import { describe, expect, it } from 'vitest';

import {
  CANONICAL_DIMENSIONS,
  scoreAssessment,
  validateAssessmentQuestions,
  validateSubmittedAnswers,
} from '../src/assessment/index.js';

const makeQuestions = () =>
  CANONICAL_DIMENSIONS.map((dimension, index) => ({
    id: `question-${index}`,
    dimension,
    weight: index + 1,
    options: [
      { id: `question-${index}-low`, label: 'Low', value: 0 },
      { id: `question-${index}-high`, label: 'High', value: 4 },
    ],
  }));

describe('Assessment scoring', () => {
  it('calculates weighted raw, maximum, and normalized dimension scores', () => {
    const questions = makeQuestions();
    const result = scoreAssessment({
      questions,
      answers: questions.map((question, index) => ({
        questionId: question.id,
        selectedOptionId: index % 2 === 0 ? `${question.id}-high` : `${question.id}-low`,
      })),
    });

    expect(result.rawScores).toEqual({
      ANALYTICAL: 4,
      CREATIVE: 0,
      SOCIAL: 12,
      PRACTICAL: 0,
      ORGANIZATIONAL: 20,
      INVESTIGATIVE: 0,
    });
    expect(result.maxScores).toEqual({
      ANALYTICAL: 4,
      CREATIVE: 8,
      SOCIAL: 12,
      PRACTICAL: 16,
      ORGANIZATIONAL: 20,
      INVESTIGATIVE: 24,
    });
    expect(result.scores).toEqual({
      ANALYTICAL: 1,
      CREATIVE: 0,
      SOCIAL: 1,
      PRACTICAL: 0,
      ORGANIZATIONAL: 1,
      INVESTIGATIVE: 0,
    });
  });

  it('accepts Decimal-like weights and all-zero valid answers', () => {
    const questions = makeQuestions().map((question) => ({
      ...question,
      weight: { toString: () => String(question.weight) },
    }));

    const result = scoreAssessment({
      questions,
      answers: questions.map((question) => ({
        questionId: question.id,
        selectedOptionId: `${question.id}-low`,
      })),
    });

    expect(result.scores).toEqual(Object.fromEntries(CANONICAL_DIMENSIONS.map((d) => [d, 0])));
  });

  it('rejects invalid questions, weights, option values, and missing dimensions', () => {
    expect(() => validateAssessmentQuestions([])).toThrow(/at least one question/);
    expect(() =>
      validateAssessmentQuestions(makeQuestions().map((question) => ({
        ...question,
        weight: 0,
      })))
    ).toThrow(/weight must be greater than zero/);
    expect(() =>
      validateAssessmentQuestions(makeQuestions().map((question) => ({
        ...question,
        options: [
          { id: 'one', value: 0 },
          { id: 'two', value: 5 },
        ],
      })))
    ).toThrow(/integer from 0 to 4/);
    expect(() =>
      validateAssessmentQuestions(makeQuestions().map((question) => ({
        ...question,
        options: [
          { id: 'one', value: 0 },
          { id: 'two', value: '4' },
        ],
      })))
    ).toThrow(/integer from 0 to 4/);
    expect(() =>
      validateAssessmentQuestions(makeQuestions().slice(0, 5))
    ).toThrow(/every dimension/);
  });

  it('rejects unknown, duplicate, and incomplete answers', () => {
    const questions = validateAssessmentQuestions(makeQuestions());

    expect(() =>
      validateSubmittedAnswers(questions, [
        { questionId: 'unknown', selectedOptionId: 'option' },
        ...questions.slice(1).map((question) => ({
          questionId: question.id,
          selectedOptionId: `${question.id}-low`,
        })),
      ])
    ).toThrow(/unknown question/);

    expect(() =>
      validateSubmittedAnswers(questions, [
        { questionId: questions[0].id, selectedOptionId: `${questions[0].id}-low` },
        { questionId: questions[0].id, selectedOptionId: `${questions[0].id}-high` },
        ...questions.slice(1).map((question) => ({
          questionId: question.id,
          selectedOptionId: `${question.id}-low`,
        })),
      ])
    ).toThrow(/Duplicate answer/);

    expect(() =>
      validateSubmittedAnswers(questions, questions.slice(0, 5).map((question) => ({
        questionId: question.id,
        selectedOptionId: `${question.id}-low`,
      })))
    ).toThrow(/All assessment questions/);
  });

  it('never trusts a client-provided numeric score', () => {
    const questions = validateAssessmentQuestions(makeQuestions());
    const answers = questions.map((question) => ({
      questionId: question.id,
      selectedOptionId: `${question.id}-low`,
      score: 4,
    }));

    const result = scoreAssessment({ questions, answers });
    expect(result.scores).toEqual(Object.fromEntries(CANONICAL_DIMENSIONS.map((d) => [d, 0])));
    expect(result.answers.every((answer) => answer.score === 0)).toBe(true);
  });
});

