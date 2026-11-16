import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import rateLimit from 'express-rate-limit';
import { createApp } from '../src/app.js';
import { AppError } from '../src/utils/app-error.js';

describe('Career Explorer API Rate Limiting & Recovery Integration', () => {
  const mockCareers = [
    {
      id: 'c-1',
      slug: 'data-scientist',
      title: 'Data Scientist',
      summary: 'Builds machine learning pipelines and statistical models.',
      published: true,
    },
    {
      id: 'c-2',
      slug: 'software-architect',
      title: 'Software Architect',
      summary: 'Designs scalable distributed backend systems.',
      published: true,
    },
  ];

  const createMockCareerService = () => ({
    listCareers: vi.fn().mockImplementation(async ({ query = {} } = {}) => {
      const q = query.q;
      let filtered = [...mockCareers];
      if (q) {
        filtered = filtered.filter(
          (c) =>
            c.title.toLowerCase().includes(q.toLowerCase()) ||
            c.summary.toLowerCase().includes(q.toLowerCase())
        );
      }
      return {
        data: filtered,
        meta: {
          page: Number(query.page || 1),
          limit: Number(query.limit || 12),
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / (query.limit || 12)) || 1,
        },
      };
    }),
    listSkills: vi.fn().mockResolvedValue({
      data: [{ id: 'sk-1', name: 'Machine Learning' }],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    }),
    getCareer: vi.fn(),
    listPathways: vi.fn(),
  });

  const mockAuthenticate = (req, res, next) => {
    req.user = { id: 'usr-student', role: 'STUDENT' };
    next();
  };

  it('permits legitimate search queries and returns standard 200 pagination envelope with rate limit headers', async () => {
    const careerService = createMockCareerService();
    const app = createApp({
      careerService,
      authenticate: mockAuthenticate,
      env: {
        ALLOWED_ORIGINS: 'http://localhost:3000',
        RATE_LIMIT_WINDOW_MS: 60000,
        RATE_LIMIT_MAX: 100,
      },
    });

    const res = await request(app)
      .get('/api/v1/careers?q=Data%20Scientist')
      .expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].slug).toBe('data-scientist');
    expect(res.body.meta).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 12,
        total: 1,
        totalPages: 1,
      })
    );

    // Verify standard draft-7 rate limit headers are emitted
    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect(res.headers).toHaveProperty('ratelimit-remaining');
    expect(res.headers).toHaveProperty('ratelimit-reset');
  });

  it('strictly returns standard 429 error envelope when request rate limit threshold is exceeded', async () => {
    const careerService = createMockCareerService();
    // Test limiter configured to allow exactly 3 requests per window
    const tightLimiter = rateLimit({
      windowMs: 60000,
      max: 3,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res, next) => {
        next(new AppError('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later.', 429));
      },
    });

    const app = createApp({
      careerService,
      authenticate: mockAuthenticate,
      apiLimiter: tightLimiter,
    });

    // Send 3 allowed requests
    await request(app).get('/api/v1/careers').expect(200);
    await request(app).get('/api/v1/careers?q=Data').expect(200);
    await request(app).get('/api/v1/skills').expect(200);

    // 4th request must be rejected with HTTP 429
    const blockedRes = await request(app).get('/api/v1/careers?q=Scientist');
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body).toEqual({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
        details: [],
      },
    });

    // Check rate limit headers on 429 response
    expect(blockedRes.headers['ratelimit-remaining']).toBe('0');
    expect(blockedRes.headers).toHaveProperty('ratelimit-reset');
    expect(blockedRes.headers).toHaveProperty('retry-after');
  });

  it('allows immediate recovery on independent client IP when one client IP is throttled', async () => {
    const careerService = createMockCareerService();
    const tightLimiter = rateLimit({
      windowMs: 60000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.headers['x-client-ip'] || req.ip,
      validate: { xForwardedForHeader: false },
      handler: (req, res, next) => {
        next(new AppError('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later.', 429));
      },
    });

    const app = createApp({
      careerService,
      authenticate: mockAuthenticate,
      apiLimiter: tightLimiter,
    });

    // Client A exhausts quota
    await request(app).get('/api/v1/careers').set('x-client-ip', '192.168.1.10').expect(200);
    await request(app).get('/api/v1/careers').set('x-client-ip', '192.168.1.10').expect(200);
    const clientABlocked = await request(app).get('/api/v1/careers').set('x-client-ip', '192.168.1.10');
    expect(clientABlocked.status).toBe(429);

    // Client B connects and is unaffected
    const clientBAllowed = await request(app).get('/api/v1/careers').set('x-client-ip', '192.168.1.20');
    expect(clientBAllowed.status).toBe(200);
    expect(clientBAllowed.body.data).toHaveLength(2);
  });
});
