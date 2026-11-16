/**
 * ============================================================================
 * CareerCompass — Recommendation Backfill & Career Catalogue Regression Tests
 * ============================================================================
 * Aligned with docs/architecture.md §7, docs/api-contract.md §5,
 * and docs/data-model.md §2.9, §4.3 & §5.1.
 *
 * Verifies:
 * 1. Career Catalogue Seeding: 10–15 published careers, all 6 canonical dimensions,
 *    skills, pathways, and 100% idempotent re-seeding without duplicate keys.
 * 2. Empty Catalogue Resilience: Attempt completion & recommendation retrieval
 *    handle empty/unpublished catalogue gracefully without throwing errors.
 * 3. Completed-Attempt Backfill: Explicit, non-recursive backfill transaction
 *    generates deterministic ranked recommendations using existing scoresJson.
 * 4. Duplicate Prevention & Idempotency: Backfill is safe to run multiple times,
 *    never creates duplicate recommendations, and preserves existing records.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

import {
  CAREER_CATALOG,
  seedCareerCatalog,
} from '../prisma/seed-data/career-catalog.js';
import {
  backfillCompletedAttemptsRecommendations,
} from '../prisma/seed.js';
import { CANONICAL_DIMENSIONS } from '../src/matching/constants.js';
import { AssessmentRepositoryAdapter } from '../src/repositories/assessment.repository.adapter.js';

describe('Career Catalogue Specification & Validation', () => {
  it('defines 10–15 published career profiles (exactly 12)', () => {
    expect(CAREER_CATALOG.length).toBeGreaterThanOrEqual(10);
    expect(CAREER_CATALOG.length).toBeLessThanOrEqual(15);
    expect(CAREER_CATALOG.length).toBe(12);

    for (const career of CAREER_CATALOG) {
      expect(career.published).toBe(true);
      expect(typeof career.slug).toBe('string');
      expect(career.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(typeof career.title).toBe('string');
      expect(career.title.trim().length).toBeGreaterThanOrEqual(2);
      expect(typeof career.description).toBe('string');
      expect(career.description.trim().length).toBeGreaterThanOrEqual(20);
    }
  });

  it('ensures every career has all 6 canonical dimensions with valid non-zero weights', () => {
    for (const career of CAREER_CATALOG) {
      const dimensionKeys = Object.keys(career.dimensions);
      expect(dimensionKeys).toHaveLength(6);

      for (const canonicalDim of CANONICAL_DIMENSIONS) {
        expect(dimensionKeys).toContain(canonicalDim);
        const weight = career.dimensions[canonicalDim];
        expect(typeof weight).toBe('number');
        expect(Number.isFinite(weight)).toBe(true);
        expect(weight).toBeGreaterThan(0);
        expect(weight).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it('ensures each career profile includes skills and multi-stage education pathways', () => {
    for (const career of CAREER_CATALOG) {
      expect(Array.isArray(career.skills)).toBe(true);
      expect(career.skills.length).toBeGreaterThanOrEqual(3);
      for (const skill of career.skills) {
        expect(typeof skill).toBe('string');
        expect(skill.trim().length).toBeGreaterThanOrEqual(2);
      }

      expect(Array.isArray(career.pathways)).toBe(true);
      expect(career.pathways.length).toBeGreaterThanOrEqual(2);
      for (const pathway of career.pathways) {
        expect(['Secondary', 'Undergraduate', 'Postgraduate']).toContain(pathway.stage);
        expect(typeof pathway.qualification).toBe('string');
        expect(pathway.qualification.trim().length).toBeGreaterThanOrEqual(5);
      }
    }
  });
});

/**
 * Creates an in-memory mock Prisma persistence client for testing
 * AssessmentRepositoryAdapter and Career Catalogue Seeders.
 */
const createMockPrismaClient = () => {
  const attempts = new Map();
  const careers = new Map();
  const careerDimensions = new Map();
  const skills = new Map();
  const careerSkills = new Map();
  const pathways = new Map();
  const recommendations = new Map(); // key: `${attemptId}_${careerId}`

  const client = {
    assessmentAttempt: {
      async findFirst({ where }) {
        for (const a of attempts.values()) {
          if (where.id && a.id !== where.id) continue;
          if (where.studentId && a.studentId !== where.studentId) continue;
          return a;
        }
        return null;
      },
      async findUnique({ where }) {
        return attempts.get(where.id) || null;
      },
      async findMany({ where }) {
        const results = [];
        for (const a of attempts.values()) {
          if (where?.status && a.status !== where.status) continue;
          if (where?.id && a.id !== where.id) continue;
          const recCount = Array.from(recommendations.values()).filter(
            (r) => r.attemptId === a.id
          ).length;
          results.push({
            ...a,
            _count: { recommendations: recCount },
          });
        }
        return results;
      },
      async update({ where, data }) {
        const existing = attempts.get(where.id);
        if (!existing) throw new Error('Attempt not found');
        const updated = { ...existing, ...data };
        attempts.set(where.id, updated);
        return updated;
      },
    },

    career: {
      async findMany({ where, include }) {
        const results = [];
        for (const c of careers.values()) {
          if (where?.published !== undefined && c.published !== where.published) continue;
          const dims = Array.from(careerDimensions.values()).filter((d) => d.careerId === c.id);
          results.push({
            ...c,
            ...(include?.dimensions ? { dimensions: dims } : {}),
          });
        }
        return results;
      },
      async upsert({ where, create, update }) {
        let found = null;
        for (const c of careers.values()) {
          if (where.slug && c.slug === where.slug) {
            found = c;
            break;
          }
          if (where.id && c.id === where.id) {
            found = c;
            break;
          }
        }
        if (found) {
          const updated = { ...found, ...update };
          careers.set(found.id, updated);
          return updated;
        }
        const created = { id: create.id || crypto.randomUUID(), ...create };
        careers.set(created.id, created);
        return created;
      },
      async count({ where } = {}) {
        let count = 0;
        for (const c of careers.values()) {
          if (where?.published !== undefined && c.published !== where.published) continue;
          count++;
        }
        return count;
      },
    },

    careerDimension: {
      async upsert({ where, create, update }) {
        const key = `${where.careerId_dimension.careerId}_${where.careerId_dimension.dimension}`;
        const existing = careerDimensions.get(key);
        if (existing) {
          const updated = { ...existing, ...update };
          careerDimensions.set(key, updated);
          return updated;
        }
        const created = { id: crypto.randomUUID(), ...create };
        careerDimensions.set(key, created);
        return created;
      },
    },

    skill: {
      async upsert({ where, create }) {
        for (const s of skills.values()) {
          if (s.name === where.name) return s;
        }
        const created = { id: crypto.randomUUID(), name: create.name };
        skills.set(created.id, created);
        return created;
      },
    },

    careerSkill: {
      async upsert({ where, create }) {
        const key = `${where.careerId_skillId.careerId}_${where.careerId_skillId.skillId}`;
        const existing = careerSkills.get(key);
        if (existing) return existing;
        const created = { ...create };
        careerSkills.set(key, created);
        return created;
      },
    },

    educationPathway: {
      async deleteMany({ where }) {
        let deleted = 0;
        for (const [id, p] of pathways.entries()) {
          if (where.careerId && p.careerId === where.careerId) {
            pathways.delete(id);
            deleted++;
          }
        }
        return { count: deleted };
      },
      async createMany({ data }) {
        for (const item of data) {
          const id = crypto.randomUUID();
          pathways.set(id, { id, ...item });
        }
        return { count: data.length };
      },
    },

    recommendation: {
      async count({ where }) {
        let count = 0;
        for (const r of recommendations.values()) {
          if (where?.attemptId && r.attemptId !== where.attemptId) continue;
          count++;
        }
        return count;
      },
      async findMany({ where, orderBy, skip = 0, take = 20 }) {
        let results = [];
        for (const r of recommendations.values()) {
          if (where?.attemptId && r.attemptId !== where.attemptId) continue;
          const career = careers.get(r.careerId);
          results.push({ ...r, career });
        }
        if (orderBy?.rank === 'asc') {
          results.sort((a, b) => a.rank - b.rank);
        }
        return results.slice(skip, skip + take);
      },
      async createMany({ data, skipDuplicates = true }) {
        let created = 0;
        for (const item of data) {
          const key = `${item.attemptId}_${item.careerId}`;
          if (recommendations.has(key)) {
            if (skipDuplicates) continue;
            throw new Error(`Unique constraint failed on (attemptId, careerId)`);
          }
          recommendations.set(key, { id: crypto.randomUUID(), ...item });
          created++;
        }
        return { count: created };
      },
    },

    // Transaction mock
    async $transaction(fn) {
      return await fn(client);
    },

    // Raw helper to inspect store
    _stores: {
      attempts,
      careers,
      careerDimensions,
      skills,
      careerSkills,
      pathways,
      recommendations,
    },
  };

  return client;
};

describe('Seeder Idempotency & Catalogue Invariants', () => {
  it('seeds 12 careers, 6 dimensions each, skills, and pathways idempotently', async () => {
    const mockDb = createMockPrismaClient();

    const firstRun = await seedCareerCatalog(mockDb);
    expect(firstRun.action).toBe('SEEDED');
    expect(firstRun.careerCount).toBe(12);

    const careerCount = await mockDb.career.count({ where: { published: true } });
    expect(careerCount).toBe(12);
    expect(mockDb._stores.careerDimensions.size).toBe(12 * 6);
    expect(mockDb._stores.skills.size).toBeGreaterThanOrEqual(15);
    expect(mockDb._stores.pathways.size).toBe(12 * 3);

    // Re-run seed: must be identical no-op without duplicate entries
    const secondRun = await seedCareerCatalog(mockDb);
    expect(secondRun.action).toBe('SEEDED');
    expect(secondRun.careerCount).toBe(12);

    expect(await mockDb.career.count({ where: { published: true } })).toBe(12);
    expect(mockDb._stores.careerDimensions.size).toBe(12 * 6);
    expect(mockDb._stores.pathways.size).toBe(12 * 3);
  });
});

describe('Empty Catalogue Resilience', () => {
  it('gracefully returns empty recommendations when no published careers exist without throwing', async () => {
    const mockDb = createMockPrismaClient();
    const adapter = new AssessmentRepositoryAdapter({ dbClient: mockDb });

    const studentId = 'student-test-01';
    const attemptId = 'attempt-empty-01';

    // Set up a completed attempt with scores, but NO published careers in database
    mockDb._stores.attempts.set(attemptId, {
      id: attemptId,
      studentId,
      status: 'COMPLETED',
      scoresJson: {
        ANALYTICAL: 0.8,
        CREATIVE: 0.5,
        SOCIAL: 0.4,
        PRACTICAL: 0.6,
        ORGANIZATIONAL: 0.5,
        INVESTIGATIVE: 0.7,
      },
    });

    // 1. Explicit backfill when catalogue is empty returns backfilled: false, count: 0
    const backfillRes = await adapter.backfillAttemptRecommendations({
      attemptId,
      studentId,
    });
    expect(backfillRes.backfilled).toBe(false);
    expect(backfillRes.count).toBe(0);
    expect(backfillRes.message).toContain('No published careers');

    // 2. listRecommendations returns data: [], total: 0 without throwing
    const listRes = await adapter.listRecommendations({ attemptId, studentId });
    expect(listRes.data).toEqual([]);
    expect(listRes.meta.total).toBe(0);
    expect(listRes.meta.totalPages).toBe(0);
  });
});

describe('Completed Attempt Recommendation Backfill', () => {
  let mockDb;
  let adapter;
  const studentId = 'student-backfill-01';
  const attemptId = '385eea28-b6d1-4b52-939f-9376902763c9'; // The exact user attempt ID

  beforeEach(async () => {
    mockDb = createMockPrismaClient();
    adapter = new AssessmentRepositoryAdapter({ dbClient: mockDb });

    // Seed the 12 careers
    await seedCareerCatalog(mockDb);

    // Set up the completed attempt matching the exact user attempt state
    mockDb._stores.attempts.set(attemptId, {
      id: attemptId,
      studentId,
      status: 'COMPLETED',
      scoresJson: {
        SOCIAL: 0.5,
        CREATIVE: 0.45,
        PRACTICAL: 0.5,
        ANALYTICAL: 0.55,
        INVESTIGATIVE: 0.55,
        ORGANIZATIONAL: 0.4,
      },
      algorithmVersion: 'cosine-v1',
    });
  });

  it('generates 12 deterministic ranked recommendations using existing scoresJson', async () => {
    // Recommendations initially missing
    expect(mockDb._stores.recommendations.size).toBe(0);

    const result = await adapter.backfillAttemptRecommendations({
      attemptId,
      studentId,
    });

    expect(result.backfilled).toBe(true);
    expect(result.count).toBe(12);
    expect(mockDb._stores.recommendations.size).toBe(12);

    // Retrieve via listRecommendations
    const listRes = await adapter.listRecommendations({ attemptId, studentId, page: 1, limit: 5 });
    expect(listRes.meta.total).toBe(12);
    expect(listRes.meta.totalPages).toBe(3);
    expect(listRes.data).toHaveLength(5);

    // Verify ranked 1st career
    const first = listRes.data[0];
    expect(first.rank).toBe(1);
    expect(first.similarityScore).toBeGreaterThan(0.9);
    expect(first.similarityScore).toBeLessThanOrEqual(1.0);
    expect(first.algorithmVersion).toBe('cosine-v1');
    expect(Array.isArray(first.reasons)).toBe(true);
    expect(first.reasons.length).toBeGreaterThan(0);
    expect(Array.isArray(first.cautions)).toBe(true);
  });

  it('safely handles non-recursive lazy backfill in listRecommendations', async () => {
    // Recommendations initially missing (count: 0)
    expect(mockDb._stores.recommendations.size).toBe(0);

    // Directly calling listRecommendations triggers safe linear backfill
    const listRes = await adapter.listRecommendations({ attemptId, studentId, page: 1, limit: 10 });
    expect(listRes.meta.total).toBe(12);
    expect(listRes.data).toHaveLength(10);
    expect(mockDb._stores.recommendations.size).toBe(12);
  });
});

describe('Duplicate Prevention & Idempotency', () => {
  it('prevents duplicate recommendations when backfill is invoked multiple times', async () => {
    const mockDb = createMockPrismaClient();
    const adapter = new AssessmentRepositoryAdapter({ dbClient: mockDb });

    await seedCareerCatalog(mockDb);

    const studentId = 'student-idemp-01';
    const attemptId = 'attempt-idemp-01';

    mockDb._stores.attempts.set(attemptId, {
      id: attemptId,
      studentId,
      status: 'COMPLETED',
      scoresJson: {
        ANALYTICAL: 0.9,
        INVESTIGATIVE: 0.8,
        PRACTICAL: 0.6,
        CREATIVE: 0.4,
        ORGANIZATIONAL: 0.5,
        SOCIAL: 0.3,
      },
    });

    // Run 1: Backfills 12 recommendations
    const run1 = await adapter.backfillAttemptRecommendations({ attemptId, studentId });
    expect(run1.backfilled).toBe(true);
    expect(run1.count).toBe(12);
    expect(mockDb._stores.recommendations.size).toBe(12);

    // Run 2: Safe no-op, returns backfilled: false, count: 12
    const run2 = await adapter.backfillAttemptRecommendations({ attemptId, studentId });
    expect(run2.backfilled).toBe(false);
    expect(run2.count).toBe(12);
    expect(run2.message).toContain('already exist');
    expect(mockDb._stores.recommendations.size).toBe(12);

    // Run 3: Batch runner also safely skips already-backfilled attempt
    const batchRun = await backfillCompletedAttemptsRecommendations(mockDb, {
      targetAttemptId: attemptId,
    });
    expect(batchRun.attemptsBackfilled).toBe(0);
    expect(mockDb._stores.recommendations.size).toBe(12);
  });
});
