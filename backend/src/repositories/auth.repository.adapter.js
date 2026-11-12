/**
 * ============================================================================
 * CareerCompass — Authentication Repository Adapter
 * ============================================================================
 * Implements AuthRepositoryInterface contract backed by an injected persistence client.
 * Aligned with docs/architecture.md §2 and docs/data-model.md §2.1 & §2.4.
 *
 * Design Invariants:
 * 1. Database-Independent Adapter:
 *    Interacts with the persistence layer through an injected `dbClient` (e.g. PrismaClient).
 *    Decouples AuthService from direct database drivers while preserving the interface contract.
 * 2. Strict Model Conformance:
 *    Uses exclusively approved Prisma model delegate names (`user`, `refreshSession`).
 *    Does not invent unapproved tables or speculative database models.
 * 3. Fail-Closed Boundaries:
 *    Validates dependencies up front. If required delegate models or transaction runners are
 *    missing, it fails closed with clear, actionable errors. Never returns dummy success.
 * 4. Token Privacy Invariant:
 *    Plaintext refresh tokens must NEVER enter persistence. Only 64-character lowercase
 *    hex SHA-256 digests (`hashedTokenId`) are accepted and stored.
 * 5. Documented Transaction Boundaries:
 *    - `createStudentUser`: Requires atomic multi-table transaction (`users` + `student_profiles`).
 *    - `rotateRefreshSession`: Requires atomic conditional update + insert transaction with row-level lock.
 *    - `revokeRefreshSessionFamily`: Requires atomic lineage update (scoped strictly to `userId`).
 * ============================================================================
 */

import { AuthRepositoryInterface } from './auth.repository.interface.js';
import {
  REVOCATION_REASONS,
  ROTATION_ERROR_CODES,
  checkRotationEligibility,
  validateSessionRecord,
  isValidSha256DigestFormat,
} from './rotation-rules.js';

export class AuthRepositoryAdapter extends AuthRepositoryInterface {
  /**
   * Instantiates the repository adapter with an injected database persistence client.
   *
   * @param {object} dependencies
   * @param {object} dependencies.dbClient - Persistence client (e.g. PrismaClient) providing `user` and `refreshSession` models
   */
  constructor({ dbClient } = {}) {
    super();

    if (!dbClient || typeof dbClient !== 'object') {
      throw new Error('AuthRepositoryAdapter requires an authoritative dbClient persistence dependency');
    }

    this.dbClient = dbClient;
  }

  /**
   * Helper verifying that required model delegate is configured on the injected client.
   *
   * @private
   * @param {'user'|'refreshSession'} delegateName
   */
  _ensureDelegate(delegateName) {
    if (!this.dbClient[delegateName] || typeof this.dbClient[delegateName] !== 'object') {
      throw new Error(`Persistence client missing required "${delegateName}" delegate model`);
    }
  }

  /**
   * Look up a user by normalized lowercase email address.
   *
   * @param {string} email
   * @returns {Promise<import('./auth.repository.interface.js').UserRecord|null>}
   */
  async findUserByEmail(email) {
    if (!email || typeof email !== 'string') {
      return null;
    }

    this._ensureDelegate('user');
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const user = await this.dbClient.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (err) {
      this._mapDatabaseError(err, 'findUserByEmail');
    }
  }

  /**
   * Look up a user by UUID primary key.
   *
   * @param {string} userId
   * @returns {Promise<import('./auth.repository.interface.js').UserRecord|null>}
   */
  async findUserById(userId) {
    if (!userId || typeof userId !== 'string') {
      return null;
    }

    this._ensureDelegate('user');

    try {
      const user = await this.dbClient.user.findUnique({
        where: { id: userId },
      });

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (err) {
      this._mapDatabaseError(err, 'findUserById');
    }
  }

  /**
   * Atomically create a new student user and linked StudentProfile in a transaction.
   *
   * Mandatory Database Transaction:
   * Inserts the `User` and `StudentProfile` atomically. If email uniqueness fails,
   * maps the database unique-constraint failure to a standardized error with code 'P2002'.
   *
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.passwordHash
   * @param {string} params.displayName
   * @param {string|null} [params.schoolGrade]
   * @param {boolean} params.consentAccepted
   * @returns {Promise<import('./auth.repository.interface.js').UserRecord>}
   */
  async createStudentUser({ email, passwordHash, displayName, schoolGrade, consentAccepted }) {
    this._ensureDelegate('user');

    // Fail closed: interactive database transaction is mandatory for multi-table creation
    if (typeof this.dbClient.$transaction !== 'function') {
      const error = new Error(
        'Database transaction capability ($transaction) is required for atomic student user creation'
      );
      error.code = 'TRANSACTION_UNAVAILABLE';
      throw error;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const creationOperation = async (client) => {
      const user = await client.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          displayName,
          role: 'STUDENT',
          status: 'ACTIVE',
          studentProfile: {
            create: {
              schoolGrade: schoolGrade || null,
              consentAccepted: Boolean(consentAccepted),
            },
          },
        },
      });

      return {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    };

    try {
      return await this.dbClient.$transaction(async (tx) => creationOperation(tx));
    } catch (err) {
      this._mapDatabaseError(err, 'createStudentUser');
    }
  }

  /**
   * Persist a new refresh session for an authenticated user.
   *
   * Token Privacy & Schema Conformance:
   * Rejects malformed values. Accepts ONLY canonical 64-character lowercase hex hash digests.
   * Note: Token privacy is an architectural invariant guaranteed upstream by `AuthService.hashToken()`;
   * this validation verifies storage column format conformance.
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.hashedTokenId - SHA-256 hex digest
   * @param {Date} params.expiresAt
   * @param {string|null} [params.rotatedFrom]
   * @returns {Promise<import('./auth.repository.interface.js').RefreshSessionRecord>}
   */
  async createRefreshSession({ userId, hashedTokenId, expiresAt, rotatedFrom = null }) {
    this._ensureDelegate('refreshSession');

    // Strict validation enforcing canonical 64-character lowercase hex digest format
    if (!isValidSha256DigestFormat(hashedTokenId)) {
      throw new Error('hashedTokenId must be a 64-character lowercase hex digest');
    }

    try {
      const session = await this.dbClient.refreshSession.create({
        data: {
          userId,
          hashedTokenId,
          expiresAt: new Date(expiresAt),
          rotatedFrom: rotatedFrom || null,
        },
      });

      return {
        id: session.id,
        userId: session.userId,
        hashedTokenId: session.hashedTokenId,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt || null,
        revokedReason: session.revokedReason || null,
        rotatedFrom: session.rotatedFrom || null,
        createdAt: session.createdAt,
      };
    } catch (err) {
      this._mapDatabaseError(err, 'createRefreshSession');
    }
  }

  /**
   * Look up a refresh session by its hashed token identifier.
   *
   * @param {string} hashedTokenId - SHA-256 hash
   * @returns {Promise<import('./auth.repository.interface.js').RefreshSessionRecord|null>}
   */
  async findRefreshSessionByHashedToken(hashedTokenId) {
    if (!hashedTokenId || typeof hashedTokenId !== 'string') {
      return null;
    }

    this._ensureDelegate('refreshSession');

    try {
      const session = await this.dbClient.refreshSession.findUnique({
        where: { hashedTokenId },
      });

      if (!session) return null;

      return {
        id: session.id,
        userId: session.userId,
        hashedTokenId: session.hashedTokenId,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt || null,
        revokedReason: session.revokedReason || null,
        rotatedFrom: session.rotatedFrom || null,
        createdAt: session.createdAt,
      };
    } catch (err) {
      this._mapDatabaseError(err, 'findRefreshSessionByHashedToken');
    }
  }

  /**
   * Look up a refresh session by its UUID primary key.
   *
   * @param {string} sessionId
   * @returns {Promise<import('./auth.repository.interface.js').RefreshSessionRecord|null>}
   */
  async findRefreshSessionById(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') {
      return null;
    }

    this._ensureDelegate('refreshSession');

    try {
      const session = await this.dbClient.refreshSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) return null;

      return {
        id: session.id,
        userId: session.userId,
        hashedTokenId: session.hashedTokenId,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt || null,
        revokedReason: session.revokedReason || null,
        rotatedFrom: session.rotatedFrom || null,
        createdAt: session.createdAt,
      };
    } catch (err) {
      this._mapDatabaseError(err, 'findRefreshSessionById');
    }
  }

  /**
   * Atomically rotate a refresh session in a single database transaction.
   *
   * Mandatory Database Transaction (Race & Concurrency Defense):
   * 1. Atomic Conditional Predecessor Revocation:
   *    Atomically marks old session as revoked IF AND ONLY IF:
   *    - id equals oldSessionId
   *    - userId equals the verified user
   *    - revokedAt IS NULL (not already revoked or rotated)
   *    - expiresAt remains in the future at the time of update
   *    If zero rows are updated, rotation fails closed immediately and returns null.
   * 2. Successor Session Insertion:
   *    Inserts new session linked via rotatedFrom = oldSessionId within the same transaction.
   * 3. Database-Level Unique Constraint:
   *    UNIQUE(rotated_from) physically guarantees that at most one successor can ever point to
   *    the predecessor session. Any racing concurrent rotation triggers rollback and returns null.
   *
   * @param {object} params
   * @param {string} params.oldSessionId
   * @param {string} params.newHashedTokenId
   * @param {Date} params.newExpiresAt
   * @param {string} params.userId
   * @returns {Promise<import('./auth.repository.interface.js').RefreshSessionRecord|null>}
   */
  async rotateRefreshSession({ oldSessionId, newHashedTokenId, newExpiresAt, userId }) {
    this._ensureDelegate('refreshSession');

    // Fail closed: interactive database transaction is mandatory for atomic rotation
    if (typeof this.dbClient.$transaction !== 'function') {
      const error = new Error(
        'Database transaction capability ($transaction) is required for atomic refresh session rotation'
      );
      error.code = 'TRANSACTION_UNAVAILABLE';
      throw error;
    }

    if (!isValidSha256DigestFormat(newHashedTokenId)) {
      throw new Error('newHashedTokenId must be a 64-character lowercase hex digest');
    }

    if (!oldSessionId || typeof oldSessionId !== 'string' || !userId || typeof userId !== 'string') {
      return null;
    }

    const rotationOperation = async (client) => {
      const now = new Date();

      // 1. Atomic Conditional Predecessor Revocation
      // Evaluates existence, ownership, non-revocation, and temporal validity in one atomic statement
      const updateResult = await client.refreshSession.updateMany({
        where: {
          id: oldSessionId,
          userId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          revokedAt: now,
          revokedReason: REVOCATION_REASONS.TOKEN_ROTATION,
        },
      });

      // If zero rows updated, fail closed immediately without creating a successor
      if (!updateResult || updateResult.count === 0) {
        return null;
      }

      // 2. Insert new successor session within the same interactive transaction
      const newSession = await client.refreshSession.create({
        data: {
          userId,
          hashedTokenId: newHashedTokenId,
          expiresAt: new Date(newExpiresAt),
          rotatedFrom: oldSessionId,
        },
      });

      return {
        id: newSession.id,
        userId: newSession.userId,
        hashedTokenId: newSession.hashedTokenId,
        expiresAt: newSession.expiresAt,
        revokedAt: newSession.revokedAt || null,
        revokedReason: newSession.revokedReason || null,
        rotatedFrom: newSession.rotatedFrom || null,
        createdAt: newSession.createdAt,
      };
    };

    try {
      return await this.dbClient.$transaction(async (tx) => rotationOperation(tx));
    } catch (err) {
      // Only classify confirmed predecessor-rotation conflicts (rotatedFrom collision) as ordinary lost races.
      // Do NOT automatically treat every Prisma P2002 error (such as hashedTokenId collision) as a lost rotation.
      if (err.code === 'P2002') {
        const target = err.meta?.target;
        const isRotatedFromConflict =
          (Array.isArray(target) && target.some((t) => t === 'rotated_from' || t === 'rotatedFrom')) ||
          (typeof target === 'string' && (target.includes('rotated_from') || target.includes('rotatedFrom')));

        if (isRotatedFromConflict) {
          // Confirmed lost rotation race: predecessor already has an inserted successor
          return null;
        }
      }
      this._mapDatabaseError(err, 'rotateRefreshSession');
    }
  }

  /**
   * Revoke an active refresh session by its session UUID.
   *
   * @param {string} sessionId
   * @param {'LOGOUT'|'EXPIRED'|'REUSE_DETECTED'|string} [reason='LOGOUT']
   * @returns {Promise<void>}
   */
  async revokeRefreshSession(sessionId, reason = REVOCATION_REASONS.LOGOUT) {
    if (!sessionId) return;
    this._ensureDelegate('refreshSession');

    try {
      await this.dbClient.refreshSession.update({
        where: { id: sessionId },
        data: {
          revokedAt: new Date(),
          revokedReason: reason,
        },
      });
    } catch (err) {
      // Ignore if session not found during idempotent revocation
      if (err.code === 'P2025') return;
      this._mapDatabaseError(err, 'revokeRefreshSession');
    }
  }

  /**
   * Revoke a refresh session by its hashed token identifier.
   *
   * @param {string} hashedTokenId
   * @returns {Promise<boolean>} True if revoked, false if not found
   */
  async revokeSessionByHashedToken(hashedTokenId) {
    if (!hashedTokenId) return false;
    this._ensureDelegate('refreshSession');

    try {
      const session = await this.dbClient.refreshSession.findUnique({
        where: { hashedTokenId },
      });

      if (!session || session.revokedAt !== null) {
        return false;
      }

      await this.dbClient.refreshSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          revokedReason: REVOCATION_REASONS.LOGOUT,
        },
      });

      return true;
    } catch (err) {
      if (err.code === 'P2025') return false;
      this._mapDatabaseError(err, 'revokeSessionByHashedToken');
    }
  }

  /**
   * Revoke all refresh sessions in a lineage or family upon reuse detection.
   * Strictly scopes traversal to `userId` to ensure zero cross-tenant contamination.
   *
   * Database Atomicity Requirement:
   * Requires PostgreSQL recursive Common Table Expression (CTE) via `$executeRaw`.
   * Fails closed if the atomic database capability is unavailable; never falls back
   * to non-atomic in-memory or iterative updates.
   *
   * @param {object} params
   * @param {string} params.sessionId
   * @param {string} params.userId
   * @returns {Promise<number>} Number of sessions revoked
   */
  async revokeRefreshSessionFamily({ sessionId, userId }) {
    if (!sessionId || !userId) return 0;
    this._ensureDelegate('refreshSession');

    // Fail closed: raw execution capability is mandatory for atomic lineage revocation
    if (typeof this.dbClient.$executeRaw !== 'function') {
      const error = new Error(
        'Database raw execution capability ($executeRaw) is required for atomic lineage-family revocation'
      );
      error.code = 'RAW_EXECUTION_UNAVAILABLE';
      throw error;
    }

    try {
      const affectedRows = await this.dbClient.$executeRaw`
        WITH RECURSIVE family_lineage AS (
          SELECT id, rotated_from, user_id FROM refresh_sessions WHERE id = ${sessionId}::uuid AND user_id = ${userId}::uuid
          UNION
          SELECT parent.id, parent.rotated_from, parent.user_id FROM refresh_sessions parent JOIN family_lineage fl ON fl.rotated_from = parent.id WHERE parent.user_id = ${userId}::uuid
        ),
        root_session AS (
          SELECT id FROM family_lineage WHERE rotated_from IS NULL
        ),
        all_descendants AS (
          SELECT id, user_id FROM refresh_sessions WHERE id IN (SELECT id FROM root_session) AND user_id = ${userId}::uuid
          UNION
          SELECT child.id, child.user_id FROM refresh_sessions child JOIN all_descendants ad ON child.rotated_from = ad.id WHERE child.user_id = ${userId}::uuid
        )
        UPDATE refresh_sessions SET revoked_at = NOW(), revoked_reason = 'TOKEN_REUSE_DETECTED'
        WHERE id IN (SELECT id FROM all_descendants) AND user_id = ${userId}::uuid AND revoked_at IS NULL;
      `;
      return typeof affectedRows === 'number' ? affectedRows : 0;
    } catch (err) {
      this._mapDatabaseError(err, 'revokeRefreshSessionFamily');
    }
  }

  /**
   * Revoke all active refresh sessions for a user (e.g. on all-device logout).
   * Defaults to ALL_DEVICES_LOGOUT revocation reason to preserve audit trail precision.
   *
   * @param {string} userId
   * @param {string} [reason=REVOCATION_REASONS.ALL_DEVICES_LOGOUT]
   * @returns {Promise<number>} Number of sessions revoked
   */
  async revokeAllUserSessions(userId, reason = REVOCATION_REASONS.ALL_DEVICES_LOGOUT) {
    if (!userId) return 0;
    this._ensureDelegate('refreshSession');

    try {
      const result = await this.dbClient.refreshSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedReason: reason,
        },
      });

      return typeof result?.count === 'number' ? result.count : 0;
    } catch (err) {
      this._mapDatabaseError(err, 'revokeAllUserSessions');
    }
  }

  /**
   * Internal database error mapper.
   * Maps Prisma and driver error codes without exposing sensitive connection data.
   *
   * @private
   * @param {Error} err
   * @param {string} operation
   */
  _mapDatabaseError(err, operation) {
    // Preserve P2002 for unique constraint conflicts
    if (err.code === 'P2002') {
      const sanitized = new Error(`Unique constraint failed during ${operation}`);
      sanitized.code = 'P2002';
      sanitized.meta = err.meta;
      throw sanitized;
    }

    // Preserve operational errors
    if (err.isOperational) {
      throw err;
    }

    // Fail closed with sanitized error
    const genericErr = new Error(`Database error occurred during ${operation}`);
    genericErr.code = err.code || 'DB_ERROR';
    throw genericErr;
  }
}
