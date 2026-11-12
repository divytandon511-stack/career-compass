import { AppError } from '../utils/app-error.js';
import { ALLOWED_ROLES } from '../utils/jwt.js';

/**
 * Role-Based Access Control (RBAC) middleware factory.
 *
 * Security Invariants:
 * 1. Default Deny: Requests are rejected unless the user's authoritative role is explicitly permitted.
 * 2. Unauthenticated Rejection: Returns 401 UNAUTHORIZED if req.user is absent or invalid.
 * 3. Unauthorized Rejection: Returns 403 FORBIDDEN if the authenticated user's role is not permitted.
 * 4. Strict Role Configuration: Accepts ONLY 'STUDENT', 'COUNSELLOR', and 'ADMIN'.
 *    Rejects invalid roles (e.g. 'PUBLIC', 'AUTH', 'SUPERADMIN') at configuration time.
 * 5. No Automatic Admin Bypass: Admins are NEVER granted implicit bypass unless 'ADMIN' is explicitly
 *    included in the permitted roles.
 * 6. Sole Source of Truth: Reads role strictly from req.user.role (established by createAuthenticate).
 *    Never reads role or identity from request body, query parameters, or client headers.
 *
 * @param {...(string|string[])} allowedRoles - Permitted roles for the route
 * @returns {import('express').RequestHandler}
 */
export const requireRole = (...allowedRoles) => {
  const roles = allowedRoles.flat();

  if (roles.length === 0) {
    throw new Error('requireRole middleware must be configured with at least one role');
  }

  for (const role of roles) {
    if (!ALLOWED_ROLES.includes(role)) {
      throw new Error(
        `Invalid role "${role}" configured in requireRole. Valid database roles are: ${ALLOWED_ROLES.join(', ')}. Note: "PUBLIC" and "AUTH" are routing access categories, not database roles.`
      );
    }
  }

  return (req, res, next) => {
    // 1. Unauthenticated check -> 401
    if (!req.user || typeof req.user !== 'object' || !req.user.id) {
      return next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
    }

    // 2. Missing or unrecognized user role on req.user -> 401
    if (!req.user.role || !ALLOWED_ROLES.includes(req.user.role)) {
      return next(new AppError('UNAUTHORIZED', 'Invalid authentication credentials', 401));
    }

    // 3. Authorized role check: verify user.role is in allowed roles
    if (!roles.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', 'Insufficient permissions to access this resource', 403));
    }

    next();
  };
};