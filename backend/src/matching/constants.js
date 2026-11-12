/**
 * ============================================================================
 * CareerCompass — Mathematical Matching Constants & Domain Definitions
 * ============================================================================
 * Aligned with docs/architecture.md §7, docs/api-contract.md §5 & §6,
 * and docs/data-model.md §2.6 & §2.10.
 *
 * Immutable, frozen constants defining:
 * 1. Fixed product interest dimensions (6 canonical dimensions)
 * 2. Immutable default dimension weights (1.0 for unit cosine matching)
 * 3. Default algorithm version identifier
 * ============================================================================
 */

/**
 * The 6 canonical interest dimensions defined by CareerCompass architecture.
 * Fixed dimension order must be preserved across assessments, vectors, and matching.
 */
export const CANONICAL_DIMENSIONS = Object.freeze([
  'ANALYTICAL',
  'CREATIVE',
  'SOCIAL',
  'PRACTICAL',
  'ORGANIZATIONAL',
  'INVESTIGATIVE',
]);

/**
 * Immutable default algorithm version identifier.
 * 'cosine-v1' strictly defines immutable unit weights (w_d = 1.0) across all 6 dimensions.
 */
export const DEFAULT_ALGORITHM_VERSION = 'cosine-v1';

/**
 * Immutable unit weights (1.0 per dimension) for standard weighted cosine similarity.
 */
export const DEFAULT_DIMENSION_WEIGHTS = Object.freeze(
  Object.fromEntries(CANONICAL_DIMENSIONS.map((dim) => [dim, 1.0]))
);

/**
 * Score bounds for normalized dimension vectors.
 */
export const MIN_NORMALIZED_SCORE = 0.0;
export const MAX_NORMALIZED_SCORE = 1.0;

/**
 * Numerical tolerances and precision clamping.
 */
export const EPSILON = 1e-9;
export const DEFAULT_DECIMAL_PRECISION = 6;

/**
 * Explanation heuristic thresholds (DEC-EXPLANATION-HEURISTICS-01).
 *
 * NOTE: These thresholds are heuristic guidance defaults for narrative explanations
 * derived strictly from vector geometry, NOT scientifically validated psychometric cutoffs
 * or guarantees of career suitability/success probability.
 */
export const EXPLANATION_THRESHOLDS = Object.freeze({
  // Minimum absolute contribution required to cite a dimension as an expressed strength
  MIN_STRENGTH_CONTRIBUTION: 0.05,
  // Minimum student score required to cite a dimension as a student strength
  MIN_STUDENT_STRENGTH_SCORE: 0.5,
  // Career dimension score threshold considered high professional demand
  HIGH_CAREER_DEMAND_THRESHOLD: 0.6,
  // Student score threshold below which high career demand warrants a discrepancy caution
  LOW_STUDENT_EXPRESSION_THRESHOLD: 0.3,
  // Variance threshold below which a profile is considered uniformly balanced
  BALANCED_PROFILE_VARIANCE_EPSILON: 1e-6,
});


