import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/app-error.js';

/**
 * Creates a specialized, strict rate limiter for sensitive authentication endpoints
 * (e.g. login, registration, credential rotation).
 *
 * Security Invariants:
 * 1. Standard Error Envelope: Uses AppError('RATE_LIMIT_EXCEEDED', ..., 429) to match
 *    the standard error response format defined in docs/api-contract.md §1.
 * 2. Privacy & Credential Protection: NEVER logs request body, passwords, tokens, or credentials.
 * 3. Standard Headers: Emits standard RateLimit-* headers (Draft-6 / Draft-7) without leaking internal limits.
 * 4. Isolation: Reusable middleware to be mounted exclusively on sensitive auth routes without affecting
 *    unrelated endpoints or altering the global rate limiter.
 *
 * @param {object} [options={}]
 * @param {number} [options.windowMs=900000] - Window duration in milliseconds (default: 15 minutes)
 * @param {number} [options.max=10] - Maximum allowed requests per IP per window (default: 10)
 * @param {string} [options.message='Too many authentication attempts, please try again later.'] - Safe client error message
 * @returns {import('express').RequestHandler}
 */
export const createAuthLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const max = options.max || 10;
  const message = options.message || 'Too many authentication attempts, please try again later.';

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
      next(new AppError('RATE_LIMIT_EXCEEDED', message, 429));
    },
    ...options,
  });
};

export const parseLimit = (envVar, fallback) => {
  const raw = process.env[envVar];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Rate limiter pre-configured for future login endpoints.
 * Stricter limit: 10 requests per 15-minute window per IP (relaxed in development).
 */
export const loginRateLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: parseLimit('RATE_LIMIT_LOGIN_MAX', process.env.NODE_ENV === 'development' ? 100 : 10),
  message: 'Too many login attempts, please try again later.',
});

/**
 * Rate limiter pre-configured for future registration endpoints.
 * Stricter limit: 5 requests per 1-hour window per IP (relaxed in development).
 */
export const registerRateLimiter = createAuthLimiter({
  windowMs: 60 * 60 * 1000,
  max: parseLimit('RATE_LIMIT_REGISTER_MAX', process.env.NODE_ENV === 'development' ? 50 : 5),
  message: 'Too many account registration attempts, please try again later.',
});

/**
 * Rate limiter pre-configured for token refresh endpoints.
 * Stricter limit: 30 requests per 15-minute window per IP (relaxed in development).
 */
export const refreshRateLimiter = createAuthLimiter({
  windowMs: 15 * 60 * 1000,
  max: parseLimit('RATE_LIMIT_REFRESH_MAX', process.env.NODE_ENV === 'development' ? 200 : 30),
  message: 'Too many token refresh attempts, please try again later.',
});
