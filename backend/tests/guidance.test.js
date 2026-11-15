import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { GuidanceService } from '../src/services/guidance.service.js';
import { AppError } from '../src/utils/app-error.js';

const student = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'STUDENT',
};
const attemptId = '22222222-2222-4222-8222-222222222222';
const careerId = '33333333-3333-4333-8333-333333333333';
const session = {
  sessionId: '6731ec8e1c4a520012ab1234',
  attemptId,
  careerIds: [careerId],
  createdAt: new Date('2026-11-13T00:00:00Z'),
  updatedAt: new Date('2026-11-13T00:00:00Z'),
  messages: [],
};

const createFixture = ({ provider = { generate: vi.fn().mockResolvedValue({
  text: 'Explore this pathway with a counsellor.',
  groundingCareerIds: [careerId],
  generatedByAI: true,
  uncertaintyDisclaimer: 'Exploratory guidance based on interest alignment.',
}) } } = {}) => {
  const repository = {
    create: vi.fn().mockResolvedValue(session),
    list: vi.fn().mockResolvedValue({ data: [session], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
    get: vi.fn().mockResolvedValue(session),
    appendMessages: vi.fn().mockResolvedValue(session),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const sqlClient = {
    assessmentAttempt: {
      findFirst: vi.fn().mockResolvedValue({ id: attemptId, scoresJson: { ANALYTICAL: 0.8 } }),
    },
    career: {
      findMany: vi.fn().mockResolvedValue([{
        id: careerId,
        title: 'Synthetic Career',
        description: 'Verified summary',
        dimensions: [],
        careerSkills: [],
        pathways: [],
      }]),
    },
  };
  const service = new GuidanceService({
    sqlClient,
    repository,
    llmProvider: provider,
  });
  const app = createApp({
    guidanceService: service,
    authenticate: (req, res, next) => {
      req.user = student;
      next();
    },
    allowedOrigins: [],
  });
  return { app, repository, sqlClient, provider };
};

describe('guidance API', () => {
  it('creates, lists, reads, messages, and deletes owned sessions', async () => {
    const { app, repository } = createFixture();

    const created = await request(app)
      .post('/api/v1/guidance/sessions')
      .send({ attemptId, careerIds: [careerId] });
    expect(created.status).toBe(201);
    expect(created.body.data.sessionId).toBe(session.sessionId);

    expect((await request(app).get('/api/v1/guidance/sessions')).status).toBe(200);
    expect((await request(app).get(`/api/v1/guidance/sessions/${session.sessionId}`)).status).toBe(200);
    const message = await request(app)
      .post(`/api/v1/guidance/sessions/${session.sessionId}/messages`)
      .send({ message: 'Why was this career recommended?' });
    expect(message.status).toBe(200);
    expect(message.body.data.message.generatedByAI).toBe(true);

    expect((await request(app).delete(`/api/v1/guidance/sessions/${session.sessionId}`)).status).toBe(204);
    expect(repository.remove).toHaveBeenCalledWith({ studentId: student.id, sessionId: session.sessionId });
  });

  it('rejects invalid input and does not trust a submitted user id', async () => {
    const { app, repository } = createFixture();
    const response = await request(app)
      .post('/api/v1/guidance/sessions')
      .send({ attemptId, careerIds: [careerId], studentId: '99999999-9999-4999-8999-999999999999' });
    expect(response.status).toBe(422);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('returns AI_UNAVAILABLE without a fake response when the provider fails', async () => {
    const { app } = createFixture({
      provider: {
        generate: vi.fn().mockRejectedValue(new AppError('AI_UNAVAILABLE', 'Unavailable', 503)),
      },
    });
    const response = await request(app)
      .post(`/api/v1/guidance/sessions/${session.sessionId}/messages`)
      .send({ message: 'Explain this result.' });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('AI_UNAVAILABLE');
  });

  it('limits message requests per authenticated student', async () => {
    const previousLimit = process.env.GUIDANCE_RATE_LIMIT_MAX;
    process.env.GUIDANCE_RATE_LIMIT_MAX = '1';
    try {
      const { app } = createFixture();
      const path = `/api/v1/guidance/sessions/${session.sessionId}/messages`;
      expect((await request(app).post(path).send({ message: 'First' })).status).toBe(200);
      expect((await request(app).post(path).send({ message: 'Second' })).status).toBe(429);
    } finally {
      if (previousLimit === undefined) delete process.env.GUIDANCE_RATE_LIMIT_MAX;
      else process.env.GUIDANCE_RATE_LIMIT_MAX = previousLimit;
    }
  });
});
