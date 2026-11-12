import crypto from 'node:crypto';

/**
 * Proposed refresh token lifetime: 7 days in milliseconds (604,800,000 ms).
 * Aligned with docs/architecture.md §2 and docs/data-model.md §2.4.
 */
export const REFRESH_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Proposed refresh token lifetime: 7 days in seconds (604,800 seconds).
 */
export const REFRESH_TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

/**
 * Generates a cryptographically secure opaque token string.
 * Uses 256 bits (32 bytes) of cryptographically strong pseudo-random data.
 *
 * @param {number} [byteLength=32] - Number of random bytes
 * @returns {string} Hex-encoded random token string (64 characters for 32 bytes)
 */
export const generateOpaqueToken = (byteLength = 32) => {
  return crypto.randomBytes(byteLength).toString('hex');
};

/**
 * Computes a deterministic SHA-256 cryptographic digest of a raw token string.
 * Plaintext refresh tokens are NEVER stored in the database.
 * Only the SHA-256 hash is persisted, matching the hashed_token_id column.
 *
 * @param {string} token - Raw plaintext token string
 * @returns {string} 64-character lowercase hex SHA-256 digest
 */
export const hashToken = (token) => {
  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new TypeError('Token must be a non-empty string');
  }

  return crypto.createHash('sha256').update(token.trim()).digest('hex');
};

