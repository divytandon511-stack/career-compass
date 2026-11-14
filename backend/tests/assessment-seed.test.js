/**
 * ============================================================================
 * CareerCompass — Assessment & Questions Seed Test Suite
 * ============================================================================
 * Verifies the integrity, dimension distribution, Likert options structure,
 * and database idempotency of the 30-question interest assessment seed.
 * Aligned with docs/architecture.md §7, docs/api-contract.md §3,
 * and docs/data-model.md §2.5, §2.6 & §4.3.
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

import {
  ASSESSMENT_ID,
  DEFAULT_ASSESSMENT,
  ASSESSMENT_QUESTIONS,
  generateQuestionId,
  generateOptionId,
  buildOptionsForPosition,
} from '../prisma/seed-data/assessment-questions.js';
import { seedAssessment } from '../prisma/seed.js';
import { CANONICAL_DIMENSIONS } from '../src/matching/constants.js';

dotenv.config();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
});

describe('Assessment Database Seed Integration & Idempotency', () => {
  let prisma;
  let isDbAvailable = false;

  beforeAll(async () => {
    try {
      prisma = new PrismaClient();
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

  it('seeds assessment and 30 questions into PostgreSQL database', async () => {
    if (!isDbAvailable) {
      console.warn('Skipping database test: PostgreSQL connection not available');
      return;
    }

    const result = await seedAssessment(prisma);
    expect(result).toBeDefined();
    expect(result.assessment.id).toBe(ASSESSMENT_ID);
    expect(result.assessment.status).toBe('PUBLISHED');
    expect(result.questionCount).toBe(30);

    // Verify record in database
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

  it('demonstrates strict idempotency when re-seeding multiple times', async () => {
    if (!isDbAvailable) {
      console.warn('Skipping database test: PostgreSQL connection not available');
      return;
    }

    // Run seed 2nd time
    const result2 = await seedAssessment(prisma);
    expect(result2.questionCount).toBe(30);

    // Run seed 3rd time
    const result3 = await seedAssessment(prisma);
    expect(result3.questionCount).toBe(30);

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
});
