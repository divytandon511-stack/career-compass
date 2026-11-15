import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';

const student = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'student@example.test',
  role: 'STUDENT',
  status: 'ACTIVE',
};

const admin = {
  ...student,
  id: '22222222-2222-4222-8222-222222222222',
  role: 'ADMIN',
};

const authenticate = (req, res, next) => {
  req.user = req.headers['x-test-role'] === 'admin' ? admin : student;
  next();
};

const assessmentService = {
  listAssessments: async () => ({
    data: [{ id: 'assessment-1', title: 'Interest Assessment' }],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  }),
  getQuestions: async () => ({
    assessmentId: 'assessment-1',
    version: 1,
    questions: [{ id: 'question-1', prompt: 'Question', options: [{ id: 'option-1', label: 'Yes' }] }],
  }),
  startAttempt: async () => ({
    id: 'attempt-1',
    assessmentId: 'assessment-1',
    status: 'IN_PROGRESS',
  }),
  getAttempt: async () => ({
    id: 'attempt-1',
    assessmentId: 'assessment-1',
    assessmentVersion: 1,
    status: 'COMPLETED',
    scoresJson: { ANALYTICAL: 1 },
    algorithmVersion: 'cosine-v1',
    answers: [{ questionId: 'question-1', selectedOptionId: 'option-1', score: 4 }],
  }),
  saveAnswer: async () => ({
    attemptId: 'attempt-1',
    questionId: 'question-1',
    selectedOptionId: 'option-1',
  }),
  submitAttempt: async () => ({
    attemptId: 'attempt-1',
    status: 'COMPLETED',
    dimensionScores: { ANALYTICAL: 1 },
    algorithmVersion: 'cosine-v1',
  }),
  listRecommendations: async () => ({
    data: [{
      career: { id: 'career-1', slug: 'developer', title: 'Developer' },
      rank: 1,
      similarityScore: 1,
      reasons: ['Strong alignment'],
      cautions: [],
    }],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  }),
  listAttempts: async () => ({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
  getAssessment: async () => ({ id: 'assessment-1', version: 1, status: 'PUBLISHED' }),
};

const app = createApp({ assessmentService, authenticate, allowedOrigins: [] });

describe('Assessment HTTP API', () => {
  it('returns assessment questions without exposing scoring values or weights', async () => {
    const response = await request(app).get(
      '/api/v1/assessments/33333333-3333-4333-8333-333333333333/questions'
    );

    expect(response.status).toBe(200);
    expect(response.body.data.questions[0]).not.toHaveProperty('weight');
    expect(response.body.data.questions[0].options[0]).not.toHaveProperty('value');
  });

  it('requires student role for attempt lifecycle operations', async () => {
    const response = await request(app)
      .post('/api/v1/assessments/33333333-3333-4333-8333-333333333333/attempts')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns the documented submit and recommendation envelopes', async () => {
    const submit = await request(app)
      .post('/api/v1/attempts/22222222-2222-4222-8222-222222222222/submit');
    const recommendations = await request(app)
      .get('/api/v1/attempts/22222222-2222-4222-8222-222222222222/recommendations');

    expect(submit.status).toBe(200);
    expect(submit.body.data.algorithmVersion).toBe('cosine-v1');
    expect(recommendations.status).toBe(200);
    expect(recommendations.body.data[0].similarityScore).toBe(1);
  });
});

