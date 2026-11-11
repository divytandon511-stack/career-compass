import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

import { app } from '../src/app.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { AppError } from '../src/utils/app-error.js';
import { validateEnv, SYNTHETIC_TEST_JWT_SECRET } from '../src/config/env.js';

describe('Error Handling Middleware and Standard Envelope', () => {
  it('returns 404 with the standard error envelope for unmapped routes', async () => {
    const res = await request(app).get('/api/v1/non-existent-endpoint');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found: GET /api/v1/non-existent-endpoint',
        details: [],
      },
    });
  });

  it('returns 400 with BAD_REQUEST code when request body contains malformed JSON', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"brokenJson": true, ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON in request body',
        details: [],
      },
    });
  });

  it('returns 413 with PAYLOAD_TOO_LARGE code when request body exceeds configured limit', async () => {
    // Default BODY_LIMIT is 100kb; send a payload exceeding 100kb
    const oversizedData = 'a'.repeat(120 * 1024);

    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send({ largeData: oversizedData });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds size limit',
        details: [],
      },
    });
  });

  it('returns generic 500 without leaking stack traces or internal exception messages', async () => {
    // Isolated test application fixture (no test routes in production app.js)
    const testApp = express();
    testApp.get('/throw-unexpected', () => {
      throw new Error('Database password leak: supersecret123');
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/throw-unexpected');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        details: [],
      },
    });
    // Ensure sensitive message string was not leaked to response body
    expect(res.text).not.toContain('Database password leak');
    expect(res.text).not.toContain('supersecret123');
    expect(res.body.error).not.toHaveProperty('stack');
  });

  it('handles operational errors with 5xx status codes by returning sanitized generic 500 envelope', async () => {
    const testApp = express();
    testApp.get('/operational-500', (req, res, next) => {
      next(new AppError('DB_CONNECTION_FAILED', 'Sensitive DB host connection timeout', 500));
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/operational-500');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        details: [],
      },
    });
    expect(res.text).not.toContain('Sensitive DB host');
  });

  it('strips untrusted error properties and prevents prototype pollution in responses', async () => {
    const testApp = express();
    testApp.get('/polluted-error', (req, res, next) => {
      const err = new Error('Basic error');
      err.extraSecret = 'sensitive-token-leak';
      err.statusCode = 500;
      next(err);
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/polluted-error');

    // Untrusted non-AppError must fall back safely to 500 INTERNAL_SERVER_ERROR
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        details: [],
      },
    });
    expect(res.body.error).not.toHaveProperty('extraSecret');
  });

  it('preserves meaningful messages and details for recognized operational AppError instances', async () => {
    const testApp = express();
    testApp.get('/operational-error', (req, res, next) => {
      next(
        new AppError('VALIDATION_ERROR', 'Please correct the supplied fields.', 422, [
          { field: 'email', issue: 'Invalid email format' },
        ])
      );
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/operational-error');

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please correct the supplied fields.',
        details: [{ field: 'email', issue: 'Invalid email format' }],
      },
    });
  });
});

describe('Environment Configuration Validation (config/env.js)', () => {
  const validSecret = 'valid-jwt-secret-minimum-32-characters-for-testing';

  it('successfully validates and applies default configuration in test environment', () => {
    const config = validateEnv({ NODE_ENV: 'test' });

    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe(4000);
    expect(config.BODY_LIMIT).toBe('100kb');
    expect(config.corsOrigins).toEqual(['http://localhost:5173']);
    expect(config.RATE_LIMIT_WINDOW_MS).toBe(900000);
    expect(config.RATE_LIMIT_MAX).toBe(100);
    expect(config.JWT_SECRET).toBe(SYNTHETIC_TEST_JWT_SECRET);
  });

  it('successfully validates configuration in development when JWT_SECRET is explicitly provided', () => {
    const config = validateEnv({
      NODE_ENV: 'development',
      JWT_SECRET: validSecret,
    });

    expect(config.NODE_ENV).toBe('development');
    expect(config.JWT_SECRET).toBe(validSecret);
  });

  it('rejects missing or omitted JWT_SECRET in development environment', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).toThrow(/JWT_SECRET is required/);
  });

  it('rejects missing or omitted JWT_SECRET in production environment', () => {
    expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET is required/);
  });

  it('rejects weak JWT_SECRET under 32 characters in all environments', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'development', JWT_SECRET: 'short_secret' })
    ).toThrow(/JWT_SECRET must be at least 32 characters/);

    expect(() =>
      validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'short_secret' })
    ).toThrow(/JWT_SECRET must be at least 32 characters/);

    expect(() =>
      validateEnv({ NODE_ENV: 'test', JWT_SECRET: 'short_secret' })
    ).toThrow(/JWT_SECRET must be at least 32 characters/);
  });

  it('rejects predictable synthetic test secret in development and production runtimes', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'development', JWT_SECRET: SYNTHETIC_TEST_JWT_SECRET })
    ).toThrow(/JWT_SECRET is required/);

    expect(() =>
      validateEnv({ NODE_ENV: 'production', JWT_SECRET: SYNTHETIC_TEST_JWT_SECRET })
    ).toThrow(/JWT_SECRET is required/);
  });

  it('rejects invalid PORT numbers outside 1-65535 or non-integers', () => {
    expect(() => validateEnv({ NODE_ENV: 'test', PORT: '0' })).toThrow(/PORT must be between 1 and 65535/);
    expect(() => validateEnv({ NODE_ENV: 'test', PORT: '65536' })).toThrow(/PORT must be between 1 and 65535/);
    expect(() => validateEnv({ NODE_ENV: 'test', PORT: 'not-a-number' })).toThrow(/PORT/);
  });

  it('rejects invalid BODY_LIMIT formats, values above 10MB, or zero sizes', () => {
    expect(() => validateEnv({ NODE_ENV: 'test', BODY_LIMIT: '50mb' })).toThrow(/BODY_LIMIT must be a size string between 1B and 10MB/);
    expect(() => validateEnv({ NODE_ENV: 'test', BODY_LIMIT: '100gb' })).toThrow(/BODY_LIMIT/);
    expect(() => validateEnv({ NODE_ENV: 'test', BODY_LIMIT: '0kb' })).toThrow(/BODY_LIMIT/);
    expect(() => validateEnv({ NODE_ENV: 'test', BODY_LIMIT: 'invalid_format' })).toThrow(/BODY_LIMIT/);
  });

  it('accepts valid bounded BODY_LIMIT strings (e.g. 500b, 512kb, 5mb)', () => {
    expect(validateEnv({ NODE_ENV: 'test', BODY_LIMIT: '500b' }).BODY_LIMIT).toBe('500b');
    expect(validateEnv({ NODE_ENV: 'test', BODY_LIMIT: '512kb' }).BODY_LIMIT).toBe('512kb');
    expect(validateEnv({ NODE_ENV: 'test', BODY_LIMIT: '5mb' }).BODY_LIMIT).toBe('5mb');
  });

  it('rejects malformed ALLOWED_ORIGINS (wildcards, origins with path or query, non-http/https)', () => {
    expect(() => validateEnv({ NODE_ENV: 'test', ALLOWED_ORIGINS: '*' })).toThrow(/ALLOWED_ORIGINS/);
    expect(() => validateEnv({ NODE_ENV: 'test', ALLOWED_ORIGINS: 'http://localhost:5173/with-path' })).toThrow(/ALLOWED_ORIGINS/);
    expect(() => validateEnv({ NODE_ENV: 'test', ALLOWED_ORIGINS: 'ftp://ftp.example.com' })).toThrow(/ALLOWED_ORIGINS/);
    expect(() => validateEnv({ NODE_ENV: 'test', ALLOWED_ORIGINS: 'not-a-valid-origin' })).toThrow(/ALLOWED_ORIGINS/);
  });

  it('accepts multiple comma-separated valid origins', () => {
    const config = validateEnv({
      NODE_ENV: 'test',
      ALLOWED_ORIGINS: 'http://localhost:5173, https://careercompass.edu',
    });
    expect(config.corsOrigins).toEqual(['http://localhost:5173', 'https://careercompass.edu']);
  });

  it('does not leak sensitive environment values in validation error messages', () => {
    try {
      validateEnv({ NODE_ENV: 'test', PORT: 'invalid_port_value_secret_12345' });
      expect.fail('Should have thrown validation error');
    } catch (err) {
      expect(err.message).not.toContain('invalid_port_value_secret_12345');
      expect(err.message).toContain('PORT');
    }
  });
});
