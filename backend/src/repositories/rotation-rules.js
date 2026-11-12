/**
 * ============================================================================
 * CareerCompass — Token Rotation Rules & Security Invariants
 * ============================================================================
 * Aligned with docs/architecture.md §2 and AuthRepositoryInterface contracts.
 *
 * This module encapsulates database-independent rules for:
 * 1. Refresh-session validation
 * 2. Pre-rotation eligibility checks
 * 3. Authoritative revocation reasons
 * 4. Token-family isolation and cross-tenant boundaries
 * 5. Concurrency error classification
 *
 * IMPORTANT POSTGRESQL CONCURRENCY NOTE:
 * ----------------------------------------------------------------------------
 * These in-memory validation rules enforce preconditions and error classification,
 * but CANNOT substitute for PostgreSQL database-level atomicity. True concurrency
 * safety during high-frequency racing rotations requires PostgreSQL row-level locks
 * (`SELECT ... FOR UPDATE` or conditional `UPDATE ... WHERE id = :id AND revoked_at IS NULL`)
 * and the UNIQUE constraint on `refresh_sessions.rotated_from`.
 * ============================================================================
 */

import { z } from 'zod';

/**
 * Regex defining the canonical format of a SHA-256 hexadecimal digest:
 * exactly 64 lowercase hexadecimal characters ([0-9a-f]).
 */
export const SHA256_HEX_DIGEST_REGEX = /^[0-9a-f]{64}$/;

/**
 * Validates whether a candidate string strictly matches the 64-character lowercase hexadecimal format
 * expected for a SHA-256 digest (matching the database `hashed_token_id` column).
 *
 * CRITICAL TOKEN PRIVACY & ARCHITECTURAL INVARIANT:
 * Format validation verifies ONLY string length (64 characters) and character set ([0-9a-f]).
 * Because 256-bit raw opaque refresh tokens (generated via 32 crypto random bytes hex-encoded)
 * are ALSO exactly 64 lowercase hexadecimal characters, format validation CANNOT mathematically
 * distinguish a raw plaintext token from a SHA-256 digest by format alone.
 *
 * Token privacy is an ARCHITECTURAL INVARIANT guaranteed upstream by `AuthService` (which deterministically
 * hashes raw tokens using SHA-256 before passing `hashedTokenId` to the repository). The repository adapter
 * enforces this format check strictly as a schema and database-boundary invariant to reject non-canonical
 * or corrupted strings, but does not claim that regex matching cryptographically proves a value is hashed.
 *
 * @param {unknown} value - Candidate hash digest string
 * @returns {boolean} True if strictly 64 lowercase hex characters
 */
export const isValidSha256DigestFormat = (value) => {
  return typeof value === 'string' && SHA256_HEX_DIGEST_REGEX.test(value);
};

export const REVOCATION_REASONS = Object.freeze({
  TOKEN_ROTATION: 'TOKEN_ROTATION',
  ROTATED: 'ROTATED', // Legacy alias supported for backward-compatibility
  LOGOUT: 'LOGOUT',
  ALL_DEVICES_LOGOUT: 'ALL_DEVICES_LOGOUT',
  TOKEN_REUSE_DETECTED: 'TOKEN_REUSE_DETECTED',
  REUSE_DETECTED: 'REUSE_DETECTED', // Legacy alias supported for backward-compatibility
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  SECURITY_RESET: 'SECURITY_RESET',
  EXPIRED: 'EXPIRED',
});

export const ROTATION_ERROR_CODES = Object.freeze({
  ROTATION_RACE_LOST: 'ROTATION_RACE_LOST',
  SESSION_ALREADY_REVOKED: 'SESSION_ALREADY_REVOKED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  IDENTITY_MISMATCH: 'IDENTITY_MISMATCH',
  INVALID_SESSION_DATA: 'INVALID_SESSION_DATA',
  TRANSACTION_REQUIRED: 'TRANSACTION_REQUIRED',
});

const sessionRecordSchema = z.object({
  id: z.string().uuid({ message: 'Session id must be a valid UUID' }),
  userId: z.string().uuid({ message: 'userId must be a valid UUID' }),
  hashedTokenId: z.string().refine(isValidSha256DigestFormat, {
    message: 'hashedTokenId must be a 64-character lowercase hex digest',
  }),
  expiresAt: z.union([z.date(), z.string().datetime()]),
  revokedAt: z.union([z.date(), z.string().datetime()]).nullable().optional(),
  revokedReason: z.string().nullable().optional(),
  rotatedFrom: z.string().uuid().nullable().optional(),
});

/**
 * Validates the structure and types of a RefreshSession record.
 *
 * @param {object} session
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export const validateSessionRecord = (session) => {
  if (!session || typeof session !== 'object') {
    return { valid: false, errors: ['Session record must be a non-null object'] };
  }

  const result = sessionRecordSchema.safeParse(session);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }

  return { valid: true };
};

/**
 * Evaluates whether an existing refresh session is eligible for token rotation.
 *
 * Invariants:
 * 1. Existence: Session must exist.
 * 2. Tenant Isolation: If expectedUserId is provided, session.userId must match strictly.
 * 3. Active Status: session.revokedAt must be null. Already-revoked sessions are rejected.
 * 4. Temporal Validity: session.expiresAt must be in the future relative to currentTime.
 *
 * @param {object|null} session - Candidate session record
 * @param {object} [options={}]
 * @param {string} [options.expectedUserId] - UUID of the authenticated caller
 * @param {number} [options.currentTime=Date.now()] - Current epoch timestamp
 * @returns {{ eligible: boolean, code?: string, reason?: string, revokedReason?: string|null }}
 */
export const checkRotationEligibility = (
  session,
  { expectedUserId, currentTime = Date.now() } = {}
) => {
  if (!session) {
    return {
      eligible: false,
      code: ROTATION_ERROR_CODES.SESSION_NOT_FOUND,
      reason: 'Refresh session not found',
    };
  }

  const validation = validateSessionRecord(session);
  if (!validation.valid) {
    return {
      eligible: false,
      code: ROTATION_ERROR_CODES.INVALID_SESSION_DATA,
      reason: `Invalid session record structure: ${validation.errors.join('; ')}`,
    };
  }

  // Cross-user tenant boundary
  if (expectedUserId) {
    const normalizedExpected = expectedUserId.trim().toLowerCase();
    const normalizedActual = session.userId.trim().toLowerCase();
    if (normalizedActual !== normalizedExpected) {
      return {
        eligible: false,
        code: ROTATION_ERROR_CODES.IDENTITY_MISMATCH,
        reason: 'Session belongs to a different user account',
      };
    }
  }

  // Revocation check
  if (session.revokedAt !== null && session.revokedAt !== undefined) {
    return {
      eligible: false,
      code: ROTATION_ERROR_CODES.SESSION_ALREADY_REVOKED,
      reason: 'Session has already been revoked',
      revokedReason: session.revokedReason || null,
    };
  }

  // Expiration check
  const expiryMs = new Date(session.expiresAt).getTime();
  if (expiryMs <= currentTime) {
    return {
      eligible: false,
      code: ROTATION_ERROR_CODES.SESSION_EXPIRED,
      reason: 'Session has reached its expiration time',
    };
  }

  return { eligible: true };
};

/**
 * Validates that all sessions in a proposed token-family lineage belong exclusively
 * to the specified user, preventing cross-tenant contamination.
 *
 * @param {object[]} sessions - Array of session records in a lineage
 * @param {string} expectedUserId - UUID of the expected account owner
 * @returns {{ isolated: boolean, violations?: string[] }}
 */
export const validateFamilyIsolation = (sessions, expectedUserId) => {
  if (!Array.isArray(sessions) || !expectedUserId) {
    return { isolated: false, violations: ['Invalid sessions array or expectedUserId'] };
  }

  const normalizedExpected = expectedUserId.trim().toLowerCase();
  const violations = [];

  for (const session of sessions) {
    if (!session || typeof session !== 'object' || !session.userId) {
      violations.push(`Invalid session entry: ${JSON.stringify(session)}`);
      continue;
    }

    if (session.userId.trim().toLowerCase() !== normalizedExpected) {
      violations.push(`Session ${session.id} belongs to user ${session.userId}, expected ${expectedUserId}`);
    }
  }

  return {
    isolated: violations.length === 0,
    violations: violations.length > 0 ? violations : undefined,
  };
};
