/**
 * ============================================================================
 * CareerCompass — Mathematical Career-Matching Engine
 * ============================================================================
 * Aligned with docs/architecture.md §7, docs/api-contract.md §5 & §6,
 * and docs/data-model.md §2.6, §2.9 & §2.13.
 *
 * Core Principles:
 * 1. Deterministic & Pure:
 *    Same inputs produce identical rankings. No database calls, no network I/O,
 *    no randomness, and no runtime mutable global state.
 * 2. Strict Input Immutability:
 *    Never mutates input vectors, career objects, or arrays.
 * 3. Stable Deterministic Tie-Breaking:
 *    Ranked strictly by:
 *      similarityScore DESCENDING -> career.slug ASCENDING -> career.id ASCENDING
 * 4. Algorithmic Independence from AI:
 *    Numerical similarity and ranking are 100% mathematical. AI explanations
 *    must NEVER alter or re-order these ranks.
 * ============================================================================
 */

import {
  CANONICAL_DIMENSIONS,
  DEFAULT_ALGORITHM_VERSION,
  DEFAULT_DIMENSION_WEIGHTS,
  DEFAULT_DECIMAL_PRECISION,
  EPSILON,
  EXPLANATION_THRESHOLDS,
} from './constants.js';

import {
  validateScoreVector,
  validateWeights,
  weightedCosineSimilarity,
  calculateDimensionContributions,
} from './vector-math.js';

/**
 * Extracts a normalized numeric dimension value from a relational dimension item,
 * supporting aliases: targetWeight, target_weight, weight, score (DEF-CONTRACT-01).
 * Rejects conflicting aliases if multiple are provided with differing values.
 *
 * @param {object} item
 * @param {string} dimension
 * @returns {number}
 */
const extractRelationalDimensionValue = (item, dimension) => {
  const aliases = [
    { key: 'targetWeight', val: item.targetWeight },
    { key: 'target_weight', val: item.target_weight },
    { key: 'weight', val: item.weight },
    { key: 'score', val: item.score },
  ].filter(({ val }) => val !== undefined && val !== null);

  if (aliases.length === 0) {
    throw new Error(
      `Dimension entry for "${dimension}" is missing target weight/score value`
    );
  }

  const parsedValues = aliases.map(({ key, val }) => {
    const num = typeof val === 'string' ? parseFloat(val) : Number(val);
    if (!Number.isFinite(num)) {
      throw new TypeError(
        `Dimension entry "${dimension}" attribute "${key}" must be a finite number, received: ${String(val)}`
      );
    }
    return { key, num };
  });

  // Check for conflicting aliases
  const first = parsedValues[0];
  for (let i = 1; i < parsedValues.length; i++) {
    const next = parsedValues[i];
    if (Math.abs(first.num - next.num) > EPSILON) {
      throw new Error(
        `Conflicting dimension values detected for "${dimension}": ${first.key} (${first.num}) vs ${next.key} (${next.num})`
      );
    }
  }

  return first.num;
};

/**
 * Resolves career profile version supporting profileVersion and profile_version (DEF-CONTRACT-01).
 * Rejects conflicting versions if both are provided with differing values.
 *
 * @param {object} career
 * @returns {number}
 */
const resolveCareerProfileVersion = (career) => {
  const v1 = career.profileVersion;
  const v2 = career.profile_version;

  if (v1 !== undefined && v2 !== undefined) {
    if (v1 !== v2) {
      throw new Error(
        `Conflicting career profile versions detected: profileVersion (${v1}) vs profile_version (${v2})`
      );
    }
    return v1;
  }

  return v1 ?? v2 ?? 1;
};

/**
 * Extracts a normalized dimension vector from a candidate career object.
 *
 * Supports both:
 * 1. Flat dictionary: `career.dimensionProfile = { ANALYTICAL: 0.9, ... }`
 * 2. Relational array: `career.dimensions = [{ dimension: 'ANALYTICAL', targetWeight: 0.9 }, ...]`
 *    supporting aliases: `targetWeight`, `target_weight`, `weight`, and `score`.
 *
 * @param {object} career
 * @param {readonly string[]} [dimensions=CANONICAL_DIMENSIONS]
 * @returns {Record<string, number>}
 */
export const extractCareerVector = (career, dimensions = CANONICAL_DIMENSIONS) => {
  if (!career || typeof career !== 'object') {
    throw new TypeError('Career must be a non-null object');
  }

  // 1. Direct dictionary (dimensionProfile or dimensions as object)
  if (
    career.dimensionProfile &&
    typeof career.dimensionProfile === 'object' &&
    !Array.isArray(career.dimensionProfile)
  ) {
    return validateScoreVector(career.dimensionProfile, {
      dimensions,
      label: `career (${career.slug || career.id || 'unidentified'}).dimensionProfile`,
    });
  }

  // 2. Relational array format (CareerDimension[])
  if (Array.isArray(career.dimensions)) {
    const vector = {};
    const seenDimensions = new Set();

    for (const item of career.dimensions) {
      if (!item || typeof item !== 'object') {
        throw new TypeError('Each dimension entry in career.dimensions must be an object');
      }
      if (typeof item.dimension !== 'string') {
        throw new TypeError(
          'Each dimension entry in career.dimensions must have a string "dimension" attribute'
        );
      }
      if (seenDimensions.has(item.dimension)) {
        throw new Error(
          `Duplicate dimension "${item.dimension}" detected in career (${career.slug || career.id || 'unidentified'}).dimensions`
        );
      }
      seenDimensions.add(item.dimension);
      vector[item.dimension] = extractRelationalDimensionValue(item, item.dimension);
    }

    return validateScoreVector(vector, {
      dimensions,
      label: `career (${career.slug || career.id || 'unidentified'}).dimensions`,
    });
  }

  // 3. Fallback: direct dimensions on the career object itself
  if (
    career.dimensions &&
    typeof career.dimensions === 'object' &&
    !Array.isArray(career.dimensions)
  ) {
    return validateScoreVector(career.dimensions, {
      dimensions,
      label: `career (${career.slug || career.id || 'unidentified'}).dimensions`,
    });
  }

  throw new Error(
    `Career "${career.slug || career.id || 'unknown'}" is missing required dimension profile`
  );
};

/**
 * Generates explainable reasons and cautions derived strictly from mathematical vector contributions.
 *
 * Defect Remediations:
 * - DEF-EXP-01: Orthogonal vectors (similarity <= EPSILON) or zero contributions never produce positive alignment claims.
 * - Neutral balanced-alignment explanation for uniform/proportional vectors instead of arbitrarily picking dimension 0.
 * - Uses centralized heuristic thresholds (DEC-EXPLANATION-HEURISTICS-01).
 *
 * @param {Array<{ dimension: string, studentScore: number, careerScore: number, absoluteContribution: number, discrepancy: number }>} contributions
 * @param {boolean} isLowInformation
 * @param {number} [similarityScore=1.0]
 * @returns {{ reasons: string[], cautions: string[] }}
 */
export const generateMathematicalExplanations = (
  contributions,
  isLowInformation,
  similarityScore = 1.0
) => {
  if (isLowInformation) {
    return {
      reasons: ['Baseline similarity calculated with low-information assessment profile'],
      cautions: ['Assessment indicates minimal interest expression; explore options broadly'],
    };
  }

  // Guard: Zero similarity or negligible similarity never claims positive alignment (DEF-EXP-01)
  if (typeof similarityScore === 'number' && similarityScore <= EPSILON) {
    return {
      reasons: ['No dimensional alignment between expressed interests and career profile'],
      cautions: [
        'Career profile demands interest dimensions not expressed in current assessment',
      ],
    };
  }

  const maxContribution = Math.max(...contributions.map((c) => c.absoluteContribution));
  const minContribution = Math.min(...contributions.map((c) => c.absoluteContribution));

  // Guard: If all contributions are zero/negligible, no positive alignment
  if (maxContribution <= EPSILON) {
    return {
      reasons: ['No dimensional alignment between expressed interests and career profile'],
      cautions: [
        'Career profile demands interest dimensions not expressed in current assessment',
      ],
    };
  }

  const reasons = [];
  const cautions = [];

  // Check for uniformly balanced contributions across all dimensions (DEF-EXP-01)
  const isUniformlyBalanced =
    contributions.length > 1 &&
    maxContribution - minContribution <=
      EXPLANATION_THRESHOLDS.BALANCED_PROFILE_VARIANCE_EPSILON &&
    maxContribution > EPSILON;

  if (isUniformlyBalanced) {
    reasons.push('Balanced alignment across all interest dimensions');
  } else {
    // Sort dimensions by absolute contribution descending
    const sortedByContribution = [...contributions].sort(
      (a, b) => b.absoluteContribution - a.absoluteContribution
    );

    // Top strengths (highest contribution dimensions)
    for (const item of sortedByContribution.slice(0, 2)) {
      if (
        item.absoluteContribution > EXPLANATION_THRESHOLDS.MIN_STRENGTH_CONTRIBUTION &&
        item.studentScore >= EXPLANATION_THRESHOLDS.MIN_STUDENT_STRENGTH_SCORE
      ) {
        const dimLabel = item.dimension.toLowerCase();
        reasons.push(`Strong alignment with ${dimLabel} interests`);
      }
    }

    // Guarded fallback: only claim moderate alignment if highest contribution exceeds strength threshold
    if (
      reasons.length === 0 &&
      sortedByContribution[0] &&
      sortedByContribution[0].absoluteContribution >
        EXPLANATION_THRESHOLDS.MIN_STRENGTH_CONTRIBUTION
    ) {
      const dimLabel = sortedByContribution[0].dimension.toLowerCase();
      reasons.push(`Moderate alignment with ${dimLabel} interests`);
    } else if (
      reasons.length === 0 &&
      sortedByContribution[0] &&
      sortedByContribution[0].absoluteContribution > EPSILON
    ) {
      const dimLabel = sortedByContribution[0].dimension.toLowerCase();
      reasons.push(`Low alignment with ${dimLabel} interests`);
    } else if (reasons.length === 0) {
      reasons.push('Minimal dimensional alignment with career profile');
    }
  }

  // Discrepancy cautions: career requires significantly higher than student expressed
  for (const item of contributions) {
    if (
      item.careerScore >= EXPLANATION_THRESHOLDS.HIGH_CAREER_DEMAND_THRESHOLD &&
      item.studentScore <= EXPLANATION_THRESHOLDS.LOW_STUDENT_EXPRESSION_THRESHOLD
    ) {
      const dimLabel = item.dimension.toLowerCase();
      cautions.push(
        `Professional ${dimLabel} demands are higher than your currently expressed interest level`
      );
    }
  }

  if (cautions.length === 0) {
    cautions.push('Explore day-to-day work and educational pathways before deciding');
  }

  return { reasons, cautions };
};

/**
 * Deterministic tie-breaking comparator for recommendation ordering (DEF-LOCALE-01 & DEC-PRECISION-01).
 *
 * Sorting Specification:
 * 1. similarityScore DESCENDING (primary, six-decimal precision per DEC-PRECISION-01)
 * 2. career.slug ASCENDING (secondary, deterministic code-point order)
 * 3. career.id ASCENDING (tertiary, deterministic code-point order)
 *
 * Code-point comparison (a < b ? -1 : (a > b ? 1 : 0)) is strictly
 * locale-independent and deterministic across all runtime environments.
 *
 * @param {{ similarityScore: number, career: { slug?: string, id: string } }} a
 * @param {{ similarityScore: number, career: { slug?: string, id: string } }} b
 * @returns {number} Negative if a should precede b, positive if b should precede a, 0 if tied
 */
export const compareCareerRanks = (a, b) => {
  // 1. Primary: similarityScore DESCENDING (DEC-PRECISION-01)
  if (b.similarityScore !== a.similarityScore) {
    return b.similarityScore - a.similarityScore;
  }

  // 2. Secondary: slug ASCENDING (deterministic code-point comparison)
  const slugA = String(a.career?.slug || '').trim().toLowerCase();
  const slugB = String(b.career?.slug || '').trim().toLowerCase();
  if (slugA < slugB) return -1;
  if (slugA > slugB) return 1;

  // 3. Tertiary: id ASCENDING (deterministic code-point comparison)
  const idA = String(a.career?.id || '').trim();
  const idB = String(b.career?.id || '').trim();
  if (idA < idB) return -1;
  if (idA > idB) return 1;

  return 0;
};

/**
 * Ranks a catalogue of careers against a student's normalized interest vector.
 *
 * Deterministic Sorting Specification (docs/architecture.md §7.5 & docs/api-contract.md §5):
 * 1. similarityScore DESCENDING (persisted 6-decimal rounded score)
 * 2. career.slug ASCENDING (deterministic code-point tie-breaker)
 * 3. career.id ASCENDING (stable unique secondary code-point tie-breaker)
 *
 * @param {Record<string, number>} studentScores - Validated student score vector
 * @param {Array<object>} careers - Array of career catalogue records
 * @param {object} [options={}]
 * @param {Record<string, number>} [options.weights=DEFAULT_DIMENSION_WEIGHTS] - Nonnegative dimension weights
 * @param {readonly string[]} [options.dimensions=CANONICAL_DIMENSIONS] - Dimension list
 * @param {string} [options.algorithmVersion=DEFAULT_ALGORITHM_VERSION] - Algorithm version string
 * @param {number} [options.precision=DEFAULT_DECIMAL_PRECISION] - Decimal precision for similarity score
 * @returns {Array<object>} Ranked recommendations with explanation metadata
 */
export const rankCareers = (
  studentScores,
  careers,
  {
    weights = DEFAULT_DIMENSION_WEIGHTS,
    dimensions = CANONICAL_DIMENSIONS,
    algorithmVersion = DEFAULT_ALGORITHM_VERSION,
    precision = DEFAULT_DECIMAL_PRECISION,
  } = {}
) => {
  // Validate student vector
  const validStudent = validateScoreVector(studentScores, {
    dimensions,
    label: 'studentScores',
  });

  // Validate weights
  const validWeights = validateWeights(weights, { dimensions });

  if (!Array.isArray(careers)) {
    throw new TypeError('careers must be an array');
  }

  if (careers.length === 0) {
    return Object.freeze([]);
  }

  // Validate career IDs and check for duplicate identifiers
  const seenIds = new Set();
  const seenSlugs = new Set();

  for (const c of careers) {
    if (!c || typeof c !== 'object') {
      throw new TypeError('Each career entry must be a non-null object');
    }
    if (!c.id || typeof c.id !== 'string') {
      throw new Error('Each career must have a valid string id');
    }
    if (seenIds.has(c.id)) {
      throw new Error(`Duplicate career id detected in input: "${c.id}"`);
    }
    seenIds.add(c.id);

    if (c.slug) {
      const normalizedSlug = String(c.slug).trim().toLowerCase();
      if (seenSlugs.has(normalizedSlug)) {
        throw new Error(`Duplicate career slug detected in input: "${c.slug}"`);
      }
      seenSlugs.add(normalizedSlug);
    }
  }

  // Compute similarity and dimension breakdown for every career
  const scoredItems = careers.map((career) => {
    const careerVector = extractCareerVector(career, dimensions);

    const { similarity, isLowInformation, studentNorm, careerNorm } = weightedCosineSimilarity(
      validStudent,
      careerVector,
      validWeights,
      { dimensions }
    );

    const contributions = calculateDimensionContributions(
      validStudent,
      careerVector,
      validWeights,
      { dimensions }
    );

    // Apply precision rounding if configured (DEC-PRECISION-01)
    let roundedSimilarity = similarity;
    if (typeof precision === 'number' && precision >= 0) {
      roundedSimilarity = Number(similarity.toFixed(precision));
    }

    const { reasons, cautions } = generateMathematicalExplanations(
      contributions,
      isLowInformation,
      roundedSimilarity
    );

    const profileVersion = resolveCareerProfileVersion(career);

    return {
      career: Object.freeze({
        id: career.id,
        slug: career.slug || career.id,
        title: career.title || career.slug || 'Untitled Career',
        description: career.description || null,
        published: career.published ?? true,
      }),
      careerProfileVersion: profileVersion,
      similarityScore: roundedSimilarity,
      rawSimilarity: similarity,
      isLowInformation,
      studentNorm,
      careerNorm,
      dimensionSnapshot: careerVector,
      algorithmWeights: validWeights,
      algorithmVersion,
      dimensionContributions: Object.freeze(contributions),
      reasons: Object.freeze(reasons),
      cautions: Object.freeze(cautions),
    };
  });

  // Sort deterministically using code-point comparator (DEF-LOCALE-01 & DEC-PRECISION-01)
  scoredItems.sort(compareCareerRanks);

  // Assign sequential 1-based ranks
  const rankedResults = scoredItems.map((item, index) => {
    return Object.freeze({
      rank: index + 1,
      ...item,
    });
  });

  return Object.freeze(rankedResults);
};


