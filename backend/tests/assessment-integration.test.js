/**
 * ============================================================================
 * CareerCompass — Assessment & Recommendations Integration Test Suite
 * ============================================================================
 * Aligned with docs/api-contract.md §3, §4, §5, docs/architecture.md §7,
 * and docs/data-model.md §2.5, §2.6, §2.7, §2.8, §2.13.
 *
 * Verifies against the dedicated PostgreSQL test database:
 * 1. Authentication & RBAC enforcement across all assessment endpoints.
 * 2. Assessment listing (student published-only vs admin draft visibility) and pagination.
 * 3. Assessment details & question projection stripping scoring weights/values for students.
 * 4. Question retrieval with optional pagination (page, limit) and position ordering.
 * 5. Attempt lifecycle: start (201), resumption (isResumed: true), attempt listing, and attempt details.
 * 6. Answer persistence: validation (422), question/attempt ownership (404), server-side scoring,
 *    and rejection of answers on completed attempts (409).
 * 7. Assessment submission: rejection of incomplete attempts (422), transactional row-locking,
 *    deterministic career matching, score persistence across 6 canonical dimensions,
 *    and rejection of already completed attempts (409).
 * 8. Concurrency & double submission safety: serialized attempt completion without duplicate recommendations.
 * 9. Recommendations retrieval: 409 when attempt in progress, 404 for other students,
 *    ranked recommendation envelope, and pagination.
 * 10. Empty career catalog resilience: successful completion with empty recommendations list.
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import dotenv from 'dotenv';

import { createApp } from '../src/app.js';
import { AssessmentService } from '../src/services/assessment.service.js';
import { AssessmentRepositoryAdapter } from '../src/repositories/assessment.repository.adapter.js';
import { createAuthenticate } from '../src/middleware/authenticate.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { CANONICAL_DIMENSIONS } from '../src/matching/constants.js';

dotenv.config();

const resolveTestDatabaseUrl = () => {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.replace(
      /\/career_compass(\?|$)/,
      '/career_compass_test$1'
    );
  }
  return null;
};

const TEST_DB_URL = resolveTestDatabaseUrl();

const STUDENT_1_ID = '11111111-1111-4111-8111-111111111101';
const STUDENT_2_ID = '11111111-1111-4111-8111-111111111102';
const ADMIN_ID = '22222222-2222-4222-8222-222222222201';
const COUNSELLOR_ID = '33333333-3333-4333-8333-333333333301';

const PUBLISHED_ASSESSMENT_ID = 'a0000000-0000-4000-8000-000000000001';
const DRAFT_ASSESSMENT_ID = 'a0000000-0000-4000-8000-000000000099';

const TEST_CAREER_1_ID = 'c0000000-0000-4000-8000-000000000001';
const TEST_CAREER_2_ID = 'c0000000-0000-4000-8000-000000000002';
const TEST_CAREER_3_ID = 'c0000000-0000-4000-8000-000000000003';

describe('Assessment Backend API Integration Test Suite', () => {
  let prisma;
  let app;
  let student1Token;
  let student2Token;
  let adminToken;
  let counsellorToken;
  let publishedAssessment;
  let allQuestions;

  beforeAll(async () => {
    expect(TEST_DB_URL).toBeTruthy();
    expect(TEST_DB_URL).toMatch(/career_compass_test/);

    prisma = new PrismaClient({
      datasources: { db: { url: TEST_DB_URL } },
    });
    await prisma.$connect();

    // Ensure clean state for test users
    await prisma.recommendation.deleteMany({
      where: {
        attempt: {
          studentId: { in: [STUDENT_1_ID, STUDENT_2_ID] },
        },
      },
    });
    await prisma.answer.deleteMany({
      where: {
        attempt: {
          studentId: { in: [STUDENT_1_ID, STUDENT_2_ID] },
        },
      },
    });
    await prisma.assessmentAttempt.deleteMany({
      where: {
        studentId: { in: [STUDENT_1_ID, STUDENT_2_ID] },
      },
    });

    // Upsert test users and student profiles
    await prisma.user.upsert({
      where: { id: STUDENT_1_ID },
      update: { status: 'ACTIVE', role: 'STUDENT' },
      create: {
        id: STUDENT_1_ID,
        email: 'integration-student1@careercompass.test',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$synthetic-hash-test',
        displayName: 'Integration Student 1',
        role: 'STUDENT',
        status: 'ACTIVE',
        studentProfile: {
          create: { consentAccepted: true, schoolGrade: '11' },
        },
      },
    });
    await prisma.studentProfile.upsert({
      where: { userId: STUDENT_1_ID },
      update: { consentAccepted: true },
      create: { userId: STUDENT_1_ID, consentAccepted: true, schoolGrade: '11' },
    });

    await prisma.user.upsert({
      where: { id: STUDENT_2_ID },
      update: { status: 'ACTIVE', role: 'STUDENT' },
      create: {
        id: STUDENT_2_ID,
        email: 'integration-student2@careercompass.test',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$synthetic-hash-test',
        displayName: 'Integration Student 2',
        role: 'STUDENT',
        status: 'ACTIVE',
        studentProfile: {
          create: { consentAccepted: true, schoolGrade: '12' },
        },
      },
    });
    await prisma.studentProfile.upsert({
      where: { userId: STUDENT_2_ID },
      update: { consentAccepted: true },
      create: { userId: STUDENT_2_ID, consentAccepted: true, schoolGrade: '12' },
    });

    await prisma.user.upsert({
      where: { id: ADMIN_ID },
      update: { status: 'ACTIVE', role: 'ADMIN' },
      create: {
        id: ADMIN_ID,
        email: 'integration-admin@careercompass.test',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$synthetic-hash-test',
        displayName: 'Integration Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    await prisma.user.upsert({
      where: { id: COUNSELLOR_ID },
      update: { status: 'ACTIVE', role: 'COUNSELLOR' },
      create: {
        id: COUNSELLOR_ID,
        email: 'integration-counsellor@careercompass.test',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$synthetic-hash-test',
        displayName: 'Integration Counsellor',
        role: 'COUNSELLOR',
        status: 'ACTIVE',
      },
    });

    // Upsert a draft assessment for admin vs student visibility tests
    await prisma.assessment.upsert({
      where: { id: DRAFT_ASSESSMENT_ID },
      update: { status: 'DRAFT', title: 'Draft Assessment v2' },
      create: {
        id: DRAFT_ASSESSMENT_ID,
        title: 'Draft Assessment v2',
        description: 'Upcoming version of career explorer (in draft)',
        version: 2,
        status: 'DRAFT',
      },
    });

    // Upsert test careers with dimensions across all 6 canonical dimensions
    const testCareers = [
      {
        id: TEST_CAREER_1_ID,
        slug: 'software-architect',
        title: 'Software Architect',
        description: 'Designs complex software systems and architectures.',
        published: true,
        profileVersion: 1,
        dimensions: {
          ANALYTICAL: 0.95,
          INVESTIGATIVE: 0.85,
          PRACTICAL: 0.65,
          CREATIVE: 0.45,
          ORGANIZATIONAL: 0.40,
          SOCIAL: 0.25,
        },
      },
      {
        id: TEST_CAREER_2_ID,
        slug: 'ux-researcher',
        title: 'UX Researcher',
        description: 'Investigates user behavior and designs intuitive experiences.',
        published: true,
        profileVersion: 1,
        dimensions: {
          SOCIAL: 0.90,
          INVESTIGATIVE: 0.80,
          CREATIVE: 0.75,
          ANALYTICAL: 0.50,
          ORGANIZATIONAL: 0.40,
          PRACTICAL: 0.30,
        },
      },
      {
        id: TEST_CAREER_3_ID,
        slug: 'data-scientist',
        title: 'Data Scientist',
        description: 'Extracts actionable insights from large multidimensional datasets.',
        published: true,
        profileVersion: 1,
        dimensions: {
          ANALYTICAL: 0.90,
          INVESTIGATIVE: 0.85,
          ORGANIZATIONAL: 0.60,
          PRACTICAL: 0.50,
          CREATIVE: 0.40,
          SOCIAL: 0.30,
        },
      },
    ];

    for (const c of testCareers) {
      await prisma.career.upsert({
        where: { id: c.id },
        update: {
          slug: c.slug,
          title: c.title,
          description: c.description,
          published: c.published,
          profileVersion: c.profileVersion,
        },
        create: {
          id: c.id,
          slug: c.slug,
          title: c.title,
          description: c.description,
          published: c.published,
          profileVersion: c.profileVersion,
        },
      });

      for (const [dim, weight] of Object.entries(c.dimensions)) {
        await prisma.careerDimension.upsert({
          where: {
            careerId_dimension: { careerId: c.id, dimension: dim },
          },
          update: { targetWeight: weight },
          create: { careerId: c.id, dimension: dim, targetWeight: weight },
        });
      }
    }

    // Verify published assessment and load questions
    publishedAssessment = await prisma.assessment.findUnique({
      where: { id: PUBLISHED_ASSESSMENT_ID },
      include: { questions: { orderBy: { position: 'asc' } } },
    });
    expect(publishedAssessment).toBeTruthy();
    expect(publishedAssessment.questions).toHaveLength(30);
    allQuestions = publishedAssessment.questions;

    // Generate JWT access tokens
    student1Token = signAccessToken({
      id: STUDENT_1_ID,
      email: 'integration-student1@careercompass.test',
      role: 'STUDENT',
    });
    student2Token = signAccessToken({
      id: STUDENT_2_ID,
      email: 'integration-student2@careercompass.test',
      role: 'STUDENT',
    });
    adminToken = signAccessToken({
      id: ADMIN_ID,
      email: 'integration-admin@careercompass.test',
      role: 'ADMIN',
    });
    counsellorToken = signAccessToken({
      id: COUNSELLOR_ID,
      email: 'integration-counsellor@careercompass.test',
      role: 'COUNSELLOR',
    });

    // Wire up runtime app
    const assessmentRepository = new AssessmentRepositoryAdapter({ dbClient: prisma });
    const assessmentService = new AssessmentService({ assessmentRepository });
    const authenticate = createAuthenticate({
      findUserById: async (id) => prisma.user.findUnique({ where: { id } }),
    });

    app = createApp({
      assessmentService,
      authenticate,
      allowedOrigins: ['http://localhost:3000'],
      apiLimiter: (req, res, next) => next(),
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.recommendation.deleteMany({
        where: {
          attempt: {
            studentId: { in: [STUDENT_1_ID, STUDENT_2_ID] },
          },
        },
      });
      await prisma.answer.deleteMany({
        where: {
          attempt: {
            studentId: { in: [STUDENT_1_ID, STUDENT_2_ID] },
          },
        },
      });
      await prisma.assessmentAttempt.deleteMany({
        where: {
          studentId: { in: [STUDENT_1_ID, STUDENT_2_ID] },
        },
      });
      await prisma.assessment.deleteMany({
        where: { id: DRAFT_ASSESSMENT_ID },
      });
      for (const careerId of [TEST_CAREER_1_ID, TEST_CAREER_2_ID, TEST_CAREER_3_ID]) {
        await prisma.careerDimension.deleteMany({ where: { careerId } });
        await prisma.career.deleteMany({ where: { id: careerId } });
      }
      await prisma.$disconnect();
    }
  });

  // ==========================================================================
  // 1. Authentication & RBAC Tests
  // ==========================================================================
  describe('Authentication & RBAC Control', () => {
    it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const endpoints = [
        { method: 'get', url: '/api/v1/assessments' },
        { method: 'get', url: `/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}` },
        { method: 'get', url: `/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/questions` },
        { method: 'post', url: `/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/attempts` },
        { method: 'get', url: '/api/v1/attempts' },
        { method: 'get', url: `/api/v1/attempts/${STUDENT_1_ID}` },
        { method: 'put', url: `/api/v1/attempts/${STUDENT_1_ID}/answers/${allQuestions[0].id}` },
        { method: 'post', url: `/api/v1/attempts/${STUDENT_1_ID}/submit` },
        { method: 'get', url: `/api/v1/attempts/${STUDENT_1_ID}/recommendations` },
      ];

      for (const { method, url } of endpoints) {
        const res = await request(app)[method](url);
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('rejects malformed authorization header with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .get('/api/v1/assessments')
        .set('Authorization', 'Basic dXNlcjpwYXNz');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('enforces RBAC: COUNSELLOR cannot start or modify attempts (403 FORBIDDEN)', async () => {
      const res1 = await request(app)
        .post(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/attempts`)
        .set('Authorization', `Bearer ${counsellorToken}`);
      expect(res1.status).toBe(403);
      expect(res1.body.error.code).toBe('FORBIDDEN');

      const res2 = await request(app)
        .get('/api/v1/attempts')
        .set('Authorization', `Bearer ${counsellorToken}`);
      expect(res2.status).toBe(403);

      const res3 = await request(app)
        .get(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/questions`)
        .set('Authorization', `Bearer ${counsellorToken}`);
      expect(res3.status).toBe(403);
    });

    it('enforces RBAC: ADMIN cannot execute student-only attempt lifecycle (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/attempts`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================================================
  // 2. Assessment Listing & Visibility
  // ==========================================================================
  describe('Assessment Listing & Visibility', () => {
    it('returns published assessments only for STUDENT role', async () => {
      const res = await request(app)
        .get('/api/v1/assessments')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      // Student must only see PUBLISHED assessments
      for (const assessment of res.body.data) {
        expect(assessment.status).toBe('PUBLISHED');
      }
      expect(res.body.data.some((a) => a.id === DRAFT_ASSESSMENT_ID)).toBe(false);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('totalPages');
    });

    it('allows ADMIN to see draft assessments and filter by status', async () => {
      const res = await request(app)
        .get('/api/v1/assessments?status=DRAFT')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((a) => a.id === DRAFT_ASSESSMENT_ID)).toBe(true);
      for (const assessment of res.body.data) {
        expect(assessment.status).toBe('DRAFT');
      }
    });

    it('supports sorting and pagination on assessments list', async () => {
      const res = await request(app)
        .get('/api/v1/assessments?sort=title&order=asc&page=1&limit=5')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(5);
    });

    it('rejects invalid query parameters with 422 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/v1/assessments?sort=invalidColumn')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns assessment detail for published assessment (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(PUBLISHED_ASSESSMENT_ID);
      expect(res.body.data.status).toBe('PUBLISHED');
      expect(res.body.data.version).toBe(1);
    });

    it('returns 404 NOT_FOUND when student requests non-existent assessment', async () => {
      const res = await request(app)
        .get('/api/v1/assessments/99999999-9999-4999-8999-999999999999')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 NOT_FOUND when student requests draft assessment by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/assessments/${DRAFT_ASSESSMENT_ID}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 200 when admin requests draft assessment by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/assessments/${DRAFT_ASSESSMENT_ID}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(DRAFT_ASSESSMENT_ID);
      expect(res.body.data.status).toBe('DRAFT');
    });
  });

  // ==========================================================================
  // 3. Question Retrieval & Projection Security
  // ==========================================================================
  describe('Question Retrieval & Projection Security', () => {
    it('returns all 30 questions stripped of scoring keys and weights for STUDENT', async () => {
      const res = await request(app)
        .get(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/questions`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.assessmentId).toBe(PUBLISHED_ASSESSMENT_ID);
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.questions).toHaveLength(30);

      // Verify positions are strictly 1..30 in ascending order
      for (let i = 0; i < 30; i++) {
        const q = res.body.data.questions[i];
        expect(q.position).toBe(i + 1);
        expect(CANONICAL_DIMENSIONS).toContain(q.dimension);
        expect(q.prompt).toBeTruthy();

        // SECURITY: weights must NEVER be exposed to students
        expect(q).not.toHaveProperty('weight');

        // SECURITY: option values (Likert 0..4) must NEVER be exposed to students
        expect(Array.isArray(q.options)).toBe(true);
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        for (const opt of q.options) {
          expect(opt).toHaveProperty('id');
          expect(opt).toHaveProperty('label');
          expect(opt).not.toHaveProperty('value');
        }
      }
    });

    it('exposes question weights and option scoring values for ADMIN', async () => {
      const res = await request(app)
        .get(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/questions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const firstQ = res.body.data.questions[0];
      expect(firstQ).toHaveProperty('weight');
      expect(typeof firstQ.weight).toBe('number');
      expect(firstQ.options[0]).toHaveProperty('value');
      expect(typeof firstQ.options[0].value).toBe('number');
    });

    it('supports optional pagination on questions endpoint (page, limit)', async () => {
      const resPage1 = await request(app)
        .get(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/questions?page=1&limit=10`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(resPage1.status).toBe(200);
      expect(resPage1.body.data.questions).toHaveLength(10);
      expect(resPage1.body.data.questions[0].position).toBe(1);
      expect(resPage1.body.data.questions[9].position).toBe(10);
      expect(resPage1.body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 30,
        totalPages: 3,
      });

      const resPage2 = await request(app)
        .get(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/questions?page=2&limit=10`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(resPage2.status).toBe(200);
      expect(resPage2.body.data.questions).toHaveLength(10);
      expect(resPage2.body.data.questions[0].position).toBe(11);
      expect(resPage2.body.data.questions[9].position).toBe(20);
      expect(resPage2.body.meta.page).toBe(2);
    });

    it('returns 404 NOT_FOUND when student requests questions for draft assessment', async () => {
      const res = await request(app)
        .get(`/api/v1/assessments/${DRAFT_ASSESSMENT_ID}/questions`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ==========================================================================
  // 4. Attempt Lifecycle & Resumption
  // ==========================================================================
  describe('Attempt Lifecycle & Resumption', () => {
    let attemptId;

    it('creates a new attempt for published assessment (201 CREATED)', async () => {
      const res = await request(app)
        .post(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.assessmentId).toBe(PUBLISHED_ASSESSMENT_ID);
      expect(res.body.data.assessmentVersion).toBe(1);
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.isResumed).toBe(false);
      expect(res.body.data).toHaveProperty('startedAt');

      attemptId = res.body.data.id;
    });

    it('resumes existing IN_PROGRESS attempt idempotently (isResumed: true)', async () => {
      const res = await request(app)
        .post(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(attemptId);
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.isResumed).toBe(true);
    });

    it('rejects attempt creation on non-existent assessment with 404 NOT_FOUND', async () => {
      const res = await request(app)
        .post('/api/v1/assessments/99999999-9999-4999-8999-999999999999/attempts')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects attempt creation on draft assessment with 409 CONFLICT', async () => {
      const res = await request(app)
        .post(`/api/v1/assessments/${DRAFT_ASSESSMENT_ID}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('lists own attempts with pagination and status filtering', async () => {
      const res = await request(app)
        .get('/api/v1/attempts?status=IN_PROGRESS&page=1&limit=10')
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((a) => a.id === attemptId)).toBe(true);
      expect(res.body.meta).toHaveProperty('total');
    });

    it('gets own attempt details with formatted answers', async () => {
      const res = await request(app)
        .get(`/api/v1/attempts/${attemptId}`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(attemptId);
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(Array.isArray(res.body.data.answers)).toBe(true);
      expect(res.body.data).not.toHaveProperty('recommendationsUrl');
    });

    it('returns 404 NOT_FOUND when student2 attempts to access student1 attempt (isolation)', async () => {
      const res = await request(app)
        .get(`/api/v1/attempts/${attemptId}`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ==========================================================================
  // 5. Answer Persistence & Validation
  // ==========================================================================
  describe('Answer Recording & Validation', () => {
    let student1AttemptId;

    beforeAll(async () => {
      const res = await request(app)
        .post(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`);
      student1AttemptId = res.body.data.id;
    });

    it('saves a valid answer and computes score server-side in DB (200 OK)', async () => {
      const question = allQuestions[0];
      const validOption = question.options[3]; // Likert value 3

      const res = await request(app)
        .put(`/api/v1/attempts/${student1AttemptId}/answers/${question.id}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ optionId: validOption.id });

      expect(res.status).toBe(200);
      expect(res.body.data.attemptId).toBe(student1AttemptId);
      expect(res.body.data.questionId).toBe(question.id);
      expect(res.body.data.selectedOptionId).toBe(validOption.id);
      expect(res.body.data).toHaveProperty('answeredAt');

      // Verify server-side score calculation in database
      const dbAnswer = await prisma.answer.findUnique({
        where: {
          attemptId_questionId: {
            attemptId: student1AttemptId,
            questionId: question.id,
          },
        },
      });
      expect(dbAnswer).toBeTruthy();
      expect(dbAnswer.score).toBe(validOption.value);
    });

    it('is idempotent: saving the exact same option returns 200 OK', async () => {
      const question = allQuestions[0];
      const validOption = question.options[3];

      const res = await request(app)
        .put(`/api/v1/attempts/${student1AttemptId}/answers/${question.id}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ optionId: validOption.id });

      expect(res.status).toBe(200);
      expect(res.body.data.selectedOptionId).toBe(validOption.id);
    });

    it('updates existing answer to a different option and updates DB score', async () => {
      const question = allQuestions[0];
      const newOption = question.options[4]; // Likert value 4

      const res = await request(app)
        .put(`/api/v1/attempts/${student1AttemptId}/answers/${question.id}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ optionId: newOption.id });

      expect(res.status).toBe(200);
      expect(res.body.data.selectedOptionId).toBe(newOption.id);

      const dbAnswer = await prisma.answer.findUnique({
        where: {
          attemptId_questionId: {
            attemptId: student1AttemptId,
            questionId: question.id,
          },
        },
      });
      expect(dbAnswer.score).toBe(newOption.value);
    });

    it('rejects invalid option ID with 422 VALIDATION_ERROR', async () => {
      const question = allQuestions[0];

      const res = await request(app)
        .put(`/api/v1/attempts/${student1AttemptId}/answers/${question.id}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ optionId: 'completely-invalid-option-id' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects client attempting to inject score directly (strict schema 422)', async () => {
      const question = allQuestions[0];
      const validOption = question.options[1];

      const res = await request(app)
        .put(`/api/v1/attempts/${student1AttemptId}/answers/${question.id}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ optionId: validOption.id, score: 4 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects answer for question not in assessment with 404 NOT_FOUND', async () => {
      const res = await request(app)
        .put(`/api/v1/attempts/${student1AttemptId}/answers/99999999-9999-4999-8999-999999999999`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ optionId: 'opt-something' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects answer submission by another student with 404 NOT_FOUND', async () => {
      const question = allQuestions[0];
      const validOption = question.options[1];

      const res = await request(app)
        .put(`/api/v1/attempts/${student1AttemptId}/answers/${question.id}`)
        .set('Authorization', `Bearer ${student2Token}`)
        .send({ optionId: validOption.id });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ==========================================================================
  // 6. Assessment Submission & Scoring Flow
  // ==========================================================================
  describe('Assessment Submission & Scoring Transaction', () => {
    let activeAttemptId;

    beforeAll(async () => {
      const startRes = await request(app)
        .post(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`);
      activeAttemptId = startRes.body.data.id;
    });

    it('rejects incomplete assessment submission with 422 and missing questions list', async () => {
      // Answer only first 5 questions (missing 25)
      for (let i = 0; i < 5; i++) {
        const q = allQuestions[i];
        await request(app)
          .put(`/api/v1/attempts/${activeAttemptId}/answers/${q.id}`)
          .set('Authorization', `Bearer ${student1Token}`)
          .send({ optionId: q.options[2].id });
      }

      const res = await request(app)
        .post(`/api/v1/attempts/${activeAttemptId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toMatch(/All assessment questions must be answered/);
      expect(res.body.error.details[0].issue).toMatch(/Missing questions:/);

      // Attempt status must remain IN_PROGRESS
      const attempt = await prisma.assessmentAttempt.findUnique({
        where: { id: activeAttemptId },
      });
      expect(attempt.status).toBe('IN_PROGRESS');
    });

    it('submits complete assessment: computes 6-dimension scores & deterministic recommendations', async () => {
      // Answer all remaining 25 questions with deliberate profiles:
      // High Analytical (option index 4 = 4), high Investigative (4), others lower (1 or 2)
      for (const q of allQuestions) {
        let optIndex = 2; // neutral
        if (q.dimension === 'ANALYTICAL') optIndex = 4;
        else if (q.dimension === 'INVESTIGATIVE') optIndex = 4;
        else if (q.dimension === 'SOCIAL') optIndex = 1;

        await request(app)
          .put(`/api/v1/attempts/${activeAttemptId}/answers/${q.id}`)
          .set('Authorization', `Bearer ${student1Token}`)
          .send({ optionId: q.options[optIndex].id });
      }

      const res = await request(app)
        .post(`/api/v1/attempts/${activeAttemptId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.attemptId).toBe(activeAttemptId);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.assessmentVersion).toBe(1);
      expect(res.body.data.algorithmVersion).toBe('cosine-v1');
      expect(res.body.data.recommendationsUrl).toBe(
        `/api/v1/attempts/${activeAttemptId}/recommendations`
      );
      expect(res.body.data).toHaveProperty('completedAt');

      // Verify all 6 dimensions are present in [0, 1]
      const scores = res.body.data.dimensionScores;
      for (const dim of CANONICAL_DIMENSIONS) {
        expect(scores).toHaveProperty(dim);
        expect(scores[dim]).toBeGreaterThanOrEqual(0);
        expect(scores[dim]).toBeLessThanOrEqual(1);
      }
      expect(scores.ANALYTICAL).toBe(1.0);
      expect(scores.INVESTIGATIVE).toBe(1.0);

      // Verify database attempt status
      const updatedAttempt = await prisma.assessmentAttempt.findUnique({
        where: { id: activeAttemptId },
      });
      expect(updatedAttempt.status).toBe('COMPLETED');
      expect(updatedAttempt.completedAt).toBeTruthy();

      // Verify recommendations persisted in DB
      const recommendations = await prisma.recommendation.findMany({
        where: { attemptId: activeAttemptId },
        orderBy: { rank: 'asc' },
        include: { career: true },
      });
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].rank).toBe(1);
      expect(Number(recommendations[0].similarityScore)).toBeGreaterThan(0);
      expect(['data-scientist', 'software-architect']).toContain(recommendations[0].career.slug);
    });

    it('rejects double submission with 409 CONFLICT', async () => {
      const res = await request(app)
        .post(`/api/v1/attempts/${activeAttemptId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/already been finalized/);
    });

    it('rejects modifying answers on a COMPLETED attempt with 409 CONFLICT', async () => {
      const question = allQuestions[0];
      const res = await request(app)
        .put(`/api/v1/attempts/${activeAttemptId}/answers/${question.id}`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ optionId: question.options[0].id });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/Completed assessment attempts cannot be changed/);
    });
  });

  // ==========================================================================
  // 7. Recommendations Endpoint & Access Control
  // ==========================================================================
  describe('Recommendations Endpoint & Access Control', () => {
    let completedAttemptId;
    let inProgressAttemptId;

    beforeAll(async () => {
      // Create and complete attempt for student 1
      const startRes = await request(app)
        .post(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`);
      completedAttemptId = startRes.body.data.id;

      for (const q of allQuestions) {
        await request(app)
          .put(`/api/v1/attempts/${completedAttemptId}/answers/${q.id}`)
          .set('Authorization', `Bearer ${student1Token}`)
          .send({ optionId: q.options[3].id });
      }

      await request(app)
        .post(`/api/v1/attempts/${completedAttemptId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`);

      // Create an in-progress attempt for student 2
      const startRes2 = await request(app)
        .post(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/attempts`)
        .set('Authorization', `Bearer ${student2Token}`);
      inProgressAttemptId = startRes2.body.data.id;
    });

    it('returns 409 CONFLICT when requesting recommendations for an IN_PROGRESS attempt', async () => {
      const res = await request(app)
        .get(`/api/v1/attempts/${inProgressAttemptId}/recommendations`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/Assessment attempt is not completed/);
    });

    it('returns 404 NOT_FOUND when student requests recommendations for another student attempt', async () => {
      const res = await request(app)
        .get(`/api/v1/attempts/${completedAttemptId}/recommendations`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns own ranked recommendations with explanation reasons and cautions (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/v1/attempts/${completedAttemptId}/recommendations`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const firstRec = res.body.data[0];
      expect(firstRec).toHaveProperty('career');
      expect(firstRec.career).toHaveProperty('id');
      expect(firstRec.career).toHaveProperty('slug');
      expect(firstRec.career).toHaveProperty('title');
      expect(firstRec.rank).toBe(1);
      expect(typeof firstRec.similarityScore).toBe('number');
      expect(firstRec.algorithmVersion).toBe('cosine-v1');
      expect(firstRec.careerProfileVersion).toBe(1);
      expect(Array.isArray(firstRec.reasons)).toBe(true);
      expect(Array.isArray(firstRec.cautions)).toBe(true);

      // Verify deterministic ordering: ranks 1, 2, ...
      for (let i = 0; i < res.body.data.length - 1; i++) {
        expect(res.body.data[i].rank).toBeLessThan(res.body.data[i + 1].rank);
        expect(res.body.data[i].similarityScore).toBeGreaterThanOrEqual(
          res.body.data[i + 1].similarityScore
        );
      }

      expect(res.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: res.body.data.length,
        totalPages: 1,
      });
    });

    it('supports pagination on recommendations endpoint', async () => {
      const res = await request(app)
        .get(`/api/v1/attempts/${completedAttemptId}/recommendations?page=1&limit=2`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // 8. Concurrency & Double Submission Safety
  // ==========================================================================
  describe('Concurrency & Double Submission Safety', () => {
    it('serializes concurrent submission requests: exactly one 200 and one 409', async () => {
      // Start a fresh attempt for student 2
      const startRes = await request(app)
        .post(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/attempts`)
        .set('Authorization', `Bearer ${student2Token}`);
      const attemptId = startRes.body.data.id;

      // Fill in all answers
      for (const q of allQuestions) {
        await request(app)
          .put(`/api/v1/attempts/${attemptId}/answers/${q.id}`)
          .set('Authorization', `Bearer ${student2Token}`)
          .send({ optionId: q.options[2].id });
      }

      // Fire two concurrent submit requests
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/v1/attempts/${attemptId}/submit`)
          .set('Authorization', `Bearer ${student2Token}`),
        request(app)
          .post(`/api/v1/attempts/${attemptId}/submit`)
          .set('Authorization', `Bearer ${student2Token}`),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      const successRes = res1.status === 200 ? res1 : res2;
      const conflictRes = res1.status === 409 ? res1 : res2;

      expect(successRes.body.data.status).toBe('COMPLETED');
      expect(conflictRes.body.error.code).toBe('CONFLICT');

      // Verify no duplicate recommendations created in database
      const count = await prisma.recommendation.count({
        where: { attemptId },
      });
      const uniqueRanks = await prisma.recommendation.findMany({
        where: { attemptId },
        select: { rank: true },
      });
      const rankSet = new Set(uniqueRanks.map((r) => r.rank));
      expect(rankSet.size).toBe(count);
    });
  });

  // ==========================================================================
  // 9. Empty Career Catalog Resilience
  // ==========================================================================
  describe('Empty Career Catalog Resilience', () => {
    it('completes attempt even if no published careers match or exist', async () => {
      // Temporarily unpublish all careers
      await prisma.career.updateMany({
        where: { id: { in: [TEST_CAREER_1_ID, TEST_CAREER_2_ID, TEST_CAREER_3_ID] } },
        data: { published: false },
      });

      try {
        const startRes = await request(app)
          .post(`/api/v1/assessments/${PUBLISHED_ASSESSMENT_ID}/attempts`)
          .set('Authorization', `Bearer ${student1Token}`);
        const attemptId = startRes.body.data.id;

        for (const q of allQuestions) {
          await request(app)
            .put(`/api/v1/attempts/${attemptId}/answers/${q.id}`)
            .set('Authorization', `Bearer ${student1Token}`)
            .send({ optionId: q.options[1].id });
        }

        const submitRes = await request(app)
          .post(`/api/v1/attempts/${attemptId}/submit`)
          .set('Authorization', `Bearer ${student1Token}`);

        expect(submitRes.status).toBe(200);
        expect(submitRes.body.data.status).toBe('COMPLETED');
        expect(submitRes.body.data.dimensionScores).toBeTruthy();

        const recsRes = await request(app)
          .get(`/api/v1/attempts/${attemptId}/recommendations`)
          .set('Authorization', `Bearer ${student1Token}`);

        expect(recsRes.status).toBe(200);
        expect(recsRes.body.data).toEqual([]);
        expect(recsRes.body.meta.total).toBe(0);
      } finally {
        // Restore published careers
        await prisma.career.updateMany({
          where: { id: { in: [TEST_CAREER_1_ID, TEST_CAREER_2_ID, TEST_CAREER_3_ID] } },
          data: { published: true },
        });
      }
    });
  });

  // ==========================================================================
  // 10. Database Transaction & Safety Invariants
  // ==========================================================================
  describe('Transaction Safety Defense', () => {
    it('throws TRANSACTION_UNAVAILABLE if dbClient lacks $transaction capability', async () => {
      const adapterWithoutTx = new AssessmentRepositoryAdapter({
        dbClient: {
          assessmentAttempt: prisma.assessmentAttempt,
        },
      });

      await expect(
        adapterWithoutTx.saveAnswer({
          attemptId: STUDENT_1_ID,
          studentId: STUDENT_1_ID,
          questionId: allQuestions[0].id,
          selectedOptionId: 'opt-1',
        })
      ).rejects.toMatchObject({
        code: 'TRANSACTION_UNAVAILABLE',
      });

      await expect(
        adapterWithoutTx.finalizeAttempt({
          attemptId: STUDENT_1_ID,
          studentId: STUDENT_1_ID,
        })
      ).rejects.toMatchObject({
        code: 'TRANSACTION_UNAVAILABLE',
      });
    });
  });
});
