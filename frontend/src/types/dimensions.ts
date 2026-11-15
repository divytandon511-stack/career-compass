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

export const CANONICAL_DIMENSIONS = DIMENSIONS;

export interface DimensionConfig {
  label: string;
  color: string;
  description: string;
}

export const DIMENSION_DETAILS: Record<Dimension, DimensionConfig> = {
  ANALYTICAL: {
    label: 'Analytical',
    color: '#6366f1',
    description: 'Systematic reasoning, quantitative problem solving, and logical analysis.',
  },
  CREATIVE: {
    label: 'Creative',
    color: '#ec4899',
    description: 'Artistic expression, design innovation, storytelling, and novel ideation.',
  },
  SOCIAL: {
    label: 'Social',
    color: '#10b981',
    description: 'Interpersonal collaboration, teaching, empathy, and community empowerment.',
  },
  PRACTICAL: {
    label: 'Practical',
    color: '#f59e0b',
    description: 'Hands-on execution, physical crafts, tools, engineering, and tangible results.',
  },
  ORGANIZATIONAL: {
    label: 'Organizational',
    color: '#06b6d4',
    description: 'Project coordination, operational planning, data management, and structured systems.',
  },
  INVESTIGATIVE: {
    label: 'Investigative',
    color: '#8b5cf6',
    description: 'Scientific inquiry, empirical research, hypothesis testing, and deep domain curiosity.',
  },
};

export interface DimensionScore {
  dimension: Dimension;
  rawScore: number;
  maxScore: number;
  normalizedScore: number; // 0.0 - 1.0
  percentage: number;      // 0 - 100
}
