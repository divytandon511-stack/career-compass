/**
 * Product-defined interest dimensions for CareerCompass (NEP 2020 alignment).
 * These represent self-reported interest preferences, not psychological/psychometric certification.
 */
export type Dimension =
  | 'ANALYTICAL'
  | 'CREATIVE'
  | 'SOCIAL'
  | 'PRACTICAL'
  | 'ORGANIZATIONAL'
  | 'INVESTIGATIVE';

export const DIMENSIONS: readonly Dimension[] = [
  'ANALYTICAL',
  'CREATIVE',
  'SOCIAL',
  'PRACTICAL',
  'ORGANIZATIONAL',
  'INVESTIGATIVE',
] as const;

export interface DimensionScore {
  dimension: Dimension;
  rawScore: number;
  maxScore: number;
  normalizedScore: number; // 0.0 - 1.0
  percentage: number;      // 0 - 100
}
