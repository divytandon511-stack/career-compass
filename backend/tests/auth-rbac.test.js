import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

import { app } from '../src/app.js';
import { createAuthenticate } from '../src/middleware/authenticate.js';
import { requireRole } from '../src/middleware/rbac.js';
import {
  isOwner,
  assertOwnership,
  resolveResourceOwnerId,
  createRequireOwnership,
} from '../src/middleware/ownership.js';
import { createAuthLimiter } from '../src/middleware/rate-limit.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { AppError } from '../src/utils/app-error.js';
import { signAccessToken } from '../src/utils/jwt.js';

describe('CareerCompass Authentication & RBAC Middleware (Stage 2)', () => {
  const studentUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'student.active@example.test',
    role: 'STUDENT',
    status: 'ACTIVE',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$syntheticHashDoNotLeak',
  };

  const counsellorUser = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'counsellor.active@example.test',
    role: 'COUNSELLOR',
    status: 'ACTIVE',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$syntheticHashDoNotLeak',
  };

  const adminUser = {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'admin.active@example.test',
    role: 'ADMIN',
    status: 'ACTIVE',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$syntheticHashDoNotLeak',
  };

  const suspendedUser = {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'student.suspended@example.test',
    role: 'STUDENT',
    status: 'SUSPENDED',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$syntheticHashDoNotLeak',
  };

  const invalidRoleUser = {
    id: '55555555-5555-4555-8555-555555555555',
    email: 'user.invalidrole@example.test',
    role: 'SUPERADMIN',
    status: 'ACTIVE',
  };

  const otherStudent = {
    id: '88888888-8888-4888-8888-888888888888',
    email: 'other.student@example.test',
    role: 'STUDENT',
    status: 'ACTIVE',
  };

  // Authoritative stub lookup
  const userDatabase = new Map([
    [studentUser.id, studentUser],
    [counsellorUser.id, counsellorUser],
    [adminUser.id, adminUser],
    [suspendedUser.id, suspendedUser],
    [invalidRoleUser.id, invalidRoleUser],
    [otherStudent.id, otherStudent],
  ]);

  const stubFindUserById = vi.fn(async (userId) => {
    return userDatabase.get(userId) || null;
  });

  /**
   * Helper to create an isolated test express application with configured routes
   */
  const createTestApp = (authMiddleware = createAuthenticate({ findUserById: stubFindUserById })) => {
    const testApp = express();
    testApp.use(express.json());

    // 1. Authenticated user profile endpoint
    testApp.get('/test/me', authMiddleware, (req, res) => {
      res.json({ data: { user: req.user } });
    });

    // 2. Student-only endpoint
    testApp.get('/test/student-only', authMiddleware, requireRole('STUDENT'), (req, res) => {
      res.json({ data: { message: 'Student access granted', user: req.user } });
    });

    // 3. Counsellor-only endpoint
    testApp.get('/test/counsellor-only', authMiddleware, requireRole('COUNSELLOR'), (req, res) => {
      res.json({ data: { message: 'Counsellor access granted', user: req.user } });
    });

    // 4. Admin-only endpoint
    testApp.get('/test/admin-only', authMiddleware, requireRole('ADMIN'), (req, res) => {
      res.json({ data: { message: 'Admin access granted', user: req.user } });
    });

    // 5. Multi-role endpoint (Student & Counsellor)
    testApp.get('/test/booking-access', authMiddleware, requireRole('STUDENT', 'COUNSELLOR'), (req, res) => {
      res.json({ data: { message: 'Booking access granted', user: req.user } });
    });

    // 6. Explicit ownership check endpoint (private student attempt lookup using useNotFound)
    testApp.get('/test/attempts/:id', authMiddleware, requireRole('STUDENT'), (req, res, next) => {
      try {
        const mockAttempt = {
          id: req.params.id,
          studentId: studentUser.id,
          status: 'COMPLETED',
        };

        // Enforce explicit ownership: private resource lookup returns 404 instead of 403 to prevent enumeration
        assertOwnership(req.user, mockAttempt, {
          ownerField: 'studentId',
          useNotFound: true,
        });

        res.json({ data: { attempt: mockAttempt } });
      } catch (err) {
        next(err);
      }
    });

    // 7. Ownership check with standard 403 Forbidden
    testApp.delete('/test/resources/:id', authMiddleware, (req, res, next) => {
      try {
        const mockResource = {
          id: req.params.id,
          userId: studentUser.id,
        };

        assertOwnership(req.user, mockResource, {
          ownerField: 'userId',
          useNotFound: false,
        });

        res.status(204).end();
      } catch (err) {
        next(err);
      }
    });

    // Mount standard centralized error handler
    testApp.use(errorHandler);

    return testApp;
  };

  describe('1. Authentication Middleware (createAuthenticate)', () => {
    const testApp = createTestApp();

    it('rejects requests with missing Authorization header with 401 UNAUTHORIZED', async () => {
      const res = await request(testApp).get('/test/me');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is required',
          details: [],
        },
      });
    });

    it('rejects requests with empty or whitespace-only Authorization header with 401 UNAUTHORIZED', async () => {
      const res = await request(testApp)
        .get('/test/me')
        .set('Authorization', '   ');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects non-Bearer authorization schemes with 401 UNAUTHORIZED', async () => {
      const res = await request(testApp)
        .get('/test/me')
        .set('Authorization', 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization header must follow Bearer <token> format',
          details: [],
        },
      });
    });

    it('rejects malformed Bearer headers (missing token or extraneous tokens) with 401 UNAUTHORIZED', async () => {
      // Missing token
      const res1 = await request(testApp)
        .get('/test/me')
        .set('Authorization', 'Bearer');
      expect(res1.status).toBe(401);
      expect(res1.body.error.code).toBe('UNAUTHORIZED');

      // Multiple parts
      const res2 = await request(testApp)
        .get('/test/me')
        .set('Authorization', 'Bearer token1 token2');
      expect(res2.status).toBe(401);
      expect(res2.body.error.code).toBe('UNAUTHORIZED');

      // Non-Bearer prefix
      const res3 = await request(testApp)
        .get('/test/me')
        .set('Authorization', 'Token some-valid-looking-token');
      expect(res3.status).toBe(401);
      expect(res3.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects expired tokens with 401 TOKEN_EXPIRED', async () => {
      const now = Math.floor(Date.now() / 1000);
      const secret = 'synthetic-test-jwt-secret-minimum-32-characters-vitest-runner';

      const expiredToken = jwt.sign(
        {
          sub: studentUser.id,
          email: studentUser.email,
          role: 'STUDENT',
          iat: now - 3600,
          exp: now - 1800,
        },
        secret,
        {
          algorithm: 'HS256',
          issuer: 'career-compass',
          audience: 'career-compass-client',
        }
      );

      const res = await request(testApp)
        .get('/test/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Authentication token has expired',
          details: [],
        },
      });
    });

    it('rejects cryptographically tampered or forged tokens with 401 INVALID_TOKEN', async () => {
      const validToken = signAccessToken(studentUser);
      const tamperedToken = `${validToken.slice(0, -6)}XYZ123`;

      const res = await request(testApp)
        .get('/test/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
          details: [],
        },
      });
    });

    it('successfully authenticates a valid STUDENT and attaches sanitized req.user', async () => {
      const token = signAccessToken(studentUser);

      const res = await request(testApp)
        .get('/test/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toEqual({
        id: studentUser.id,
        email: studentUser.email,
        role: 'STUDENT',
        status: 'ACTIVE',
      });
    });

    it('successfully authenticates a valid COUNSELLOR and attaches sanitized req.user', async () => {
      const token = signAccessToken(counsellorUser);

      const res = await request(testApp)
        .get('/test/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toEqual({
        id: counsellorUser.id,
        email: counsellorUser.email,
        role: 'COUNSELLOR',
        status: 'ACTIVE',
      });
    });

    it('successfully authenticates a valid ADMIN and attaches sanitized req.user', async () => {
      const token = signAccessToken(adminUser);

      const res = await request(testApp)
        .get('/test/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toEqual({
        id: adminUser.id,
        email: adminUser.email,
        role: 'ADMIN',
        status: 'ACTIVE',
      });
    });

    it('strictly guarantees passwords and password hashes are NEVER attached to req.user', async () => {
      const token = signAccessToken(studentUser);

      const res = await request(testApp)
        .get('/test/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).not.toHaveProperty('password');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.body.data.user).not.toHaveProperty('password_hash');
    });

    it('rejects suspended accounts with 401 UNAUTHORIZED even with a valid signed token', async () => {
      const token = signAccessToken(suspendedUser);

      const res = await request(testApp)
        .get('/test/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User account is suspended',
          details: [],
        },
      });
    });

    it('rejects deleted or missing accounts (not in database) with 401 UNAUTHORIZED', async () => {
      const deletedUser = {
        id: '99999999-9999-4999-8999-999999999999',
        email: 'ghost.user@example.test',
        role: 'STUDENT',
      };
      const token = signAccessToken(deletedUser);

      const res = await request(testApp)
        .get('/test/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User account not found',
          details: [],
        },
      });
    });

    it('derives role from authoritative database record, ignoring stale role in JWT', async () => {
      const tokenWithOldRole = signAccessToken({
        id: counsellorUser.id,
        email: counsellorUser.email,
        role: 'STUDENT', // Stale role in JWT
      });

      const res = await request(testApp)
        .get('/test/me')
        .set('Authorization', `Bearer ${tokenWithOldRole}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('COUNSELLOR');
    });

    it('rejects users with invalid or unrecognized stored roles with 401 UNAUTHORIZED', async () => {
      const token = signAccessToken({
        id: invalidRoleUser.id,
        email: invalidRoleUser.email,
        role: 'STUDENT',
      });

      const res = await request(testApp)
        .get('/test/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User account has an invalid or unrecognized role',
          details: [],
        },
      });
    });

    it('fails closed and returns 500 INTERNAL_SERVER_ERROR when authoritative database lookup fails', async () => {
      const failingLookup = vi.fn(async () => {
        throw new Error('Database cluster connection failure');
      });

      const failingApp = createTestApp(createAuthenticate({ findUserById: failingLookup }));
      const token = signAccessToken(studentUser);

      const res = await request(failingApp)
        .get('/test/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          details: [],
        },
      });
      expect(res.body.error).not.toHaveProperty('Database cluster connection failure');
    });

    it('fails closed and returns 500 when findUserById dependency is not provided', async () => {
      const missingDepApp = createTestApp(createAuthenticate());
      const token = signAccessToken(studentUser);

      const res = await request(missingDepApp)
        .get('/test/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    // Fix 1 Regression Tests: Authoritative user record validation
    describe('Fix 1 — Authoritative User Record Schema Validations', () => {
      it('rejects database user missing id with 401 UNAUTHORIZED', async () => {
        const lookup = vi.fn(async () => ({
          email: 'no.id@example.test',
          role: 'STUDENT',
          status: 'ACTIVE',
        }));
        const testAppSchema = createTestApp(createAuthenticate({ findUserById: lookup }));
        const token = signAccessToken(studentUser);

        const res = await request(testAppSchema)
          .get('/test/me')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      });

      it('rejects database user with non-string id with 401 UNAUTHORIZED', async () => {
        const lookup = vi.fn(async () => ({
          id: 123456789,
          email: 'number.id@example.test',
          role: 'STUDENT',
          status: 'ACTIVE',
        }));
        const testAppSchema = createTestApp(createAuthenticate({ findUserById: lookup }));
        const token = signAccessToken(studentUser);

        const res = await request(testAppSchema)
          .get('/test/me')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      });

      it('rejects database user with malformed UUID id with 401 UNAUTHORIZED', async () => {
        const lookup = vi.fn(async () => ({
          id: 'not-a-valid-uuid-format',
          email: 'bad.uuid@example.test',
          role: 'STUDENT',
          status: 'ACTIVE',
        }));
        const testAppSchema = createTestApp(createAuthenticate({ findUserById: lookup }));
        const token = signAccessToken(studentUser);

        const res = await request(testAppSchema)
          .get('/test/me')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      });

      it('rejects database user id different from verified JWT sub with 401 UNAUTHORIZED', async () => {
        const differentUserId = '99999999-9999-4999-8999-999999999999';
        const lookup = vi.fn(async () => ({
          id: differentUserId, // Mismatched DB UUID
          email: 'mismatch@example.test',
          role: 'STUDENT',
          status: 'ACTIVE',
        }));
        const testAppSchema = createTestApp(createAuthenticate({ findUserById: lookup }));
        const token = signAccessToken(studentUser); // Token has studentUser.id

        const res = await request(testAppSchema)
          .get('/test/me')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
        expect(res.body.error.message).toBe('User account identity does not match token subject');
      });

      it('rejects database user missing email or with invalid email format with 401 UNAUTHORIZED', async () => {
        // Missing email
        const lookupMissing = vi.fn(async () => ({
          id: studentUser.id,
          role: 'STUDENT',
          status: 'ACTIVE',
        }));
        const testApp1 = createTestApp(createAuthenticate({ findUserById: lookupMissing }));
        const token = signAccessToken(studentUser);

        const res1 = await request(testApp1)
          .get('/test/me')
          .set('Authorization', `Bearer ${token}`);
        expect(res1.status).toBe(401);
        expect(res1.body.error.code).toBe('UNAUTHORIZED');

        // Invalid email
        const lookupInvalid = vi.fn(async () => ({
          id: studentUser.id,
          email: 'not-an-email',
          role: 'STUDENT',
          status: 'ACTIVE',
        }));
        const testApp2 = createTestApp(createAuthenticate({ findUserById: lookupInvalid }));
        const res2 = await request(testApp2)
          .get('/test/me')
          .set('Authorization', `Bearer ${token}`);
        expect(res2.status).toBe(401);
        expect(res2.body.error.code).toBe('UNAUTHORIZED');
      });

      it('rejects database user represented as an array with 401 UNAUTHORIZED', async () => {
        const lookupArray = vi.fn(async () => [studentUser]);
        const testAppArray = createTestApp(createAuthenticate({ findUserById: lookupArray }));
        const token = signAccessToken(studentUser);

        const res = await request(testAppArray)
          .get('/test/me')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
        expect(res.body.error.message).toBe('User account not found');
      });
    });
  });

  describe('2. Role-Based Access Control (requireRole)', () => {
    const testApp = createTestApp();

    it('rejects unauthenticated requests with 401 UNAUTHORIZED (default deny)', async () => {
      const unauthApp = express();
      unauthApp.get('/no-auth', requireRole('STUDENT'), (req, res) => res.json({ ok: true }));
      unauthApp.use(errorHandler);

      const res = await request(unauthApp).get('/no-auth');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          details: [],
        },
      });
    });

    it('rejects configuration of empty roles with descriptive error', () => {
      expect(() => requireRole()).toThrow(/at least one role/);
      expect(() => requireRole([])).toThrow(/at least one role/);
    });

    it('rejects invalid or pseudo-roles like PUBLIC or AUTH during middleware configuration', () => {
      expect(() => requireRole('PUBLIC')).toThrow(/Invalid role "PUBLIC"/);
      expect(() => requireRole('AUTH')).toThrow(/Invalid role "AUTH"/);
      expect(() => requireRole('SUPERADMIN')).toThrow(/Invalid role "SUPERADMIN"/);
      expect(() => requireRole('student')).toThrow(/Invalid role "student"/);
    });

    it('permits STUDENT accessing STUDENT route, and rejects COUNSELLOR and ADMIN with 403 FORBIDDEN', async () => {
      const studentToken = signAccessToken(studentUser);
      const counsellorToken = signAccessToken(counsellorUser);
      const adminToken = signAccessToken(adminUser);

      // Student succeeds
      const resStudent = await request(testApp)
        .get('/test/student-only')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(resStudent.status).toBe(200);
      expect(resStudent.body.data.message).toBe('Student access granted');

      // Counsellor rejected with 403
      const resCounsellor = await request(testApp)
        .get('/test/student-only')
        .set('Authorization', `Bearer ${counsellorToken}`);
      expect(resCounsellor.status).toBe(403);
      expect(resCounsellor.body).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions to access this resource',
          details: [],
        },
      });

      // Admin rejected with 403 (No automatic admin bypass!)
      const resAdmin = await request(testApp)
        .get('/test/student-only')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(403);
      expect(resAdmin.body.error.code).toBe('FORBIDDEN');
    });

    it('permits COUNSELLOR accessing COUNSELLOR route, and rejects STUDENT and ADMIN with 403', async () => {
      const studentToken = signAccessToken(studentUser);
      const counsellorToken = signAccessToken(counsellorUser);
      const adminToken = signAccessToken(adminUser);

      // Counsellor succeeds
      const resCounsellor = await request(testApp)
        .get('/test/counsellor-only')
        .set('Authorization', `Bearer ${counsellorToken}`);
      expect(resCounsellor.status).toBe(200);

      // Student rejected
      const resStudent = await request(testApp)
        .get('/test/counsellor-only')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(resStudent.status).toBe(403);

      // Admin rejected (No automatic bypass)
      const resAdmin = await request(testApp)
        .get('/test/counsellor-only')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(403);
    });

    it('permits ADMIN accessing ADMIN route, and rejects STUDENT and COUNSELLOR with 403', async () => {
      const studentToken = signAccessToken(studentUser);
      const counsellorToken = signAccessToken(counsellorUser);
      const adminToken = signAccessToken(adminUser);

      // Admin succeeds
      const resAdmin = await request(testApp)
        .get('/test/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);

      // Student rejected
      const resStudent = await request(testApp)
        .get('/test/admin-only')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(resStudent.status).toBe(403);

      // Counsellor rejected
      const resCounsellor = await request(testApp)
        .get('/test/admin-only')
        .set('Authorization', `Bearer ${counsellorToken}`);
      expect(resCounsellor.status).toBe(403);
    });

    it('permits multiple allowed roles when explicitly configured (e.g. STUDENT and COUNSELLOR)', async () => {
      const studentToken = signAccessToken(studentUser);
      const counsellorToken = signAccessToken(counsellorUser);
      const adminToken = signAccessToken(adminUser);

      // Student succeeds
      const resStudent = await request(testApp)
        .get('/test/booking-access')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(resStudent.status).toBe(200);

      // Counsellor succeeds
      const resCounsellor = await request(testApp)
        .get('/test/booking-access')
        .set('Authorization', `Bearer ${counsellorToken}`);
      expect(resCounsellor.status).toBe(200);

      // Admin rejected (not in allowed list for this route)
      const resAdmin = await request(testApp)
        .get('/test/booking-access')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(403);
    });

    it('strictly does not read role or userId from client headers, query string, or body', async () => {
      const studentToken = signAccessToken(studentUser);

      const res = await request(testApp)
        .get('/test/admin-only?role=ADMIN&userId=' + adminUser.id)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('X-User-Role', 'ADMIN')
        .set('X-User-Id', adminUser.id)
        .send({ role: 'ADMIN', userId: adminUser.id });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('3. Ownership Boundary (isOwner, assertOwnership, createRequireOwnership)', () => {
    const testApp = createTestApp();

    describe('Core isOwner & resolveResourceOwnerId helpers', () => {
      it('correctly compares direct string UUID owner identifiers', () => {
        expect(isOwner(studentUser, studentUser.id)).toBe(true);
        expect(isOwner(studentUser, otherStudent.id)).toBe(false);
      });

      it('rejects malformed string identifiers that are not valid UUIDs', () => {
        expect(isOwner(studentUser, 'not-a-valid-uuid')).toBe(false);
      });

      it('resolves owner from explicitly configured ownerField', () => {
        expect(isOwner(studentUser, { studentId: studentUser.id }, { ownerField: 'studentId' })).toBe(true);
        expect(isOwner(studentUser, { userId: studentUser.id }, { ownerField: 'userId' })).toBe(true);
        expect(isOwner(counsellorUser, { counsellorId: counsellorUser.id }, { ownerField: 'counsellorId' })).toBe(true);
      });

      it('resolves owner using an explicit getOwnerId extractor function', () => {
        const extractor = (res) => res.studentId;
        expect(isOwner(studentUser, { studentId: studentUser.id }, { getOwnerId: extractor })).toBe(true);
      });

      it('returns false for unauthenticated user or null/undefined resource', () => {
        expect(isOwner(null, { userId: studentUser.id }, { ownerField: 'userId' })).toBe(false);
        expect(isOwner(undefined, { userId: studentUser.id }, { ownerField: 'userId' })).toBe(false);
        expect(isOwner(studentUser, null)).toBe(false);
        expect(isOwner(studentUser, undefined)).toBe(false);
      });

      it('handles case-insensitive and trimmed UUID strings safely', () => {
        expect(isOwner({ id: '  11111111-1111-4111-8111-111111111111  ' }, studentUser.id.toUpperCase())).toBe(true);
      });
    });

    describe('Fix 2 — Removal of Automatic Owner-Field Guessing', () => {
      const mockBooking = {
        id: '77777777-7777-4777-8777-777777777777',
        studentId: studentUser.id,
        counsellorId: counsellorUser.id,
      };

      it('handles Booking containing both studentId and counsellorId without field confusion', () => {
        // Valid explicit student ownership check
        expect(isOwner(studentUser, mockBooking, { ownerField: 'studentId' })).toBe(true);
        expect(isOwner(counsellorUser, mockBooking, { ownerField: 'studentId' })).toBe(false);

        // Valid explicit counsellor ownership check
        expect(isOwner(counsellorUser, mockBooking, { ownerField: 'counsellorId' })).toBe(true);
        expect(isOwner(studentUser, mockBooking, { ownerField: 'counsellorId' })).toBe(false);
      });

      it('fails closed on object ownership check when ownerField is omitted (no guessing)', () => {
        // Omitting ownerField must return false, never guess studentId or counsellorId
        expect(isOwner(studentUser, mockBooking)).toBe(false);
        expect(isOwner(counsellorUser, mockBooking)).toBe(false);
        expect(resolveResourceOwnerId(mockBooking)).toBe(null);
      });

      it('fails closed when resource primary key id matches user ID but no ownerField is configured', () => {
        const resourceWithMatchingPk = {
          id: studentUser.id, // Primary key happens to equal studentUser UUID
          title: 'Unrelated Resource',
        };

        // Must NOT conflate resource.id with ownership
        expect(isOwner(studentUser, resourceWithMatchingPk)).toBe(false);
        expect(resolveResourceOwnerId(resourceWithMatchingPk)).toBe(null);
      });

      it('fails closed when configured ownerField does not exist on the resource', () => {
        expect(isOwner(studentUser, mockBooking, { ownerField: 'nonExistentOwnerField' })).toBe(false);
      });

      it('assertOwnership fails closed when ownerField is missing for an object resource', () => {
        expect(() => assertOwnership(studentUser, mockBooking)).toThrow(AppError);
        try {
          assertOwnership(studentUser, mockBooking);
        } catch (err) {
          expect(err.statusCode).toBe(403);
          expect(err.code).toBe('FORBIDDEN');
        }
      });
    });

    describe('assertOwnership behavior & error envelopes', () => {
      it('throws 401 UNAUTHORIZED when currentUser is missing', () => {
        expect(() => assertOwnership(null, { userId: studentUser.id }, { ownerField: 'userId' })).toThrowError(AppError);
        try {
          assertOwnership(null, { userId: studentUser.id }, { ownerField: 'userId' });
        } catch (err) {
          expect(err.statusCode).toBe(401);
          expect(err.code).toBe('UNAUTHORIZED');
        }
      });

      it('throws 404 NOT_FOUND when resource is null or undefined', () => {
        try {
          assertOwnership(studentUser, null, { ownerField: 'studentId' });
        } catch (err) {
          expect(err.statusCode).toBe(404);
          expect(err.code).toBe('NOT_FOUND');
        }
      });

      it('returns true when user explicitly owns the resource', () => {
        expect(assertOwnership(studentUser, { studentId: studentUser.id }, { ownerField: 'studentId' })).toBe(true);
      });

      it('throws 403 FORBIDDEN on ownership mismatch when useNotFound is false', () => {
        try {
          assertOwnership(otherStudent, { studentId: studentUser.id }, { ownerField: 'studentId' });
        } catch (err) {
          expect(err.statusCode).toBe(403);
          expect(err.code).toBe('FORBIDDEN');
        }
      });

      it('throws 404 NOT_FOUND on ownership mismatch when useNotFound is true (preventing student resource enumeration)', () => {
        try {
          assertOwnership(otherStudent, { studentId: studentUser.id }, { ownerField: 'studentId', useNotFound: true });
        } catch (err) {
          expect(err.statusCode).toBe(404);
          expect(err.code).toBe('NOT_FOUND');
          expect(err.message).toBe('Resource not found');
        }
      });

      it('strictly prevents implicit ADMIN bypass in ownership assertions', () => {
        const studentResource = { studentId: studentUser.id };

        // Admin attempting access without ownership throws 403
        expect(() => assertOwnership(adminUser, studentResource, { ownerField: 'studentId' })).toThrow(AppError);
        try {
          assertOwnership(adminUser, studentResource, { ownerField: 'studentId' });
        } catch (err) {
          expect(err.statusCode).toBe(403);
          expect(err.code).toBe('FORBIDDEN');
        }

        // Admin attempting access with useNotFound=true throws 404
        try {
          assertOwnership(adminUser, studentResource, { ownerField: 'studentId', useNotFound: true });
        } catch (err) {
          expect(err.statusCode).toBe(404);
          expect(err.code).toBe('NOT_FOUND');
        }
      });
    });

    describe('HTTP Route Integration for Ownership', () => {
      it('permits student accessing own assessment attempt', async () => {
        const token = signAccessToken(studentUser);

        const res = await request(testApp)
          .get('/test/attempts/mock-attempt-123')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.attempt.id).toBe('mock-attempt-123');
        expect(res.body.data.attempt.studentId).toBe(studentUser.id);
      });

      it('returns 404 NOT_FOUND (not 403) when another student attempts to access a private attempt (preventing enumeration)', async () => {
        const otherToken = signAccessToken(otherStudent);

        const res = await request(testApp)
          .get('/test/attempts/mock-attempt-123')
          .set('Authorization', `Bearer ${otherToken}`);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({
          error: {
            code: 'NOT_FOUND',
            message: 'Resource not found',
            details: [],
          },
        });
      });

      it('returns 403 FORBIDDEN when user attempts to delete a resource owned by another user', async () => {
        const otherToken = signAccessToken(otherStudent);

        const res = await request(testApp)
          .delete('/test/resources/mock-res-123')
          .set('Authorization', `Bearer ${otherToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('permits deletion when user is the true owner', async () => {
        const token = signAccessToken(studentUser);

        const res = await request(testApp)
          .delete('/test/resources/mock-res-123')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(204);
      });
    });

    describe('Fix 3 — Async Resource Retrieval in createRequireOwnership Middleware Factory', () => {
      it('validates middleware configuration at initialization time', () => {
        expect(() => createRequireOwnership({ getResource: 'not-a-func' })).toThrow(/must be a function/);
        expect(() => createRequireOwnership({})).toThrow(/requires an explicit "ownerField"/);
        expect(() => createRequireOwnership({ ownerField: '' })).toThrow(/requires an explicit "ownerField"/);
      });

      it('successfully awaits async getResource and grants access to owner', async () => {
        const asyncApp = express();
        const auth = createAuthenticate({ findUserById: stubFindUserById });

        const asyncGetResource = vi.fn(async (req) => {
          // Simulate async database query latency
          await new Promise((r) => setTimeout(r, 5));
          return {
            id: req.params.id,
            studentId: studentUser.id,
          };
        });

        asyncApp.get(
          '/async-test/:id',
          auth,
          createRequireOwnership({
            getResource: asyncGetResource,
            ownerField: 'studentId',
            useNotFound: true,
          }),
          (req, res) => res.json({ success: true })
        );
        asyncApp.use(errorHandler);

        const studentToken = signAccessToken(studentUser);
        const res = await request(asyncApp)
          .get('/async-test/mock-1')
          .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
        expect(asyncGetResource).toHaveBeenCalledTimes(1);
      });

      it('handles rejected promises from async getResource through next(err) without crashing', async () => {
        const failingAsyncApp = express();
        const auth = createAuthenticate({ findUserById: stubFindUserById });

        const failingGetResource = vi.fn(async () => {
          throw new Error('Database connection pool exhausted');
        });

        failingAsyncApp.get(
          '/async-fail/:id',
          auth,
          createRequireOwnership({
            getResource: failingGetResource,
            ownerField: 'studentId',
          }),
          (req, res) => res.json({ success: true })
        );
        failingAsyncApp.use(errorHandler);

        const studentToken = signAccessToken(studentUser);
        const res = await request(failingAsyncApp)
          .get('/async-fail/mock-1')
          .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(500);
        expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
        expect(res.body.error).not.toHaveProperty('Database connection pool exhausted');
      });

      it('returns 404 NOT_FOUND when async getResource returns null or undefined', async () => {
        const notFoundApp = express();
        const auth = createAuthenticate({ findUserById: stubFindUserById });

        const missingGetResource = vi.fn(async () => null);

        notFoundApp.get(
          '/async-missing/:id',
          auth,
          createRequireOwnership({
            getResource: missingGetResource,
            ownerField: 'studentId',
            useNotFound: true,
          }),
          (req, res) => res.json({ success: true })
        );
        notFoundApp.use(errorHandler);

        const studentToken = signAccessToken(studentUser);
        const res = await request(notFoundApp)
          .get('/async-missing/mock-1')
          .set('Authorization', `Bearer ${studentToken}`);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({
          error: {
            code: 'NOT_FOUND',
            message: 'Resource not found',
            details: [],
          },
        });
      });
    });
  });

  describe('4. Rate Limiting Middleware (createAuthLimiter)', () => {
    it('returns 429 RATE_LIMIT_EXCEEDED with standard error envelope when limit is exceeded', async () => {
      const limiterApp = express();
      limiterApp.use(express.json());

      const testLimiter = createAuthLimiter({
        windowMs: 60 * 1000,
        max: 2,
        message: 'Too many authentication attempts from this IP, please try again later.',
      });

      limiterApp.post('/auth/test-login', testLimiter, (req, res) => {
        res.json({ ok: true });
      });
      limiterApp.use(errorHandler);

      // Request 1: Allowed
      const res1 = await request(limiterApp).post('/auth/test-login').send({ email: 'test@example.com' });
      expect(res1.status).toBe(200);

      // Request 2: Allowed
      const res2 = await request(limiterApp).post('/auth/test-login').send({ email: 'test@example.com' });
      expect(res2.status).toBe(200);

      // Request 3: Throttled (429)
      const res3 = await request(limiterApp).post('/auth/test-login').send({ email: 'test@example.com' });
      expect(res3.status).toBe(429);
      expect(res3.body).toEqual({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many authentication attempts from this IP, please try again later.',
          details: [],
        },
      });
      expect(res3.headers).toHaveProperty('ratelimit-limit');
      expect(res3.headers).toHaveProperty('ratelimit-remaining');
    });
  });

  describe('5. Health Check Endpoints Regression', () => {
    it('verifies GET /api/v1/health continues to function without authentication', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: {
          status: 'ok',
        },
      });
    });

    it('verifies root GET /health continues to function without authentication', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        data: {
          status: 'ok',
        },
      });
    });
  });
});
