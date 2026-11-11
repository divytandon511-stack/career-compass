import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env if present
dotenv.config();

/**
 * Clearly labeled synthetic secret used exclusively in automated test suites (NODE_ENV=test).
 * Strictly forbidden in development and production runtimes.
 */
export const SYNTHETIC_TEST_JWT_SECRET = 'synthetic-test-jwt-secret-minimum-32-characters-vitest-runner';

/**
 * Validates whether an origin string is a well-formed HTTP or HTTPS origin without paths, queries, or wildcards.
 */
const validateOrigin = (origin) => {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.pathname !== '/' && url.pathname !== '') return false;
    if (url.search || url.hash) return false;
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates bounded body size string (1B to 10MB) with units b, kb, or mb.
 */
const validateBodyLimit = (val) => {
  if (typeof val !== 'string') return false;
  const match = val.trim().match(/^(\d+)(b|kb|mb)$/i);
  if (!match) return false;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  let bytes = num;
  if (unit === 'kb') bytes = num * 1024;
  if (unit === 'mb') bytes = num * 1024 * 1024;
  return bytes > 0 && bytes <= 10 * 1024 * 1024;
};

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce
    .number({ invalid_type_error: 'PORT must be an integer' })
    .int({ message: 'PORT must be an integer' })
    .min(1, { message: 'PORT must be between 1 and 65535' })
    .max(65535, { message: 'PORT must be between 1 and 65535' })
    .default(4000),
  ALLOWED_ORIGINS: z
    .string()
    .refine((val) => {
      const origins = val.split(',').map((o) => o.trim()).filter(Boolean);
      if (origins.length === 0) return false;
      return origins.every(validateOrigin);
    }, {
      message: 'ALLOWED_ORIGINS must be a comma-separated list of valid http:// or https:// origins without path or query (e.g. "http://localhost:5173,https://app.example.com")',
    })
    .default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number({ invalid_type_error: 'RATE_LIMIT_WINDOW_MS must be an integer' })
    .int()
    .positive({ message: 'RATE_LIMIT_WINDOW_MS must be a positive integer' })
    .default(900000),
  RATE_LIMIT_MAX: z.coerce
    .number({ invalid_type_error: 'RATE_LIMIT_MAX must be an integer' })
    .int()
    .positive({ message: 'RATE_LIMIT_MAX must be a positive integer' })
    .default(100),
  BODY_LIMIT: z
    .string()
    .refine(validateBodyLimit, {
      message: 'BODY_LIMIT must be a size string between 1B and 10MB with unit b, kb, or mb (e.g. "100kb", "1mb")',
    })
    .default('100kb'),
  JWT_SECRET: z
    .string({ invalid_type_error: 'JWT_SECRET must be a string' })
    .min(32, { message: 'JWT_SECRET must be at least 32 characters long' })
    .optional(),
  JWT_EXPIRES_IN: z.coerce
    .number({ invalid_type_error: 'JWT_EXPIRES_IN must be an integer' })
    .int({ message: 'JWT_EXPIRES_IN must be an integer' })
    .min(1, { message: 'JWT_EXPIRES_IN must be between 1 and 900 seconds' })
    .max(900, { message: 'JWT_EXPIRES_IN must be between 1 and 900 seconds' })
    .default(900),
  JWT_ISSUER: z.string().default('career-compass'),
  JWT_AUDIENCE: z.string().default('career-compass-client'),
}).refine(
  (data) => {
    // Only automated test suites running with NODE_ENV=test may omit JWT_SECRET
    if (data.NODE_ENV === 'test') {
      return true;
    }

    // In all non-test environments (development, production), JWT_SECRET is strictly required
    if (!data.JWT_SECRET || typeof data.JWT_SECRET !== 'string' || data.JWT_SECRET.trim().length < 32) {
      return false;
    }

    // Never permit using the predictable synthetic test secret in development or production
    if (data.JWT_SECRET === SYNTHETIC_TEST_JWT_SECRET) {
      return false;
    }

    return true;
  },
  {
    message: 'JWT_SECRET is required and must be at least 32 characters long in development and production environments',
    path: ['JWT_SECRET'],
  }
);

/**
 * Validates raw environment configuration without leaking secrets
 * @param {Record<string, unknown>} [rawEnv=process.env]
 * @returns {Record<string, unknown>}
 */
export const validateEnv = (rawEnv = process.env) => {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`[Config Error] Invalid environment configuration:\n${issues}`);
  }

  // Only assign synthetic test secret when NODE_ENV is strictly 'test' and no secret was supplied
  const jwtSecret =
    result.data.JWT_SECRET ||
    (result.data.NODE_ENV === 'test' ? SYNTHETIC_TEST_JWT_SECRET : undefined);

  return {
    ...result.data,
    JWT_SECRET: jwtSecret,
    corsOrigins: result.data.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
};

export const env = validateEnv(process.env);
