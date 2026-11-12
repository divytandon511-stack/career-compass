import { z } from 'zod';
import { AppError } from '../utils/app-error.js';

const uuidSchema = z.string().uuid();

/**
 * ============================================================================
 * CRITICAL ARCHITECTURAL INVARIANT: DATABASE-LEVEL OWNERSHIP FILTERING
 * ============================================================================
 * In-memory ownership checks are defense-in-depth safeguards and MUST NEVER be
 * used as a substitute for database query filtering.
 *
 * Per docs/architecture.md §4:
 * "Default deny: check role and resource ownership at service/database query level
 * (WHERE studentId = currentUser.id, WHERE counsellorId = currentUser.id).
 * Never trust userId in a request body as proof of identity. Return 404 for
 * unauthorized resource enumeration where appropriate; 403 for known forbidden operations."
 *
 * Queries for private resources (assessment attempts, bookings, saved careers,
 * guidance sessions) MUST ALWAYS include `WHERE studentId = currentUser.id`
 * directly in the SQL/Prisma query.
 *
 * Under no circumstances should a service fetch all resources from the database
 * and filter them in memory, as doing so leaks unauthorized data into memory
 * and violates tenancy guarantees.
 * ============================================================================
 */

/**
 * Resolves the owner ID from a resource object or direct identifier.
 * Requires an explicit ownerField or getOwnerId extractor function for resource objects.
 * Never guesses or falls back to candidate fields or resource primary keys.
 *
 * @param {object|string} resource - The resource object or direct owner UUID string
 * @param {string|((res: object) => string)|null} [ownerOption=null] - Explicit field name or extractor function
 * @returns {string|null} Normalized lowercase owner UUID string or null
 */
export const resolveResourceOwnerId = (resource, ownerOption = null) => {
  // Direct owner ID passed as string (from trusted server-side code)
  if (typeof resource === 'string') {
    const trimmed = resource.trim();
    return uuidSchema.safeParse(trimmed).success ? trimmed.toLowerCase() : null;
  }

  // Reject non-objects, null, or arrays
  if (typeof resource !== 'object' || resource === null || Array.isArray(resource)) {
    return null;
  }

  // For resource objects, require an explicitly configured ownerField or trusted extractor
  if (!ownerOption) {
    return null; // Fails closed: never guess or fall back to candidate list or resource.id
  }

  if (typeof ownerOption === 'function') {
    try {
      const extracted = ownerOption(resource);
      if (typeof extracted === 'string' && uuidSchema.safeParse(extracted.trim()).success) {
        return extracted.trim().toLowerCase();
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof ownerOption === 'string' && ownerOption.trim().length > 0) {
    const val = resource[ownerOption.trim()];
    if (typeof val === 'string' && uuidSchema.safeParse(val.trim()).success) {
      return val.trim().toLowerCase();
    }
    return null;
  }

  return null;
};

/**
 * Checks whether an authenticated user matches the owner of a resource.
 *
 * @param {object} currentUser - Authenticated user object from req.user
 * @param {object|string} resource - Authoritative resource object or owner UUID
 * @param {object|string} [options={}] - Options object or explicit ownerField string
 * @param {string} [options.ownerField] - Explicit ownership field on the resource
 * @param {((res: object) => string)} [options.getOwnerId] - Explicit owner ID extractor function
 * @returns {boolean}
 */
export const isOwner = (currentUser, resource, options = {}) => {
  if (!currentUser || typeof currentUser !== 'object' || !currentUser.id) {
    return false;
  }

  if (typeof currentUser.id !== 'string' || !uuidSchema.safeParse(currentUser.id.trim()).success) {
    return false;
  }

  const ownerOption = typeof options === 'string'
    ? options
    : (options?.ownerField || options?.getOwnerId || null);

  const ownerId = resolveResourceOwnerId(resource, ownerOption);
  if (!ownerId) {
    return false;
  }

  return currentUser.id.trim().toLowerCase() === ownerId;
};

/**
 * Asserts that the authenticated user owns the resource, throwing an operational AppError
 * if ownership is not satisfied.
 *
 * Per docs/api-contract.md §10:
 * When querying private student resources (such as assessment attempts or AI guidance sessions),
 * unauthorized access must return 404 NOT_FOUND instead of 403 to prevent resource enumeration.
 * Setting options.useNotFound = true enforces this requirement.
 *
 * @param {object} currentUser - Authenticated user object from req.user
 * @param {object|string} resource - Resource object or owner UUID
 * @param {object} [options={}]
 * @param {string} [options.ownerField] - Explicit field name (e.g. 'studentId', 'userId')
 * @param {((res: object) => string)} [options.getOwnerId] - Explicit owner ID extractor function
 * @param {boolean} [options.useNotFound=false] - Return 404 instead of 403 to prevent enumeration
 * @param {string} [options.message] - Custom error message
 * @returns {boolean} True if ownership is confirmed
 */
export const assertOwnership = (currentUser, resource, options = {}) => {
  if (!currentUser || typeof currentUser !== 'object' || !currentUser.id) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  if (typeof currentUser.id !== 'string' || !uuidSchema.safeParse(currentUser.id.trim()).success) {
    throw new AppError('UNAUTHORIZED', 'Invalid authenticated user identity', 401);
  }

  if (resource === null || resource === undefined) {
    throw new AppError('NOT_FOUND', options?.message || 'Resource not found', 404);
  }

  if (isOwner(currentUser, resource, options)) {
    return true;
  }

  if (options?.useNotFound || options?.notFoundOnForbidden) {
    throw new AppError('NOT_FOUND', options?.message || 'Resource not found', 404);
  }

  throw new AppError(
    'FORBIDDEN',
    options?.message || 'Access forbidden: you do not have permission to access this resource',
    403
  );
};

/**
 * Declarative Express middleware factory for enforcing ownership on pre-fetched resources.
 * Supports synchronous or asynchronous resource retrieval, validating configuration at creation.
 *
 * @param {object} config
 * @param {(req: import('express').Request) => object|string|Promise<object|string>} [config.getResource] - Function to retrieve resource from request
 * @param {string} [config.ownerField] - Explicit ownership field name
 * @param {((res: object) => string)} [config.getOwnerId] - Explicit owner ID extractor function
 * @param {boolean} [config.useNotFound=false] - Return 404 instead of 403 to prevent enumeration
 * @returns {import('express').RequestHandler}
 */
export const createRequireOwnership = ({
  getResource = (req) => req.resource,
  ownerField,
  getOwnerId,
  useNotFound = false,
} = {}) => {
  // Validate middleware configuration at initialization time
  if (typeof getResource !== 'function') {
    throw new Error('createRequireOwnership "getResource" must be a function');
  }

  if (
    (!ownerField || typeof ownerField !== 'string' || ownerField.trim().length === 0) &&
    typeof getOwnerId !== 'function'
  ) {
    throw new Error(
      'createRequireOwnership requires an explicit "ownerField" string or "getOwnerId" extractor function'
    );
  }

  return async (req, res, next) => {
    try {
      // Never authorize before retrieval completes; await synchronous or asynchronous getResource
      const resource = await getResource(req);

      // Return 404 for missing resources (null or undefined)
      if (resource === null || resource === undefined) {
        throw new AppError('NOT_FOUND', 'Resource not found', 404);
      }

      // Assert ownership; fails closed if ownership is not confirmed
      assertOwnership(req.user, resource, {
        ownerField,
        getOwnerId,
        useNotFound,
      });

      // Ensure next() is called exactly once on successful authorization
      next();
    } catch (err) {
      // Forward errors (including async rejections) to centralized error handler
      next(err);
    }
  };
};
