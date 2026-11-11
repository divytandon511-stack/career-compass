import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { AppError } from '../src/utils/app-error.js';
import {
  signAccessToken,
  verifyAccessToken,
  getJwtConfig,
  ALLOWED_ROLES,
  ALLOWED_JWT_ALGORITHMS,
  MIN_ACCESS_TOKEN_LIFETIME,
  MAX_ACCESS_TOKEN_LIFETIME,
} from '../src/utils/jwt.js';

describe('JWT Access Token Utilities', () => {
  const validUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'student.demo@example.test',
    role: 'STUDENT',
  };

  const testSecret = 'test-secret-with-at-least-32-characters-for-jwt-signing';

  it('exports strictly allowlisted algorithms, roles, and lifetime bounds', () => {
    expect(ALLOWED_JWT_ALGORITHMS).toEqual(['HS256']);
    expect(ALLOWED_ROLES).toEqual(['STUDENT', 'COUNSELLOR', 'ADMIN']);
    expect(MIN_ACCESS_TOKEN_LIFETIME).toBe(1);
    expect(MAX_ACCESS_TOKEN_LIFETIME).toBe(900);
  });

  it('signs and successfully verifies a valid access token with required claims', () => {
    const token = signAccessToken(validUser, { secret: testSecret });

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // Standard header.payload.signature

    const decoded = verifyAccessToken(token, { secret: testSecret });

    expect(decoded.sub).toBe(validUser.id);
    expect(decoded.email).toBe(validUser.email);
    expect(decoded.role).toBe(validUser.role);
    expect(decoded.iss).toBe('career-compass');
    expect(decoded.aud).toBe('career-compass-client');
    expect(typeof decoded.exp).toBe('number');
    expect(typeof decoded.iat).toBe('number');

    // Default TTL assertion: exp - iat should match default 900 seconds
    expect(decoded.exp - decoded.iat).toBe(900);
  });

  it('accepts valid UUID when provided via "sub" instead of "id"', () => {
    const userWithSub = {
      sub: '22222222-2222-4222-8222-222222222222',
      email: 'counsellor@example.test',
      role: 'COUNSELLOR',
    };

    const token = signAccessToken(userWithSub, { secret: testSecret });
    const decoded = verifyAccessToken(token, { secret: testSecret });

    expect(decoded.sub).toBe(userWithSub.sub);
    expect(decoded.role).toBe('COUNSELLOR');
  });

  it('strictly excludes sensitive fields, passwords, hashes, and unapproved tenancy claims from payload', () => {
    const userWithSensitiveData = {
      ...validUser,
      password: 'PlaintextPassword123!',
      passwordHash: '$argon2id$...',
      schoolId: 'unapproved-school-id',
      profile: { bio: 'secret' },
    };

    const token = signAccessToken(userWithSensitiveData, { secret: testSecret });
    const decoded = verifyAccessToken(token, { secret: testSecret });

    expect(decoded).not.toHaveProperty('password');
    expect(decoded).not.toHaveProperty('passwordHash');
    expect(decoded).not.toHaveProperty('schoolId');
    expect(decoded).not.toHaveProperty('profile');
  });

  it('rejects invalid or malformed user UUIDs during signing', () => {
    const invalidIds = [
      '123',
      'not-a-valid-uuid',
      '11111111-1111-1111-1111',
      '',
      '   ',
      null,
      undefined,
      12345,
    ];

    for (const invalidId of invalidIds) {
      expect(() =>
        signAccessToken({ id: invalidId, email: validUser.email, role: 'STUDENT' })
      ).toThrow(TypeError);
    }
  });

  it('rejects invalid or incomplete user objects for signing', () => {
    // Missing ID
    expect(() => signAccessToken({ email: 'test@example.test', role: 'STUDENT' })).toThrow(TypeError);

    // Missing Email
    expect(() => signAccessToken({ id: validUser.id, role: 'STUDENT' })).toThrow(TypeError);

    // Missing Role
    expect(() => signAccessToken({ id: validUser.id, email: 'test@example.test' })).toThrow(TypeError);

    // Invalid Role
    expect(() => signAccessToken({ id: validUser.id, email: 'test@example.test', role: 'SUPERUSER' })).toThrow(TypeError);

    // Non-object
    expect(() => signAccessToken(null)).toThrow(TypeError);
  });

  describe('JWT Lifetime Validation (Fix 1)', () => {
    it('accepts valid bounded lifetimes between 1 and 900 seconds', () => {
      // Lower bound
      expect(getJwtConfig({ secret: testSecret, expiresIn: 1 }).expiresIn).toBe(1);

      // Upper bound (default 900 seconds)
      expect(getJwtConfig({ secret: testSecret, expiresIn: 900 }).expiresIn).toBe(900);

      // Intermediate value
      expect(getJwtConfig({ secret: testSecret, expiresIn: 300 }).expiresIn).toBe(300);

      // String numeric format coerced cleanly
      expect(getJwtConfig({ secret: testSecret, expiresIn: '600' }).expiresIn).toBe(600);
    });

    it('rejects invalid, negative, zero, fractional, NaN, Infinity, and oversized lifetimes', () => {
      const invalidLifetimes = [
        -1,
        0,
        -100,
        901,
        10000,
        1.5,
        3.14159,
        NaN,
        Infinity,
        -Infinity,
        'not-a-number',
        '901',
        '-5',
        null,
      ];

      for (const invalidVal of invalidLifetimes) {
        expect(() =>
          getJwtConfig({ secret: testSecret, expiresIn: invalidVal })
        ).toThrow(/JWT expiration lifetime must be a positive integer between 1 and 900 seconds/);

        expect(() =>
          signAccessToken(validUser, { secret: testSecret, expiresIn: invalidVal })
        ).toThrow(/JWT expiration lifetime must be a positive integer between 1 and 900 seconds/);
      }
    });

    it('rejects expired JWT tokens with TOKEN_EXPIRED code using a separately constructed expired token', () => {
      // Construct a cryptographically signed expired JWT directly via raw jwt.sign
      const expiredToken = jwt.sign(
        {
          sub: validUser.id,
          email: validUser.email,
          role: validUser.role,
          iat: Math.floor(Date.now() / 1000) - 120, // Issued 2 minutes ago
          exp: Math.floor(Date.now() / 1000) - 60,  // Expired 1 minute ago
        },
        testSecret,
        {
          algorithm: 'HS256',
          issuer: 'career-compass',
          audience: 'career-compass-client',
        }
      );

      try {
        verifyAccessToken(expiredToken, { secret: testSecret });
        expect.fail('Should have thrown TOKEN_EXPIRED error');
      } catch (err) {
        expect(err.code).toBe('TOKEN_EXPIRED');
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Authentication token has expired');
        expect(typeof err.expiredAt).toBe('object');
      }
    });
  });

  describe('Sanitized Verification Error Handling (Fix 2)', () => {
    it('returns generic sanitized INVALID_TOKEN 401 error for malformed signatures without leaking raw library messages', () => {
      const validToken = signAccessToken(validUser, { secret: testSecret });
      const parts = validToken.split('.');

      // Tamper with signature bytes
      const tamperedToken = `${parts[0]}.${parts[1]}.tampered_signature_bytes`;

      try {
        verifyAccessToken(tamperedToken, { secret: testSecret });
        expect.fail('Should have thrown INVALID_TOKEN error');
      } catch (err) {
        expect(err.code).toBe('INVALID_TOKEN');
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid authentication token');
        expect(err.message).not.toContain('invalid signature');
      }
    });

    it('returns generic sanitized INVALID_TOKEN 401 error for token signed with a different secret', () => {
      const differentSecret = 'another-completely-different-secret-key-32chars';
      const token = signAccessToken(validUser, { secret: differentSecret });

      try {
        verifyAccessToken(token, { secret: testSecret });
        expect.fail('Should have rejected token signed with wrong secret');
      } catch (err) {
        expect(err.code).toBe('INVALID_TOKEN');
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid authentication token');
      }
    });

    it('returns generic sanitized INVALID_TOKEN 401 error for mismatched issuer or audience', () => {
      const token = signAccessToken(validUser, { secret: testSecret });

      // Wrong expected issuer
      try {
        verifyAccessToken(token, { secret: testSecret, issuer: 'malicious-issuer' });
        expect.fail('Should have rejected wrong issuer');
      } catch (err) {
        expect(err.code).toBe('INVALID_TOKEN');
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid authentication token');
        expect(err.message).not.toContain('jwt issuer invalid');
      }

      // Wrong expected audience
      try {
        verifyAccessToken(token, { secret: testSecret, audience: 'wrong-audience' });
        expect.fail('Should have rejected wrong audience');
      } catch (err) {
        expect(err.code).toBe('INVALID_TOKEN');
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid authentication token');
        expect(err.message).not.toContain('jwt audience invalid');
      }
    });

    it('returns generic sanitized INVALID_TOKEN 401 error when decoded subject is not a valid UUID', () => {
      // Forged or legacy token with non-UUID subject signed with legitimate key
      const forgedToken = jwt.sign(
        {
          sub: 'not-a-uuid-string',
          email: validUser.email,
          role: 'STUDENT',
        },
        testSecret,
        {
          algorithm: 'HS256',
          expiresIn: 900,
          issuer: 'career-compass',
          audience: 'career-compass-client',
        }
      );

      try {
        verifyAccessToken(forgedToken, { secret: testSecret });
        expect.fail('Should have rejected non-UUID subject claim');
      } catch (err) {
        expect(err.code).toBe('INVALID_TOKEN');
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid authentication token');
      }
    });

    it('returns generic sanitized INVALID_TOKEN 401 error when decoded role is unauthorized or unrecognized', () => {
      // Token signed with legitimate key but carrying an unauthorized/injected role
      const forgedToken = jwt.sign(
        {
          sub: validUser.id,
          email: validUser.email,
          role: 'SUPERADMIN',
        },
        testSecret,
        {
          algorithm: 'HS256',
          expiresIn: 900,
          issuer: 'career-compass',
          audience: 'career-compass-client',
        }
      );

      try {
        verifyAccessToken(forgedToken, { secret: testSecret });
        expect.fail('Should have rejected unauthorized role claim');
      } catch (err) {
        expect(err.code).toBe('INVALID_TOKEN');
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid authentication token');
      }
    });

    it('returns generic sanitized INVALID_TOKEN 401 error when decoded email is missing or malformed', () => {
      const forgedToken = jwt.sign(
        {
          sub: validUser.id,
          email: 'invalid-email-format',
          role: 'STUDENT',
        },
        testSecret,
        {
          algorithm: 'HS256',
          expiresIn: 900,
          issuer: 'career-compass',
          audience: 'career-compass-client',
        }
      );

      try {
        verifyAccessToken(forgedToken, { secret: testSecret });
        expect.fail('Should have rejected malformed email claim');
      } catch (err) {
        expect(err.code).toBe('INVALID_TOKEN');
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid authentication token');
      }
    });

    it('rejects tokens signed with the unsigned "none" algorithm (algorithm confusion defense)', () => {
      // Manually forge an unsigned token with alg: none
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: validUser.id,
          email: validUser.email,
          role: validUser.role,
          iss: 'career-compass',
          aud: 'career-compass-client',
        })
      ).toString('base64url');

      const unsignedToken = `${header}.${payload}.`;

      try {
        verifyAccessToken(unsignedToken, { secret: testSecret });
        expect.fail('Should have rejected unsigned "none" token');
      } catch (err) {
        expect(err.code).toBe('INVALID_TOKEN');
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Invalid authentication token');
      }
    });
  });

  describe('Configuration & Interface Boundaries', () => {
    it('preserves standard Error for genuine configuration failures (not masked as 401)', () => {
      // Secret too short throws configuration Error, not AppError(401)
      expect(() => getJwtConfig({ secret: 'too-short-secret' })).toThrow(Error);
      expect(() => getJwtConfig({ secret: 'too-short-secret' })).not.toThrow(AppError);

      // Algorithm "none" throws configuration Error
      expect(() => getJwtConfig({ algorithm: 'none', secret: testSecret })).toThrow(/forbidden/);
    });

    it('rejects non-string or empty token verification inputs with UNAUTHORIZED', () => {
      expect(() => verifyAccessToken('')).toThrow();
      expect(() => verifyAccessToken(null)).toThrow();
      expect(() => verifyAccessToken(undefined)).toThrow();
      expect(() => verifyAccessToken('   ')).toThrow();
    });
  });
});
