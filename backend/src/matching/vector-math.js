/**
 * ============================================================================
 * CareerCompass — Pure Mathematical Vector Operations
 * ============================================================================
 * Aligned with docs/architecture.md §7, docs/api-contract.md §5,
 * and docs/data-model.md §2.6, §2.7 & §2.13.
 *
 * Requirements:
 * - Pure mathematical functions (deterministic, no mutable state, no I/O)
 * - Strict finite number and bounds validation
 * - Missing dimensions are rejected, NEVER silently converted to zero
 * - Explicit handling of zero vectors, zero weights, and zero denominators
 * - Floating point clamping to [0.0, 1.0]
 * ============================================================================
 */

import {
  CANONICAL_DIMENSIONS,
  DEFAULT_DIMENSION_WEIGHTS,
  MIN_NORMALIZED_SCORE,
  MAX_NORMALIZED_SCORE,
  EPSILON,
} from './constants.js';

/**
 * Validates that an input vector contains finite, nonnegative numbers within bounds [0.0, 1.0]
 * across all expected dimensions.
 *
 * Policy:
 * Incomplete score vectors with missing dimensions are rejected immediately with an explicit
 * error rather than silently defaulting missing dimensions to zero.
 *
 * @param {Record<string, unknown>} vector - Candidate vector object
 * @param {object} [options={}]
 * @param {readonly string[]} [options.dimensions=CANONICAL_DIMENSIONS] - Expected dimension names
 * @param {boolean} [options.requireAll=true] - Whether every dimension in dimensions must be present
 * @param {string} [options.label='vector'] - Context label for error messages
 * @returns {Record<string, number>} Validated defensive copy of the vector
 */
export const validateScoreVector = (
  vector,
  { dimensions = CANONICAL_DIMENSIONS, requireAll = true, label = 'vector' } = {}
) => {
  if (!vector || typeof vector !== 'object' || Array.isArray(vector)) {
    throw new TypeError(`${label} must be a non-null object`);
  }

  const validated = {};

  for (const dim of dimensions) {
    if (!(dim in vector)) {
      if (requireAll) {
        throw new Error(`Missing required dimension "${dim}" in ${label}`);
      }
      continue;
    }

    const value = vector[dim];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(
        `${label} dimension "${dim}" must be a finite number, received: ${String(value)}`
      );
    }

    if (value < MIN_NORMALIZED_SCORE || value > MAX_NORMALIZED_SCORE) {
      throw new RangeError(
        `${label} dimension "${dim}" (${value}) must be within normalized range [${MIN_NORMALIZED_SCORE}, ${MAX_NORMALIZED_SCORE}]`
      );
    }

    validated[dim] = value;
  }

  return Object.freeze(validated);
};

/**
 * Validates dimension weights for weighted cosine similarity.
 *
 * Policy:
 * Weights must be finite numbers >= 0. Negative, NaN, or non-finite weights are rejected.
 *
 * @param {Record<string, unknown>} [weights=DEFAULT_DIMENSION_WEIGHTS] - Weight dictionary
 * @param {object} [options={}]
 * @param {readonly string[]} [options.dimensions=CANONICAL_DIMENSIONS] - Target dimensions
 * @returns {Record<string, number>} Validated immutable copy of weights
 */
export const validateWeights = (
  weights = DEFAULT_DIMENSION_WEIGHTS,
  { dimensions = CANONICAL_DIMENSIONS } = {}
) => {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    throw new TypeError('weights must be a non-null object');
  }

  const validated = {};

  for (const dim of dimensions) {
    const rawWeight = dim in weights ? weights[dim] : 1.0;

    if (typeof rawWeight !== 'number' || !Number.isFinite(rawWeight)) {
      throw new TypeError(
        `Weight for dimension "${dim}" must be a finite number, received: ${String(rawWeight)}`
      );
    }

    if (rawWeight < 0) {
      throw new RangeError(
        `Weight for dimension "${dim}" must be non-negative (>= 0), received: ${rawWeight}`
      );
    }

    validated[dim] = rawWeight;
  }

  return Object.freeze(validated);
};

/**
 * Normalizes raw assessment scores to [0.0, 1.0] per dimension.
 *
 * Mathematical Formula:
 * student_d = raw_d / max_d
 *
 * Policy (docs/architecture.md §7.2):
 * "For each dimension d, compute raw_d = Σ(answerValue_q × weight_q) and max_d = Σ(4 × weight_q)
 * for answered required questions. Normalize student_d = raw_d / max_d, in [0,1].
 * Reject incomplete required submissions instead of silently altering denominators."
 *
 * @param {Record<string, number>} rawScores - Raw dimension score sums
 * @param {Record<string, number>} maxScores - Maximum possible dimension score sums
 * @param {object} [options={}]
 * @param {readonly string[]} [options.dimensions=CANONICAL_DIMENSIONS]
 * @returns {Record<string, number>} Normalized score vector in [0.0, 1.0]
 */
export const normalizeAssessmentScores = (
  rawScores,
  maxScores,
  { dimensions = CANONICAL_DIMENSIONS } = {}
) => {
  if (!rawScores || typeof rawScores !== 'object' || Array.isArray(rawScores)) {
    throw new TypeError('rawScores must be a non-null object');
  }
  if (!maxScores || typeof maxScores !== 'object' || Array.isArray(maxScores)) {
    throw new TypeError('maxScores must be a non-null object');
  }

  const normalized = {};

  for (const dim of dimensions) {
    if (!(dim in rawScores)) {
      throw new Error(`Missing raw score for required dimension "${dim}"`);
    }
    if (!(dim in maxScores)) {
      throw new Error(`Missing max score for required dimension "${dim}"`);
    }

    const raw = rawScores[dim];
    const max = maxScores[dim];

    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
      throw new TypeError(`Raw score for dimension "${dim}" must be a finite number >= 0`);
    }
    if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0) {
      throw new RangeError(
        `Max score for dimension "${dim}" must be a finite number > 0, received: ${max}`
      );
    }
    if (raw > max + EPSILON) {
      throw new RangeError(
        `Raw score for dimension "${dim}" (${raw}) cannot exceed maximum possible score (${max})`
      );
    }

    const score = Math.max(0.0, Math.min(1.0, raw / max));
    normalized[dim] = score;
  }

  return Object.freeze(normalized);
};

/**
 * Computes the weighted inner (dot) product of two vectors:
 * sum_i (w_i * a_i * b_i)
 *
 * @param {Record<string, number>} vectorA
 * @param {Record<string, number>} vectorB
 * @param {Record<string, number>} weights
 * @param {readonly string[]} [dimensions=CANONICAL_DIMENSIONS]
 * @returns {number}
 */
export const weightedDotProduct = (
  vectorA,
  vectorB,
  weights,
  dimensions = CANONICAL_DIMENSIONS
) => {
  let sum = 0.0;
  for (const dim of dimensions) {
    const w = weights[dim];
    const a = vectorA[dim];
    const b = vectorB[dim];
    sum += w * a * b;
  }
  return sum;
};

/**
 * Computes the weighted Euclidean (L2) norm of a vector:
 * sqrt(sum_i (w_i * v_i^2))
 *
 * @param {Record<string, number>} vector
 * @param {Record<string, number>} weights
 * @param {readonly string[]} [dimensions=CANONICAL_DIMENSIONS]
 * @returns {number} Nonnegative L2 norm
 */
export const weightedNorm = (
  vector,
  weights,
  dimensions = CANONICAL_DIMENSIONS
) => {
  let sumSquares = 0.0;
  for (const dim of dimensions) {
    const w = weights[dim];
    const v = vector[dim];
    sumSquares += w * v * v;
  }
  return Math.sqrt(sumSquares);
};

/**
 * Computes the weighted cosine similarity between a student score vector and a career target vector.
 *
 * Mathematical Formulation:
 * similarity = sum(w_i × s_i × c_i) / [sqrt(sum(w_i × s_i²)) × sqrt(sum(w_i × c_i²))]
 *
 * Policy on Zero Vectors & Zero Denominators (docs/architecture.md §7.4):
 * "If either norm is zero, return score 0 and mark low-information assessment; never divide by zero."
 *
 * Clamping Policy:
 * Floating-point inaccuracies (e.g. 1.0000000000000002) are clamped strictly to [0.0, 1.0].
 *
 * @param {Record<string, number>} studentVector - Normalized student scores
 * @param {Record<string, number>} careerVector - Normalized career target attributes
 * @param {Record<string, number>} [weights=DEFAULT_DIMENSION_WEIGHTS] - Nonnegative dimension weights
 * @param {object} [options={}]
 * @param {readonly string[]} [options.dimensions=CANONICAL_DIMENSIONS] - Fixed dimension order
 * @returns {{ similarity: number, isLowInformation: boolean, studentNorm: number, careerNorm: number }}
 */
export const weightedCosineSimilarity = (
  studentVector,
  careerVector,
  weights = DEFAULT_DIMENSION_WEIGHTS,
  { dimensions = CANONICAL_DIMENSIONS } = {}
) => {
  const validStudent = validateScoreVector(studentVector, { dimensions, label: 'studentVector' });
  const validCareer = validateScoreVector(careerVector, { dimensions, label: 'careerVector' });
  const validWeights = validateWeights(weights, { dimensions });

  const dot = weightedDotProduct(validStudent, validCareer, validWeights, dimensions);
  const studentNorm = weightedNorm(validStudent, validWeights, dimensions);
  const careerNorm = weightedNorm(validCareer, validWeights, dimensions);

  const denominator = studentNorm * careerNorm;

  // Zero-norm policy: if either norm is zero (or effectively zero), similarity is 0.0
  if (denominator <= EPSILON || studentNorm <= EPSILON || careerNorm <= EPSILON) {
    return {
      similarity: 0.0,
      isLowInformation: true,
      studentNorm,
      careerNorm,
    };
  }

  const rawSimilarity = dot / denominator;
  // Clamp strictly to [0.0, 1.0] to guard against floating-point epsilon overshoot
  const similarity = Math.max(0.0, Math.min(1.0, rawSimilarity));

  return {
    similarity,
    isLowInformation: false,
    studentNorm,
    careerNorm,
  };
};

/**
 * Decomposes weighted cosine similarity into explainable, additive per-dimension contributions.
 *
 * Mathematical Property:
 * contribution_i = (w_i × s_i × c_i) / (||s||_w × ||c||_w)
 * Notice: sum_i (contribution_i) === total similarity score!
 *
 * @param {Record<string, number>} studentVector
 * @param {Record<string, number>} careerVector
 * @param {Record<string, number>} [weights=DEFAULT_DIMENSION_WEIGHTS]
 * @param {object} [options={}]
 * @param {readonly string[]} [options.dimensions=CANONICAL_DIMENSIONS]
 * @returns {Array<{ dimension: string, studentScore: number, careerScore: number, weight: number, absoluteContribution: number, relativeContribution: number, discrepancy: number }>}
 */
export const calculateDimensionContributions = (
  studentVector,
  careerVector,
  weights = DEFAULT_DIMENSION_WEIGHTS,
  { dimensions = CANONICAL_DIMENSIONS } = {}
) => {
  const validStudent = validateScoreVector(studentVector, { dimensions, label: 'studentVector' });
  const validCareer = validateScoreVector(careerVector, { dimensions, label: 'careerVector' });
  const validWeights = validateWeights(weights, { dimensions });

  const studentNorm = weightedNorm(validStudent, validWeights, dimensions);
  const careerNorm = weightedNorm(validCareer, validWeights, dimensions);
  const denominator = studentNorm * careerNorm;

  const { similarity } = weightedCosineSimilarity(validStudent, validCareer, validWeights, {
    dimensions,
  });

  return dimensions.map((dim) => {
    const s_i = validStudent[dim];
    const c_i = validCareer[dim];
    const w_i = validWeights[dim];

    let absoluteContribution = 0.0;
    if (denominator > EPSILON) {
      absoluteContribution = (w_i * s_i * c_i) / denominator;
      // Clamp to [0, 1]
      absoluteContribution = Math.max(0.0, Math.min(1.0, absoluteContribution));
    }

    const relativeContribution =
      similarity > EPSILON ? absoluteContribution / similarity : 0.0;

    const discrepancy = Math.abs(s_i - c_i);

    return Object.freeze({
      dimension: dim,
      studentScore: s_i,
      careerScore: c_i,
      weight: w_i,
      absoluteContribution,
      relativeContribution,
      discrepancy,
    });
  });
};

