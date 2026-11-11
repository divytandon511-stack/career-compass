import { describe, it, expect } from 'vitest';
import argon2 from 'argon2';
import {
  hashPassword,
  verifyPassword,
  DEFAULT_ARGON2_OPTIONS,
} from '../src/utils/password.js';

describe('Argon2id Password Hashing Utilities', () => {
  const samplePassword = 'SyntheticPassword123!@#';

  it('exports OWASP-aligned Argon2id configuration parameters', () => {
    expect(DEFAULT_ARGON2_OPTIONS.type).toBe(argon2.argon2id);
    expect(DEFAULT_ARGON2_OPTIONS.memoryCost).toBe(65536); // 64 MiB
    expect(DEFAULT_ARGON2_OPTIONS.timeCost).toBe(3); // 3 iterations
    expect(DEFAULT_ARGON2_OPTIONS.parallelism).toBe(4); // 4 lanes
    expect(DEFAULT_ARGON2_OPTIONS.hashLength).toBe(32); // 32 bytes
  });

  it('generates a valid Argon2id hash for a plaintext password', async () => {
    const hash = await hashPassword(samplePassword);

    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).toContain('m=65536,t=3,p=4');
  });

  it('generates distinct salt-backed hashes for identical passwords', async () => {
    const hash1 = await hashPassword(samplePassword);
    const hash2 = await hashPassword(samplePassword);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(hash1, samplePassword)).toBe(true);
    expect(await verifyPassword(hash2, samplePassword)).toBe(true);
  });

  it('correctly verifies a valid password against its hash', async () => {
    const hash = await hashPassword(samplePassword);
    const isValid = await verifyPassword(hash, samplePassword);

    expect(isValid).toBe(true);
  });

  it('rejects an incorrect password safely (returns false without throwing)', async () => {
    const hash = await hashPassword(samplePassword);
    const isValid = await verifyPassword(hash, 'WrongPassword999!');

    expect(isValid).toBe(false);
  });

  it('fails safely when verifying against corrupted or malformed hash strings', async () => {
    const corruptedHashes = [
      'not-a-valid-argon-hash',
      '$argon2id$corrupted_header',
      '$argon2id$v=19$m=0,t=0,p=0$invalid',
      'random_gibberish_12345',
    ];

    for (const badHash of corruptedHashes) {
      const isValid = await verifyPassword(badHash, samplePassword);
      expect(isValid).toBe(false);
    }
  });

  it('rejects non-string or empty inputs safely', async () => {
    // hashPassword validation
    await expect(hashPassword('')).rejects.toThrow(TypeError);
    await expect(hashPassword(null)).rejects.toThrow(TypeError);
    await expect(hashPassword(undefined)).rejects.toThrow(TypeError);
    await expect(hashPassword(12345)).rejects.toThrow(TypeError);

    // verifyPassword safe falsy returns
    expect(await verifyPassword('', samplePassword)).toBe(false);
    expect(await verifyPassword(null, samplePassword)).toBe(false);
    expect(await verifyPassword(undefined, samplePassword)).toBe(false);
    expect(await verifyPassword('$argon2id$...', '')).toBe(false);
    expect(await verifyPassword('$argon2id$...', null)).toBe(false);
  });
});
