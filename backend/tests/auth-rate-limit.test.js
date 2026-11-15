import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { parseLimit, createAuthLimiter } from '../src/middleware/rate-limit.js';

describe('Auth Rate Limiter Configuration & Invariants', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Helper to dynamically import rate-limit.js with isolated process.env using vi.resetModules()
  const loadExportedLimiters = async (envUpdates = {}) => {
    vi.resetModules();
    delete process.env.RATE_LIMIT_LOGIN_MAX;
    delete process.env.RATE_LIMIT_REGISTER_MAX;
    delete process.env.RATE_LIMIT_REFRESH_MAX;
    Object.assign(process.env, envUpdates);

    const mod = await import('../src/middleware/rate-limit.js');
    return mod;
  };

  // Helper to extract the standard RateLimit-Limit header configured on the actual middleware
  const getMiddlewareLimitHeader = async (middleware) => {
    const app = express();
    app.get('/test-limit', middleware, (req, res) => res.json({ ok: true }));
    const res = await request(app).get('/test-limit');
    return Number(res.headers['ratelimit-limit']);
  };

  describe('parseLimit helper function', () => {
    it('correctly parses positive integer environment variables', () => {
      process.env.TEST_LIMIT = '75';
      expect(parseLimit('TEST_LIMIT', 10)).toBe(75);
    });

    it('falls back to default when environment variable is unset or empty', () => {
      delete process.env.TEST_LIMIT;
      expect(parseLimit('TEST_LIMIT', 30)).toBe(30);

      process.env.TEST_LIMIT = '';
      expect(parseLimit('TEST_LIMIT', 30)).toBe(30);
    });

    it('falls back to default when environment variable is zero, negative, or non-numeric', () => {
      process.env.TEST_LIMIT = '0';
      expect(parseLimit('TEST_LIMIT', 30)).toBe(30);

      process.env.TEST_LIMIT = '-5';
      expect(parseLimit('TEST_LIMIT', 30)).toBe(30);

      process.env.TEST_LIMIT = 'not-a-number';
      expect(parseLimit('TEST_LIMIT', 30)).toBe(30);
    });
  });

  describe('Actual Exported Middleware Configurations', () => {
    it('exercises actual exported middleware under production defaults: login 10, register 5, refresh 30', async () => {
      const { loginRateLimiter, registerRateLimiter, refreshRateLimiter } = await loadExportedLimiters({
        NODE_ENV: 'production',
      });

      expect(await getMiddlewareLimitHeader(loginRateLimiter)).toBe(10);
      expect(await getMiddlewareLimitHeader(registerRateLimiter)).toBe(5);
      expect(await getMiddlewareLimitHeader(refreshRateLimiter)).toBe(30);
    });

    it('exercises actual exported middleware under development defaults: login 100, register 50, refresh 200', async () => {
      const { loginRateLimiter, registerRateLimiter, refreshRateLimiter } = await loadExportedLimiters({
        NODE_ENV: 'development',
      });

      expect(await getMiddlewareLimitHeader(loginRateLimiter)).toBe(100);
      expect(await getMiddlewareLimitHeader(registerRateLimiter)).toBe(50);
      expect(await getMiddlewareLimitHeader(refreshRateLimiter)).toBe(200);
    });

    it('exercises actual exported middleware with explicit environment-variable overrides', async () => {
      const { loginRateLimiter, registerRateLimiter, refreshRateLimiter } = await loadExportedLimiters({
        NODE_ENV: 'production',
        RATE_LIMIT_LOGIN_MAX: '15',
        RATE_LIMIT_REGISTER_MAX: '8',
        RATE_LIMIT_REFRESH_MAX: '45',
      });

      expect(await getMiddlewareLimitHeader(loginRateLimiter)).toBe(15);
      expect(await getMiddlewareLimitHeader(registerRateLimiter)).toBe(8);
      expect(await getMiddlewareLimitHeader(refreshRateLimiter)).toBe(45);
    });

    it('falls back safely to conservative defaults when environment values are invalid', async () => {
      const { loginRateLimiter, registerRateLimiter, refreshRateLimiter } = await loadExportedLimiters({
        NODE_ENV: 'production',
        RATE_LIMIT_LOGIN_MAX: 'invalid-string',
        RATE_LIMIT_REGISTER_MAX: '-10',
        RATE_LIMIT_REFRESH_MAX: '0',
      });

      expect(await getMiddlewareLimitHeader(loginRateLimiter)).toBe(10);
      expect(await getMiddlewareLimitHeader(registerRateLimiter)).toBe(5);
      expect(await getMiddlewareLimitHeader(refreshRateLimiter)).toBe(30);
    });

    it('falls back safely to development defaults when invalid environment values are passed in development', async () => {
      const { loginRateLimiter, registerRateLimiter, refreshRateLimiter } = await loadExportedLimiters({
        NODE_ENV: 'development',
        RATE_LIMIT_LOGIN_MAX: 'abc',
        RATE_LIMIT_REGISTER_MAX: '-1',
        RATE_LIMIT_REFRESH_MAX: '0',
      });

      expect(await getMiddlewareLimitHeader(loginRateLimiter)).toBe(100);
      expect(await getMiddlewareLimitHeader(registerRateLimiter)).toBe(50);
      expect(await getMiddlewareLimitHeader(refreshRateLimiter)).toBe(200);
    });

    it('enforces HTTP 429 with standard AppError envelope when actual threshold is exceeded', async () => {
      const { refreshRateLimiter } = await loadExportedLimiters({
        NODE_ENV: 'development',
        RATE_LIMIT_REFRESH_MAX: '2',
      });

      const app = express();
      app.post('/auth/refresh-test', refreshRateLimiter, (req, res) => res.status(200).json({ ok: true }));
      app.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({
          error: { code: err.code, message: err.message },
        });
      });

      const res1 = await request(app).post('/auth/refresh-test');
      expect(res1.status).toBe(200);

      const res2 = await request(app).post('/auth/refresh-test');
      expect(res2.status).toBe(200);

      const res3 = await request(app).post('/auth/refresh-test');
      expect(res3.status).toBe(429);
      expect(res3.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res3.body.error.message).toBe('Too many token refresh attempts, please try again later.');
    });
  });
});
