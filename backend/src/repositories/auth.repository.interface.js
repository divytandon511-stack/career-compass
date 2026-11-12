/**
 * ============================================================================
 * CareerCompass — Authentication Repository Contract Interface
 * ============================================================================
 * Status: Interface definition and architectural contract
 * Alignment: docs/architecture.md §2, docs/data-model.md §2.1 & §2.4, docs/api-contract.md §2
 *
 * This file defines the contract for all authentication persistence operations.
 * It contains NO runtime in-memory storage. Future implementation must use
 * PostgreSQL with Prisma ORM without altering this public API.
 *
 * MANDATORY ATOMICITY & CONCURRENCY GUARANTEES FOR PRISMA IMPLEMENTATION:
 * ----------------------------------------------------------------------------
 * 1. Atomic Student Account Creation:
 *    Must execute within a single Prisma interactive transaction (`prisma.$transaction`).
 *    Inserts the `User` (role=STUDENT, status=ACTIVE) and 1:1 `StudentProfile`
 *    (schoolGrade, consentAccepted) atomically. If email uniqueness fails,
 *    it must throw a unique constraint violation error (e.g. Prisma code P2002).
 *
 * 2. Atomic Refresh Session Rotation (Concurrency & Race Defense):
 *    Must execute within a single Prisma interactive transaction.
 *    - Query the old session with row-level lock (`SELECT ... FOR UPDATE` or conditional update).
 *    - Verify `oldSession.revokedAt === null`.
 *    - If already revoked (race condition or token reuse), ABORT and return null or throw.
 *    - Atomically update `oldSession.revokedAt = now()`.
 *    - Insert new `RefreshSession` with `rotatedFrom = oldSession.id`.
 *    - Guarantees exactly one concurrent rotation succeeds; racing attempts fail.
 *
 * 3. Safe Lineage-Aware Family Revocation (Reuse Detection Defense):
 *    When reuse of an already-rotated token is detected, all sessions in the lineage
 *    family must be revoked atomically. Because docs/data-model.md defines `rotated_from`
 *    without a dedicated `family_id` column, the PostgreSQL implementation must use:
 *    a) A recursive Common Table Expression (CTE) walking `rotated_from` to identify the
 *       root session and all descendants, atomically setting `revoked_at = NOW()`.
 *    b) As an immediate containment fallback, atomically revoke all active sessions for
 *       the user: `UPDATE refresh_sessions SET revoked_at = NOW() WHERE user_id = :userId AND revoked_at IS NULL`.
 *
 * 4. Token Privacy Invariant:
 *    Plaintext refresh tokens must NEVER be passed to or stored by the repository.
 *    Only deterministic SHA-256 digests (`hashedTokenId`) are persisted, matching
 *    the `hashed_token_id VARCHAR(255)` column with `INDEX(hashed_token_id)`.
 *
 * 5. Database Constraints Required for Security:
 *    - `users.email`: UNIQUE constraint (case-insensitive or normalized lowercase)
 *    - `refresh_sessions.id`: UUID PRIMARY KEY
 *    - `refresh_sessions.user_id`: FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE
 *    - `refresh_sessions.hashed_token_id`: UNIQUE or INDEXED VARCHAR(255)
 *    - `refresh_sessions.rotated_from`: FOREIGN KEY REFERENCES refresh_sessions(id) ON DELETE SET NULL
 * ============================================================================
 */

/**
 * @typedef {Object} UserRecord
 * @property {string} id - UUID primary key
 * @property {string} email - Normalized unique email address
 * @property {string} passwordHash - Argon2id encoded password hash
 * @property {string} displayName - User display name
 * @property {'STUDENT'|'COUNSELLOR'|'ADMIN'} role - Authoritative user role
 * @property {'ACTIVE'|'SUSPENDED'} status - Authoritative account status
 * @property {Date} createdAt - Timestamp of creation
 * @property {Date} updatedAt - Timestamp of last update
 */

/**
 * @typedef {Object} RefreshSessionRecord
 * @property {string} id - UUID primary key
 * @property {string} userId - Foreign key referencing User.id
 * @property {string} hashedTokenId - SHA-256 hex digest of the opaque refresh token
 * @property {Date} expiresAt - Absolute expiry timestamp (proposed 7 days)
 * @property {Date|null} revokedAt - Revocation timestamp (null if currently active)
 * @property {'TOKEN_ROTATION'|'ROTATED'|'LOGOUT'|'ALL_DEVICES_LOGOUT'|'TOKEN_REUSE_DETECTED'|'REUSE_DETECTED'|'ACCOUNT_SUSPENDED'|'SECURITY_RESET'|'EXPIRED'|null} [revokedReason] - Explicit reason for revocation
 * @property {string|null} rotatedFrom - Foreign key referencing previous session id in chain
 * @property {Date} createdAt - Timestamp of creation
 */

/**
 * Base contract for authentication repositories.
 * Throws if methods are invoked without an authoritative database implementation.
 */
export class AuthRepositoryInterface {
  /**
   * Look up a user by normalized lowercase email address.
   *
   * @param {string} email - Normalized email
   * @returns {Promise<UserRecord|null>}
   */
  async findUserByEmail(email) {
    throw new Error('AuthRepositoryInterface.findUserByEmail must be implemented by database repository');
  }

  /**
   * Look up a user by immutable UUID primary key.
   *
   * @param {string} userId - User UUID
   * @returns {Promise<UserRecord|null>}
   */
  async findUserById(userId) {
    throw new Error('AuthRepositoryInterface.findUserById must be implemented by database repository');
  }

  /**
   * Atomically create a new student user and linked StudentProfile in a transaction.
   *
   * Transaction requirements:
   * - Must create User with role='STUDENT', status='ACTIVE'.
   * - Must create linked StudentProfile with schoolGrade and consentAccepted.
   * - If email violates UNIQUE constraint, must throw error with code 'P2002' or code 'CONFLICT'.
   *
   * @param {object} params
   * @param {string} params.email - Normalized lowercase email
   * @param {string} params.passwordHash - Argon2id hash
   * @param {string} params.displayName - Display name
   * @param {string|null} [params.schoolGrade] - Grade ("9", "10", "11", "12")
   * @param {boolean} params.consentAccepted - Consent flag
   * @returns {Promise<UserRecord>} Created user record
   */
  async createStudentUser(params) {
    throw new Error('AuthRepositoryInterface.createStudentUser must be implemented by database repository');
  }

  /**
   * Persist a new refresh session for an authenticated user.
   * Plaintext tokens must never be passed to this method; only hashedTokenId.
   *
   * @param {object} params
   * @param {string} params.userId - User UUID
   * @param {string} params.hashedTokenId - SHA-256 hash of opaque token
   * @param {Date} params.expiresAt - Expiry timestamp
   * @param {string|null} [params.rotatedFrom] - Predecessor session UUID if rotated
   * @returns {Promise<RefreshSessionRecord>} Created session record
   */
  async createRefreshSession(params) {
    throw new Error('AuthRepositoryInterface.createRefreshSession must be implemented by database repository');
  }

  /**
   * Look up a refresh session by its hashed token identifier.
   *
   * @param {string} hashedTokenId - SHA-256 hash of opaque token
   * @returns {Promise<RefreshSessionRecord|null>}
   */
  async findRefreshSessionByHashedToken(hashedTokenId) {
    throw new Error('AuthRepositoryInterface.findRefreshSessionByHashedToken must be implemented by database repository');
  }

  /**
   * Look up a refresh session by its UUID primary key.
   *
   * @param {string} sessionId - Session UUID
   * @returns {Promise<RefreshSessionRecord|null>}
   */
  async findRefreshSessionById(sessionId) {
    throw new Error('AuthRepositoryInterface.findRefreshSessionById must be implemented by database repository');
  }

  /**
   * Atomically rotate a refresh session in a single database transaction.
   *
   * Atomicity guarantees:
   * - Conditionally updates oldSession setting revokedAt = NOW(), revokedReason = 'TOKEN_ROTATION'
   *   (or 'ROTATED' for legacy compatibility) WHERE id = oldSessionId AND revokedAt IS NULL.
   * - If old session was already revoked (e.g. concurrent race condition), must return null or abort.
   * - Creates new session linked via rotatedFrom = oldSessionId.
   *
   * @param {object} params
   * @param {string} params.oldSessionId - ID of active session being rotated
   * @param {string} params.newHashedTokenId - SHA-256 hash of new replacement token
   * @param {Date} params.newExpiresAt - Expiry timestamp of new replacement token
   * @param {string} params.userId - User UUID
   * @returns {Promise<RefreshSessionRecord|null>} Newly created replacement session, or null if rotation raced/failed
   */
  async rotateRefreshSession(params) {
    throw new Error('AuthRepositoryInterface.rotateRefreshSession must be implemented by database repository');
  }

  /**
   * Revoke an active refresh session by its session UUID.
   *
   * @param {string} sessionId - Session UUID
   * @param {'LOGOUT'|'EXPIRED'|'REUSE_DETECTED'} [reason='LOGOUT'] - Reason for revocation
   * @returns {Promise<void>}
   */
  async revokeRefreshSession(sessionId, reason = 'LOGOUT') {
    throw new Error('AuthRepositoryInterface.revokeRefreshSession must be implemented by database repository');
  }

  /**
   * Revoke a refresh session by its hashed token identifier.
   * Used during single-session logout to invalidate the current refresh cookie.
   *
   * @param {string} hashedTokenId - SHA-256 hash of opaque token
   * @returns {Promise<boolean>} True if a session was revoked, false if not found
   */
  async revokeSessionByHashedToken(hashedTokenId) {
    throw new Error('AuthRepositoryInterface.revokeSessionByHashedToken must be implemented by database repository');
  }

  /**
   * Revoke all refresh sessions in a lineage or family upon reuse detection.
   *
   * Implementation strategy:
   * In PostgreSQL/Prisma, this must traverse the `rotatedFrom` chain using a recursive CTE,
   * setting `revoked_at = NOW()` and `revoked_reason = 'REUSE_DETECTED'` on all descendants,
   * or atomically revoke all active sessions for the user if the lineage cannot be disambiguated.
   *
   * @param {object} params
   * @param {string} params.sessionId - Session UUID where reuse was detected
   * @param {string} params.userId - Account owner UUID
   * @returns {Promise<number>} Number of sessions revoked
   */
  async revokeRefreshSessionFamily(params) {
    throw new Error('AuthRepositoryInterface.revokeRefreshSessionFamily must be implemented by database repository');
  }

  /**
   * Revoke all active refresh sessions for a user (e.g. on all-device logout or password reset).
   *
   * @param {string} userId - User UUID
   * @returns {Promise<number>} Number of sessions revoked
   */
  async revokeAllUserSessions(userId) {
    throw new Error('AuthRepositoryInterface.revokeAllUserSessions must be implemented by database repository');
  }
}
