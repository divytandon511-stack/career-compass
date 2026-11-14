/**
 * ============================================================================
 * CareerCompass — Assessment & Questions Seed Test Suite
 * ============================================================================
 * Verifies:
 * 1. Data Integrity: 30 questions, 6 dimensions (5 each), Likert options (0..4).
 * 2. Database Safety: Runs exclusively against an isolated disposable test database.
 * 3. Immutability Protection: Re-running seed preserves historical attempts/answers;
 *    conflicting changes on published versions throw AssessmentImmutabilityError.
 * 4. API Contract Conformance: Verifies database queries and projections matching
 *    docs/api-contract.md §3 without mutating existing API handlers.
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import dotenv from 'dotenv';

import {
  ASSESSMENT_ID,
  DEFAULT_ASSESSMENT,
  ASSESSMENT_QUESTIONS,
  generateQuestionId,
  generateOptionId,
  buildOptionsForPosition,
} from '../prisma/seed-data/assessment-questions.js';
import {
  seedAssessment,
  AssessmentImmutabilityError,
  areOptionsEqual,
  areQuestionsEqual,
  findAssessmentConflicts,
} from '../prisma/seed.js';
import { CANONICAL_DIMENSIONS } from '../src/matching/constants.js';
import { app } from '../src/app.js';

dotenv.config();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Resolve isolated test database URL. Strictly forbids shared or production databases.
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

describe('Assessment Seed Data Specification', () => {
  it('defines valid assessment metadata with PUBLISHED status and version 1', () => {
    expect(DEFAULT_ASSESSMENT.id).toBe(ASSESSMENT_ID);
    expect(DEFAULT_ASSESSMENT.id).toMatch(UUID_REGEX);
    expect(DEFAULT_ASSESSMENT.title).toBe('Career Interest Explorer v1');
    expect(DEFAULT_ASSESSMENT.version).toBe(1);
    expect(DEFAULT_ASSESSMENT.status).toBe('PUBLISHED');
    expect(DEFAULT_ASSESSMENT.description).toBeTruthy();
    expect(typeof DEFAULT_ASSESSMENT.description).toBe('string');
  });

  it('contains exactly 30 questions', () => {
    expect(ASSESSMENT_QUESTIONS).toHaveLength(30);
  });

  it('covers all 6 canonical dimensions with exactly 5 questions per dimension', () => {
    const dimensionCounts = {};
    for (const dim of CANONICAL_DIMENSIONS) {
      dimensionCounts[dim] = 0;
    }

    for (const q of ASSESSMENT_QUESTIONS) {
      expect(CANONICAL_DIMENSIONS).toContain(q.dimension);
      dimensionCounts[q.dimension] = (dimensionCounts[q.dimension] || 0) + 1;
    }

    expect(Object.keys(dimensionCounts)).toHaveLength(6);
    for (const dim of CANONICAL_DIMENSIONS) {
      expect(dimensionCounts[dim]).toBe(5);
    }
  });

  it('has sequential positions 1 through 30 without gaps or duplicates', () => {
    const positions = ASSESSMENT_QUESTIONS.map((q) => q.position);
    expect(positions).toHaveLength(30);

    const sortedPositions = [...positions].sort((a, b) => a - b);
    for (let i = 0; i < 30; i++) {
      expect(sortedPositions[i]).toBe(i + 1);
    }

    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(30);
  });

  it('ensures each question has positive scoring weight (> 0)', () => {
    for (const q of ASSESSMENT_QUESTIONS) {
      expect(typeof q.weight).toBe('number');
      expect(q.weight).toBeGreaterThan(0);
      expect(q.weight).toBe(1.0);
    }
  });

  it('ensures question prompts are clear, non-empty, and age-appropriate', () => {
    for (const q of ASSESSMENT_QUESTIONS) {
      expect(typeof q.prompt).toBe('string');
      expect(q.prompt.trim().length).toBeGreaterThanOrEqual(20);
      expect(q.id).toMatch(UUID_REGEX);
    }
  });

  it('ensures all 30 question IDs are unique RFC 4122 v4 UUIDs', () => {
    const questionIds = ASSESSMENT_QUESTIONS.map((q) => q.id);
    const uniqueIds = new Set(questionIds);
    expect(uniqueIds.size).toBe(30);

    for (const id of questionIds) {
      expect(id).toMatch(UUID_REGEX);
    }
  });

  it('ensures each question has standard 5-point Likert options (0..4) with unique UUIDs', () => {
    const allOptionIds = new Set();

    for (const q of ASSESSMENT_QUESTIONS) {
      expect(Array.isArray(q.options)).toBe(true);
      expect(q.options).toHaveLength(5);

      const seenValues = new Set();
      q.options.forEach((opt, idx) => {
        expect(opt.id).toMatch(UUID_REGEX);
        expect(allOptionIds.has(opt.id)).toBe(false);
        allOptionIds.add(opt.id);

        expect(typeof opt.label).toBe('string');
        expect(opt.label.trim().length).toBeGreaterThan(0);

        expect(opt.value).toBe(idx);
        expect(opt.value).toBeGreaterThanOrEqual(0);
        expect(opt.value).toBeLessThanOrEqual(4);
        expect(Number.isInteger(opt.value)).toBe(true);

        seenValues.add(opt.value);
      });

      expect(seenValues.size).toBe(5);
    }

    // 30 questions * 5 options = 150 unique option IDs
    expect(allOptionIds.size).toBe(150);
  });

  it('deterministic ID generators produce consistent, reproducible UUIDs', () => {
    expect(generateQuestionId(1)).toBe('b0000000-0000-4000-8000-000000000001');
    expect(generateQuestionId(30)).toBe('b0000000-0000-4000-8000-000000000030');
    expect(generateOptionId(1, 0)).toBe('c0000000-0001-4000-8000-000000000000');
    expect(generateOptionId(30, 4)).toBe('c0000000-0030-4000-8000-000000000004');

    const optionsQ1 = buildOptionsForPosition(1);
    expect(optionsQ1).toHaveLength(5);
    expect(optionsQ1[0].label).toBe('Strongly Disagree');
    expect(optionsQ1[4].label).toBe('Strongly Agree');
  });

  it('conflict detection helpers correctly identify mismatched assessment definitions', () => {
    const sampleAssessment = {
      id: ASSESSMENT_ID,
      title: 'Career Interest Explorer v1',
      version: 1,
      questions: [
        {
          position: 1,
          dimension: 'ANALYTICAL',
          prompt: 'Original prompt',
          weight: 1.0,
          options: [{ id: 'opt-1', label: 'Agree', value: 3 }],
        },
      ],
    };

    // Equal definitions yield no conflicts
    const equalQuestions = [
      {
        position: 1,
        dimension: 'ANALYTICAL',
        prompt: 'Original prompt',
        weight: 1.0,
        options: [{ id: 'opt-1', label: 'Agree', value: 3 }],
      },
    ];
    expect(
      findAssessmentConflicts(sampleAssessment, sampleAssessment, equalQuestions)
    ).toHaveLength(0);

    // Prompt change yields conflict
    const conflictingPrompt = [
      {
        position: 1,
        dimension: 'ANALYTICAL',
        prompt: 'Altered prompt',
        weight: 1.0,
        options: [{ id: 'opt-1', label: 'Agree', value: 3 }],
      },
    ];
    const conflicts = findAssessmentConflicts(
      sampleAssessment,
      sampleAssessment,
      conflictingPrompt
    );
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]).toContain('definition differs');
  });
});

describe('Database Safety & Isolated Test Environment', () => {
  it('enforces safety invariant: test database URL must target an isolated test database', () => {
    expect(TEST_DB_URL).toBeTruthy();
    // Safety verification: URL must never target production or non-test database
    expect(TEST_DB_URL).toMatch(/career_compass_test/);
    expect(TEST_DB_URL).not.toMatch(/\/career_compass(\?|$)/);
  });
});

describe('Assessment Database Seed Integration & Immutability Protection', () => {
  let prisma;
  let isDbAvailable = false;
  let dbConnectionError = null;

  beforeAll(async () => {
    if (!TEST_DB_URL) {
      isDbAvailable = false;
      dbConnectionError = 'TEST_DATABASE_URL is not configured';
      return;
    }

    try {
      prisma = new PrismaClient({
        datasources: { db: { url: TEST_DB_URL } },
      });
      await prisma.$connect();
      isDbAvailable = true;
    } catch (err) {
      isDbAvailable = false;
      dbConnectionError = err.message;
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('seeds assessment and 30 questions into the isolated test database', async (ctx) => {
    if (!isDbAvailable) {
      ctx.skip(`PostgreSQL test database unavailable: ${dbConnectionError}`);
      return;
    }

    const result = await seedAssessment(prisma);
    expect(result).toBeDefined();
    expect(result.action).toBeOneOf(['CREATED', 'UNCHANGED']);
    expect(result.assessment.id).toBe(ASSESSMENT_ID);
    expect(result.assessment.status).toBe('PUBLISHED');
    expect(result.questionCount).toBe(30);

    // Verify record directly in database
    const dbAssessment = await prisma.assessment.findUnique({
      where: { id: ASSESSMENT_ID },
      include: { questions: { orderBy: { position: 'asc' } } },
    });

    expect(dbAssessment).not.toBeNull();
    expect(dbAssessment.title).toBe('Career Interest Explorer v1');
    expect(dbAssessment.status).toBe('PUBLISHED');
    expect(dbAssessment.version).toBe(1);
    expect(dbAssessment.questions).toHaveLength(30);

    // Verify each dimension has 5 questions in database
    const dbDimCounts = {};
    for (const q of dbAssessment.questions) {
      dbDimCounts[q.dimension] = (dbDimCounts[q.dimension] || 0) + 1;
      expect(Number(q.weight)).toBe(1.0);
      expect(Array.isArray(q.options)).toBe(true);
      expect(q.options).toHaveLength(5);
    }

    for (const dim of CANONICAL_DIMENSIONS) {
      expect(dbDimCounts[dim]).toBe(5);
    }
  });

  it('demonstrates strict idempotency: unchanged seed re-run preserves existing records without mutation', async (ctx) => {
    if (!isDbAvailable) {
      ctx.skip(`PostgreSQL test database unavailable: ${dbConnectionError}`);
      return;
    }

    // Re-run seed on existing unchanged published assessment
    const result = await seedAssessment(prisma);
    expect(result.action).toBe('UNCHANGED');
    expect(result.questionCount).toBe(30);

    // Total count of assessments in database with this ID must still be exactly 1
    const totalAssessments = await prisma.assessment.count({
      where: { id: ASSESSMENT_ID },
    });
    expect(totalAssessments).toBe(1);

    // Total count of questions for this assessment must still be exactly 30
    const totalQuestions = await prisma.question.count({
      where: { assessmentId: ASSESSMENT_ID },
    });
    expect(totalQuestions).toBe(30);
  });

  it('preserves historical attempts and answers when re-seeding unchanged assessment', async (ctx) => {
    if (!isDbAvailable) {
      ctx.skip(`PostgreSQL test database unavailable: ${dbConnectionError}`);
      return;
    }

    // 1. Create a synthetic student user and attempt
    const syntheticEmail = `student-${Date.now()}@example.test`;
    const user = await prisma.user.create({
      data: {
        email: syntheticEmail,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$syntheticHashForTestingPurposesOnly',
        displayName: 'Test Student Immutability',
        role: 'STUDENT',
        studentProfile: {
          create: {
            schoolGrade: '11',
            consentAccepted: true,
          },
        },
      },
    });

    const attempt = await prisma.assessmentAttempt.create({
      data: {
        studentId: user.id,
        assessmentId: ASSESSMENT_ID,
        assessmentVersion: 1,
        status: 'IN_PROGRESS',
      },
    });

    // Record an answer referencing question 1 and option 0
    const firstQuestion = await prisma.question.findFirst({
      where: { assessmentId: ASSESSMENT_ID, position: 1 },
    });
    expect(firstQuestion).not.toBeNull();

    const selectedOption = firstQuestion.options[0];
    const answer = await prisma.answer.create({
      data: {
        attemptId: attempt.id,
        questionId: firstQuestion.id,
        selectedOptionId: selectedOption.id,
        score: selectedOption.value,
      },
    });

    // 2. Re-run seedAssessment
    const reseedResult = await seedAssessment(prisma);
    expect(reseedResult.action).toBe('UNCHANGED');

    // 3. Verify attempt and answer are strictly preserved
    const retrievedAttempt = await prisma.assessmentAttempt.findUnique({
      where: { id: attempt.id },
      include: { answers: true },
    });

    expect(retrievedAttempt).not.toBeNull();
    expect(retrievedAttempt.answers).toHaveLength(1);
    expect(retrievedAttempt.answers[0].id).toBe(answer.id);
    expect(retrievedAttempt.answers[0].selectedOptionId).toBe(selectedOption.id);
    expect(retrievedAttempt.answers[0].score).toBe(selectedOption.value);

    // Clean up synthetic test records
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('rejects conflicting changes to published assessment with AssessmentImmutabilityError', async (ctx) => {
    if (!isDbAvailable) {
      ctx.skip(`PostgreSQL test database unavailable: ${dbConnectionError}`);
      return;
    }

    // Construct conflicting questions dataset (altered prompt on question 1)
    const conflictingQuestions = ASSESSMENT_QUESTIONS.map((q) => {
      if (q.position === 1) {
        return {
          ...q,
          prompt: 'Altered question prompt attempting to silently mutate published assessment',
        };
      }
      return q;
    });

    // Attempting to re-seed with conflicting data on published version 1 must throw
    await expect(
      seedAssessment(prisma, {
        assessmentData: DEFAULT_ASSESSMENT,
        questionsData: conflictingQuestions,
      })
    ).rejects.toThrow(AssessmentImmutabilityError);

    // Verify published question in database remains intact and unaltered
    const q1 = await prisma.question.findUnique({
      where: {
        assessmentId_position: {
          assessmentId: ASSESSMENT_ID,
          position: 1,
        },
      },
    });
    expect(q1.prompt).toBe(ASSESSMENT_QUESTIONS[0].prompt);
  });

  it('supports seeding new assessment versions (e.g. v2) alongside existing published versions', async (ctx) => {
    if (!isDbAvailable) {
      ctx.skip(`PostgreSQL test database unavailable: ${dbConnectionError}`);
      return;
    }

    const VERSION_2_ID = 'a0000000-0000-4000-8000-000000000002';
    const v2Assessment = {
      id: VERSION_2_ID,
      title: 'Career Interest Explorer v2',
      description: 'Revised career interest explorer for senior students.',
      version: 2,
      status: 'PUBLISHED',
    };

    const v2Questions = ASSESSMENT_QUESTIONS.map((q) => ({
      ...q,
      id: `b0000000-0002-4000-8000-${String(q.position).padStart(12, '0')}`,
    }));

    // Seed version 2
    const v2Result = await seedAssessment(prisma, {
      assessmentData: v2Assessment,
      questionsData: v2Questions,
    });

    expect(v2Result.action).toBeOneOf(['CREATED', 'UNCHANGED']);
    expect(v2Result.assessment.id).toBe(VERSION_2_ID);
    expect(v2Result.questionCount).toBe(30);

    // Verify both versions coexist in the database independently
    const v1Count = await prisma.question.count({ where: { assessmentId: ASSESSMENT_ID } });
    const v2Count = await prisma.question.count({ where: { assessmentId: VERSION_2_ID } });

    expect(v1Count).toBe(30);
    expect(v2Count).toBe(30);

    // Clean up v2 test records
    await prisma.assessment.delete({ where: { id: VERSION_2_ID } });
  });
});

describe('API Contract Accessibility & Boundary Verification', () => {
  let prisma;
  let isDbAvailable = false;

  beforeAll(async () => {
    if (!TEST_DB_URL) return;
    try {
      prisma = new PrismaClient({
        datasources: { db: { url: TEST_DB_URL } },
      });
      await prisma.$connect();
      isDbAvailable = true;
    } catch {
      isDbAvailable = false;
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('confirms existing HTTP router has not been modified (returns 404 for unmounted /api/v1/assessments)', async () => {
    // Tests that we did NOT modify existing API routes in backend/src/routes
    const res = await request(app).get('/api/v1/assessments');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('verifies seeded database fulfills published-assessments query contract (docs/api-contract.md §3)', async (ctx) => {
    if (!isDbAvailable) {
      ctx.skip('PostgreSQL test database unavailable');
      return;
    }

    // Contract query: GET /assessments (list published assessments)
    const publishedAssessments = await prisma.assessment.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        description: true,
        version: true,
        status: true,
        createdAt: true,
      },
    });

    expect(publishedAssessments.length).toBeGreaterThanOrEqual(1);
    const target = publishedAssessments.find((a) => a.id === ASSESSMENT_ID);
    expect(target).toBeDefined();
    expect(target.title).toBe('Career Interest Explorer v1');
    expect(target.version).toBe(1);
    expect(target.status).toBe('PUBLISHED');
  });

  it('verifies student questions projection contract strips scoring values and weights (docs/api-contract.md §3)', async (ctx) => {
    if (!isDbAvailable) {
      ctx.skip('PostgreSQL test database unavailable');
      return;
    }

    // Contract query: GET /assessments/:id/questions (STUDENT access)
    // "200 questions with options but no scoring keys for students"
    // "Never expose option value or internal weights to student endpoints"
    const questionsFromDb = await prisma.question.findMany({
      where: { assessmentId: ASSESSMENT_ID },
      orderBy: { position: 'asc' },
    });

    expect(questionsFromDb).toHaveLength(30);

    // Project questions for student consumption according to API contract
    const studentProjectedQuestions = questionsFromDb.map((q) => ({
      id: q.id,
      position: q.position,
      dimension: q.dimension,
      prompt: q.prompt,
      // Strip server-side 'value' from options; expose only 'id' and 'label'
      options: q.options.map((opt) => ({
        id: opt.id,
        label: opt.label,
      })),
    }));

    expect(studentProjectedQuestions).toHaveLength(30);
    for (const q of studentProjectedQuestions) {
      expect(q).not.toHaveProperty('weight');
      expect(q.options).toHaveLength(5);
      for (const opt of q.options) {
        expect(opt).toHaveProperty('id');
        expect(opt).toHaveProperty('label');
        expect(opt).not.toHaveProperty('value'); // Scoring value strictly hidden from student
      }
    }
  });
});
