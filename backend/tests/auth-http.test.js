import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

import { createApp } from '../src/app.js';
import { AuthService, createAuthService } from '../src/services/auth.service.js';
import { createAuthenticate } from '../src/middleware/authenticate.js';
import { hashToken } from '../src/utils/token.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { SYNTHETIC_TEST_JWT_SECRET } from '../src/config/env.js';
import { createAuthLimiter } from '../src/middleware/rate-limit.js';
import { parseCookies } from '../src/middleware/cookie-parser.js';
import { extractRefreshCookie } from '../src/utils/cookie.js';
import { createAuthRouter } from '../src/routes/auth.routes.js';

/**
 * In-test fake repository adhering to AuthRepositoryInterface.
 * Simulates persistence and constraints for isolated HTTP integration testing.
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
        return null;
      }

      for (const s of sessions.values()) {
        if (s.rotatedFrom === oldSessionId) {
          return null;
        }
      }

      if (hashedTokenIndex.has(newHashedTokenId)) {
        const error = new Error('Unique constraint failed on the fields: (`hashedTokenId`)');
        error.code = 'P2002';
        throw error;
      }

      oldSession.revokedAt = new Date();
      oldSession.revokedReason = 'TOKEN_ROTATION';
      oldSession.hasSuccessor = true;

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

describe('CareerCompass — Stage 4 Authentication HTTP Integration', () => {
  let fakeRepo;
  let authService;
  let authenticate;
  let app;
  let mockCurrentTime;
  const TRUSTED_ORIGIN = 'http://localhost:5173';
  const UNTRUSTED_ORIGIN = 'https://malicious.evil.test';

  // No-op rate limiter to prevent cross-test rate limit starvation in functional tests
  const noopLimiter = (req, res, next) => next();

  beforeEach(() => {
    mockCurrentTime = Date.now();
    fakeRepo = createFakeAuthRepository();
    authService = createAuthService({
      authRepository: fakeRepo,
      getCurrentTime: () => mockCurrentTime,
      rotationGraceWindowMs: 5000,
    });
    authenticate = createAuthenticate({
      findUserById: (id) => fakeRepo.findUserById(id),
    });

    app = createApp({
      authService,
      authenticate,
      allowedOrigins: [TRUSTED_ORIGIN],
      isSecure: false,
      registerLimiter: noopLimiter,
      loginLimiter: noopLimiter,
      refreshLimiter: noopLimiter,
    });
  });

  describe('POST /api/v1/auth/register', () => {
    const validRegistration = {
      email: 'student.register@example.test',
      password: 'SecurePassword123!',
      displayName: 'Priya Patel',
      schoolGrade: '11',
      consentAccepted: true,
    };

    it('returns 201 with standard data envelope and created user (no secrets, no cookie)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegistration);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        data: {
          user: {
            id: expect.any(String),
            email: 'student.register@example.test',
            role: 'STUDENT',
          },
        },
      });

      // Must never set refresh cookie or expose passwords
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(res.body.data.user).not.toHaveProperty('password');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('returns 422 with validation error envelope for invalid input', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'short',
          displayName: '',
        });

      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.error.details)).toBe(true);
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });

    it('returns 409 CONFLICT if email is already registered', async () => {
      await request(app).post('/api/v1/auth/register').send(validRegistration);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegistration);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toBe('An account with this email already exists');
    });

    it('rejects client-supplied privileged role in registration payload (422)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegistration,
          email: 'admin.hacker@example.test',
          role: 'ADMIN',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('enforces registration rate limiting (429) when configured', async () => {
      const strictApp = createApp({
        authService,
        authenticate,
        allowedOrigins: [TRUSTED_ORIGIN],
        registerLimiter: createAuthLimiter({ windowMs: 60000, max: 2, message: 'Too many registrations' }),
        loginLimiter: noopLimiter,
        refreshLimiter: noopLimiter,
      });

      // First 2 succeed
      await request(strictApp).post('/api/v1/auth/register').send({ ...validRegistration, email: 'u1@test.test' });
      await request(strictApp).post('/api/v1/auth/register').send({ ...validRegistration, email: 'u2@test.test' });

      // 3rd is rate limited
      const res = await request(strictApp)
        .post('/api/v1/auth/register')
        .send({ ...validRegistration, email: 'u3@test.test' });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.body.error.message).toBe('Too many registrations');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const userCredentials = {
      email: 'login.student@example.test',
      password: 'StrongPassword123!',
    };

    beforeEach(async () => {
      await authService.register({
        email: userCredentials.email,
        password: userCredentials.password,
        displayName: 'Login Student',
        schoolGrade: '12',
        consentAccepted: true,
      });
    });

    it('returns 200 with access token, user, and sets HttpOnly refresh cookie (never exposes refresh token in JSON)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(userCredentials);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: {
          accessToken: expect.any(String),
          expiresIn: 900,
          user: {
            id: expect.any(String),
            email: userCredentials.email,
            role: 'STUDENT',
          },
        },
      });

      // Refresh token must NOT be in JSON
      expect(res.body.data).not.toHaveProperty('refreshToken');

      // Refresh token must be in Set-Cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.length).toBeGreaterThan(0);
      const refreshCookie = cookies[0];
      expect(refreshCookie).toMatch(/^refreshToken=[0-9a-f]{64};/);
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('SameSite=Strict');
      expect(refreshCookie).toContain('Path=/');
      expect(refreshCookie).toContain('Max-Age=604800');
    });

    it('uses __Host- prefix and Secure attribute in secure deployment mode', async () => {
      const secureApp = createApp({
        authService,
        authenticate,
        allowedOrigins: [TRUSTED_ORIGIN],
        isSecure: true, // Secure deployment (production / HTTPS)
        registerLimiter: noopLimiter,
        loginLimiter: noopLimiter,
        refreshLimiter: noopLimiter,
      });

      const res = await request(secureApp)
        .post('/api/v1/auth/login')
        .send(userCredentials);

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toMatch(/^__Host-refreshToken=[0-9a-f]{64};/);
      expect(cookies[0]).toContain('Secure');
      expect(cookies[0]).toContain('HttpOnly');
      expect(cookies[0]).toContain('SameSite=Strict');
      expect(cookies[0]).toContain('Path=/');
      expect(cookies[0]).not.toContain('Domain=');
    });

    it('returns standardized 401 response for nonexistent account without leaking account presence', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'unknown.email@example.test',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
          details: [],
        },
      });
    });

    it('returns standardized 401 response for incorrect password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: userCredentials.email,
          password: 'WrongPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
          details: [],
        },
      });
    });

    it('returns standardized 401 response for suspended account', async () => {
      const user = await fakeRepo.findUserByEmail(userCredentials.email);
      user.status = 'SUSPENDED';

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(userCredentials);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
          details: [],
        },
      });
    });

    it('enforces login rate limiting (429) when limit is exceeded', async () => {
      const strictApp = createApp({
        authService,
        authenticate,
        allowedOrigins: [TRUSTED_ORIGIN],
        loginLimiter: createAuthLimiter({ windowMs: 60000, max: 2, message: 'Too many logins' }),
        registerLimiter: noopLimiter,
        refreshLimiter: noopLimiter,
      });

      await request(strictApp).post('/api/v1/auth/login').send({ email: 'u1@test.com', password: 'p1' });
      await request(strictApp).post('/api/v1/auth/login').send({ email: 'u2@test.com', password: 'p2' });

      const res = await request(strictApp)
        .post('/api/v1/auth/login')
        .send({ email: 'u3@test.com', password: 'p3' });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.body.error.message).toBe('Too many logins');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let rawRefreshToken;
    let refreshCookieHeader;

    beforeEach(async () => {
      await authService.register({
        email: 'refresh.student@example.test',
        password: 'Password123!@#',
        displayName: 'Refresh Student',
        schoolGrade: '10',
        consentAccepted: true,
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'refresh.student@example.test', password: 'Password123!@#' });

      refreshCookieHeader = loginRes.headers['set-cookie'][0].split(';')[0];
      rawRefreshToken = refreshCookieHeader.split('=')[1];
    });

    it('returns 200 with new accessToken and rotates refresh cookie when valid origin is supplied', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', refreshCookieHeader);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: {
          accessToken: expect.any(String),
          expiresIn: 900,
        },
      });

      // Must never expose refresh token in JSON
      expect(res.body.data).not.toHaveProperty('refreshToken');

      // Rotated refresh cookie must be delivered
      const newCookieHeader = res.headers['set-cookie'][0];
      expect(newCookieHeader).toContain('refreshToken=');
      const newRefreshToken = newCookieHeader.split(';')[0].split('=')[1];
      expect(newRefreshToken).not.toBe(rawRefreshToken);
      expect(newRefreshToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it('blocks request with 403 FORBIDDEN when CSRF Origin is missing on refresh', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookieHeader);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('missing Origin or Referer');
    });

    it('blocks request with 403 FORBIDDEN when CSRF Origin is untrusted', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', UNTRUSTED_ORIGIN)
        .set('Cookie', refreshCookieHeader);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Cross-site request blocked: untrusted origin');
    });

    it('permits refresh when valid Referer is supplied instead of Origin', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Referer', `${TRUSTED_ORIGIN}/dashboard`)
        .set('Cookie', refreshCookieHeader);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
    });

    it('returns 401 UNAUTHORIZED when refresh cookie is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Refresh token cookie is required');
    });

    it('returns 401 UNAUTHORIZED when refresh cookie is non-canonical hex', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', `refreshToken=${'A'.repeat(64)}`); // Uppercase hex

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Invalid or malformed refresh token');
    });

    it('returns 401 UNAUTHORIZED when refresh session is expired', async () => {
      // Advance clock past 7-day expiration
      mockCurrentTime += 7 * 24 * 60 * 60 * 1000 + 3600000;

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', refreshCookieHeader);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Refresh token has expired');
    });

    it('enforces refresh rate limiting (429) when limit is exceeded', async () => {
      const strictApp = createApp({
        authService,
        authenticate,
        allowedOrigins: [TRUSTED_ORIGIN],
        refreshLimiter: createAuthLimiter({ windowMs: 60000, max: 2, message: 'Too many refreshes' }),
        registerLimiter: noopLimiter,
        loginLimiter: noopLimiter,
      });

      // 1st and 2nd requests
      await request(strictApp).post('/api/v1/auth/refresh').set('Origin', TRUSTED_ORIGIN).set('Cookie', refreshCookieHeader);
      await request(strictApp).post('/api/v1/auth/refresh').set('Origin', TRUSTED_ORIGIN).set('Cookie', refreshCookieHeader);

      // 3rd is rate limited
      const res = await request(strictApp)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', refreshCookieHeader);

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.body.error.message).toBe('Too many refreshes');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let user;
    let loginRes;
    let refreshCookieHeader;

    beforeEach(async () => {
      const reg = await authService.register({
        email: 'logout.http@example.test',
        password: 'Password123!@#',
        displayName: 'Logout HTTP Student',
        schoolGrade: '9',
        consentAccepted: true,
      });
      user = reg.user;

      loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'logout.http@example.test', password: 'Password123!@#' });

      refreshCookieHeader = loginRes.headers['set-cookie'][0].split(';')[0];
    });

    it('returns 204 No Content with empty body and clears refresh cookie on single-session logout', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', refreshCookieHeader);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');

      // Cookie must be cleared
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(setCookie[0]).toContain('refreshToken=;');
      expect(setCookie[0]).toContain('Expires=Thu, 01 Jan 1970');
    });

    it('blocks logout with 403 FORBIDDEN when CSRF Origin is missing or untrusted', async () => {
      const resMissing = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', refreshCookieHeader);

      expect(resMissing.status).toBe(403);
      expect(resMissing.body.error.code).toBe('FORBIDDEN');

      const resUntrusted = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', UNTRUSTED_ORIGIN)
        .set('Cookie', refreshCookieHeader);

      expect(resUntrusted.status).toBe(403);
      expect(resUntrusted.body.error.code).toBe('FORBIDDEN');
    });

    it('supports all-device logout via verified Bearer token and revokes all user sessions', async () => {
      // Create a second active session
      const login2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'logout.http@example.test', password: 'Password123!@#' });

      const cookie2 = login2.headers['set-cookie'][0].split(';')[0];

      // Logout with allDevices=true and valid Bearer access token
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`)
        .send({ allDevices: true });

      expect(res.status).toBe(204);

      // Verify second session was also revoked
      const refreshAttempt = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookie2);

      expect(refreshAttempt.status).toBe(401);
    });

    it('never trusts client-controlled userId in request body or query for logout', async () => {
      const otherUserUuid = '99999999-9999-4999-8999-999999999999';

      // Attacker attempts to pass a victim's userId in body
      const res = await request(app)
        .post('/api/v1/auth/logout?userId=' + otherUserUuid)
        .set('Origin', TRUSTED_ORIGIN)
        .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`)
        .send({ allDevices: true, userId: otherUserUuid });

      expect(res.status).toBe(204);

      // Only the authenticated user's sessions were affected (verified by user.id)
      const userSessions = [...fakeRepo.sessions.values()].filter((s) => s.userId === user.id);
      expect(userSessions.every((s) => s.revokedAt !== null)).toBe(true);
    });

    it('rejects all-device logout with expired refresh cookie when unauthenticated (401)', async () => {
      // Advance clock past expiration
      mockCurrentTime += 7 * 24 * 60 * 60 * 1000 + 3600000;

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', refreshCookieHeader)
        .send({ allDevices: true });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects single-session logout with 400 BAD_REQUEST when no cookie is supplied', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .send({ allDevices: false });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBe('Refresh token is required for single-session logout');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let studentUser;
    let counsellorUser;
    let adminUser;

    beforeEach(async () => {
      const sReg = await authService.register({
        email: 'me.student@example.test',
        password: 'Password123!@#',
        displayName: 'Me Student',
        schoolGrade: '10',
        consentAccepted: true,
      });
      studentUser = sReg.user;

      // Seed counsellor and admin records in fake repo
      const cId = crypto.randomUUID();
      counsellorUser = {
        id: cId,
        email: 'me.counsellor@example.test',
        displayName: 'Counsellor Alice',
        role: 'COUNSELLOR',
        status: 'ACTIVE',
        passwordHash: await argon2.hash('Password123!'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      fakeRepo.users.set(cId, counsellorUser);
      fakeRepo.emailIndex.set('me.counsellor@example.test', cId);

      const aId = crypto.randomUUID();
      adminUser = {
        id: aId,
        email: 'me.admin@example.test',
        displayName: 'Admin Bob',
        role: 'ADMIN',
        status: 'ACTIVE',
        passwordHash: await argon2.hash('Password123!'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      fakeRepo.users.set(aId, adminUser);
      fakeRepo.emailIndex.set('me.admin@example.test', aId);
    });

    it('returns 200 with authenticated student profile', async () => {
      const token = signAccessToken({
        id: studentUser.id,
        email: studentUser.email,
        role: studentUser.role,
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: {
          user: {
            id: studentUser.id,
            email: studentUser.email,
            role: 'STUDENT',
          },
        },
      });
    });

    it('returns 200 with authenticated counsellor profile', async () => {
      const token = signAccessToken({
        id: counsellorUser.id,
        email: counsellorUser.email,
        role: counsellorUser.role,
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('COUNSELLOR');
    });

    it('returns 200 with authenticated admin profile', async () => {
      const token = signAccessToken({
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('ADMIN');
    });

    it('returns 401 UNAUTHORIZED when Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Authentication token is required');
    });

    it('returns 401 UNAUTHORIZED when Authorization header is malformed', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'InvalidScheme 12345');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Authorization header must follow Bearer <token> format');
    });

    it('returns 401 for expired access token', async () => {
      // Craft expired token using raw jwt.sign directly
      const expiredToken = jwt.sign(
        {
          sub: studentUser.id,
          email: studentUser.email,
          role: studentUser.role,
          iat: Math.floor(Date.now() / 1000) - 120,
          exp: Math.floor(Date.now() / 1000) - 60,
        },
        SYNTHETIC_TEST_JWT_SECRET,
        {
          algorithm: 'HS256',
          issuer: 'career-compass',
          audience: 'career-compass-client',
        }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('denies access with 401 when user account is suspended in database', async () => {
      const token = signAccessToken({
        id: studentUser.id,
        email: studentUser.email,
        role: studentUser.role,
      });

      // Mark user suspended in authoritative database
      const dbUser = await fakeRepo.findUserById(studentUser.id);
      dbUser.status = 'SUSPENDED';

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('User account is suspended');
    });
  });

  describe('CORS Transport Security', () => {
    it('sets Access-Control-Allow-Origin and credentials for allowed frontend origin', async () => {
      const res = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', TRUSTED_ORIGIN);

      expect(res.headers['access-control-allow-origin']).toBe(TRUSTED_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('omits Access-Control-Allow-Origin for unauthorized origin (no wildcard)', async () => {
      const res = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', UNTRUSTED_ORIGIN);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('omits Access-Control-Allow-Origin on preflight for untrusted origin on /auth/refresh', async () => {
      const res = await request(app)
        .options('/api/v1/auth/refresh')
        .set('Origin', UNTRUSTED_ORIGIN);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('omits Access-Control-Allow-Origin on preflight for untrusted origin on /auth/logout', async () => {
      const res = await request(app)
        .options('/api/v1/auth/logout')
        .set('Origin', UNTRUSTED_ORIGIN);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Cookie Parser Security (COOKIE-02)', () => {
    it('uses null-prototype object and prevents prototype pollution from __proto__ and constructor', () => {
      const parsed = parseCookies('__proto__=polluted; constructor=shadowed; theme=dark');
      expect(Object.getPrototypeOf(parsed)).toBeNull();
      expect(parsed.__proto__).toBe('polluted');
      expect(parsed.constructor).toBe('shadowed');
      expect(parsed.theme).toBe('dark');
      expect(({}).polluted).toBeUndefined();
    });

    it('rejects duplicate refreshToken with 400 AppError', () => {
      expect(() => {
        parseCookies('refreshToken=tokenA; refreshToken=tokenB');
      }).toThrowError('Duplicate authentication cookies detected');
    });

    it('rejects duplicate __Host-refreshToken with 400 AppError', () => {
      expect(() => {
        parseCookies('__Host-refreshToken=tokenA; __Host-refreshToken=tokenB');
      }).toThrowError('Duplicate authentication cookies detected');
    });

    it('preserves first occurrence for duplicate non-sensitive cookies (RFC 6265 path specificity)', () => {
      const parsed = parseCookies('pref=first; pref=second; role=student');
      expect(parsed.pref).toBe('first');
      expect(parsed.role).toBe('student');
    });

    it('safely handles malformed percent-encoding without throwing', () => {
      const parsed = parseCookies('safe=hello%20world; malformed=%E0%A4%A; regular=123');
      expect(parsed.safe).toBe('hello world');
      expect(parsed.malformed).toBe('%E0%A4%A');
      expect(parsed.regular).toBe('123');
    });

    it('returns empty null-prototype object for empty, whitespace, or malformed headers', () => {
      expect(parseCookies(undefined)).toEqual(Object.create(null));
      expect(parseCookies('')).toEqual(Object.create(null));
      expect(parseCookies('   ')).toEqual(Object.create(null));
      expect(parseCookies('invalid; no-equals; ;')).toEqual(Object.create(null));
      expect(parseCookies('bad name=val')).toEqual(Object.create(null));
    });
  });

  describe('Secure Cookie Extraction & Boundary (COOKIE-01)', () => {
    beforeEach(async () => {
      await authService.register({
        email: 'login.student@example.test',
        password: 'StrongPassword123!',
        displayName: 'Login Student',
        schoolGrade: '12',
        consentAccepted: true,
      });
    });

    it('in secure mode: extractRefreshCookie accepts only __Host-refreshToken and rejects refreshToken', () => {
      const reqSecure = {
        cookies: {
          refreshToken: 'dev-token-hex',
        },
      };
      expect(extractRefreshCookie(reqSecure, { isSecure: true })).toBeNull();

      const reqWithHost = {
        cookies: {
          '__Host-refreshToken': 'secure-token-hex',
          refreshToken: 'dev-token-hex',
        },
      };
      expect(extractRefreshCookie(reqWithHost, { isSecure: true })).toBe('secure-token-hex');
    });

    it('in development mode: extractRefreshCookie accepts only refreshToken and rejects __Host-refreshToken', () => {
      const reqDev = {
        cookies: {
          '__Host-refreshToken': 'secure-token-hex',
        },
      };
      expect(extractRefreshCookie(reqDev, { isSecure: false })).toBeNull();

      const reqWithDev = {
        cookies: {
          refreshToken: 'dev-token-hex',
        },
      };
      expect(extractRefreshCookie(reqWithDev, { isSecure: false })).toBe('dev-token-hex');
    });

    it('in secure deployment mode: POST /auth/refresh rejects development refreshToken cookie (401)', async () => {
      const secureApp = createApp({
        authService,
        authenticate,
        allowedOrigins: [TRUSTED_ORIGIN],
        isSecure: true,
        registerLimiter: noopLimiter,
        loginLimiter: noopLimiter,
        refreshLimiter: noopLimiter,
      });

      const loginRes = await request(secureApp)
        .post('/api/v1/auth/login')
        .send({ email: 'login.student@example.test', password: 'StrongPassword123!' });

      const secureCookieHeader = loginRes.headers['set-cookie'][0].split(';')[0];
      const rawToken = secureCookieHeader.split('=')[1];

      const res = await request(secureApp)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', `refreshToken=${rawToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Refresh token cookie is required');
    });

    it('in secure deployment mode: POST /auth/logout rejects single-session logout with development cookie (400)', async () => {
      const secureApp = createApp({
        authService,
        authenticate,
        allowedOrigins: [TRUSTED_ORIGIN],
        isSecure: true,
        registerLimiter: noopLimiter,
        loginLimiter: noopLimiter,
        refreshLimiter: noopLimiter,
      });

      const res = await request(secureApp)
        .post('/api/v1/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', `refreshToken=${'a'.repeat(64)}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBe('Refresh token is required for single-session logout');
    });

    it('in development mode: POST /auth/refresh rejects __Host-refreshToken cookie (401)', async () => {
      const devApp = createApp({
        authService,
        authenticate,
        allowedOrigins: [TRUSTED_ORIGIN],
        isSecure: false,
        registerLimiter: noopLimiter,
        loginLimiter: noopLimiter,
        refreshLimiter: noopLimiter,
      });

      const res = await request(devApp)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', `__Host-refreshToken=${'a'.repeat(64)}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('in secure mode: POST /auth/logout clears __Host-refreshToken with Secure, HttpOnly, SameSite=Strict, Path=/', async () => {
      const secureApp = createApp({
        authService,
        authenticate,
        allowedOrigins: [TRUSTED_ORIGIN],
        isSecure: true,
        registerLimiter: noopLimiter,
        loginLimiter: noopLimiter,
        refreshLimiter: noopLimiter,
      });

      const loginRes = await request(secureApp)
        .post('/api/v1/auth/login')
        .send({ email: 'login.student@example.test', password: 'StrongPassword123!' });

      const cookieHeader = loginRes.headers['set-cookie'][0].split(';')[0];

      const res = await request(secureApp)
        .post('/api/v1/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieHeader);

      expect(res.status).toBe(204);
      const setCookies = res.headers['set-cookie'];
      expect(setCookies).toBeDefined();
      const hostClearCookie = setCookies.find((c) => c.startsWith('__Host-refreshToken=;'));
      expect(hostClearCookie).toBeDefined();
      expect(hostClearCookie).toContain('Secure');
      expect(hostClearCookie).toContain('HttpOnly');
      expect(hostClearCookie).toContain('SameSite=Strict');
      expect(hostClearCookie).toContain('Path=/');
      expect(hostClearCookie).toContain('Expires=Thu, 01 Jan 1970');
    });
  });

  describe('Duplicate Cookie HTTP Defense (COOKIE-02)', () => {
    it('returns 400 BAD_REQUEST when duplicate refreshToken cookies are sent to refresh', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', `refreshToken=${'a'.repeat(64)}; refreshToken=${'b'.repeat(64)}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBe('Duplicate authentication cookies detected');
    });

    it('returns 400 BAD_REQUEST when duplicate __Host-refreshToken cookies are sent to refresh', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', `__Host-refreshToken=${'a'.repeat(64)}; __Host-refreshToken=${'b'.repeat(64)}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBe('Duplicate authentication cookies detected');
    });

    it('preserves first occurrence when duplicate non-sensitive cookies accompany refresh', async () => {
      const reg = await authService.register({
        email: 'dup.cookie@example.test',
        password: 'Password123!@#',
        displayName: 'Dup Cookie Student',
        schoolGrade: '11',
        consentAccepted: true,
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'dup.cookie@example.test', password: 'Password123!@#' });

      const rawCookie = loginRes.headers['set-cookie'][0].split(';')[0];

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', `theme=dark; theme=light; ${rawCookie}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
    });
  });

  describe('CSRF Advanced Origin/Referer Validation (CSRF-01)', () => {
    let validCookie;

    beforeEach(async () => {
      await authService.register({
        email: 'csrf.student@example.test',
        password: 'StrongPassword123!',
        displayName: 'CSRF Student',
        schoolGrade: '12',
        consentAccepted: true,
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'csrf.student@example.test', password: 'StrongPassword123!' });
      validCookie = loginRes.headers['set-cookie'][0].split(';')[0];
    });

    it('permits request with allowed Origin alone', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', validCookie);

      expect(res.status).toBe(200);
    });

    it('permits request with allowed Referer alone', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Referer', `${TRUSTED_ORIGIN}/app/dashboard`)
        .set('Cookie', validCookie);

      expect(res.status).toBe(200);
    });

    it('permits request with matching allowed Origin and Referer', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Referer', `${TRUSTED_ORIGIN}/settings`)
        .set('Cookie', validCookie);

      expect(res.status).toBe(200);
    });

    it('blocks request with 403 when Origin and Referer conflict', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Referer', 'https://attacker.evil.test/csrf-attack')
        .set('Cookie', validCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Cross-site request blocked: conflicting Origin and Referer headers');
    });

    it('blocks request with 403 when Referer is malformed', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Referer', 'not-a-valid-referer-url')
        .set('Cookie', validCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Cross-site request blocked: invalid Referer header');
    });

    it('blocks request with 403 when Origin is "null"', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', 'null')
        .set('Cookie', validCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Cross-site request blocked: untrusted origin');
    });

    it('blocks request with 403 when Origin is untrusted', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Origin', UNTRUSTED_ORIGIN)
        .set('Cookie', validCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Cross-site request blocked: untrusted origin');
    });

    it('blocks request with 403 when both Origin and Referer are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', validCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Cross-site request blocked: missing Origin or Referer header');
    });
  });

  describe('Logout Authentication Boundaries & Cross-User Security', () => {
    it('returns 401 when invalid Bearer token is passed to logout', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Authorization', 'Bearer invalid.jwt.token')
        .send({ allDevices: true });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('returns 401 when expired Bearer token is passed to logout', async () => {
      const expiredToken = jwt.sign(
        {
          sub: crypto.randomUUID(),
          email: 'expired@example.test',
          role: 'STUDENT',
          iat: Math.floor(Date.now() / 1000) - 200,
          exp: Math.floor(Date.now() / 1000) - 100,
        },
        SYNTHETIC_TEST_JWT_SECRET,
        {
          algorithm: 'HS256',
          issuer: 'career-compass',
          audience: 'career-compass-client',
        }
      );

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ allDevices: true });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('blocks all-device logout with 403 FORBIDDEN when User A Bearer token is paired with User B cookie', async () => {
      // User A
      await authService.register({
        email: 'user.a@example.test',
        password: 'Password123!@#',
        displayName: 'User A',
        schoolGrade: '10',
        consentAccepted: true,
      });
      const loginA = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'user.a@example.test', password: 'Password123!@#' });
      const tokenA = loginA.body.data.accessToken;

      // User B
      await authService.register({
        email: 'user.b@example.test',
        password: 'Password123!@#',
        displayName: 'User B',
        schoolGrade: '11',
        consentAccepted: true,
      });
      const loginB = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'user.b@example.test', password: 'Password123!@#' });
      const cookieB = loginB.headers['set-cookie'][0].split(';')[0];

      // User A attempts to revoke all devices while presenting User B's cookie
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Cookie', cookieB)
        .send({ allDevices: true });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Authentication identity does not match refresh session');
    });
  });

  describe('Default Registration Rate Limiting & Malformed Payloads', () => {
    it('enforces default registerRateLimiter (5 requests per hour limit)', async () => {
      const rateLimitedApp = createApp({
        authService,
        authenticate,
        allowedOrigins: [TRUSTED_ORIGIN],
      });

      for (let i = 1; i <= 5; i++) {
        const res = await request(rateLimitedApp)
          .post('/api/v1/auth/register')
          .send({
            email: `ratelimit.${i}@example.test`,
            password: 'SecurePassword123!',
            displayName: `Rate Limit User ${i}`,
            schoolGrade: '11',
            consentAccepted: true,
          });
        expect(res.status).toBe(201);
      }

      const resLimited = await request(rateLimitedApp)
        .post('/api/v1/auth/register')
        .send({
          email: 'ratelimit.6@example.test',
          password: 'SecurePassword123!',
          displayName: 'Rate Limit User 6',
          schoolGrade: '11',
          consentAccepted: true,
        });

      expect(resLimited.status).toBe(429);
      expect(resLimited.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(resLimited.body.error.message).toBe('Too many account registration attempts, please try again later.');
    });

    it('returns 400 BAD_REQUEST for malformed JSON payload on register', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"email": "broken-json');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBe('Malformed JSON in request body');
    });

    it('returns 400 BAD_REQUEST for malformed JSON payload on login', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "broken-login');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBe('Malformed JSON in request body');
    });

    it('returns 422 VALIDATION_ERROR when invalid payload format is sent to login', async () => {
      const resInvalidEmail = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'Short' });

      expect(resInvalidEmail.status).toBe(422);
      expect(resInvalidEmail.body.error.code).toBe('VALIDATION_ERROR');

      const resExtraField = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'valid@example.test',
          password: 'Password123!',
          unrecognizedField: 'malicious injection',
        });

      expect(resExtraField.status).toBe(422);
      expect(resExtraField.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Auth Router Dependency Hardening', () => {
    it('throws immediately when authService dependency is missing', () => {
      expect(() => createAuthRouter({ authenticate })).toThrowError(
        'createAuthRouter requires an authService dependency'
      );
    });

    it('throws immediately when authenticate dependency is missing', () => {
      expect(() => createAuthRouter({ authService })).toThrowError(
        'createAuthRouter requires an authenticate middleware function dependency'
      );
    });

    it('throws immediately when authenticate dependency is not a function', () => {
      expect(() => createAuthRouter({ authService, authenticate: 'not-a-function' })).toThrowError(
        'createAuthRouter requires an authenticate middleware function dependency'
      );
      expect(() => createAuthRouter({ authService, authenticate: {} })).toThrowError(
        'createAuthRouter requires an authenticate middleware function dependency'
      );
      expect(() => createAuthRouter({ authService, authenticate: null })).toThrowError(
        'createAuthRouter requires an authenticate middleware function dependency'
      );
    });

    it('successfully instantiates router when valid authenticate function is provided', () => {
      const router = createAuthRouter({ authService, authenticate });
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
    });

    it('rejects logout with 401 when Authorization header is present with malformed Bearer scheme', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Authorization', 'InvalidScheme some-token')
        .send({ allDevices: false });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Authorization header must follow Bearer <token> format');
    });

    it('succeeds with 204 on single-session cookie logout when Authorization header is absent', async () => {
      await authService.register({
        email: 'cookie.logout@example.test',
        password: 'Password123!@#',
        displayName: 'Cookie Logout',
        schoolGrade: '11',
        consentAccepted: true,
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'cookie.logout@example.test', password: 'Password123!@#' });

      const cookieHeader = loginRes.headers['set-cookie'][0].split(';')[0];

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', TRUSTED_ORIGIN)
        .set('Cookie', cookieHeader);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });
  });
});
