import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseLimit, createAuthLimiter } from '../src/middleware/rate-limit.js';

describe('Auth Rate Limiter Configuration & Invariants', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

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

  it('ensures production defaults remain strictly conservative (10/5/30) when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RATE_LIMIT_LOGIN_MAX;
    delete process.env.RATE_LIMIT_REGISTER_MAX;
    delete process.env.RATE_LIMIT_REFRESH_MAX;

    const loginLimit = parseLimit('RATE_LIMIT_LOGIN_MAX', process.env.NODE_ENV === 'development' ? 100 : 10);
    const registerLimit = parseLimit('RATE_LIMIT_REGISTER_MAX', process.env.NODE_ENV === 'development' ? 50 : 5);
    const refreshLimit = parseLimit('RATE_LIMIT_REFRESH_MAX', process.env.NODE_ENV === 'development' ? 200 : 30);

    expect(loginLimit).toBe(10);
    expect(registerLimit).toBe(5);
    expect(refreshLimit).toBe(30);
  });

  it('allows relaxed ceilings during development without affecting production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.RATE_LIMIT_LOGIN_MAX;
    delete process.env.RATE_LIMIT_REGISTER_MAX;
    delete process.env.RATE_LIMIT_REFRESH_MAX;

    const loginLimit = parseLimit('RATE_LIMIT_LOGIN_MAX', process.env.NODE_ENV === 'development' ? 100 : 10);
    const registerLimit = parseLimit('RATE_LIMIT_REGISTER_MAX', process.env.NODE_ENV === 'development' ? 50 : 5);
    const refreshLimit = parseLimit('RATE_LIMIT_REFRESH_MAX', process.env.NODE_ENV === 'development' ? 200 : 30);

    expect(loginLimit).toBe(100);
    expect(registerLimit).toBe(50);
    expect(refreshLimit).toBe(200);
  });

  it('respects explicit environment overrides in any mode', () => {
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_REFRESH_MAX = '60';

    const refreshLimit = parseLimit('RATE_LIMIT_REFRESH_MAX', process.env.NODE_ENV === 'development' ? 200 : 30);
    expect(refreshLimit).toBe(60);
  });

  it('enforces HTTP 429 with standard AppError envelope when max threshold is exceeded', async () => {
    const express = (await import('express')).default;
    const request = (await import('supertest')).default;
    const app = express();

    app.post(
      '/test-rate-limit',
      createAuthLimiter({ windowMs: 60000, max: 2, message: 'Too many rate-limit test requests' }),
      (req, res) => res.status(200).json({ ok: true })
    );

    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        error: { code: err.code, message: err.message },
      });
    });

    const res1 = await request(app).post('/test-rate-limit');
    expect(res1.status).toBe(200);

    const res2 = await request(app).post('/test-rate-limit');
    expect(res2.status).toBe(200);

    const res3 = await request(app).post('/test-rate-limit');
    expect(res3.status).toBe(429);
    expect(res3.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res3.body.error.message).toBe('Too many rate-limit test requests');
  });
});

