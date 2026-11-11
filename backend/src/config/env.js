import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env if present
dotenv.config();

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
});

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

  return {
    ...result.data,
    corsOrigins: result.data.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
};

export const env = validateEnv(process.env);
