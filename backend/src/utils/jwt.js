import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from './app-error.js';

export const ALLOWED_ROLES = ['STUDENT', 'COUNSELLOR', 'ADMIN'];
export const ALLOWED_JWT_ALGORITHMS = ['HS256'];
export const MIN_ACCESS_TOKEN_LIFETIME = 1;
export const MAX_ACCESS_TOKEN_LIFETIME = 900;

const uuidSchema = z.string().uuid({ message: 'User id/sub must be a valid UUID' });
const roleSchema = z.enum(ALLOWED_ROLES, { message: `User role must be one of: ${ALLOWED_ROLES.join(', ')}` });
const emailSchema = z.string().trim().email({ message: 'User email must be a valid email' });

/**
 * Validates and resolves the active JWT configuration.
 * Enforces minimum secret length (32 characters), algorithm allowlist, and bounded lifetime (1 to 900 seconds).
 *
 * @param {Record<string, unknown>} [overrides={}]
 * @returns {{ secret: string, algorithm: string, expiresIn: number, issuer: string, audience: string }}
 */
export const getJwtConfig = (overrides = {}) => {
  const secret = 'secret' in overrides ? overrides.secret : (env.JWT_SECRET || process.env.JWT_SECRET);

  if (!secret || typeof secret !== 'string' || secret.length < 32) {
    throw new Error('JWT secret must be a string of at least 32 characters');
  }

  const algorithm = (overrides.algorithm || 'HS256').toUpperCase();

  if (algorithm === 'NONE') {
    throw new Error('Algorithm "none" is strictly forbidden');
  }

  if (!ALLOWED_JWT_ALGORITHMS.includes(algorithm)) {
    throw new Error(`JWT signing algorithm must be one of: ${ALLOWED_JWT_ALGORITHMS.join(', ')}`);
  }

  const rawExpiresIn = 'expiresIn' in overrides ? overrides.expiresIn : (env.JWT_EXPIRES_IN || 900);
  const expiresIn = typeof rawExpiresIn === 'string' && /^\d+$/.test(rawExpiresIn.trim())
    ? parseInt(rawExpiresIn.trim(), 10)
    : Number(rawExpiresIn);

  if (
    typeof expiresIn !== 'number' ||
    !Number.isFinite(expiresIn) ||
    !Number.isInteger(expiresIn) ||
    expiresIn < MIN_ACCESS_TOKEN_LIFETIME ||
    expiresIn > MAX_ACCESS_TOKEN_LIFETIME
  ) {
    throw new Error(
      `JWT expiration lifetime must be a positive integer between ${MIN_ACCESS_TOKEN_LIFETIME} and ${MAX_ACCESS_TOKEN_LIFETIME} seconds`
    );
  }

  return {
    secret,
    algorithm,
    expiresIn,
    issuer: overrides.issuer || env.JWT_ISSUER || 'career-compass',
    audience: overrides.audience || env.JWT_AUDIENCE || 'career-compass-client',
  };
};

/**
 * Signs a short-lived access JWT (proposed TTL: 900 seconds / 15 minutes).
 * Strictly validates user ID as a UUID and role against allowlist.
 * Packages minimal authorization claims: sub, email, role.
 *
 * NOTE: Never include passwords, password hashes, profile PII, or unapproved tenancy fields.
 *
 * @param {{ id?: string, sub?: string, email: string, role: 'STUDENT' | 'COUNSELLOR' | 'ADMIN' }} user
 * @param {Record<string, unknown>} [options={}] - Optional configuration overrides (e.g. for testing)
 * @returns {string} Signed compact JWT string
 */
export const signAccessToken = (user, options = {}) => {
  if (!user || typeof user !== 'object') {
    throw new TypeError('User must be an object');
  }

  const userId = user.id || user.sub;
  const uuidValidation = uuidSchema.safeParse(userId);
  if (!uuidValidation.success) {
    throw new TypeError('User must have a valid UUID id or sub');
  }

  const roleValidation = roleSchema.safeParse(user.role);
  if (!roleValidation.success) {
    throw new TypeError(`User role must be one of: ${ALLOWED_ROLES.join(', ')}`);
  }

  const emailValidation = emailSchema.safeParse(user.email);
  if (!emailValidation.success) {
    throw new TypeError('User must have a valid string email');
  }

  const config = getJwtConfig(options);

  const payload = {
    sub: userId.trim(),
    email: user.email.trim().toLowerCase(),
    role: user.role,
  };

  return jwt.sign(payload, config.secret, {
    algorithm: config.algorithm,
    expiresIn: config.expiresIn,
    issuer: config.issuer,
    audience: config.audience,
  });
};

/**
 * Verifies and decodes a signed access JWT.
 * Enforces algorithm allowlist, issuer, audience, and signature validity.
 * Validates that decoded subject is a UUID and role belongs to allowlist.
 * Returns sanitized, generic error envelopes without exposing internal jsonwebtoken messages.
 *
 * IMPORTANT ARCHITECTURAL INVARIANT:
 * Successful cryptographic token verification alone does NOT prove that the user
 * account is currently ACTIVE. An authoritative database lookup on user status
 * must be performed during session authentication middleware.
 *
 * @param {string} token - Raw compact JWT string
 * @param {Record<string, unknown>} [options={}] - Optional configuration overrides
 * @returns {{ sub: string, email: string, role: string, iss: string, aud: string, exp: number, iat: number }}
 */
export const verifyAccessToken = (token, options = {}) => {
  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new AppError('UNAUTHORIZED', 'Authentication token must be a non-empty string', 401);
  }

  // Configuration resolution: genuine configuration errors bubble up as standard errors
  const config = getJwtConfig(options);

  let decoded;
  try {
    decoded = jwt.verify(token.trim(), config.secret, {
      algorithms: [config.algorithm], // Disallows 'none' and enforces allowlisted algorithm
      issuer: config.issuer,
      audience: config.audience,
      complete: false,
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new AppError('TOKEN_EXPIRED', 'Authentication token has expired', 401);
      error.expiredAt = err.expiredAt;
      throw error;
    }

    // Generic sanitized error: do not expose raw jsonwebtoken messages to callers
    throw new AppError('INVALID_TOKEN', 'Invalid authentication token', 401);
  }

  // Validate decoded claims after cryptographic verification; return generic error on failure
  if (!decoded || typeof decoded !== 'object') {
    throw new AppError('INVALID_TOKEN', 'Invalid authentication token', 401);
  }

  const subjectValidation = uuidSchema.safeParse(decoded.sub);
  if (!subjectValidation.success) {
    throw new AppError('INVALID_TOKEN', 'Invalid authentication token', 401);
  }

  const roleValidation = roleSchema.safeParse(decoded.role);
  if (!roleValidation.success) {
    throw new AppError('INVALID_TOKEN', 'Invalid authentication token', 401);
  }

  const emailValidation = emailSchema.safeParse(decoded.email);
  if (!emailValidation.success) {
    throw new AppError('INVALID_TOKEN', 'Invalid authentication token', 401);
  }

  return decoded;
};
