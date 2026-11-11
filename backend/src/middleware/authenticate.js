import { z } from 'zod';
import { AppError } from '../utils/app-error.js';
import { verifyAccessToken, ALLOWED_ROLES } from '../utils/jwt.js';

const authoritativeUserSchema = z.object({
  id: z.string().uuid({ message: 'User id must be a valid UUID' }),
  email: z.string().trim().email({ message: 'User email must be a valid email' }),
  role: z.enum(ALLOWED_ROLES, { message: 'Invalid user role' }),
  status: z.literal('ACTIVE', { message: 'User account is suspended' }),
});

/**
 * Creates an Express authentication middleware that strictly parses Bearer tokens,
 * verifies them cryptographically, and queries the authoritative user store.
 *
 * Security Invariants:
 * 1. Strict Header Format: Expects "Authorization: Bearer <token>". Missing, non-Bearer,
 *    empty, or multi-part headers are rejected with 401 UNAUTHORIZED.
 * 2. Cryptographic Verification: Validates algorithm, signature, expiration, and payload
 *    structure using Stage 1 JWT utilities.
 * 3. Authoritative Source of Truth: Never trusts the JWT role or status claims as current.
 *    The authoritative database record via findUserById(decoded.sub) determines current role,
 *    active status, and account existence.
 * 4. Revocation & Suspension Defense: Deleted or suspended accounts are rejected with 401.
 * 5. Strict Schema Validation: Authoritative user record must be a valid object with UUID id,
 *    matching decoded.sub, valid email, ACTIVE status, and allowlisted role.
 * 6. Sanitized req.user: Only safe identity fields (id, email, role, status) are attached.
 *    Passwords, hashes, and internal secrets are NEVER attached to req.user.
 * 7. Fail-Closed: User lookup errors and database exceptions bubble up to the centralized
 *    error handler as 500 INTERNAL_SERVER_ERROR without exposing database internals.
 *
 * @param {object} dependencies
 * @param {(userId: string) => Promise<object|null>} dependencies.findUserById - Authoritative user lookup function
 * @param {(token: string) => object} [dependencies.verifyToken=verifyAccessToken] - Token verification function
 * @returns {import('express').RequestHandler}
 */
export const createAuthenticate = ({ findUserById, verifyToken = verifyAccessToken } = {}) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;

      if (!authHeader || typeof authHeader !== 'string') {
        throw new AppError('UNAUTHORIZED', 'Authentication token is required', 401);
      }

      const trimmedHeader = authHeader.trim();
      const parts = trimmedHeader.split(/\s+/);

      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw new AppError('UNAUTHORIZED', 'Authorization header must follow Bearer <token> format', 401);
      }

      const token = parts[1];
      if (!token) {
        throw new AppError('UNAUTHORIZED', 'Authentication token is required', 401);
      }

      // Cryptographically verify token and validate standard claims
      let decoded;
      try {
        decoded = verifyToken(token);
      } catch (err) {
        if (err instanceof AppError) {
          throw err;
        }
        throw new AppError('INVALID_TOKEN', 'Invalid authentication token', 401);
      }

      if (!decoded || !decoded.sub) {
        throw new AppError('INVALID_TOKEN', 'Invalid authentication token', 401);
      }

      // findUserById dependency is mandatory for authoritative verification
      if (typeof findUserById !== 'function') {
        throw new Error('Authentication dependency "findUserById" is required but not configured');
      }

      // Query the authoritative user record using decoded.sub
      const user = await findUserById(decoded.sub);

      // Reject null, undefined, arrays, and non-object records
      if (!user || typeof user !== 'object' || Array.isArray(user)) {
        throw new AppError('UNAUTHORIZED', 'User account not found', 401);
      }

      // Check account status specifically for explicit suspension response
      if (user.status !== 'ACTIVE') {
        throw new AppError('UNAUTHORIZED', 'User account is suspended', 401);
      }

      // Validate authoritative user role against allowlist
      if (!user.role || !ALLOWED_ROLES.includes(user.role)) {
        throw new AppError('UNAUTHORIZED', 'User account has an invalid or unrecognized role', 401);
      }

      // Validate complete user record schema (UUID id, valid email, active status, allowlisted role)
      const userValidation = authoritativeUserSchema.safeParse(user);
      if (!userValidation.success) {
        throw new AppError('UNAUTHORIZED', 'User account has invalid or incomplete identity fields', 401);
      }

      // Enforce that authoritative database user ID matches verified token subject
      if (user.id.trim().toLowerCase() !== decoded.sub.trim().toLowerCase()) {
        throw new AppError('UNAUTHORIZED', 'User account identity does not match token subject', 401);
      }

      // Attach a minimal, trusted user representation to req.user
      // Explicitly pick allowed properties to avoid leaking password hashes or unexpected data
      req.user = {
        id: userValidation.data.id,
        email: userValidation.data.email,
        role: userValidation.data.role,
        status: userValidation.data.status,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
};
