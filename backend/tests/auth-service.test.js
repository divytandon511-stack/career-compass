import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import argon2 from 'argon2';

import { AuthService, createAuthService, SYNTHETIC_ARGON2_HASH } from '../src/services/auth.service.js';
import { AuthRepositoryInterface } from '../src/repositories/auth.repository.interface.js';
import { AppError } from '../src/utils/app-error.js';
import { verifyAccessToken } from '../src/utils/jwt.js';
import { hashToken } from '../src/utils/token.js';
import * as passwordUtils from '../src/utils/password.js';

/**
 * In-test fake repository adhering to AuthRepositoryInterface.
 * Used exclusively within unit tests to verify AuthService business logic in isolation.
 *
 * CRITICAL TEST LIMITATION DISCLAIMER:
 * This fake repository is an in-memory simulation for testing service-level flows.
 * It DOES NOT claim to prove real PostgreSQL ACID transaction guarantees, row-level locks
 * (SELECT ... FOR UPDATE), multi-process serialization, or database constraint enforcement.
 * Real concurrency, multi-connection race conditions, and SQL uniqueness constraint tests
 * MUST be added in integration tests against an authoritative PostgreSQL database when the
 * Prisma adapter is implemented in Stage 5.
 */
const createFakeAuthRepository = () => {
  const users = new Map();
  const emailIndex = new Map();
  const studentProfiles = new Map();
  const sessions = new Map();
  const hashedTokenIndex = new Map();

  return {
    users,
    emailIndex,
    studentProfiles,
    sessions,
    hashedTokenIndex,

    async findUserByEmail(email) {
      const userId = emailIndex.get(email.toLowerCase());
      if (!userId) return null;
      return users.get(userId) || null;
    },

    async findUserById(userId) {
      return users.get(userId) || null;
    },

    async createStudentUser({ email, passwordHash, displayName, schoolGrade, consentAccepted }) {
      const normalizedEmail = email.toLowerCase();
      if (emailIndex.has(normalizedEmail)) {
        const error = new Error('Unique constraint failed on the fields: (`email`)');
        error.code = 'P2002';
        throw error;
      }

      const id = crypto.randomUUID();
      const user = {
        id,
        email: normalizedEmail,
        passwordHash,
        displayName,
        role: 'STUDENT',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      users.set(id, user);
      emailIndex.set(normalizedEmail, id);
      studentProfiles.set(id, {
        userId: id,
        schoolGrade: schoolGrade || null,
        consentAccepted,
        createdAt: new Date(),
      });

      return user;
    },

    async createRefreshSession({ userId, hashedTokenId, expiresAt, rotatedFrom = null }) {
      if (hashedTokenIndex.has(hashedTokenId)) {
        const error = new Error('Unique constraint failed on the fields: (`hashedTokenId`)');
        error.code = 'P2002';
        throw error;
      }

      const id = crypto.randomUUID();
      const session = {
        id,
        userId,
        hashedTokenId,
        expiresAt,
        revokedAt: null,
        revokedReason: null,
        rotatedFrom,
        createdAt: new Date(),
      };

      sessions.set(id, session);
      hashedTokenIndex.set(hashedTokenId, id);
      return session;
    },

    async findRefreshSessionByHashedToken(hashedTokenId) {
      const sessionId = hashedTokenIndex.get(hashedTokenId);
      if (!sessionId) return null;
      return sessions.get(sessionId) || null;
    },

    async findRefreshSessionById(sessionId) {
      return sessions.get(sessionId) || null;
    },

    async rotateRefreshSession({ oldSessionId, newHashedTokenId, newExpiresAt, userId }) {
      const oldSession = sessions.get(oldSessionId);
      if (!oldSession || oldSession.revokedAt !== null) {
        // Concurrency collision or already rotated/revoked
        return null;
      }

      // Predecessor uniqueness invariant: a predecessor may have at most one successful rotation successor
      for (const s of sessions.values()) {
        if (s.rotatedFrom === oldSessionId) {
          return null;
        }
      }

      // HashedTokenId uniqueness invariant
      if (hashedTokenIndex.has(newHashedTokenId)) {
        const error = new Error('Unique constraint failed on the fields: (`hashedTokenId`)');
        error.code = 'P2002';
        throw error;
      }

      // Mark old session revoked atomically with reason TOKEN_ROTATION
      oldSession.revokedAt = new Date();
      oldSession.revokedReason = 'TOKEN_ROTATION';
      oldSession.hasSuccessor = true;

      // Create new replacement session
      const id = crypto.randomUUID();
      const newSession = {
        id,
        userId,
        hashedTokenId: newHashedTokenId,
        expiresAt: newExpiresAt,
        revokedAt: null,
        revokedReason: null,
        rotatedFrom: oldSessionId,
        createdAt: new Date(),
      };

      sessions.set(id, newSession);
      hashedTokenIndex.set(newHashedTokenId, id);
      return newSession;
    },

    async revokeRefreshSession(sessionId, reason = 'LOGOUT') {
      const session = sessions.get(sessionId);
      if (session) {
        session.revokedAt = new Date();
        session.revokedReason = reason;
      }
    },

    async revokeSessionByHashedToken(hashedTokenId) {
      const sessionId = hashedTokenIndex.get(hashedTokenId);
      if (sessionId) {
        const session = sessions.get(sessionId);
        if (session) {
          session.revokedAt = new Date();
          session.revokedReason = 'LOGOUT';
          return true;
        }
      }
      return false;
    },

    async revokeRefreshSessionFamily(params) {
      const sessionId = params?.sessionId;
      const targetUserId = typeof params === 'string' ? params : params?.userId;

      if (!sessionId) {
        let count = 0;
        for (const session of sessions.values()) {
          if ((!targetUserId || session.userId === targetUserId) && session.revokedAt === null) {
            session.revokedAt = new Date();
            session.revokedReason = 'REUSE_DETECTED';
            count++;
          }
        }
        return count;
      }

      // Lineage traversal: find root session by walking rotatedFrom upward
      let rootId = sessionId;
      const visitedUp = new Set([rootId]);
      while (true) {
        const curr = sessions.get(rootId);
        if (curr && curr.rotatedFrom && !visitedUp.has(curr.rotatedFrom)) {
          visitedUp.add(curr.rotatedFrom);
          rootId = curr.rotatedFrom;
        } else {
          break;
        }
      }

      // Collect all descendants from root down
      const familyIds = new Set([rootId]);
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const [id, s] of sessions.entries()) {
          if (s.rotatedFrom && familyIds.has(s.rotatedFrom) && !familyIds.has(id)) {
            familyIds.add(id);
            expanded = true;
          }
        }
      }

      // Revoke all unrevoked sessions strictly within this family lineage
      let count = 0;
      for (const id of familyIds) {
        const s = sessions.get(id);
        if (s && (!targetUserId || s.userId === targetUserId) && s.revokedAt === null) {
          s.revokedAt = new Date();
          s.revokedReason = 'REUSE_DETECTED';
          count++;
        }
      }
      return count;
    },

    async revokeAllUserSessions(userId) {
      let count = 0;
      for (const session of sessions.values()) {
        if (session.userId === userId && session.revokedAt === null) {
          session.revokedAt = new Date();
          session.revokedReason = 'LOGOUT';
          count++;
        }
      }
      return count;
    },
  };
};

describe('CareerCompass Authentication Service (Stage 3)', () => {
  let fakeRepo;
  let authService;
  let mockCurrentTime;

  beforeEach(() => {
    fakeRepo = createFakeAuthRepository();
    mockCurrentTime = Date.now();
    authService = createAuthService({
      authRepository: fakeRepo,
      getCurrentTime: () => mockCurrentTime,
      rotationGraceWindowMs: 5000,
    });
  });

  describe('Repository Interface Contract', () => {
    it('throws descriptive errors when AuthRepositoryInterface base methods are directly invoked', async () => {
      const baseRepo = new AuthRepositoryInterface();

      await expect(baseRepo.findUserByEmail('test@example.com')).rejects.toThrow(/must be implemented/);
      await expect(baseRepo.findUserById('uuid')).rejects.toThrow(/must be implemented/);
      await expect(baseRepo.createStudentUser({})).rejects.toThrow(/must be implemented/);
      await expect(baseRepo.createRefreshSession({})).rejects.toThrow(/must be implemented/);
      await expect(baseRepo.findRefreshSessionByHashedToken('hash')).rejects.toThrow(/must be implemented/);
      await expect(baseRepo.findRefreshSessionById('uuid')).rejects.toThrow(/must be implemented/);
      await expect(baseRepo.rotateRefreshSession({})).rejects.toThrow(/must be implemented/);
      await expect(baseRepo.revokeRefreshSession('id')).rejects.toThrow(/must be implemented/);
      await expect(baseRepo.revokeSessionByHashedToken('hash')).rejects.toThrow(/must be implemented/);
      await expect(baseRepo.revokeRefreshSessionFamily({ sessionId: 'id', userId: 'id' })).rejects.toThrow(/must be implemented/);
      await expect(baseRepo.revokeAllUserSessions('id')).rejects.toThrow(/must be implemented/);
    });

    it('requires authRepository dependency in AuthService constructor', () => {
      expect(() => new AuthService()).toThrow(/requires an authRepository dependency/);
      expect(() => new AuthService({})).toThrow(/requires an authRepository dependency/);
    });
  });

  describe('Registration Service', () => {
    const validRegistration = {
      email: 'student.new@example.test',
      password: 'SecurePassword123!',
      displayName: 'Aarav Sharma',
      schoolGrade: '10',
      consentAccepted: true,
    };

    it('successfully registers a student with normalized email, hashed password, and returns minimal user fields', async () => {
      const result = await authService.register(validRegistration);

      expect(result).toHaveProperty('user');
      expect(result.user).toEqual({
        id: expect.any(String),
        email: 'student.new@example.test',
        role: 'STUDENT',
      });

      expect(result.user).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('passwordHash');

      const storedUser = await fakeRepo.findUserById(result.user.id);
      expect(storedUser).toBeDefined();
      expect(storedUser.role).toBe('STUDENT');
      expect(storedUser.status).toBe('ACTIVE');
      expect(storedUser.passwordHash).toMatch(/^\$argon2id\$/);

      const isMatch = await argon2.verify(storedUser.passwordHash, validRegistration.password);
      expect(isMatch).toBe(true);

      const profile = fakeRepo.studentProfiles.get(result.user.id);
      expect(profile).toBeDefined();
      expect(profile.schoolGrade).toBe('10');
      expect(profile.consentAccepted).toBe(true);
    });

    it('normalizes email to lowercase during registration', async () => {
      const result = await authService.register({
        ...validRegistration,
        email: 'UPPERCASE.STUDENT@Example.TEST',
      });

      expect(result.user.email).toBe('uppercase.student@example.test');
      const found = await fakeRepo.findUserByEmail('uppercase.student@example.test');
      expect(found).toBeDefined();
    });

    it('rejects duplicate email registrations with 409 CONFLICT', async () => {
      await authService.register(validRegistration);

      await expect(
        authService.register({
          ...validRegistration,
          email: 'STUDENT.NEW@EXAMPLE.TEST',
        })
      ).rejects.toThrowError(AppError);

      try {
        await authService.register({
          ...validRegistration,
          email: 'STUDENT.NEW@EXAMPLE.TEST',
        });
      } catch (err) {
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('CONFLICT');
        expect(err.message).toBe('An account with this email already exists');
      }
    });

    it('rejects privilege escalation attempts in registration payload (strict schema rejection)', async () => {
      await expect(
        authService.register({
          ...validRegistration,
          role: 'ADMIN',
        })
      ).rejects.toThrowError(AppError);

      try {
        await authService.register({
          ...validRegistration,
          role: 'ADMIN',
        });
      } catch (err) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('VALIDATION_ERROR');
      }
    });

    it('rejects registration when consentAccepted is false or omitted', async () => {
      await expect(
        authService.register({
          ...validRegistration,
          consentAccepted: false,
        })
      ).rejects.toThrowError(AppError);

      try {
        await authService.register({
          ...validRegistration,
          consentAccepted: false,
        });
      } catch (err) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('VALIDATION_ERROR');
      }
    });

    it('handles repository unique constraint race condition gracefully as 409 CONFLICT', async () => {
      const raceRepo = createFakeAuthRepository();
      raceRepo.findUserByEmail = vi.fn(async () => null);
      raceRepo.createStudentUser = vi.fn(async () => {
        const err = new Error('Unique constraint violation');
        err.code = 'P2002';
        throw err;
      });

      const raceService = createAuthService({ authRepository: raceRepo });

      await expect(raceService.register(validRegistration)).rejects.toThrowError(AppError);
      try {
        await raceService.register(validRegistration);
      } catch (err) {
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('CONFLICT');
      }
    });
  });

  describe('Login Service & Timing-Safe Verification (Fix 1)', () => {
    let registeredUser;
    const plaintextPassword = 'ValidPassword123!';

    beforeEach(async () => {
      const reg = await authService.register({
        email: 'registered.student@example.test',
        password: plaintextPassword,
        displayName: 'Registered Student',
        schoolGrade: '11',
        consentAccepted: true,
      });
      registeredUser = reg.user;
    });

    it('successfully logs in with valid credentials, issues access token and persists hashed refresh token', async () => {
      const result = await authService.login({
        email: 'REGISTERED.STUDENT@EXAMPLE.TEST',
        password: plaintextPassword,
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('expiresIn', 900);
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toEqual({
        id: registeredUser.id,
        email: 'registered.student@example.test',
        role: 'STUDENT',
      });

      const decoded = verifyAccessToken(result.accessToken);
      expect(decoded.sub).toBe(registeredUser.id);
      expect(decoded.role).toBe('STUDENT');
      expect(decoded.email).toBe('registered.student@example.test');

      expect(result.refreshToken).toMatch(/^[a-f0-9]{64}$/);

      const hashedTokenId = hashToken(result.refreshToken);
      const session = await fakeRepo.findRefreshSessionByHashedToken(hashedTokenId);
      expect(session).toBeDefined();
      expect(session.userId).toBe(registeredUser.id);
      expect(session.hashedTokenId).toBe(hashedTokenId);
      expect(session.revokedAt).toBeNull();
    });

    it('executes dummy Argon2 verification for unknown email addresses to normalize timing', async () => {
      const verifySpy = vi.spyOn(passwordUtils, 'verifyPassword');

      await expect(
        authService.login({
          email: 'unknown.ghost@example.test',
          password: 'Password123!',
        })
      ).rejects.toThrow(AppError);

      // Verify that verifyPassword was explicitly called with SYNTHETIC_ARGON2_HASH
      expect(verifySpy).toHaveBeenCalledWith(SYNTHETIC_ARGON2_HASH, 'Password123!');
      verifySpy.mockRestore();
    });

    it('produces identical error envelope for unknown email and wrong password', async () => {
      let unknownEmailError;
      try {
        await authService.login({
          email: 'nonexistent@example.test',
          password: 'WrongPassword123!',
        });
      } catch (err) {
        unknownEmailError = err;
      }

      let wrongPasswordError;
      try {
        await authService.login({
          email: 'registered.student@example.test',
          password: 'WrongPassword123!',
        });
      } catch (err) {
        wrongPasswordError = err;
      }

      // Assert exact error parity: status, code, message, and details
      expect(unknownEmailError.statusCode).toBe(401);
      expect(wrongPasswordError.statusCode).toBe(401);
      expect(unknownEmailError.code).toBe('UNAUTHORIZED');
      expect(wrongPasswordError.code).toBe('UNAUTHORIZED');
      expect(unknownEmailError.message).toBe('Invalid email or password');
      expect(wrongPasswordError.message).toBe('Invalid email or password');
      expect(unknownEmailError.details).toEqual([]);
      expect(wrongPasswordError.details).toEqual([]);
    });

    it('rejects suspended accounts with 401 UNAUTHORIZED even with correct password', async () => {
      const user = await fakeRepo.findUserById(registeredUser.id);
      user.status = 'SUSPENDED';

      await expect(
        authService.login({
          email: 'registered.student@example.test',
          password: plaintextPassword,
        })
      ).rejects.toThrowError(AppError);

      try {
        await authService.login({
          email: 'registered.student@example.test',
          password: plaintextPassword,
        });
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.message).toBe('Invalid email or password');
        expect(err.internalReason).toBe('ACCOUNT_SUSPENDED');
      }
    });

    it('rejects login requests with validation errors (422)', async () => {
      await expect(
        authService.login({
          email: 'not-an-email',
          password: '',
        })
      ).rejects.toThrowError(AppError);

      try {
        await authService.login({
          email: 'not-an-email',
          password: '',
        });
      } catch (err) {
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  describe('Refresh Token Lifecycle, Concurrency & Replay Policy (Fix 3 & Fix 4)', () => {
    let activeUser;
    let initialLogin;

    beforeEach(async () => {
      const reg = await authService.register({
        email: 'rotate.student@example.test',
        password: 'Password123!@#',
        displayName: 'Rotate Student',
        schoolGrade: '12',
        consentAccepted: true,
      });
      activeUser = reg.user;

      initialLogin = await authService.login({
        email: 'rotate.student@example.test',
        password: 'Password123!@#',
      });
    });

    it('rejects invalid or malformed refresh token formats (non-canonical hex) before database query', async () => {
      // Non-hex characters
      await expect(authService.refresh('zzzz'.repeat(16))).rejects.toThrow(AppError);
      // Uppercase hex characters (non-canonical)
      await expect(authService.refresh('A'.repeat(64))).rejects.toThrow(AppError);
      // Mixed-case hex characters (non-canonical)
      await expect(authService.refresh('aAbB'.repeat(16))).rejects.toThrow(AppError);
      // Leading or trailing whitespace
      await expect(authService.refresh(' ' + 'a'.repeat(64))).rejects.toThrow(AppError);
      await expect(authService.refresh('a'.repeat(64) + ' ')).rejects.toThrow(AppError);
      // Too short
      await expect(authService.refresh('a'.repeat(32))).rejects.toThrow(AppError);
      // Too long
      await expect(authService.refresh('a'.repeat(65))).rejects.toThrow(AppError);
      // Empty or non-string
      await expect(authService.refresh('')).rejects.toThrow(AppError);
      await expect(authService.refresh(null)).rejects.toThrow(AppError);
    });

    it('fails closed when submitting a token hash instead of a raw token', async () => {
      const rawToken = initialLogin.refreshToken;
      const rawHash = hashToken(rawToken);

      // Attempting to refresh using the SHA-256 hash string directly
      // Hashing the hash yields a different digest, so it must not find any session
      await expect(authService.refresh(rawHash)).rejects.toThrow(AppError);
      try {
        await authService.refresh(rawHash);
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid or expired refresh token');
      }
    });

    it('successfully rotates refresh token and links rotation predecessor', async () => {
      const oldRefreshToken = initialLogin.refreshToken;
      const oldHashedId = hashToken(oldRefreshToken);

      const refreshResult = await authService.refresh(oldRefreshToken);

      expect(refreshResult).toHaveProperty('accessToken');
      expect(refreshResult).toHaveProperty('expiresIn', 900);
      expect(refreshResult).toHaveProperty('refreshToken');
      expect(refreshResult.refreshToken).not.toBe(oldRefreshToken);

      const oldSession = await fakeRepo.findRefreshSessionByHashedToken(oldHashedId);
      expect(oldSession.revokedAt).not.toBeNull();
      expect(oldSession.revokedReason).toBe('TOKEN_ROTATION');

      const newHashedId = hashToken(refreshResult.refreshToken);
      const newSession = await fakeRepo.findRefreshSessionByHashedToken(newHashedId);
      expect(newSession).toBeDefined();
      expect(newSession.revokedAt).toBeNull();
      expect(newSession.rotatedFrom).toBe(oldSession.id);
    });

    it('rejects recent rotated token replay within 5s grace window without revoking token family', async () => {
      const originalToken = initialLogin.refreshToken;

      // Legitimate rotation at t = 0
      const firstRotation = await authService.refresh(originalToken);
      expect(firstRotation.refreshToken).toBeDefined();

      // Advancing clock by 2 seconds (within 5-second grace window)
      mockCurrentTime += 2000;

      // Replaying original token within grace period
      try {
        await authService.refresh(originalToken);
        expect.fail('Should have rejected rotated token');
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.message).toBe('Refresh token was recently rotated; please use the new token');
      }

      // CRUCIAL: Verify that the legitimate new token was NOT revoked!
      const newHashedId = hashToken(firstRotation.refreshToken);
      const activeSession = await fakeRepo.findRefreshSessionByHashedToken(newHashedId);
      expect(activeSession.revokedAt).toBeNull();
    });

    it('triggers full token family revocation when rotated token is replayed outside the grace window', async () => {
      const originalToken = initialLogin.refreshToken;

      // Legitimate rotation at t = 0
      const firstRotation = await authService.refresh(originalToken);
      const activeHashedId = hashToken(firstRotation.refreshToken);

      // Advancing clock by 10 seconds (exceeding 5-second grace window)
      mockCurrentTime += 10000;

      // Replaying original token outside grace window triggers reuse detection
      try {
        await authService.refresh(originalToken);
        expect.fail('Should have rejected replay outside grace window');
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.message).toBe('Invalid refresh token session: token reuse detected');
      }

      // Verify that the replacement token was also revoked by family revocation
      const activeSession = await fakeRepo.findRefreshSessionByHashedToken(activeHashedId);
      expect(activeSession.revokedAt).not.toBeNull();
      expect(activeSession.revokedReason).toBe('REUSE_DETECTED');
    });

    it('handles concurrent rotation requests safely (exactly one succeeds, loser receives no token)', async () => {
      const tokenToRotate = initialLogin.refreshToken;

      const promise1 = authService.refresh(tokenToRotate);
      const promise2 = authService.refresh(tokenToRotate);

      const results = await Promise.allSettled([promise1, promise2]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(rejected[0].reason.statusCode).toBe(401);
    });

    it('denies expired refresh sessions with 401 UNAUTHORIZED', async () => {
      const token = initialLogin.refreshToken;
      const hashedId = hashToken(token);
      const session = await fakeRepo.findRefreshSessionByHashedToken(hashedId);

      // Fast forward time past session expiry (7 days + 1 minute)
      mockCurrentTime += 7 * 24 * 60 * 60 * 1000 + 60000;

      try {
        await authService.refresh(token);
        expect.fail('Should have rejected expired refresh session');
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.message).toBe('Refresh token has expired');
      }

      expect(session.revokedAt).not.toBeNull();
      expect(session.revokedReason).toBe('EXPIRED');
    });

    it('denies refresh when user account has been suspended since token issuance', async () => {
      const user = await fakeRepo.findUserById(activeUser.id);
      user.status = 'SUSPENDED';

      try {
        await authService.refresh(initialLogin.refreshToken);
        expect.fail('Should have rejected suspended user');
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.message).toBe('User account is suspended');
      }
    });
  });

  describe('Logout & Trusted Identity Binding (Fix 2)', () => {
    let loginData;
    let user;
    const otherUserUuid = '88888888-8888-4888-8888-888888888888';

    beforeEach(async () => {
      const reg = await authService.register({
        email: 'logout.student@example.test',
        password: 'Password123!@#',
        displayName: 'Logout Student',
        schoolGrade: '9',
        consentAccepted: true,
      });
      user = reg.user;

      loginData = await authService.login({
        email: 'logout.student@example.test',
        password: 'Password123!@#',
      });
    });

    it('successfully revokes the specific refresh session upon single-device logout', async () => {
      const hashedId = hashToken(loginData.refreshToken);
      const sessionBefore = await fakeRepo.findRefreshSessionByHashedToken(hashedId);
      expect(sessionBefore.revokedAt).toBeNull();

      const logoutResult = await authService.logout({
        refreshToken: loginData.refreshToken,
      });

      expect(logoutResult).toEqual({ success: true });

      const sessionAfter = await fakeRepo.findRefreshSessionByHashedToken(hashedId);
      expect(sessionAfter.revokedAt).not.toBeNull();
      expect(sessionAfter.revokedReason).toBe('LOGOUT');

      await expect(authService.refresh(loginData.refreshToken)).rejects.toThrowError(AppError);
    });

    it('revokes all active sessions when authenticatedUserId is provided with allDevices=true', async () => {
      const login2 = await authService.login({
        email: 'logout.student@example.test',
        password: 'Password123!@#',
      });

      const hash1 = hashToken(loginData.refreshToken);
      const hash2 = hashToken(login2.refreshToken);

      await authService.logout({
        authenticatedUserId: user.id,
        allDevices: true,
      });

      const s1 = await fakeRepo.findRefreshSessionByHashedToken(hash1);
      const s2 = await fakeRepo.findRefreshSessionByHashedToken(hash2);
      expect(s1.revokedAt).not.toBeNull();
      expect(s2.revokedAt).not.toBeNull();
    });

    it('derives user identity from verified active refresh token when allDevices=true without authenticatedUserId', async () => {
      const login2 = await authService.login({
        email: 'logout.student@example.test',
        password: 'Password123!@#',
      });

      const hash1 = hashToken(loginData.refreshToken);
      const hash2 = hashToken(login2.refreshToken);

      // Unauthenticated logout request that carries the valid refresh token with allDevices=true
      await authService.logout({
        refreshToken: loginData.refreshToken,
        allDevices: true,
      });

      const s1 = await fakeRepo.findRefreshSessionByHashedToken(hash1);
      const s2 = await fakeRepo.findRefreshSessionByHashedToken(hash2);
      expect(s1.revokedAt).not.toBeNull();
      expect(s2.revokedAt).not.toBeNull();
    });

    it('strictly blocks cross-user logout attempts with 403 FORBIDDEN', async () => {
      // Authenticated as otherUserUuid, but attempting to supply loginData.refreshToken (belonging to 'user.id')
      try {
        await authService.logout({
          refreshToken: loginData.refreshToken,
          authenticatedUserId: otherUserUuid,
        });
        expect.fail('Should have rejected cross-user session revocation');
      } catch (err) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
        expect(err.message).toBe('Authentication identity does not match refresh session');
      }

      // Ensure the targeted session was NOT revoked
      const hashedId = hashToken(loginData.refreshToken);
      const session = await fakeRepo.findRefreshSessionByHashedToken(hashedId);
      expect(session.revokedAt).toBeNull();
    });

    it('rejects all-device logout with 401 when insufficient authentication context is supplied', async () => {
      // Attempting allDevices=true with no token and no authenticated identity
      try {
        await authService.logout({ allDevices: true });
        expect.fail('Should have rejected all-device logout without context');
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
      }
    });

    it('rejects malformed authenticatedUserId with 401 UNAUTHORIZED', async () => {
      try {
        await authService.logout({
          authenticatedUserId: 'not-a-valid-uuid',
          allDevices: true,
        });
        expect.fail('Should have rejected malformed UUID');
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
        expect(err.message).toBe('Invalid authenticated identity');
      }
    });

    it('rejects single-session logout with 400 BAD_REQUEST when no refresh token is supplied', async () => {
      try {
        await authService.logout({ allDevices: false });
        expect.fail('Should have rejected logout without token');
      } catch (err) {
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('BAD_REQUEST');
      }
    });
  });

  describe('Repository Failure Propagation', () => {
    it('fails closed and propagates repository failures without swallowing unexpected errors', async () => {
      const failingRepo = createFakeAuthRepository();
      failingRepo.findUserByEmail = vi.fn(async () => {
        throw new Error('PostgreSQL connection timeout');
      });

      const service = createAuthService({ authRepository: failingRepo });

      await expect(
        service.login({
          email: 'any@example.test',
          password: 'Password123!',
        })
      ).rejects.toThrow('PostgreSQL connection timeout');
    });
  });

  describe('Revocation Reason Classification & Concurrency Grace Policy (REFRESH-02)', () => {
    let studentUser;
    let primaryLogin;
    let secondaryLogin;

    beforeEach(async () => {
      const reg = await authService.register({
        email: 'classification.student@example.test',
        password: 'Password123!@#',
        displayName: 'Classification Student',
        schoolGrade: '11',
        consentAccepted: true,
      });
      studentUser = reg.user;

      primaryLogin = await authService.login({
        email: 'classification.student@example.test',
        password: 'Password123!@#',
      });

      // Second independent active session (simulating second device/tab)
      secondaryLogin = await authService.login({
        email: 'classification.student@example.test',
        password: 'Password123!@#',
      });
    });

    it('1. TOKEN_ROTATION within five seconds: 401, no family revocation, no successor token', async () => {
      const rotated = await authService.refresh(primaryLogin.refreshToken);
      expect(rotated.refreshToken).toBeDefined();

      // Advance clock by 2s (within 5s grace window)
      mockCurrentTime += 2000;

      let caughtError;
      let replacementToken;
      try {
        replacementToken = await authService.refresh(primaryLogin.refreshToken);
      } catch (err) {
        caughtError = err;
      }

      expect(replacementToken).toBeUndefined();
      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(401);
      expect(caughtError.message).toBe('Refresh token was recently rotated; please use the new token');

      // Crucial: verify that the newly issued token and secondary login session are NOT revoked
      const primaryNewHashedId = hashToken(rotated.refreshToken);
      const primaryActive = await fakeRepo.findRefreshSessionByHashedToken(primaryNewHashedId);
      expect(primaryActive.revokedAt).toBeNull();

      const secondaryHashedId = hashToken(secondaryLogin.refreshToken);
      const secondaryActive = await fakeRepo.findRefreshSessionByHashedToken(secondaryHashedId);
      expect(secondaryActive.revokedAt).toBeNull();
    });

    it('2. TOKEN_ROTATION after five seconds: 401, family revocation, no successor token', async () => {
      const rotated = await authService.refresh(primaryLogin.refreshToken);
      expect(rotated.refreshToken).toBeDefined();

      // Advance clock by 10s (exceeding 5s grace window)
      mockCurrentTime += 10000;

      let caughtError;
      let replacementToken;
      try {
        replacementToken = await authService.refresh(primaryLogin.refreshToken);
      } catch (err) {
        caughtError = err;
      }

      expect(replacementToken).toBeUndefined();
      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(401);
      expect(caughtError.message).toBe('Invalid refresh token session: token reuse detected');

      // Crucial: family revocation occurred
      const primaryNewHashedId = hashToken(rotated.refreshToken);
      const primaryActive = await fakeRepo.findRefreshSessionByHashedToken(primaryNewHashedId);
      expect(primaryActive.revokedAt).not.toBeNull();
      expect(primaryActive.revokedReason).toBe('REUSE_DETECTED');
    });

    it('3. LOGOUT within five seconds: 401, no grace, no unnecessary family revocation, no replacement token', async () => {
      const primaryHash = hashToken(primaryLogin.refreshToken);
      const session = await fakeRepo.findRefreshSessionByHashedToken(primaryHash);
      session.revokedAt = new Date(mockCurrentTime);
      session.revokedReason = 'LOGOUT';

      // 2 seconds later (within 5s)
      mockCurrentTime += 2000;

      let caughtError;
      let replacementToken;
      try {
        replacementToken = await authService.refresh(primaryLogin.refreshToken);
      } catch (err) {
        caughtError = err;
      }

      expect(replacementToken).toBeUndefined();
      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(401);
      expect(caughtError.message).not.toBe('Refresh token was recently rotated; please use the new token');
      expect(caughtError.message).toBe('Refresh token has been revoked or is no longer valid');

      // Verify secondary session was NOT revoked
      const secondaryHash = hashToken(secondaryLogin.refreshToken);
      const secondarySession = await fakeRepo.findRefreshSessionByHashedToken(secondaryHash);
      expect(secondarySession.revokedAt).toBeNull();
    });

    it('4. ALL_DEVICES_LOGOUT within five seconds: 401, no grace, no replacement token', async () => {
      const primaryHash = hashToken(primaryLogin.refreshToken);
      const session = await fakeRepo.findRefreshSessionByHashedToken(primaryHash);
      session.revokedAt = new Date(mockCurrentTime);
      session.revokedReason = 'ALL_DEVICES_LOGOUT';

      mockCurrentTime += 2000;

      let caughtError;
      let replacementToken;
      try {
        replacementToken = await authService.refresh(primaryLogin.refreshToken);
      } catch (err) {
        caughtError = err;
      }

      expect(replacementToken).toBeUndefined();
      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(401);
      expect(caughtError.message).not.toBe('Refresh token was recently rotated; please use the new token');
      expect(caughtError.message).toBe('Refresh token has been revoked or is no longer valid');
    });

    it('5. TOKEN_REUSE_DETECTED within five seconds: 401, no grace, no replacement token', async () => {
      const primaryHash = hashToken(primaryLogin.refreshToken);
      const session = await fakeRepo.findRefreshSessionByHashedToken(primaryHash);
      session.revokedAt = new Date(mockCurrentTime);
      session.revokedReason = 'TOKEN_REUSE_DETECTED';

      mockCurrentTime += 2000;

      let caughtError;
      let replacementToken;
      try {
        replacementToken = await authService.refresh(primaryLogin.refreshToken);
      } catch (err) {
        caughtError = err;
      }

      expect(replacementToken).toBeUndefined();
      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(401);
      expect(caughtError.message).not.toBe('Refresh token was recently rotated; please use the new token');
      expect(caughtError.message).toBe('Refresh token has been revoked or is no longer valid');
    });

    it('6. ACCOUNT_SUSPENDED within five seconds: 401, no grace, no replacement token', async () => {
      const primaryHash = hashToken(primaryLogin.refreshToken);
      const session = await fakeRepo.findRefreshSessionByHashedToken(primaryHash);
      session.revokedAt = new Date(mockCurrentTime);
      session.revokedReason = 'ACCOUNT_SUSPENDED';

      mockCurrentTime += 2000;

      let caughtError;
      let replacementToken;
      try {
        replacementToken = await authService.refresh(primaryLogin.refreshToken);
      } catch (err) {
        caughtError = err;
      }

      expect(replacementToken).toBeUndefined();
      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(401);
      expect(caughtError.message).not.toBe('Refresh token was recently rotated; please use the new token');
      expect(caughtError.message).toBe('Refresh token has been revoked or is no longer valid');
    });

    it('7. SECURITY_RESET within five seconds: 401, no grace, no replacement token', async () => {
      const primaryHash = hashToken(primaryLogin.refreshToken);
      const session = await fakeRepo.findRefreshSessionByHashedToken(primaryHash);
      session.revokedAt = new Date(mockCurrentTime);
      session.revokedReason = 'SECURITY_RESET';

      mockCurrentTime += 2000;

      let caughtError;
      let replacementToken;
      try {
        replacementToken = await authService.refresh(primaryLogin.refreshToken);
      } catch (err) {
        caughtError = err;
      }

      expect(replacementToken).toBeUndefined();
      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(401);
      expect(caughtError.message).not.toBe('Refresh token was recently rotated; please use the new token');
      expect(caughtError.message).toBe('Refresh token has been revoked or is no longer valid');
    });

    it('8. Unknown or missing revokedReason: 401, no grace, no replacement token', async () => {
      const primaryHash = hashToken(primaryLogin.refreshToken);
      const session = await fakeRepo.findRefreshSessionByHashedToken(primaryHash);
      session.revokedAt = new Date(mockCurrentTime);
      session.revokedReason = null; // Missing reason

      mockCurrentTime += 2000;

      let caughtError;
      let replacementToken;
      try {
        replacementToken = await authService.refresh(primaryLogin.refreshToken);
      } catch (err) {
        caughtError = err;
      }

      expect(replacementToken).toBeUndefined();
      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(401);
      expect(caughtError.message).not.toBe('Refresh token was recently rotated; please use the new token');
      expect(caughtError.message).toBe('Refresh token has been revoked or is no longer valid');
    });

    it('9. A descendant session with rotatedFrom populated but revokedReason=LOGOUT: no grace, no replacement token', async () => {
      // Rotate primaryLogin -> yields child session B with rotatedFrom set to primaryLogin.id
      const rotated = await authService.refresh(primaryLogin.refreshToken);
      const childHashedId = hashToken(rotated.refreshToken);
      const childSession = await fakeRepo.findRefreshSessionByHashedToken(childHashedId);

      expect(childSession.rotatedFrom).not.toBeNull();

      // Child session B is subsequently logged out
      childSession.revokedAt = new Date(mockCurrentTime);
      childSession.revokedReason = 'LOGOUT';

      // 2 seconds later (within 5s grace window)
      mockCurrentTime += 2000;

      let caughtError;
      let replacementToken;
      try {
        replacementToken = await authService.refresh(rotated.refreshToken);
      } catch (err) {
        caughtError = err;
      }

      expect(replacementToken).toBeUndefined();
      expect(caughtError).toBeInstanceOf(AppError);
      expect(caughtError.statusCode).toBe(401);
      // Crucial: must NOT receive rotation grace despite rotatedFrom being populated!
      expect(caughtError.message).not.toBe('Refresh token was recently rotated; please use the new token');
      expect(caughtError.message).toBe('Refresh token has been revoked or is no longer valid');

      // Verify secondary session on other device remains active
      const secondaryHash = hashToken(secondaryLogin.refreshToken);
      const secondarySession = await fakeRepo.findRefreshSessionByHashedToken(secondaryHash);
      expect(secondarySession.revokedAt).toBeNull();
    });

    it('10. Concurrent rotation still allows exactly one successful token issuance and loser receives no token', async () => {
      const token = primaryLogin.refreshToken;

      const p1 = authService.refresh(token);
      const p2 = authService.refresh(token);

      const results = await Promise.allSettled([p1, p2]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      const winnerToken = fulfilled[0].value.refreshToken;
      expect(typeof winnerToken).toBe('string');
      expect(winnerToken).toHaveLength(64);

      expect(rejected[0].reason).toBeInstanceOf(AppError);
      expect(rejected[0].reason.statusCode).toBe(401);
      expect(rejected[0].reason.refreshToken).toBeUndefined();
    });
  });

  describe('Integration Hardening & Invariant Verification', () => {
    let student;
    let loginData;

    beforeEach(async () => {
      const reg = await authService.register({
        email: 'hardening.student@example.test',
        password: 'Password123!@#',
        displayName: 'Hardening Student',
        schoolGrade: '10',
        consentAccepted: true,
      });
      student = reg.user;

      loginData = await authService.login({
        email: 'hardening.student@example.test',
        password: 'Password123!@#',
      });
    });

    describe('1. All-device logout session validation (revocation and expiry)', () => {
      it('rejects expired refresh session from authenticating caller for all-device logout', async () => {
        // Fast-forward past session expiry (7 days + 1 hour)
        mockCurrentTime += 7 * 24 * 60 * 60 * 1000 + 3600000;

        let caughtError;
        try {
          await authService.logout({
            refreshToken: loginData.refreshToken,
            allDevices: true,
          });
        } catch (err) {
          caughtError = err;
        }

        expect(caughtError).toBeInstanceOf(AppError);
        expect(caughtError.statusCode).toBe(401);
        expect(caughtError.message).toBe(
          'Authentication context or verified active refresh session is required for all-device logout'
        );

        // Verify session was NOT revoked via all-device logout
        const session = await fakeRepo.findRefreshSessionByHashedToken(hashToken(loginData.refreshToken));
        expect(session.revokedAt).toBeNull();
      });

      it('rejects already-revoked refresh session from authenticating caller for all-device logout', async () => {
        // Revoke the session first
        await authService.logout({ refreshToken: loginData.refreshToken });

        let caughtError;
        try {
          await authService.logout({
            refreshToken: loginData.refreshToken,
            allDevices: true,
          });
        } catch (err) {
          caughtError = err;
        }

        expect(caughtError).toBeInstanceOf(AppError);
        expect(caughtError.statusCode).toBe(401);
        expect(caughtError.message).toBe(
          'Authentication context or verified active refresh session is required for all-device logout'
        );
      });

      it('permits active, non-expired refresh session to authenticate caller for all-device logout', async () => {
        const login2 = await authService.login({
          email: 'hardening.student@example.test',
          password: 'Password123!@#',
        });

        // 1 hour later (well within 7 days)
        mockCurrentTime += 3600000;

        const res = await authService.logout({
          refreshToken: loginData.refreshToken,
          allDevices: true,
        });

        expect(res).toEqual({ success: true });

        const s1 = await fakeRepo.findRefreshSessionByHashedToken(hashToken(loginData.refreshToken));
        const s2 = await fakeRepo.findRefreshSessionByHashedToken(hashToken(login2.refreshToken));
        expect(s1.revokedAt).not.toBeNull();
        expect(s2.revokedAt).not.toBeNull();
      });
    });

    describe('2. Standardized externally observable invalid-login responses', () => {
      it('returns identical external 401 error envelope across all login failure modes with internal distinctions', async () => {
        const cases = [
          {
            name: 'nonexistent account',
            input: { email: 'nonexistent.user@example.test', password: 'Password123!@#' },
            expectedInternalReason: 'USER_NOT_FOUND',
          },
          {
            name: 'incorrect password',
            input: { email: 'hardening.student@example.test', password: 'WrongPassword999!' },
            expectedInternalReason: 'INVALID_CREDENTIALS',
          },
        ];

        for (const tc of cases) {
          let err;
          try {
            await authService.login(tc.input);
          } catch (e) {
            err = e;
          }

          expect(err, `Failed for case: ${tc.name}`).toBeInstanceOf(AppError);
          expect(err.statusCode).toBe(401);
          expect(err.code).toBe('UNAUTHORIZED');
          expect(err.message).toBe('Invalid email or password');
          expect(err.internalReason).toBe(tc.expectedInternalReason);
        }

        // Suspended account case
        const user = await fakeRepo.findUserById(student.id);
        user.status = 'SUSPENDED';

        let suspendedErr;
        try {
          await authService.login({
            email: 'hardening.student@example.test',
            password: 'Password123!@#',
          });
        } catch (e) {
          suspendedErr = e;
        }

        expect(suspendedErr).toBeInstanceOf(AppError);
        expect(suspendedErr.statusCode).toBe(401);
        expect(suspendedErr.code).toBe('UNAUTHORIZED');
        expect(suspendedErr.message).toBe('Invalid email or password');
        expect(suspendedErr.internalReason).toBe('ACCOUNT_SUSPENDED');

        // Invalid role account case
        user.status = 'ACTIVE';
        user.role = 'SUPERUSER'; // Invalid non-allowlisted role

        let roleErr;
        try {
          await authService.login({
            email: 'hardening.student@example.test',
            password: 'Password123!@#',
          });
        } catch (e) {
          roleErr = e;
        }

        expect(roleErr).toBeInstanceOf(AppError);
        expect(roleErr.statusCode).toBe(401);
        expect(roleErr.code).toBe('UNAUTHORIZED');
        expect(roleErr.message).toBe('Invalid email or password');
        expect(roleErr.internalReason).toBe('INVALID_ROLE');
      });
    });

    describe('3. Canonical 64-character lowercase hex refresh token enforcement', () => {
      it('strictly rejects non-canonical refresh tokens in refresh()', async () => {
        const nonCanonical = [
          'A'.repeat(64), // Uppercase hex
          'aAbB'.repeat(16), // Mixed-case hex
          ' ' + 'a'.repeat(64), // Leading whitespace
          'a'.repeat(64) + ' ', // Trailing whitespace
          '\t' + 'a'.repeat(64), // Tab character
          '\n' + 'a'.repeat(64), // Newline character
          'a'.repeat(63), // 63 chars
          'a'.repeat(65), // 65 chars
          '0123456789abcdef'.repeat(3) + 'g'.repeat(16), // Invalid non-hex 'g'
        ];

        for (const token of nonCanonical) {
          let err;
          try {
            await authService.refresh(token);
          } catch (e) {
            err = e;
          }

          expect(err, `Failed to reject token: ${token}`).toBeInstanceOf(AppError);
          expect(err.statusCode).toBe(401);
          expect(err.message).toBe('Invalid or malformed refresh token');
        }
      });

      it('strictly rejects non-canonical refresh tokens in logout()', async () => {
        const nonCanonical = [
          'A'.repeat(64),
          ' ' + 'a'.repeat(64),
          'a'.repeat(64) + ' ',
          'g'.repeat(64),
          'a'.repeat(32),
        ];

        for (const token of nonCanonical) {
          let err;
          try {
            await authService.logout({ refreshToken: token });
          } catch (e) {
            err = e;
          }

          expect(err, `Failed to reject token in logout: ${token}`).toBeInstanceOf(AppError);
          expect(err.statusCode).toBe(401);
          expect(err.message).toBe('Invalid or malformed refresh token');
        }
      });
    });

    describe('4. Repository contract uniqueness and family isolation invariants', () => {
      it('enforces hashedTokenId uniqueness invariant on session insertion and rotation', async () => {
        const hashedId = hashToken('a'.repeat(64));

        await fakeRepo.createRefreshSession({
          userId: student.id,
          hashedTokenId: hashedId,
          expiresAt: new Date(mockCurrentTime + 10000),
        });

        // Attempt duplicate insertion
        await expect(
          fakeRepo.createRefreshSession({
            userId: student.id,
            hashedTokenId: hashedId,
            expiresAt: new Date(mockCurrentTime + 10000),
          })
        ).rejects.toThrow(/Unique constraint failed/);
      });

      it('enforces that a predecessor session may have at most one successful rotation successor', async () => {
        const token = loginData.refreshToken;
        const initialSession = await fakeRepo.findRefreshSessionByHashedToken(hashToken(token));

        // First rotation succeeds
        const newSession1 = await fakeRepo.rotateRefreshSession({
          oldSessionId: initialSession.id,
          newHashedTokenId: hashToken('b'.repeat(64)),
          newExpiresAt: new Date(mockCurrentTime + 10000),
          userId: student.id,
        });
        expect(newSession1).not.toBeNull();
        expect(newSession1.rotatedFrom).toBe(initialSession.id);

        // Attempting a second rotation on the same predecessor session must fail (return null)
        const newSession2 = await fakeRepo.rotateRefreshSession({
          oldSessionId: initialSession.id,
          newHashedTokenId: hashToken('c'.repeat(64)),
          newExpiresAt: new Date(mockCurrentTime + 10000),
          userId: student.id,
        });
        expect(newSession2).toBeNull();
      });

      it('family revocation preserves lineage and isolates unrelated sessions for the same user', async () => {
        // Session A lineage (Laptop): Login -> Rotate A1 -> Rotate A2
        const loginA = await authService.login({
          email: 'hardening.student@example.test',
          password: 'Password123!@#',
        });
        const rotA1 = await authService.refresh(loginA.refreshToken);
        const rotA2 = await authService.refresh(rotA1.refreshToken);

        // Session B lineage (Mobile): Login -> Rotate B1
        const loginB = await authService.login({
          email: 'hardening.student@example.test',
          password: 'Password123!@#',
        });
        const rotB1 = await authService.refresh(loginB.refreshToken);

        // Advance past grace period (10s)
        mockCurrentTime += 10000;

        // Replay Session A1 (outside grace window -> token reuse detected)
        let caughtReuseErr;
        try {
          await authService.refresh(rotA1.refreshToken);
        } catch (e) {
          caughtReuseErr = e;
        }

        expect(caughtReuseErr).toBeInstanceOf(AppError);
        expect(caughtReuseErr.statusCode).toBe(401);
        expect(caughtReuseErr.message).toBe('Invalid refresh token session: token reuse detected');

        // Verify that all sessions in Family A are revoked
        const sessionA2 = await fakeRepo.findRefreshSessionByHashedToken(hashToken(rotA2.refreshToken));
        expect(sessionA2.revokedAt).not.toBeNull();
        expect(sessionA2.revokedReason).toBe('REUSE_DETECTED');

        // CRUCIAL ISOLATION VERIFICATION:
        // Session B (Mobile) is in an independent lineage family and must remain ACTIVE!
        const sessionB1 = await fakeRepo.findRefreshSessionByHashedToken(hashToken(rotB1.refreshToken));
        expect(sessionB1.revokedAt).toBeNull();

        // Mobile session B1 can continue to be refreshed successfully!
        const rotB2 = await authService.refresh(rotB1.refreshToken);
        expect(rotB2).toHaveProperty('accessToken');
        expect(rotB2).toHaveProperty('refreshToken');
        expect(rotB2.refreshToken).toHaveLength(64);
      });
    });
  });
});
