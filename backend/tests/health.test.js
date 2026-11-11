import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import http from 'node:http';

import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { startServer, shutdown, isMainModule, server } from '../src/server.js';
import { AppError } from '../src/utils/app-error.js';
import { errorHandler } from '../src/middleware/error-handler.js';

describe('Health Endpoint, Security Headers, CORS, and Server Startup', () => {
  afterAll(async () => {
    await shutdown();
  });

  it('GET /api/v1/health returns HTTP 200 and the standard health data envelope', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        status: 'ok',
      },
    });
  });

  it('GET /health root alias returns HTTP 200 aligned with architecture specs', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: {
        status: 'ok',
      },
    });
  });

  it('verifies that security headers from Helmet are present in the response', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(res.headers).toHaveProperty('x-dns-prefetch-control', 'off');
    expect(res.headers).toHaveProperty('x-frame-options', 'SAMEORIGIN');
    expect(res.headers).toHaveProperty('x-download-options', 'noopen');
  });

  it('allows requests from configured CORS origins with credentials', async () => {
    const allowedOrigin = env.corsOrigins[0] || 'http://localhost:5173';

    const res = await request(app)
      .get('/api/v1/health')
      .set('Origin', allowedOrigin);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not approve disallowed CORS origins (Access-Control-Allow-Origin is omitted)', async () => {
    const disallowedOrigin = 'http://malicious-external-origin.test';

    const res = await request(app)
      .get('/api/v1/health')
      .set('Origin', disallowedOrigin);

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('handles CORS preflight (OPTIONS) requests correctly for allowed origins', async () => {
    const allowedOrigin = env.corsOrigins[0] || 'http://localhost:5173';

    const res = await request(app)
      .options('/api/v1/health')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'GET');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-methods']).toContain('GET');
  });

  it('rejects CORS preflight (OPTIONS) requests for disallowed origins without allow headers', async () => {
    const disallowedOrigin = 'http://unauthorized-origin.test';

    const res = await request(app)
      .options('/api/v1/health')
      .set('Origin', disallowedOrigin)
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rate limiting returns the standard error envelope on threshold breach', async () => {
    const rateLimitedApp = express();
    const testLimiter = rateLimit({
      windowMs: 60000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res, next) => {
        next(new AppError('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later.', 429));
      },
    });

    rateLimitedApp.use(testLimiter);
    rateLimitedApp.get('/test-limit', (req, res) => res.json({ ok: true }));
    rateLimitedApp.use(errorHandler);

    // Request 1 and 2 succeed
    await request(rateLimitedApp).get('/test-limit').expect(200);
    await request(rateLimitedApp).get('/test-limit').expect(200);

    // Request 3 exceeds limit
    const res = await request(rateLimitedApp).get('/test-limit');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
        details: [],
      },
    });
  });

  it('handles asynchronous HTTP startup errors (EADDRINUSE) when a port conflict occurs', async () => {
    const blockerServer = http.createServer((req, res) => res.end('blocker'));

    // Bind to port 0 to obtain an ephemeral port assigned by the OS
    await new Promise((resolve) => blockerServer.listen(0, resolve));
    const ephemeralPort = blockerServer.address().port;

    try {
      // Attempt to start our application on the already occupied ephemeral port
      await expect(startServer(ephemeralPort)).rejects.toMatchObject({
        code: 'EADDRINUSE',
      });
    } finally {
      await new Promise((resolve) => blockerServer.close(resolve));
    }
  });

  it('prevents duplicate shutdown executions and handles idempotent shutdown', async () => {
    // Calling shutdown multiple times sequentially and concurrently resolves cleanly
    await expect(Promise.all([shutdown('SIGTERM'), shutdown('SIGTERM')])).resolves.toBeDefined();
    await expect(shutdown('SIGINT')).resolves.toBeUndefined();
  });

  it('supports starting a server again after a completed shutdown', async () => {
    // Start on ephemeral port 0
    const serverInstance1 = await startServer(0);
    expect(serverInstance1.listening).toBe(true);

    // Shut down cleanly
    await shutdown('SIGTERM');
    expect(serverInstance1.listening).toBe(false);

    // Start again on ephemeral port 0
    const serverInstance2 = await startServer(0);
    expect(serverInstance2.listening).toBe(true);

    // Clean up
    await shutdown('SIGTERM');
    expect(serverInstance2.listening).toBe(false);
  });

  it('verifies importing server.js does not start an HTTP server', () => {
    expect(isMainModule()).toBe(false);
    expect(server).toBeNull();
  });
});
