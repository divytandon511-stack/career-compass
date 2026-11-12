import { describe, it, expect } from 'vitest';

import {
  CANONICAL_DIMENSIONS,
  DEFAULT_ALGORITHM_VERSION,
  DEFAULT_DIMENSION_WEIGHTS,
  EPSILON,
  EXPLANATION_THRESHOLDS,
  validateScoreVector,
  validateWeights,
  normalizeAssessmentScores,
  weightedDotProduct,
  weightedNorm,
  weightedCosineSimilarity,
  calculateDimensionContributions,
  extractCareerVector,
  generateMathematicalExplanations,
  compareCareerRanks,
  rankCareers,
} from '../src/matching/index.js';

describe('CareerCompass — Mathematical Career-Matching Engine (Stage 6A)', () => {
  // Canonical sample test vector
  const sampleStudent = Object.freeze({
    ANALYTICAL: 0.9,
    CREATIVE: 0.4,
    SOCIAL: 0.2,
    PRACTICAL: 0.7,
    ORGANIZATIONAL: 0.5,
    INVESTIGATIVE: 0.8,
  });

  const sampleCareer = Object.freeze({
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'software-engineer',
    title: 'Software Engineer',
    dimensionProfile: Object.freeze({
      ANALYTICAL: 0.95,
      CREATIVE: 0.4,
      SOCIAL: 0.3,
      PRACTICAL: 0.6,
      ORGANIZATIONAL: 0.5,
      INVESTIGATIVE: 0.85,
    }),
  });

  // ==========================================================================
  // 1. Vector Normalization & Pre-Computation Validation
  // ==========================================================================
  describe('1. Vector Normalization & Pre-computation', () => {
    it('normalizes raw assessment question scores to [0.0, 1.0] accurately', () => {
      const raw = {
        ANALYTICAL: 16,
        CREATIVE: 10,
        SOCIAL: 4,
        PRACTICAL: 14,
        ORGANIZATIONAL: 8,
        INVESTIGATIVE: 18,
      };
      const max = {
        ANALYTICAL: 20,
        CREATIVE: 20,
        SOCIAL: 20,
        PRACTICAL: 20,
        ORGANIZATIONAL: 20,
        INVESTIGATIVE: 20,
      };

      const normalized = normalizeAssessmentScores(raw, max);

      expect(normalized.ANALYTICAL).toBeCloseTo(0.8, 6);
      expect(normalized.CREATIVE).toBeCloseTo(0.5, 6);
      expect(normalized.SOCIAL).toBeCloseTo(0.2, 6);
      expect(normalized.PRACTICAL).toBeCloseTo(0.7, 6);
      expect(normalized.ORGANIZATIONAL).toBeCloseTo(0.4, 6);
      expect(normalized.INVESTIGATIVE).toBeCloseTo(0.9, 6);
    });

    it('rejects normalization when raw scores exceed maximum possible score', () => {
      const raw = { ...sampleStudent, ANALYTICAL: 25 };
      const max = { ...sampleStudent, ANALYTICAL: 20 };

      expect(() => normalizeAssessmentScores(raw, max)).toThrowError(RangeError);
    });

    it('rejects normalization when max score is zero or negative', () => {
      const raw = { ...sampleStudent, ANALYTICAL: 5 };
      const maxZero = { ...sampleStudent, ANALYTICAL: 0 };
      const maxNegative = { ...sampleStudent, ANALYTICAL: -10 };

      expect(() => normalizeAssessmentScores(raw, maxZero)).toThrowError(RangeError);
      expect(() => normalizeAssessmentScores(raw, maxNegative)).toThrowError(RangeError);
    });

    it('rejects normalization if any required canonical dimension is missing', () => {
      const incompleteRaw = {
        ANALYTICAL: 10,
        CREATIVE: 10,
        // Missing SOCIAL, PRACTICAL, ORGANIZATIONAL, INVESTIGATIVE
      };
      const max = Object.fromEntries(CANONICAL_DIMENSIONS.map((d) => [d, 20]));

      expect(() => normalizeAssessmentScores(incompleteRaw, max)).toThrowError(
        /Missing raw score for required dimension/
      );
    });
  });

  // ==========================================================================
  // 2. Strict Input Validation (Dimensions, Finite Numbers & Bounds)
  // ==========================================================================
  describe('2. Input Validation & Bounds Checking', () => {
    it('validates a complete, valid vector and returns an immutable copy', () => {
      const validated = validateScoreVector(sampleStudent);
      expect(validated).toEqual(sampleStudent);
      expect(Object.isFrozen(validated)).toBe(true);
    });

    it('rejects vector missing any required canonical dimension', () => {
      const missingInvestigative = { ...sampleStudent };
      delete missingInvestigative.INVESTIGATIVE;

      expect(() => validateScoreVector(missingInvestigative)).toThrowError(
        'Missing required dimension "INVESTIGATIVE" in vector'
      );
    });

    it('rejects vectors with negative values or values exceeding 1.0', () => {
      const negative = { ...sampleStudent, SOCIAL: -0.01 };
      const excessive = { ...sampleStudent, ANALYTICAL: 1.0001 };

      expect(() => validateScoreVector(negative)).toThrowError(RangeError);
      expect(() => validateScoreVector(excessive)).toThrowError(RangeError);
    });

    it('rejects non-finite values (NaN, Infinity, -Infinity) and non-numeric types', () => {
      expect(() => validateScoreVector({ ...sampleStudent, CREATIVE: NaN })).toThrowError(
        TypeError
      );
      expect(() => validateScoreVector({ ...sampleStudent, CREATIVE: Infinity })).toThrowError(
        TypeError
      );
      expect(() => validateScoreVector({ ...sampleStudent, CREATIVE: -Infinity })).toThrowError(
        TypeError
      );
      expect(() => validateScoreVector({ ...sampleStudent, CREATIVE: '0.8' })).toThrowError(
        TypeError
      );
      expect(() => validateScoreVector({ ...sampleStudent, CREATIVE: null })).toThrowError(
        TypeError
      );
    });

    it('rejects non-object vector inputs (arrays, null, primitives)', () => {
      expect(() => validateScoreVector(null)).toThrowError(TypeError);
      expect(() => validateScoreVector([0.5, 0.5])).toThrowError(TypeError);
      expect(() => validateScoreVector('invalid')).toThrowError(TypeError);
    });

    it('rejects negative weights and non-finite weights', () => {
      expect(() => validateWeights({ ANALYTICAL: -1.0 })).toThrowError(RangeError);
      expect(() => validateWeights({ ANALYTICAL: NaN })).toThrowError(TypeError);
      expect(() => validateWeights({ ANALYTICAL: Infinity })).toThrowError(TypeError);
      expect(() => validateWeights({ ANALYTICAL: '1.0' })).toThrowError(TypeError);
    });

    it('defaults omitted dimensions in custom weights object to 1.0', () => {
      const partialWeights = { ANALYTICAL: 2.5 };
      const validated = validateWeights(partialWeights);

      expect(validated.ANALYTICAL).toBe(2.5);
      expect(validated.CREATIVE).toBe(1.0);
      expect(validated.SOCIAL).toBe(1.0);
      expect(validated.PRACTICAL).toBe(1.0);
      expect(validated.ORGANIZATIONAL).toBe(1.0);
      expect(validated.INVESTIGATIVE).toBe(1.0);
    });
  });

  // ==========================================================================
  // 3. Mathematical Cosine Similarity (Identical, Orthogonal, Collinear)
  // ==========================================================================
  describe('3. Weighted Cosine Similarity Properties', () => {
    it('returns exactly 1.0 for identical non-zero vectors', () => {
      const { similarity, isLowInformation } = weightedCosineSimilarity(
        sampleStudent,
        sampleStudent
      );

      expect(similarity).toBe(1.0);
      expect(isLowInformation).toBe(false);
    });

    it('returns exactly 1.0 for collinear vectors (proportional scalar multiples)', () => {
      const base = {
        ANALYTICAL: 0.2,
        CREATIVE: 0.4,
        SOCIAL: 0.1,
        PRACTICAL: 0.3,
        ORGANIZATIONAL: 0.2,
        INVESTIGATIVE: 0.5,
      };
      // Exactly 2x multiplier
      const scaled = {
        ANALYTICAL: 0.4,
        CREATIVE: 0.8,
        SOCIAL: 0.2,
        PRACTICAL: 0.6,
        ORGANIZATIONAL: 0.4,
        INVESTIGATIVE: 1.0,
      };

      const { similarity } = weightedCosineSimilarity(base, scaled);
      expect(similarity).toBeCloseTo(1.0, 9);
    });

    it('returns exactly 0.0 for completely orthogonal vectors', () => {
      const vectorA = {
        ANALYTICAL: 1.0,
        CREATIVE: 0.0,
        SOCIAL: 0.0,
        PRACTICAL: 0.0,
        ORGANIZATIONAL: 0.0,
        INVESTIGATIVE: 0.0,
      };
      const vectorB = {
        ANALYTICAL: 0.0,
        CREATIVE: 1.0,
        SOCIAL: 0.8,
        PRACTICAL: 0.5,
        ORGANIZATIONAL: 0.2,
        INVESTIGATIVE: 0.9,
      };

      const { similarity, isLowInformation } = weightedCosineSimilarity(vectorA, vectorB);
      expect(similarity).toBe(0.0);
      expect(isLowInformation).toBe(false);
    });

    it('matches independently calculated hand-computed benchmark values with non-uniform weights', () => {
      // Benchmark 3 dimensions: ANALYTICAL, CREATIVE, SOCIAL
      // Weights: w = [2.0, 1.0, 3.0]
      // Student: s = [0.9, 0.4, 0.2]
      // Career:  c = [0.8, 0.6, 0.1]
      //
      // Numerator:
      // 2*(0.9*0.8) + 1*(0.4*0.6) + 3*(0.2*0.1) = 1.44 + 0.24 + 0.06 = 1.74
      //
      // Denominator:
      // student squared norm = 2*(0.81) + 1*(0.16) + 3*(0.04) = 1.62 + 0.16 + 0.12 = 1.90
      // career squared norm  = 2*(0.64) + 1*(0.36) + 3*(0.01) = 1.28 + 0.36 + 0.03 = 1.67
      // sqrt(1.90 * 1.67) = sqrt(3.173) ≈ 1.7812916661793405
      //
      // Similarity = 1.74 / 1.7812916661793405 ≈ 0.9768192661848529
      const dimensions = ['ANALYTICAL', 'CREATIVE', 'SOCIAL'];
      const weights = { ANALYTICAL: 2.0, CREATIVE: 1.0, SOCIAL: 3.0 };
      const student = { ANALYTICAL: 0.9, CREATIVE: 0.4, SOCIAL: 0.2 };
      const career = { ANALYTICAL: 0.8, CREATIVE: 0.6, SOCIAL: 0.1 };

      const { similarity } = weightedCosineSimilarity(student, career, weights, { dimensions });

      expect(similarity).toBeCloseTo(0.976819266, 6);
    });

    it('strictly clamps floating-point inaccuracies to [0.0, 1.0]', () => {
      const ones = Object.fromEntries(CANONICAL_DIMENSIONS.map((d) => [d, 1.0]));
      const result = weightedCosineSimilarity(ones, ones);

      expect(result.similarity).toBeLessThanOrEqual(1.0);
      expect(result.similarity).toBeGreaterThanOrEqual(0.0);
    });
  });

  // ==========================================================================
  // 4. Zero Vectors, Zero Denominators & Low-Information Policy
  // ==========================================================================
  describe('4. Zero Vectors & Zero Denominators Policy', () => {
    const zeroVector = Object.freeze(
      Object.fromEntries(CANONICAL_DIMENSIONS.map((d) => [d, 0.0]))
    );

    it('returns score 0.0 and marks isLowInformation=true when student vector is all zeros', () => {
      const { similarity, isLowInformation, studentNorm } = weightedCosineSimilarity(
        zeroVector,
        sampleCareer.dimensionProfile
      );

      expect(similarity).toBe(0.0);
      expect(isLowInformation).toBe(true);
      expect(studentNorm).toBe(0.0);
    });

    it('returns score 0.0 and marks isLowInformation=true when career vector is all zeros', () => {
      const { similarity, isLowInformation, careerNorm } = weightedCosineSimilarity(
        sampleStudent,
        zeroVector
      );

      expect(similarity).toBe(0.0);
      expect(isLowInformation).toBe(true);
      expect(careerNorm).toBe(0.0);
    });

    it('returns score 0.0 and marks isLowInformation=true when both vectors are all zeros', () => {
      const { similarity, isLowInformation } = weightedCosineSimilarity(zeroVector, zeroVector);

      expect(similarity).toBe(0.0);
      expect(isLowInformation).toBe(true);
    });

    it('handles zero weights: returns 0.0 if all dimensions with non-zero scores have zero weight', () => {
      // Student only has scores on CREATIVE
      const student = { ...zeroVector, CREATIVE: 0.9 };
      // Career has scores on CREATIVE
      const career = { ...zeroVector, CREATIVE: 0.8 };
      // But weight for CREATIVE is 0.0
      const zeroCreativeWeight = { ...DEFAULT_DIMENSION_WEIGHTS, CREATIVE: 0.0 };

      const { similarity, isLowInformation } = weightedCosineSimilarity(
        student,
        career,
        zeroCreativeWeight
      );

      expect(similarity).toBe(0.0);
      expect(isLowInformation).toBe(true);
    });
  });

  // ==========================================================================
  // 5. Additive Category Contributions (Explainability Decomposition)
  // ==========================================================================
  describe('5. Explainable Dimension Contributions', () => {
    it('proves that the sum of per-dimension contributions equals the total similarity score', () => {
      const contributions = calculateDimensionContributions(
        sampleStudent,
        sampleCareer.dimensionProfile
      );

      const { similarity } = weightedCosineSimilarity(
        sampleStudent,
        sampleCareer.dimensionProfile
      );

      const sumContributions = contributions.reduce(
        (acc, item) => acc + item.absoluteContribution,
        0
      );

      expect(sumContributions).toBeCloseTo(similarity, 8);
    });

    it('computes relative percentage contributions that sum to 1.0 when similarity > 0', () => {
      const contributions = calculateDimensionContributions(
        sampleStudent,
        sampleCareer.dimensionProfile
      );

      const sumRelative = contributions.reduce(
        (acc, item) => acc + item.relativeContribution,
        0
      );

      expect(sumRelative).toBeCloseTo(1.0, 6);
    });

    it('correctly populates explainable reasons and cautions based on mathematical metrics', () => {
      const contributions = calculateDimensionContributions(
        sampleStudent,
        sampleCareer.dimensionProfile
      );
      const { reasons, cautions } = generateMathematicalExplanations(contributions, false);

      expect(reasons.length).toBeGreaterThan(0);
      expect(cautions.length).toBeGreaterThan(0);
      expect(reasons[0]).toMatch(/alignment with/i);
    });

    it('generates zero positive alignment claims for orthogonal vectors with 0.0 similarity (DEF-EXP-01)', () => {
      const sOrth = {
        ANALYTICAL: 1.0,
        CREATIVE: 0.0,
        SOCIAL: 0.0,
        PRACTICAL: 0.0,
        ORGANIZATIONAL: 0.0,
        INVESTIGATIVE: 0.0,
      };
      const cOrth = {
        ANALYTICAL: 0.0,
        CREATIVE: 1.0,
        SOCIAL: 0.0,
        PRACTICAL: 0.0,
        ORGANIZATIONAL: 0.0,
        INVESTIGATIVE: 0.0,
      };
      const contributions = calculateDimensionContributions(sOrth, cOrth);
      const { similarity } = weightedCosineSimilarity(sOrth, cOrth);

      expect(similarity).toBe(0.0);
      const { reasons, cautions } = generateMathematicalExplanations(
        contributions,
        false,
        similarity
      );

      expect(reasons).toHaveLength(1);
      expect(reasons[0]).toBe(
        'No dimensional alignment between expressed interests and career profile'
      );
      expect(reasons[0]).not.toMatch(/alignment with .* interests/i);
      expect(cautions[0]).toBe(
        'Career profile demands interest dimensions not expressed in current assessment'
      );
    });

    it('generates neutral balanced-alignment explanation for uniform/proportional vectors (DEF-EXP-01)', () => {
      const sUniform = Object.fromEntries(CANONICAL_DIMENSIONS.map((d) => [d, 0.2]));
      const cUniform = Object.fromEntries(CANONICAL_DIMENSIONS.map((d) => [d, 0.9]));
      const contributions = calculateDimensionContributions(sUniform, cUniform);
      const { similarity } = weightedCosineSimilarity(sUniform, cUniform);

      expect(similarity).toBe(1.0);
      const { reasons, cautions } = generateMathematicalExplanations(
        contributions,
        false,
        similarity
      );

      expect(reasons).toHaveLength(1);
      expect(reasons[0]).toBe('Balanced alignment across all interest dimensions');
      // Must not arbitrarily single out ANALYTICAL or any individual dimension
      expect(reasons[0]).not.toMatch(/analytical/i);
      // All 6 dimensions exceed student interest, so 6 cautions must be emitted
      expect(cautions).toHaveLength(6);
    });

    it('matches independently pre-computed benchmark values for 6-dimensional contributions', () => {
      const contributions = calculateDimensionContributions(
        sampleStudent,
        sampleCareer.dimensionProfile
      );
      // Denominator = sqrt(2.39 * 2.485) ≈ 2.4370371355397447
      // ANALYTICAL: 0.9 * 0.95 / 2.4370371355397447 = 0.855 / 2.4370371355397447 ≈ 0.350835848
      const analytical = contributions.find((c) => c.dimension === 'ANALYTICAL');
      expect(analytical.absoluteContribution).toBeCloseTo(0.350836, 6);
      expect(analytical.studentScore).toBe(0.9);
      expect(analytical.careerScore).toBe(0.95);
      expect(analytical.discrepancy).toBeCloseTo(0.05, 6);
    });
  });

  // ==========================================================================
  // 6. Career Recommendation Ranking & Deterministic Tie-Breaking
  // ==========================================================================
  describe('6. Deterministic Recommendation Ranking & Tie-Breaking', () => {
    const careerA = Object.freeze({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      slug: 'architect',
      title: 'Architect',
      dimensionProfile: Object.freeze({
        ANALYTICAL: 0.8,
        CREATIVE: 0.9,
        SOCIAL: 0.3,
        PRACTICAL: 0.7,
        ORGANIZATIONAL: 0.4,
        INVESTIGATIVE: 0.6,
      }),
    });

    const careerB = Object.freeze({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      slug: 'biomedical-scientist',
      title: 'Biomedical Scientist',
      dimensionProfile: Object.freeze({
        ANALYTICAL: 0.9,
        CREATIVE: 0.3,
        SOCIAL: 0.2,
        PRACTICAL: 0.5,
        ORGANIZATIONAL: 0.6,
        INVESTIGATIVE: 0.95,
      }),
    });

    const careerC = Object.freeze({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      slug: 'counsellor',
      title: 'School Counsellor',
      dimensionProfile: Object.freeze({
        ANALYTICAL: 0.3,
        CREATIVE: 0.4,
        SOCIAL: 0.95,
        PRACTICAL: 0.2,
        ORGANIZATIONAL: 0.7,
        INVESTIGATIVE: 0.4,
      }),
    });

    it('ranks careers strictly in descending order of similarity score', () => {
      const ranked = rankCareers(sampleStudent, [careerA, careerB, careerC]);

      expect(ranked).toHaveLength(3);
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(2);
      expect(ranked[2].rank).toBe(3);

      expect(ranked[0].similarityScore).toBeGreaterThanOrEqual(ranked[1].similarityScore);
      expect(ranked[1].similarityScore).toBeGreaterThanOrEqual(ranked[2].similarityScore);

      // Student has high ANALYTICAL (0.9) & INVESTIGATIVE (0.8), low SOCIAL (0.2).
      // Biomedical Scientist should rank highest, Counsellor lowest.
      expect(ranked[0].career.slug).toBe('biomedical-scientist');
      expect(ranked[2].career.slug).toBe('counsellor');
    });

    it('resolves ties deterministically: sorts identical similarity scores by slug ascending', () => {
      // Two careers with identical vector profile
      const identicalVector = Object.freeze({
        ANALYTICAL: 0.7,
        CREATIVE: 0.7,
        SOCIAL: 0.7,
        PRACTICAL: 0.7,
        ORGANIZATIONAL: 0.7,
        INVESTIGATIVE: 0.7,
      });

      const careerZebra = {
        id: '11111111-0000-0000-0000-000000000000',
        slug: 'zebra-trainer',
        title: 'Zebra Trainer',
        dimensionProfile: identicalVector,
      };

      const careerAlpha = {
        id: '22222222-0000-0000-0000-000000000000',
        slug: 'alpha-tester',
        title: 'Alpha Tester',
        dimensionProfile: identicalVector,
      };

      const careerBeta = {
        id: '33333333-0000-0000-0000-000000000000',
        slug: 'beta-reviewer',
        title: 'Beta Reviewer',
        dimensionProfile: identicalVector,
      };

      // Pass in reverse alphabetical order: Zebra, Beta, Alpha
      const ranked = rankCareers(sampleStudent, [careerZebra, careerBeta, careerAlpha]);

      expect(ranked[0].similarityScore).toBe(ranked[1].similarityScore);
      expect(ranked[1].similarityScore).toBe(ranked[2].similarityScore);

      // Must be broken deterministically by slug ASCENDING: alpha -> beta -> zebra
      expect(ranked[0].career.slug).toBe('alpha-tester');
      expect(ranked[1].career.slug).toBe('beta-reviewer');
      expect(ranked[2].career.slug).toBe('zebra-trainer');
    });

    it('resolves ties deterministically by career ID via pure comparator compareCareerRanks (DEF-TEST-01)', () => {
      // Under production constraints, every career in catalog has a unique slug.
      // However, when slugs are identical or omitted, compareCareerRanks breaks ties strictly by ID.
      const recordA = {
        similarityScore: 0.95,
        career: { id: '00000000-0000-0000-0000-000000000002', slug: 'software-specialist' },
      };
      const recordB = {
        similarityScore: 0.95,
        career: { id: '00000000-0000-0000-0000-000000000001', slug: 'software-specialist' },
      };

      // Identical scores, identical slugs -> recordB (id ending in ...0001) must precede recordA (id ending in ...0002)
      const result = compareCareerRanks(recordA, recordB);
      expect(result).toBeGreaterThan(0); // recordA > recordB, meaning recordB sorts before recordA

      const sorted = [recordA, recordB].sort(compareCareerRanks);
      expect(sorted[0].career.id).toBe('00000000-0000-0000-0000-000000000001');
      expect(sorted[1].career.id).toBe('00000000-0000-0000-0000-000000000002');
    });

    it('resolves ties deterministically in rankCareers when career slugs are omitted (DEF-TEST-01)', () => {
      const identicalVector = Object.freeze({ ...sampleStudent });

      // Both careers omit slug, so normalized slug evaluates to empty string on both
      const careerId1 = {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Specialist 1',
        dimensionProfile: identicalVector,
      };

      const careerId2 = {
        id: '00000000-0000-0000-0000-000000000002',
        title: 'Specialist 2',
        dimensionProfile: identicalVector,
      };

      // Pass in reverse order (id2, id1)
      const ranked = rankCareers(sampleStudent, [careerId2, careerId1]);
      expect(ranked[0].career.id).toBe('00000000-0000-0000-0000-000000000001');
      expect(ranked[1].career.id).toBe('00000000-0000-0000-0000-000000000002');
    });

    it('uses deterministic code-point ordering independent of runtime locale (DEF-LOCALE-01)', () => {
      const itemA = { similarityScore: 0.8, career: { id: '2', slug: 'beta' } };
      const itemB = { similarityScore: 0.8, career: { id: '1', slug: 'ALPHA' } };

      const sorted = [itemA, itemB].sort(compareCareerRanks);
      // Normalized 'alpha' < 'beta' in code-point order
      expect(sorted[0].career.slug).toBe('ALPHA');
      expect(sorted[1].career.slug).toBe('beta');
    });

    it('ranks by 6-decimal rounded similarityScore so near-ties tie-break on slug (DEC-PRECISION-01)', () => {
      const student = {
        ANALYTICAL: 0.85,
        CREATIVE: 0.5,
        SOCIAL: 0.5,
        PRACTICAL: 0.5,
        ORGANIZATIONAL: 0.5,
        INVESTIGATIVE: 0.5,
      };

      // Career Zebra has slightly higher raw similarity at 7th decimal
      const careerZebra = {
        id: 'z-id',
        slug: 'zebra',
        title: 'Zebra',
        dimensionProfile: {
          ANALYTICAL: 0.8500004,
          CREATIVE: 0.5,
          SOCIAL: 0.5,
          PRACTICAL: 0.5,
          ORGANIZATIONAL: 0.5,
          INVESTIGATIVE: 0.5,
        },
      };
      // Career Alpha has slightly lower raw similarity at 7th decimal
      const careerAlpha = {
        id: 'a-id',
        slug: 'alpha',
        title: 'Alpha',
        dimensionProfile: {
          ANALYTICAL: 0.8500001,
          CREATIVE: 0.5,
          SOCIAL: 0.5,
          PRACTICAL: 0.5,
          ORGANIZATIONAL: 0.5,
          INVESTIGATIVE: 0.5,
        },
      };

      const ranked = rankCareers(student, [careerZebra, careerAlpha]);

      // Both round to 0.850000 at precision 6
      expect(ranked[0].similarityScore).toBe(ranked[1].similarityScore);
      // Tie-break by slug ASC: alpha must precede zebra
      expect(ranked[0].career.slug).toBe('alpha');
      expect(ranked[1].career.slug).toBe('zebra');
      // Raw similarity is still preserved for audit
      expect(ranked[0].rawSimilarity).not.toBe(ranked[1].rawSimilarity);
    });

    it('rejects duplicate career identifiers (duplicate id or duplicate slug)', () => {
      const duplicateId = [
        { id: 'same-id', slug: 'slug-1', title: 'T1', dimensionProfile: sampleStudent },
        { id: 'same-id', slug: 'slug-2', title: 'T2', dimensionProfile: sampleStudent },
      ];
      expect(() => rankCareers(sampleStudent, duplicateId)).toThrowError(
        /Duplicate career id detected/
      );

      const duplicateSlug = [
        { id: 'id-1', slug: 'same-slug', title: 'T1', dimensionProfile: sampleStudent },
        { id: 'id-2', slug: 'same-slug', title: 'T2', dimensionProfile: sampleStudent },
      ];
      expect(() => rankCareers(sampleStudent, duplicateSlug)).toThrowError(
        /Duplicate career slug detected/
      );
    });

    it('supports relational dimensions array format (CareerDimension[])', () => {
      const relationalCareer = {
        id: '44444444-4444-4444-8444-444444444444',
        slug: 'data-scientist',
        title: 'Data Scientist',
        dimensions: [
          { dimension: 'ANALYTICAL', targetWeight: 0.9 },
          { dimension: 'CREATIVE', targetWeight: 0.5 },
          { dimension: 'SOCIAL', targetWeight: 0.2 },
          { dimension: 'PRACTICAL', targetWeight: 0.6 },
          { dimension: 'ORGANIZATIONAL', targetWeight: 0.4 },
          { dimension: 'INVESTIGATIVE', targetWeight: 0.8 },
        ],
      };

      const ranked = rankCareers(sampleStudent, [relationalCareer]);
      expect(ranked).toHaveLength(1);
      expect(ranked[0].similarityScore).toBeGreaterThan(0.9);
      expect(ranked[0].dimensionSnapshot.ANALYTICAL).toBe(0.9);
    });

    it('supports target_weight, weight, and score aliases in relational dimensions (DEF-CONTRACT-01)', () => {
      const careerSnake = {
        id: 'c-snake',
        slug: 'snake-case-career',
        title: 'Snake Case Career',
        dimensions: CANONICAL_DIMENSIONS.map((dim) => ({
          dimension: dim,
          target_weight: 0.7,
        })),
        profile_version: 2,
      };

      const careerWeight = {
        id: 'c-weight',
        slug: 'weight-career',
        title: 'Weight Career',
        dimensions: CANONICAL_DIMENSIONS.map((dim) => ({
          dimension: dim,
          weight: '0.7',
        })),
      };

      const careerScore = {
        id: 'c-score',
        slug: 'score-career',
        title: 'Score Career',
        dimensions: CANONICAL_DIMENSIONS.map((dim) => ({
          dimension: dim,
          score: 0.7,
        })),
      };

      const vectorSnake = extractCareerVector(careerSnake);
      const vectorWeight = extractCareerVector(careerWeight);
      const vectorScore = extractCareerVector(careerScore);

      expect(vectorSnake.ANALYTICAL).toBe(0.7);
      expect(vectorWeight.ANALYTICAL).toBe(0.7);
      expect(vectorScore.ANALYTICAL).toBe(0.7);

      const ranked = rankCareers(sampleStudent, [careerSnake]);
      expect(ranked[0].careerProfileVersion).toBe(2);
    });

    it('rejects conflicting dimension aliases and duplicate dimensions (DEF-CONTRACT-01)', () => {
      const conflictingAliases = {
        id: 'c-conflict',
        slug: 'conflict-career',
        dimensions: CANONICAL_DIMENSIONS.map((dim) => ({
          dimension: dim,
          targetWeight: 0.8,
          target_weight: 0.4,
        })),
      };
      expect(() => extractCareerVector(conflictingAliases)).toThrowError(
        /Conflicting dimension values detected/
      );

      const duplicateDimensions = {
        id: 'c-duplicate',
        slug: 'dup-dim-career',
        dimensions: [
          { dimension: 'ANALYTICAL', targetWeight: 0.8 },
          { dimension: 'ANALYTICAL', targetWeight: 0.8 },
          ...CANONICAL_DIMENSIONS.slice(1).map((dim) => ({ dimension: dim, targetWeight: 0.5 })),
        ],
      };
      expect(() => extractCareerVector(duplicateDimensions)).toThrowError(
        /Duplicate dimension "ANALYTICAL" detected/
      );

      const conflictingProfileVersions = {
        id: 'c-version-conflict',
        slug: 'version-conflict',
        profileVersion: 1,
        profile_version: 2,
        dimensionProfile: sampleStudent,
      };
      expect(() => rankCareers(sampleStudent, [conflictingProfileVersions])).toThrowError(
        /Conflicting career profile versions detected/
      );
    });

    it('captures full snapshot metadata guaranteeing 100% historical reproducibility', () => {
      const ranked = rankCareers(sampleStudent, [careerA]);
      const item = ranked[0];

      expect(item.algorithmVersion).toBe(DEFAULT_ALGORITHM_VERSION);
      expect(item.dimensionSnapshot).toEqual(careerA.dimensionProfile);
      expect(item.algorithmWeights).toEqual(DEFAULT_DIMENSION_WEIGHTS);
      expect(item.careerProfileVersion).toBe(1);
    });
  });

  // ==========================================================================
  // 7. Input Immutability & Defensive Copying
  // ==========================================================================
  describe('7. Input Immutability Guarantees', () => {
    it('strictly preserves input objects without in-place mutation', () => {
      const studentInput = { ...sampleStudent };
      const careersInput = [
        {
          id: 'test-1',
          slug: 'test-career',
          title: 'Test Career',
          dimensionProfile: { ...sampleStudent },
        },
      ];
      const weightsInput = { ...DEFAULT_DIMENSION_WEIGHTS };

      const studentSnapshot = JSON.stringify(studentInput);
      const careersSnapshot = JSON.stringify(careersInput);
      const weightsSnapshot = JSON.stringify(weightsInput);

      rankCareers(studentInput, careersInput, { weights: weightsInput });

      expect(JSON.stringify(studentInput)).toBe(studentSnapshot);
      expect(JSON.stringify(careersInput)).toBe(careersSnapshot);
      expect(JSON.stringify(weightsInput)).toBe(weightsSnapshot);
    });
  });

  // ==========================================================================
  // 8. Ranking Stability & Determinism Under Random Input Shuffling
  // ==========================================================================
  describe('8. Ranking Stability Across Shuffled Orders', () => {
    it('produces the exact same ordered ranks regardless of career input array order', () => {
      const c1 = {
        id: '1',
        slug: 'c-alpha',
        title: 'Alpha',
        dimensionProfile: { ...sampleStudent, ANALYTICAL: 0.9 },
      };
      const c2 = {
        id: '2',
        slug: 'c-beta',
        title: 'Beta',
        dimensionProfile: { ...sampleStudent, ANALYTICAL: 0.7 },
      };
      const c3 = {
        id: '3',
        slug: 'c-gamma',
        title: 'Gamma',
        dimensionProfile: { ...sampleStudent, ANALYTICAL: 0.5 },
      };

      const order1 = rankCareers(sampleStudent, [c1, c2, c3]);
      const order2 = rankCareers(sampleStudent, [c3, c1, c2]);
      const order3 = rankCareers(sampleStudent, [c2, c3, c1]);

      const slugs1 = order1.map((r) => r.career.slug);
      const slugs2 = order2.map((r) => r.career.slug);
      const slugs3 = order3.map((r) => r.career.slug);

      expect(slugs1).toEqual(['c-alpha', 'c-beta', 'c-gamma']);
      expect(slugs2).toEqual(['c-alpha', 'c-beta', 'c-gamma']);
      expect(slugs3).toEqual(['c-alpha', 'c-beta', 'c-gamma']);
    });
  });
});

