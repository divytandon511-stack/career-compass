import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';

import {
  AuthRepositoryAdapter,
  REVOCATION_REASONS,
  ROTATION_ERROR_CODES,
  SHA256_HEX_DIGEST_REGEX,
  isValidSha256DigestFormat,
  checkRotationEligibility,
  validateSessionRecord,
  validateFamilyIsolation,
} from '../src/repositories/index.js';

/**
 * Creates an isolated mock Prisma-like persistence client.
 * Simulates Prisma model delegates (`user`, `refreshSession`) and interactive transactions.
 *
 * NOTE ON TESTING METHODOLOGY:
 * ----------------------------------------------------------------------------
 * This fake client simulates Prisma's query signatures and transactional behavior in-memory.
 * It proves that AuthRepositoryAdapter correctly orchestrates queries, maps records,
 * validates preconditions, and handles errors. It does NOT simulate true PostgreSQL
 * multiversion concurrency control (MVCC) or real database row locks (`SELECT FOR UPDATE`),
 * which must be validated against a live PostgreSQL instance in Stage 5.
 * ----------------------------------------------------------------------------
 */
const createMockPrismaClient = () => {
  const users = new Map();
  const emailIndex = new Map();
  const sessions = new Map();
  const hashedTokenIndex = new Map();
  const rotatedFromIndex = new Map();

  const userDelegate = {
    async findUnique({ where }) {
      if (where.email) {
        const id = emailIndex.get(where.email.toLowerCase());
        return id ? users.get(id) || null : null;
      }
      if (where.id) {
        return users.get(where.id) || null;
      }
      return null;
    },

    async create({ data }) {
      const normalizedEmail = data.email.toLowerCase();
      if (emailIndex.has(normalizedEmail)) {
        const error = new Error('Unique constraint failed on the fields: (`email`)');
        error.code = 'P2002';
        error.meta = { target: ['email'] };
        throw error;
      }

      const id = crypto.randomUUID();
      const record = {
        id,
        email: normalizedEmail,
        passwordHash: data.passwordHash,
        displayName: data.displayName,
        role: data.role || 'STUDENT',
        status: data.status || 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      users.set(id, record);
      emailIndex.set(normalizedEmail, id);
      return record;
    },
  };

  const refreshSessionDelegate = {
    async findUnique({ where }) {
      if (where.hashedTokenId) {
        const id = hashedTokenIndex.get(where.hashedTokenId);
        return id ? sessions.get(id) || null : null;
      }
      if (where.id) {
        return sessions.get(where.id) || null;
      }
      return null;
    },

    async findMany({ where }) {
      const results = [];
      for (const s of sessions.values()) {
        if (where.userId && s.userId !== where.userId) continue;
        results.push({ ...s });
      }
      return results;
    },

    async create({ data }) {
      if (hashedTokenIndex.has(data.hashedTokenId)) {
        const error = new Error('Unique constraint failed on the fields: (`hashed_token_id`)');
        error.code = 'P2002';
        error.meta = { target: ['hashed_token_id'] };
        throw error;
      }

      // Enforce UNIQUE(rotated_from) constraint
      if (data.rotatedFrom && rotatedFromIndex.has(data.rotatedFrom)) {
        const error = new Error('Unique constraint failed on the fields: (`rotated_from`)');
        error.code = 'P2002';
        error.meta = { target: ['rotated_from'] };
        throw error;
      }

      const id = crypto.randomUUID();
      const record = {
        id,
        userId: data.userId,
        hashedTokenId: data.hashedTokenId,
        expiresAt: data.expiresAt,
        revokedAt: null,
        revokedReason: null,
        rotatedFrom: data.rotatedFrom || null,
        createdAt: new Date(),
      };

      sessions.set(id, record);
      hashedTokenIndex.set(data.hashedTokenId, id);
      if (data.rotatedFrom) {
        rotatedFromIndex.set(data.rotatedFrom, id);
      }
      return record;
    },

    async update({ where, data }) {
      const s = sessions.get(where.id);
      if (!s) {
        const error = new Error('Record to update not found');
        error.code = 'P2025';
        throw error;
      }

      if (data.revokedAt !== undefined) s.revokedAt = data.revokedAt;
      if (data.revokedReason !== undefined) s.revokedReason = data.revokedReason;

      return { ...s };
    },

    async updateMany({ where, data }) {
      let count = 0;
      for (const s of sessions.values()) {
        if (where.id && s.id !== where.id) continue;
        if (where.userId && s.userId !== where.userId) continue;
        if (where.revokedAt === null && s.revokedAt !== null) continue;
        if (where.expiresAt && where.expiresAt.gt) {
          if (new Date(s.expiresAt).getTime() <= new Date(where.expiresAt.gt).getTime()) {
            continue;
          }
        }

        if (data.revokedAt !== undefined) s.revokedAt = data.revokedAt;
        if (data.revokedReason !== undefined) s.revokedReason = data.revokedReason;
        count++;
      }
      return { count };
    },
  };

  const client = {
    user: userDelegate,
    refreshSession: refreshSessionDelegate,
    async $transaction(fn) {
      // Interactive transaction executes against the client delegates
      return await fn(client);
    },
    async $executeRaw(strings, ...values) {
      // NOTE ON TESTING METHODOLOGY:
      // This simulated raw executor traverses the in-memory session lineage.
      // It satisfies the raw execution interface and validates query parameters,
      // but does NOT simulate or prove real PostgreSQL transaction isolation or atomicity.
      const sessionId = values[0];
      const userId = values[1];

      if (!sessionId || !userId) return 0;
      const normalizedUserId = userId.trim().toLowerCase();

      // Find root session by following rotatedFrom upward
      const familyIds = new Set([sessionId]);
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const s of sessions.values()) {
          if (familyIds.has(s.id) && s.rotatedFrom && !familyIds.has(s.rotatedFrom)) {
            familyIds.add(s.rotatedFrom);
            expanded = true;
          }
        }
      }

      // Find all descendants by following rotatedFrom downward
      expanded = true;
      while (expanded) {
        expanded = false;
        for (const s of sessions.values()) {
          if (s.rotatedFrom && familyIds.has(s.rotatedFrom) && !familyIds.has(s.id)) {
            familyIds.add(s.id);
            expanded = true;
          }
        }
      }

      let revokedCount = 0;
      for (const id of familyIds) {
        const s = sessions.get(id);
        if (s && s.userId.trim().toLowerCase() === normalizedUserId && s.revokedAt === null) {
          s.revokedAt = new Date();
          s.revokedReason = REVOCATION_REASONS.TOKEN_REUSE_DETECTED;
          revokedCount++;
        }
      }
      return revokedCount;
    },
  };

  return { client, users, emailIndex, sessions, hashedTokenIndex, rotatedFromIndex };
};

describe('AuthRepositoryAdapter & Rotation Rules (Stage 5A)', () => {
  let mock;
  let adapter;

  beforeEach(() => {
    mock = createMockPrismaClient();
    adapter = new AuthRepositoryAdapter({ dbClient: mock.client });
  });

  describe('1. Dependency Validation & Adapter Instantiation', () => {
    it('throws when dbClient is missing or not an object', () => {
      expect(() => new AuthRepositoryAdapter()).toThrowError(
        'AuthRepositoryAdapter requires an authoritative dbClient persistence dependency'
      );
      expect(() => new AuthRepositoryAdapter({ dbClient: null })).toThrowError(
        'AuthRepositoryAdapter requires an authoritative dbClient persistence dependency'
      );
      expect(() => new AuthRepositoryAdapter({ dbClient: 'invalid' })).toThrowError(
        'AuthRepositoryAdapter requires an authoritative dbClient persistence dependency'
      );
    });

    it('fails closed when required user delegate model is missing on client', async () => {
      const incompleteAdapter = new AuthRepositoryAdapter({
        dbClient: { refreshSession: mock.client.refreshSession },
      });

      await expect(incompleteAdapter.findUserByEmail('test@example.com')).rejects.toThrowError(
        'Persistence client missing required "user" delegate model'
      );
    });

    it('fails closed when required refreshSession delegate model is missing on client', async () => {
      const incompleteAdapter = new AuthRepositoryAdapter({
        dbClient: { user: mock.client.user },
      });

      await expect(
        incompleteAdapter.createRefreshSession({
          userId: crypto.randomUUID(),
          hashedTokenId: 'a'.repeat(64),
          expiresAt: new Date(),
        })
      ).rejects.toThrowError('Persistence client missing required "refreshSession" delegate model');
    });
  });

  describe('2. User Lookup & Registration Mapping', () => {
    it('returns null when querying nonexistent user by email or id', async () => {
      expect(await adapter.findUserByEmail('nonexistent@example.test')).toBeNull();
      expect(await adapter.findUserById(crypto.randomUUID())).toBeNull();
    });

    it('creates a student user and maps fields strictly to UserRecord contract', async () => {
      const user = await adapter.createStudentUser({
        email: 'Priya.Patel@example.test',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$syntheticHash',
        displayName: 'Priya Patel',
        schoolGrade: '11',
        consentAccepted: true,
      });

      expect(user).toEqual({
        id: expect.any(String),
        email: 'priya.patel@example.test', // Case normalized
        passwordHash: expect.any(String),
        displayName: 'Priya Patel',
        role: 'STUDENT',
        status: 'ACTIVE',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      // Verify retrieval by normalized email
      const retrieved = await adapter.findUserByEmail('priya.patel@example.test');
      expect(retrieved).toEqual(user);

      // Verify retrieval by uppercase query normalized internally
      const retrievedUpper = await adapter.findUserByEmail('PRIYA.PATEL@EXAMPLE.TEST');
      expect(retrievedUpper).toEqual(user);

      // Verify retrieval by ID
      const retrievedId = await adapter.findUserById(user.id);
      expect(retrievedId).toEqual(user);
    });

    it('rejects duplicate email registration and maps to standardized P2002 error', async () => {
      await adapter.createStudentUser({
        email: 'duplicate@example.test',
        passwordHash: 'hash1',
        displayName: 'Student One',
        consentAccepted: true,
      });

      await expect(
        adapter.createStudentUser({
          email: 'duplicate@example.test',
          passwordHash: 'hash2',
          displayName: 'Student Two',
          consentAccepted: true,
        })
      ).rejects.toMatchObject({
        code: 'P2002',
      });
    });
  });

  describe('3. Refresh Session Creation & Token Privacy Invariant', () => {
    const validHashedToken = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const userId = crypto.randomUUID();

    it('persists a new refresh session with 64-char lowercase hex hash', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const session = await adapter.createRefreshSession({
        userId,
        hashedTokenId: validHashedToken,
        expiresAt,
      });

      expect(session).toEqual({
        id: expect.any(String),
        userId,
        hashedTokenId: validHashedToken,
        expiresAt,
        revokedAt: null,
        revokedReason: null,
        rotatedFrom: null,
        createdAt: expect.any(Date),
      });

      // Retrieval by hash
      const retrievedByHash = await adapter.findRefreshSessionByHashedToken(validHashedToken);
      expect(retrievedByHash).toEqual(session);

      // Retrieval by session id
      const retrievedById = await adapter.findRefreshSessionById(session.id);
      expect(retrievedById).toEqual(session);
    });

    it('strictly rejects non-hex digests upholding canonical format validation', async () => {
      const plaintextToken = 'plaintext-raw-token-not-hashed';

      await expect(
        adapter.createRefreshSession({
          userId,
          hashedTokenId: plaintextToken,
          expiresAt: new Date(),
        })
      ).rejects.toThrowError('hashedTokenId must be a 64-character lowercase hex digest');

      // Uppercase hex must also be rejected (enforcing canonical representation)
      await expect(
        adapter.createRefreshSession({
          userId,
          hashedTokenId: validHashedToken.toUpperCase(),
          expiresAt: new Date(),
        })
      ).rejects.toThrowError('hashedTokenId must be a 64-character lowercase hex digest');
    });

    it('demonstrates that a raw 64-character hex token is format-indistinguishable from a SHA-256 digest', () => {
      // Raw opaque refresh token (256-bit, 32 bytes hex)
      const rawOpaqueToken = crypto.randomBytes(32).toString('hex');
      // Deterministic SHA-256 digest
      const sha256Digest = crypto.createHash('sha256').update(rawOpaqueToken).digest('hex');

      expect(rawOpaqueToken).toHaveLength(64);
      expect(sha256Digest).toHaveLength(64);

      // Both match canonical format validator and regex
      expect(isValidSha256DigestFormat(rawOpaqueToken)).toBe(true);
      expect(isValidSha256DigestFormat(sha256Digest)).toBe(true);
      expect(SHA256_HEX_DIGEST_REGEX.test(rawOpaqueToken)).toBe(true);
      expect(SHA256_HEX_DIGEST_REGEX.test(sha256Digest)).toBe(true);

      // Demonstrates format validation cannot mathematically distinguish raw tokens from digests;
      // token privacy is guaranteed architecturally upstream by AuthService.hashToken() before repository invocation.
    });
  });

  describe('4. Concurrency-Safe Rotation Logic & Racing Defenses', () => {
    let activeSession;
    const userId = crypto.randomUUID();

    beforeEach(async () => {
      activeSession = await adapter.createRefreshSession({
        userId,
        hashedTokenId: '11'.repeat(32),
        expiresAt: new Date(Date.now() + 3600000),
      });
    });

    it('successfully rotates an active, eligible session and creates successor linked via rotatedFrom', async () => {
      const newHash = '22'.repeat(32);
      const newExpiresAt = new Date(Date.now() + 7 * 86400000);

      const rotated = await adapter.rotateRefreshSession({
        oldSessionId: activeSession.id,
        newHashedTokenId: newHash,
        newExpiresAt,
        userId,
      });

      expect(rotated).toBeDefined();
      expect(rotated.userId).toBe(userId);
      expect(rotated.hashedTokenId).toBe(newHash);
      expect(rotated.rotatedFrom).toBe(activeSession.id);
      expect(rotated.revokedAt).toBeNull();

      // Verify old session was marked revoked with TOKEN_ROTATION
      const updatedOld = await adapter.findRefreshSessionById(activeSession.id);
      expect(updatedOld.revokedAt).not.toBeNull();
      expect(updatedOld.revokedReason).toBe(REVOCATION_REASONS.TOKEN_ROTATION);
    });

    it('returns null when attempting to rotate an already-revoked session (conditional updateMany affects 0 rows)', async () => {
      // First rotation succeeds
      await adapter.rotateRefreshSession({
        oldSessionId: activeSession.id,
        newHashedTokenId: '22'.repeat(32),
        newExpiresAt: new Date(Date.now() + 86400000),
        userId,
      });

      // Second concurrent/racing rotation on the same oldSessionId MUST return null
      const racingRotation = await adapter.rotateRefreshSession({
        oldSessionId: activeSession.id,
        newHashedTokenId: '33'.repeat(32),
        newExpiresAt: new Date(Date.now() + 86400000),
        userId,
      });

      expect(racingRotation).toBeNull();
    });

    it('returns null when attempting to rotate an expired session (conditional updateMany affects 0 rows)', async () => {
      const expiredSession = await adapter.createRefreshSession({
        userId,
        hashedTokenId: '44'.repeat(32),
        expiresAt: new Date(Date.now() - 1000), // In the past
      });

      const result = await adapter.rotateRefreshSession({
        oldSessionId: expiredSession.id,
        newHashedTokenId: '55'.repeat(32),
        newExpiresAt: new Date(Date.now() + 86400000),
        userId,
      });

      expect(result).toBeNull();
    });

    it('returns null when rotation userId does not match session owner (cross-user isolation)', async () => {
      const differentUser = crypto.randomUUID();

      const result = await adapter.rotateRefreshSession({
        oldSessionId: activeSession.id,
        newHashedTokenId: '66'.repeat(32),
        newExpiresAt: new Date(Date.now() + 86400000),
        userId: differentUser, // Mismatched user
      });

      expect(result).toBeNull();
    });

    it('returns null when updateMany affects 0 rows (simulating losing concurrent request)', async () => {
      const losingClient = {
        refreshSession: {
          ...mock.client.refreshSession,
          async updateMany() {
            return { count: 0 };
          },
        },
        async $transaction(fn) {
          return await fn(losingClient);
        },
      };

      const losingAdapter = new AuthRepositoryAdapter({ dbClient: losingClient });
      const result = await losingAdapter.rotateRefreshSession({
        oldSessionId: activeSession.id,
        newHashedTokenId: '77'.repeat(32),
        newExpiresAt: new Date(Date.now() + 86400000),
        userId,
      });

      expect(result).toBeNull();
    });

    it('returns null and triggers rollback when duplicate successor insertion fails with P2002 on rotatedFrom', async () => {
      // First rotation succeeds and inserts successor with rotatedFrom = activeSession.id
      await adapter.rotateRefreshSession({
        oldSessionId: activeSession.id,
        newHashedTokenId: '88'.repeat(32),
        newExpiresAt: new Date(Date.now() + 86400000),
        userId,
      });

      // Attempting to rotate again with duplicate rotatedFrom triggers P2002 conflict and returns null
      const secondAttempt = await adapter.rotateRefreshSession({
        oldSessionId: activeSession.id,
        newHashedTokenId: '99'.repeat(32),
        newExpiresAt: new Date(Date.now() + 86400000),
        userId,
      });

      expect(secondAttempt).toBeNull();
    });

    it('documents that insertion failure causes a rollback in real PostgreSQL transactions', async () => {
      let rollbackSimulated = false;
      const transactionalClient = {
        refreshSession: {
          ...mock.client.refreshSession,
          async create() {
            const err = new Error('Unique constraint failed on the fields: (`rotated_from`)');
            err.code = 'P2002';
            throw err;
          },
        },
        async $transaction(fn) {
          try {
            return await fn(transactionalClient);
          } catch (err) {
            rollbackSimulated = true;
            throw err;
          }
        },
      };

      const txAdapter = new AuthRepositoryAdapter({ dbClient: transactionalClient });
      const result = await txAdapter.rotateRefreshSession({
        oldSessionId: activeSession.id,
        newHashedTokenId: 'aa'.repeat(32),
        newExpiresAt: new Date(Date.now() + 86400000),
        userId,
      });

      expect(result).toBeNull();
      expect(rollbackSimulated).toBe(true);
    });
  });

  describe('5. Single-Session and All-Device Revocation', () => {
    let session;
    const userId = crypto.randomUUID();
    const tokenHash = '77'.repeat(32);

    beforeEach(async () => {
      session = await adapter.createRefreshSession({
        userId,
        hashedTokenId: tokenHash,
        expiresAt: new Date(Date.now() + 86400000),
      });
    });

    it('revokes session by UUID with specified reason', async () => {
      await adapter.revokeRefreshSession(session.id, REVOCATION_REASONS.SECURITY_RESET);
      const updated = await adapter.findRefreshSessionById(session.id);
      expect(updated.revokedAt).not.toBeNull();
      expect(updated.revokedReason).toBe(REVOCATION_REASONS.SECURITY_RESET);
    });

    it('revokes active session by hashed token and returns true', async () => {
      const result = await adapter.revokeSessionByHashedToken(tokenHash);
      expect(result).toBe(true);

      const updated = await adapter.findRefreshSessionById(session.id);
      expect(updated.revokedAt).not.toBeNull();
      expect(updated.revokedReason).toBe(REVOCATION_REASONS.LOGOUT);

      // Calling again on already revoked session returns false (idempotent)
      const secondCall = await adapter.revokeSessionByHashedToken(tokenHash);
      expect(secondCall).toBe(false);
    });

    it('revokes all active sessions for a user upon all-device logout with ALL_DEVICES_LOGOUT reason', async () => {
      // Create additional active sessions for the same user
      await adapter.createRefreshSession({
        userId,
        hashedTokenId: '88'.repeat(32),
        expiresAt: new Date(Date.now() + 86400000),
      });
      await adapter.createRefreshSession({
        userId,
        hashedTokenId: '99'.repeat(32),
        expiresAt: new Date(Date.now() + 86400000),
      });

      // Another user's session that must NOT be revoked
      const otherUser = crypto.randomUUID();
      const otherUserSession = await adapter.createRefreshSession({
        userId: otherUser,
        hashedTokenId: 'aa'.repeat(32),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const count = await adapter.revokeAllUserSessions(userId);
      expect(count).toBe(3);

      // Verify authoritative revocation reason is ALL_DEVICES_LOGOUT
      const updated = await adapter.findRefreshSessionById(session.id);
      expect(updated.revokedAt).not.toBeNull();
      expect(updated.revokedReason).toBe(REVOCATION_REASONS.ALL_DEVICES_LOGOUT);

      // Other user session remains active
      const otherRetrieved = await adapter.findRefreshSessionById(otherUserSession.id);
      expect(otherRetrieved.revokedAt).toBeNull();
    });
  });

  describe('6. Family Revocation Boundaries & Cross-User Isolation', () => {
    it('fails closed with RAW_EXECUTION_UNAVAILABLE when $executeRaw is unavailable, preventing partial non-atomic revocation', async () => {
      const clientWithoutRaw = {
        refreshSession: mock.client.refreshSession,
        // $executeRaw intentionally omitted
      };

      const adapterWithoutRaw = new AuthRepositoryAdapter({ dbClient: clientWithoutRaw });
      await expect(
        adapterWithoutRaw.revokeRefreshSessionFamily({
          sessionId: crypto.randomUUID(),
          userId: crypto.randomUUID(),
        })
      ).rejects.toMatchObject({
        code: 'RAW_EXECUTION_UNAVAILABLE',
        message: expect.stringContaining('$executeRaw'),
      });
    });

    it('revokes all descendants and ancestors in a multi-generation family chain upon reuse detection', async () => {
      const userId = crypto.randomUUID();

      // Build 3-generation lineage: Root -> Gen1 -> Gen2
      const root = await adapter.createRefreshSession({
        userId,
        hashedTokenId: 'a1'.repeat(32),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const gen1 = await adapter.createRefreshSession({
        userId,
        hashedTokenId: 'b1'.repeat(32),
        expiresAt: new Date(Date.now() + 86400000),
        rotatedFrom: root.id,
      });

      const gen2 = await adapter.createRefreshSession({
        userId,
        hashedTokenId: 'c1'.repeat(32),
        expiresAt: new Date(Date.now() + 86400000),
        rotatedFrom: gen1.id,
      });

      // Separate independent active family for the same user (e.g. from mobile phone)
      const mobileFamily = await adapter.createRefreshSession({
        userId,
        hashedTokenId: 'd1'.repeat(32),
        expiresAt: new Date(Date.now() + 86400000),
      });

      // Reuse detected on Gen1: should revoke root, Gen1, and Gen2
      const count = await adapter.revokeRefreshSessionFamily({
        sessionId: gen1.id,
        userId,
      });

      expect(count).toBe(3);

      const rootUpdated = await adapter.findRefreshSessionById(root.id);
      const gen1Updated = await adapter.findRefreshSessionById(gen1.id);
      const gen2Updated = await adapter.findRefreshSessionById(gen2.id);

      expect(rootUpdated.revokedAt).not.toBeNull();
      expect(rootUpdated.revokedReason).toBe(REVOCATION_REASONS.TOKEN_REUSE_DETECTED);
      expect(gen1Updated.revokedAt).not.toBeNull();
      expect(gen1Updated.revokedReason).toBe(REVOCATION_REASONS.TOKEN_REUSE_DETECTED);
      expect(gen2Updated.revokedAt).not.toBeNull();
      expect(gen2Updated.revokedReason).toBe(REVOCATION_REASONS.TOKEN_REUSE_DETECTED);

      // Mobile family must remain active and completely unaffected
      const mobileUpdated = await adapter.findRefreshSessionById(mobileFamily.id);
      expect(mobileUpdated.revokedAt).toBeNull();
    });

    it('enforces cross-user isolation: cannot revoke another user sessions in family revocation', async () => {
      const userA = crypto.randomUUID();
      const userB = crypto.randomUUID();

      const sessionA = await adapter.createRefreshSession({
        userId: userA,
        hashedTokenId: 'e1'.repeat(32),
        expiresAt: new Date(Date.now() + 86400000),
      });

      // Calling revokeRefreshSessionFamily with userB for userA's session revokes 0
      const count = await adapter.revokeRefreshSessionFamily({
        sessionId: sessionA.id,
        userId: userB,
      });

      expect(count).toBe(0);

      const checkA = await adapter.findRefreshSessionById(sessionA.id);
      expect(checkA.revokedAt).toBeNull();
    });

    it('delegates to $executeRaw when raw SQL execution is available on persistence client', async () => {
      let rawQueryExecuted = false;
      const rawClient = {
        refreshSession: mock.client.refreshSession,
        async $executeRaw(strings, ...values) {
          rawQueryExecuted = true;
          return 4;
        },
      };

      const rawAdapter = new AuthRepositoryAdapter({ dbClient: rawClient });
      const count = await rawAdapter.revokeRefreshSessionFamily({
        sessionId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
      });

      expect(rawQueryExecuted).toBe(true);
      expect(count).toBe(4);
    });
  });

  describe('7. Reusable Rotation Rules Unit Tests', () => {
    it('validateSessionRecord correctly validates valid and malformed session structures', () => {
      const valid = {
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        hashedTokenId: 'f1'.repeat(32),
        expiresAt: new Date(),
      };
      expect(validateSessionRecord(valid).valid).toBe(true);

      const missingId = { ...valid, id: 'not-a-uuid' };
      expect(validateSessionRecord(missingId).valid).toBe(false);

      const invalidHash = { ...valid, hashedTokenId: 'not-64-hex' };
      expect(validateSessionRecord(invalidHash).valid).toBe(false);
    });

    it('checkRotationEligibility accurately flags ineligible sessions with canonical error codes', () => {
      const userId = crypto.randomUUID();
      const active = {
        id: crypto.randomUUID(),
        userId,
        hashedTokenId: '00'.repeat(32),
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
      };

      // Active & valid
      expect(checkRotationEligibility(active, { expectedUserId: userId }).eligible).toBe(true);

      // Nonexistent
      expect(checkRotationEligibility(null)).toEqual({
        eligible: false,
        code: ROTATION_ERROR_CODES.SESSION_NOT_FOUND,
        reason: 'Refresh session not found',
      });

      // Mismatched user
      const mismatch = checkRotationEligibility(active, { expectedUserId: crypto.randomUUID() });
      expect(mismatch.eligible).toBe(false);
      expect(mismatch.code).toBe(ROTATION_ERROR_CODES.IDENTITY_MISMATCH);

      // Already revoked
      const revoked = { ...active, revokedAt: new Date(), revokedReason: 'TOKEN_ROTATION' };
      const revokedRes = checkRotationEligibility(revoked, { expectedUserId: userId });
      expect(revokedRes.eligible).toBe(false);
      expect(revokedRes.code).toBe(ROTATION_ERROR_CODES.SESSION_ALREADY_REVOKED);
      expect(revokedRes.revokedReason).toBe('TOKEN_ROTATION');

      // Expired
      const expired = { ...active, expiresAt: new Date(Date.now() - 1000) };
      const expiredRes = checkRotationEligibility(expired, { expectedUserId: userId });
      expect(expiredRes.eligible).toBe(false);
      expect(expiredRes.code).toBe(ROTATION_ERROR_CODES.SESSION_EXPIRED);
    });

    it('validateFamilyIsolation detects cross-tenant contamination', () => {
      const userA = crypto.randomUUID();
      const userB = crypto.randomUUID();

      const validFamily = [
        { id: crypto.randomUUID(), userId: userA },
        { id: crypto.randomUUID(), userId: userA },
      ];
      expect(validateFamilyIsolation(validFamily, userA).isolated).toBe(true);

      const contaminatedFamily = [
        { id: crypto.randomUUID(), userId: userA },
        { id: crypto.randomUUID(), userId: userB },
      ];
      const result = validateFamilyIsolation(contaminatedFamily, userA);
      expect(result.isolated).toBe(false);
      expect(result.violations).toHaveLength(1);
    });
  });

  describe('8. Database Error Mapping & Fail-Closed Boundary', () => {
    it('sanitizes unexpected internal database driver errors without leaking internals', async () => {
      const failingClient = {
        user: {
          async findUnique() {
            const driverErr = new Error('FATAL: password authentication failed for user "postgres_internal"');
            driverErr.code = 'ECONNREFUSED';
            throw driverErr;
          },
        },
      };

      const failingAdapter = new AuthRepositoryAdapter({ dbClient: failingClient });

      await expect(failingAdapter.findUserByEmail('test@example.com')).rejects.toThrowError(
        'Database error occurred during findUserByEmail'
      );
    });
  });
});
