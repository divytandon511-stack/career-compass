/**
 * ============================================================================
 * CareerCompass — Assessment Database Seed Runner
 * ============================================================================
 * Seeds the published 30-question interest assessment into the database.
 * Aligned with docs/architecture.md §7, docs/api-contract.md §3,
 * and docs/data-model.md §2.5, §2.6 & §4.3.
 *
 * Invariants & Guarantees:
 * 1. Fully Idempotent: Re-running with unchanged seed data produces identical state
 *    without modifying records, duplicating rows, or throwing errors.
 * 2. Published Assessment Immutability: Published assessments are strictly immutable.
 *    Conflicting changes to questions, options, dimensions, or weights on a published
 *    version or one with existing attempts are rejected with an AssessmentImmutabilityError.
 * 3. Historical Data Preservation: Existing student attempts, answers, and profiles
 *    are never deleted, truncated, or corrupted.
 * 4. Version Extensibility: Supports seeding new assessment versions (e.g. v2) alongside
 *    existing published versions without altering historical data.
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
 * Custom error thrown when an attempt is made to overwrite an immutable published assessment.
 */
export class AssessmentImmutabilityError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'AssessmentImmutabilityError';
    this.details = details;
  }
}

/**
 * Compares two options arrays for value equality.
 *
 * @param {Array<object>} existingOptions
 * @param {Array<object>} incomingOptions
 * @returns {boolean}
 */
export const areOptionsEqual = (existingOptions, incomingOptions) => {
  if (!Array.isArray(existingOptions) || !Array.isArray(incomingOptions)) {
    return false;
  }
  if (existingOptions.length !== incomingOptions.length) {
    return false;
  }
  for (let i = 0; i < existingOptions.length; i++) {
    const a = existingOptions[i];
    const b = incomingOptions[i];
    if (a.id !== b.id || a.label !== b.label || a.value !== b.value) {
      return false;
    }
  }
  return true;
};

/**
 * Compares an existing question against an incoming question definition.
 *
 * @param {object} existingQ
 * @param {object} incomingQ
 * @returns {boolean}
 */
export const areQuestionsEqual = (existingQ, incomingQ) => {
  if (existingQ.position !== incomingQ.position) return false;
  if (existingQ.dimension !== incomingQ.dimension) return false;
  if (existingQ.prompt !== incomingQ.prompt) return false;
  if (Number(existingQ.weight) !== Number(incomingQ.weight)) return false;
  return areOptionsEqual(existingQ.options, incomingQ.options);
};

/**
 * Identifies discrepancies between existing assessment records and incoming seed data.
 *
 * @param {object} existingAssessment
 * @param {object} incomingAssessment
 * @param {Array<object>} incomingQuestions
 * @returns {string[]} List of conflict descriptions
 */
export const findAssessmentConflicts = (
  existingAssessment,
  incomingAssessment,
  incomingQuestions
) => {
  const conflicts = [];

  if (existingAssessment.title !== incomingAssessment.title) {
    conflicts.push(
      `title mismatch: existing "${existingAssessment.title}" vs incoming "${incomingAssessment.title}"`
    );
  }
  if (existingAssessment.version !== incomingAssessment.version) {
    conflicts.push(
      `version mismatch: existing ${existingAssessment.version} vs incoming ${incomingAssessment.version}`
    );
  }
  if (existingAssessment.questions.length !== incomingQuestions.length) {
    conflicts.push(
      `question count mismatch: existing has ${existingAssessment.questions.length} questions vs incoming ${incomingQuestions.length}`
    );
  }

  const existingMap = new Map(
    existingAssessment.questions.map((q) => [q.position, q])
  );

  for (const inQ of incomingQuestions) {
    const exQ = existingMap.get(inQ.position);
    if (!exQ) {
      conflicts.push(`missing question at position ${inQ.position}`);
      continue;
    }
    if (!areQuestionsEqual(exQ, inQ)) {
      conflicts.push(
        `question at position ${inQ.position} (${inQ.dimension}) definition differs from existing record`
      );
    }
  }

  return conflicts;
};

/**
 * Seeds or synchronizes the authoritative published interest assessment.
 *
 * Policy:
 * 1. If assessment does not exist: creates assessment and questions inside a single transaction.
 * 2. If assessment exists and seed data is identical: safe no-op (action: 'UNCHANGED'), preserves all data.
 * 3. If assessment exists and conflicts are detected:
 *    - If status is PUBLISHED or attempts exist: rejects with AssessmentImmutabilityError.
 *    - If status is DRAFT with 0 attempts: updates in place.
 *
 * @param {import('@prisma/client').PrismaClient} prismaClient
 * @param {object} [options={}]
 * @param {object} [options.assessmentData=DEFAULT_ASSESSMENT]
 * @param {Array<object>} [options.questionsData=ASSESSMENT_QUESTIONS]
 * @returns {Promise<{ action: 'CREATED'|'UNCHANGED'|'UPDATED', assessment: object, questionCount: number, questions: object[] }>}
 */
export async function seedAssessment(
  prismaClient,
  {
    assessmentData = DEFAULT_ASSESSMENT,
    questionsData = ASSESSMENT_QUESTIONS,
  } = {}
) {
  if (!prismaClient || typeof prismaClient.$transaction !== 'function') {
    throw new Error('seedAssessment requires an authoritative PrismaClient instance');
  }

  return await prismaClient.$transaction(async (tx) => {
    // 1. Check for existing assessment record including questions and attempt count
    const existing = await tx.assessment.findUnique({
      where: { id: assessmentData.id },
      include: {
        questions: { orderBy: { position: 'asc' } },
        _count: { select: { attempts: true } },
      },
    });

    // 2. If not found, create new assessment and all questions
    if (!existing) {
      const createdAssessment = await tx.assessment.create({
        data: {
          id: assessmentData.id,
          title: assessmentData.title,
          description: assessmentData.description,
          version: assessmentData.version,
          status: assessmentData.status,
        },
      });

      const createdQuestions = [];
      for (const q of questionsData) {
        const createdQ = await tx.question.create({
          data: {
            id: q.id,
            assessmentId: createdAssessment.id,
            dimension: q.dimension,
            prompt: q.prompt,
            position: q.position,
            weight: q.weight,
            options: q.options,
          },
        });
        createdQuestions.push(createdQ);
      }

      return {
        action: 'CREATED',
        assessment: createdAssessment,
        questionCount: createdQuestions.length,
        questions: createdQuestions,
      };
    }

    // 3. Existing assessment found: verify definition equality
    const conflicts = findAssessmentConflicts(existing, assessmentData, questionsData);

    if (conflicts.length === 0) {
      // Unchanged seed data: safe idempotent resolution without mutation
      return {
        action: 'UNCHANGED',
        assessment: existing,
        questionCount: existing.questions.length,
        questions: existing.questions,
      };
    }

    // 4. Conflicting changes detected: check immutability constraints
    const isPublished = existing.status === 'PUBLISHED';
    const hasAttempts = (existing._count?.attempts ?? 0) > 0;

    if (isPublished || hasAttempts) {
      throw new AssessmentImmutabilityError(
        `Cannot modify published assessment "${existing.title}" (ID: ${existing.id}, Version: ${existing.version}) in place. ` +
          `Published assessments are immutable to preserve historical attempts and answers (${existing._count?.attempts ?? 0} attempt(s) recorded). ` +
          `Conflicts detected:\n${conflicts.map((c) => `  - ${c}`).join('\n')}\n` +
          `To introduce question or scoring changes, publish a new assessment version.`,
        {
          assessmentId: existing.id,
          version: existing.version,
          status: existing.status,
          attemptCount: existing._count?.attempts ?? 0,
          conflicts,
        }
      );
    }

    // 5. Safe draft update: mutable only when in DRAFT status with zero attempts
    const updatedAssessment = await tx.assessment.update({
      where: { id: existing.id },
      data: {
        title: assessmentData.title,
        description: assessmentData.description,
        version: assessmentData.version,
        status: assessmentData.status,
      },
    });

    const updatedQuestions = [];
    for (const q of questionsData) {
      const updatedQ = await tx.question.upsert({
        where: {
          assessmentId_position: {
            assessmentId: updatedAssessment.id,
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
          assessmentId: updatedAssessment.id,
          dimension: q.dimension,
          prompt: q.prompt,
          position: q.position,
          weight: q.weight,
          options: q.options,
        },
      });
      updatedQuestions.push(updatedQ);
    }

    return {
      action: 'UPDATED',
      assessment: updatedAssessment,
      questionCount: updatedQuestions.length,
      questions: updatedQuestions,
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
    if (result.action === 'CREATED') {
      console.log(
        `[Seed] Successfully created assessment "${result.assessment.title}" (ID: ${result.assessment.id}, Version: ${result.assessment.version}, Status: ${result.assessment.status}) with ${result.questionCount} questions.`
      );
    } else if (result.action === 'UNCHANGED') {
      console.log(
        `[Seed] Verified published assessment "${result.assessment.title}" (v${result.assessment.version}) is up to date (${result.questionCount} questions). Preserved existing records.`
      );
    } else {
      console.log(
        `[Seed] Updated draft assessment "${result.assessment.title}" (v${result.assessment.version}) with ${result.questionCount} questions.`
      );
    }
  } catch (err) {
    console.error('[Seed Error] Database seeding encountered an error:', err.message);
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
