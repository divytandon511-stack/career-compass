import argon2 from 'argon2';

/**
 * Default Argon2id parameters aligned with OWASP Password Storage guidelines:
 * - type: Argon2id (hybrid variant offering resilience against side-channel cache attacks and GPU cracking)
 * - memoryCost: 65536 KiB (64 MiB RAM footprint resists ASIC/GPU offline cracking)
 * - timeCost: 3 iterations (provides strong computational difficulty within interactive latency budget)
 * - parallelism: 4 lanes/threads (utilizes multi-core CPUs effectively)
 * - hashLength: 32 bytes (256-bit cryptographic digest)
 */
export const DEFAULT_ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
});

/**
 * Hashes a plaintext password using Argon2id.
 * Never logs passwords or generated hashes.
 *
 * @param {string} password - Plaintext password to hash
 * @param {Record<string, unknown>} [customOptions={}] - Optional parameter overrides (e.g. for testing)
 * @returns {Promise<string>} Standard encoded Argon2id hash string ($argon2id$v=19$m=65536,t=3,p=4$...)
 */
export const hashPassword = async (password, customOptions = {}) => {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('Password must be a non-empty string');
  }

  return argon2.hash(password, {
    ...DEFAULT_ARGON2_OPTIONS,
    ...customOptions,
  });
};

/**
 * Safely verifies a plaintext password against an Argon2 hash.
 * Malformed, invalid, or corrupted hashes fail safely by returning false without throwing exceptions.
 *
 * @param {string} hash - Encoded hash from database
 * @param {string} password - Plaintext password candidate
 * @returns {Promise<boolean>} True if password matches hash, false otherwise
 */
export const verifyPassword = async (hash, password) => {
  if (typeof hash !== 'string' || typeof password !== 'string') {
    return false;
  }

  if (hash.length === 0 || password.length === 0) {
    return false;
  }

  try {
    return await argon2.verify(hash, password);
  } catch {
    // Malformed hash format or corrupted string fails safely
    return false;
  }
};
