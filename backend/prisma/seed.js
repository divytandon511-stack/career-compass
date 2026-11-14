/**
 * ============================================================================
 * CareerCompass — Assessment Database Seed Runner
 * ============================================================================
 * Seeds the published 30-question interest assessment into the database.
 * Aligned with docs/architecture.md §7, docs/api-contract.md §3,
 * and docs/data-model.md §2.5, §2.6 & §4.3.
 *
 * Invariants & Guarantees:
 * 1. Fully Idempotent: Re-running multiple times produces identical state
 *    without duplicating records or violating unique constraints.
 * 2. Non-Destructive: Never drops, truncates, or resets existing tables or user data.
 * 3. Transactionally Atomic: Wraps assessment and question upserts in a single
 *    Prisma interactive transaction.
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import {
  DEFAULT_ASSESSMENT,
  ASSESSMENT_QUESTIONS,
} from './seed-data/assessment-questions.js';

// Load environment variables (.env) if present
dotenv.config();

/**
 * Seeds or synchronizes the authoritative published interest assessment and its 30 questions.
 *
 * @param {import('@prisma/client').PrismaClient} prismaClient
 * @returns {Promise<{ assessment: object, questionCount: number, questions: object[] }>}
 */
export async function seedAssessment(prismaClient) {
  if (!prismaClient || typeof prismaClient.$transaction !== 'function') {
    throw new Error('seedAssessment requires an authoritative PrismaClient instance');
  }

  return await prismaClient.$transaction(async (tx) => {
    // 1. Upsert Published Assessment
    const assessment = await tx.assessment.upsert({
      where: { id: DEFAULT_ASSESSMENT.id },
      update: {
        title: DEFAULT_ASSESSMENT.title,
        description: DEFAULT_ASSESSMENT.description,
        version: DEFAULT_ASSESSMENT.version,
        status: DEFAULT_ASSESSMENT.status,
      },
      create: {
        id: DEFAULT_ASSESSMENT.id,
        title: DEFAULT_ASSESSMENT.title,
        description: DEFAULT_ASSESSMENT.description,
        version: DEFAULT_ASSESSMENT.version,
        status: DEFAULT_ASSESSMENT.status,
      },
    });

    // 2. Upsert each of the 30 questions by compound unique key [assessmentId, position]
    const seededQuestions = [];
    for (const q of ASSESSMENT_QUESTIONS) {
      const question = await tx.question.upsert({
        where: {
          assessmentId_position: {
            assessmentId: assessment.id,
            position: q.position,
          },
        },
        update: {
          dimension: q.dimension,
          prompt: q.prompt,
          weight: q.weight,
          options: q.options,
        },
        create: {
          id: q.id,
          assessmentId: assessment.id,
          dimension: q.dimension,
          prompt: q.prompt,
          position: q.position,
          weight: q.weight,
          options: q.options,
        },
      });
      seededQuestions.push(question);
    }

    return {
      assessment,
      questionCount: seededQuestions.length,
      questions: seededQuestions,
    };
  });
}

/**
 * CLI execution entry point.
 */
async function runSeed() {
  const prisma = new PrismaClient();
  try {
    console.log('[Seed] Seeding CareerCompass assessment data...');
    const result = await seedAssessment(prisma);
    console.log(
      `[Seed] Successfully seeded assessment "${result.assessment.title}" (ID: ${result.assessment.id}, Version: ${result.assessment.version}, Status: ${result.assessment.status})`
    );
    console.log(`[Seed] Total questions verified in database: ${result.questionCount}`);
  } catch (err) {
    console.error('[Seed Error] Database seeding encountered an error:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

// Only invoke runSeed directly when executed from the command line
const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith('seed.js') || process.argv[1].endsWith('seed'));

if (isDirectExecution) {
  runSeed().catch(() => {
    process.exit(1);
  });
}

export default seedAssessment;
