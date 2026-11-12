/**
 * ============================================================================
 * CareerCompass — Mathematical Matching Engine Public Interface
 * ============================================================================
 */

export {
  CANONICAL_DIMENSIONS,
  DEFAULT_ALGORITHM_VERSION,
  DEFAULT_DIMENSION_WEIGHTS,
  MIN_NORMALIZED_SCORE,
  MAX_NORMALIZED_SCORE,
  EPSILON,
  DEFAULT_DECIMAL_PRECISION,
  EXPLANATION_THRESHOLDS,
} from './constants.js';

export {
  validateScoreVector,
  validateWeights,
  normalizeAssessmentScores,
  weightedDotProduct,
  weightedNorm,
  weightedCosineSimilarity,
  calculateDimensionContributions,
} from './vector-math.js';

export {
  extractCareerVector,
  generateMathematicalExplanations,
  compareCareerRanks,
  rankCareers,
} from './career-matcher.js';

