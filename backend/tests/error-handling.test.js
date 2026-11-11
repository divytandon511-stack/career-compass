import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

import { app } from '../src/app.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { AppError } from '../src/utils/app-error.js';
import { validateEnv } from '../src/config/env.js';

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
    testApp.get('/throw-internal-error', (req, res, next) => {
      next(new Error('CRITICAL_INTERNAL_DATABASE_CREDENTIALS_LEAK'));
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/throw-internal-error');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        details: [],
      },
    });

    // Ensure internal exception message is never exposed in the response
    expect(JSON.stringify(res.body)).not.toContain('CRITICAL_INTERNAL_DATABASE_CREDENTIALS_LEAK');
    expect(res.body.error).not.toHaveProperty('stack');
    expect(res.body).not.toHaveProperty('stack');
  });

  it('prevents untrusted error properties from corrupting the standardized error contract', async () => {
    const testApp = express();
    testApp.get('/untrusted-error', (req, res, next) => {
      // Simulate untrusted error object with unexpected/polluted properties
      const untrustedError = {
        statusCode: 200, // Attempting to spoof success status
        code: 'UNTRUSTED_ARBITRARY_CODE',
        message: 'Internal driver state error',
        details: { pollutedKey: 'pollutedValue' }, // Non-array details
        extraSecret: 'confidential_key_123',
      };
      next(untrustedError);
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/untrusted-error');

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
  it('successfully validates and applies default configuration', () => {
    const config = validateEnv({});

    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(4000);
    expect(config.BODY_LIMIT).toBe('100kb');
    expect(config.corsOrigins).toEqual(['http://localhost:5173']);
    expect(config.RATE_LIMIT_WINDOW_MS).toBe(900000);
    expect(config.RATE_LIMIT_MAX).toBe(100);
  });

  it('rejects invalid PORT numbers outside 1-65535 or non-integers', () => {
    expect(() => validateEnv({ PORT: '0' })).toThrow(/PORT must be between 1 and 65535/);
    expect(() => validateEnv({ PORT: '65536' })).toThrow(/PORT must be between 1 and 65535/);
    expect(() => validateEnv({ PORT: 'not-a-number' })).toThrow(/PORT/);
  });

  it('rejects invalid BODY_LIMIT formats, values above 10MB, or zero sizes', () => {
    expect(() => validateEnv({ BODY_LIMIT: '50mb' })).toThrow(/BODY_LIMIT must be a size string between 1B and 10MB/);
    expect(() => validateEnv({ BODY_LIMIT: '100gb' })).toThrow(/BODY_LIMIT/);
    expect(() => validateEnv({ BODY_LIMIT: '0kb' })).toThrow(/BODY_LIMIT/);
    expect(() => validateEnv({ BODY_LIMIT: 'invalid_format' })).toThrow(/BODY_LIMIT/);
  });

  it('accepts valid bounded BODY_LIMIT strings (e.g. 500b, 512kb, 5mb)', () => {
    expect(validateEnv({ BODY_LIMIT: '500b' }).BODY_LIMIT).toBe('500b');
    expect(validateEnv({ BODY_LIMIT: '512kb' }).BODY_LIMIT).toBe('512kb');
    expect(validateEnv({ BODY_LIMIT: '5mb' }).BODY_LIMIT).toBe('5mb');
  });

  it('rejects malformed ALLOWED_ORIGINS (wildcards, origins with path or query, non-http/https)', () => {
    expect(() => validateEnv({ ALLOWED_ORIGINS: '*' })).toThrow(/ALLOWED_ORIGINS/);
    expect(() => validateEnv({ ALLOWED_ORIGINS: 'http://localhost:5173/with-path' })).toThrow(/ALLOWED_ORIGINS/);
    expect(() => validateEnv({ ALLOWED_ORIGINS: 'ftp://ftp.example.com' })).toThrow(/ALLOWED_ORIGINS/);
    expect(() => validateEnv({ ALLOWED_ORIGINS: 'not-a-valid-origin' })).toThrow(/ALLOWED_ORIGINS/);
  });

  it('accepts multiple comma-separated valid origins', () => {
    const config = validateEnv({
      ALLOWED_ORIGINS: 'http://localhost:5173, https://careercompass.edu',
    });
    expect(config.corsOrigins).toEqual(['http://localhost:5173', 'https://careercompass.edu']);
  });

  it('does not leak sensitive environment values in validation error messages', () => {
    try {
      validateEnv({ PORT: 'invalid_port_value_secret_12345' });
      expect.fail('Should have thrown validation error');
    } catch (err) {
      expect(err.message).not.toContain('invalid_port_value_secret_12345');
      expect(err.message).toContain('PORT');
    }
  });
});
