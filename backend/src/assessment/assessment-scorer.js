import { AppError } from '../utils/app-error.js';
import {
  CANONICAL_DIMENSIONS,
  normalizeAssessmentScores,
} from '../matching/index.js';

const OPTION_VALUE_MIN = 0;
const OPTION_VALUE_MAX = 4;

const validationError = (message, details = []) =>
  new AppError('VALIDATION_ERROR', message, 422, details);

const toFiniteWeight = (value, label) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    Array.isArray(value) ||
    (typeof value !== 'number' && typeof value !== 'string' && typeof value?.toString !== 'function')
  ) {
    throw validationError(`${label} must be a finite number`);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw validationError(`${label} must be a finite number`);
  }
  return number;
};

const requireString = (value, label) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw validationError(`${label} must be a non-empty string`);
  }
  return value.trim();
};

const validateOption = (option, questionId, index) => {
  if (!option || typeof option !== 'object' || Array.isArray(option)) {
    throw validationError(`Question "${questionId}" option ${index} must be an object`);
  }

  const id = requireString(option.id, `Question "${questionId}" option ${index} id`);
  const value = option.value;

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < OPTION_VALUE_MIN ||
    value > OPTION_VALUE_MAX
  ) {
    throw validationError(
      `Question "${questionId}" option "${id}" value must be an integer from 0 to 4`
    );
  }

  return Object.freeze({ id, value });
};

export const validateAssessmentQuestion = (question, index = 0) => {
  if (!question || typeof question !== 'object' || Array.isArray(question)) {
    throw validationError(`Question ${index} must be an object`);
  }

  const id = requireString(question.id, `Question ${index} id`);
  const dimension = requireString(question.dimension, `Question "${id}" dimension`);

  if (!CANONICAL_DIMENSIONS.includes(dimension)) {
    throw validationError(`Question "${id}" uses an unsupported dimension "${dimension}"`);
  }

  const weight = toFiniteWeight(question.weight, `Question "${id}" weight`);
  if (weight <= 0) {
    throw validationError(`Question "${id}" weight must be greater than zero`);
  }

  if (!Array.isArray(question.options) || question.options.length < 2) {
    throw validationError(`Question "${id}" must define at least two options`);
  }

  const optionIds = new Set();
  const options = question.options.map((option, optionIndex) => {
    const validated = validateOption(option, id, optionIndex);
    if (optionIds.has(validated.id)) {
      throw validationError(`Question "${id}" contains duplicate option "${validated.id}"`);
    }
    optionIds.add(validated.id);
    return validated;
  });

  return Object.freeze({
    id,
    dimension,
    weight,
    options: Object.freeze(options),
  });
};

export const validateAssessmentQuestions = (questions) => {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw validationError('Assessment must contain at least one question');
  }

  const questionIds = new Set();
  const validatedQuestions = questions.map((question, index) => {
    const validated = validateAssessmentQuestion(question, index);
    if (questionIds.has(validated.id)) {
      throw validationError(`Assessment contains duplicate question "${validated.id}"`);
    }
    questionIds.add(validated.id);
    return validated;
  });

  const missingDimensions = CANONICAL_DIMENSIONS.filter(
    (dimension) => !validatedQuestions.some((question) => question.dimension === dimension)
  );
  if (missingDimensions.length > 0) {
    throw validationError(
      `Assessment must contain at least one question for every dimension: ${missingDimensions.join(', ')}`
    );
  }

  return Object.freeze(validatedQuestions);
};

export const validateSubmittedAnswers = (questions, answers) => {
  if (!Array.isArray(answers)) {
    throw validationError('answers must be an array');
  }

  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const submittedQuestionIds = new Set();

  const resolvedAnswers = answers.map((answer, index) => {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
      throw validationError(`Answer ${index} must be an object`);
    }

    const questionId = requireString(answer.questionId, `Answer ${index} questionId`);
    const selectedOptionId = requireString(
      answer.selectedOptionId,
      `Answer ${index} selectedOptionId`
    );

    if (submittedQuestionIds.has(questionId)) {
      throw validationError(`Duplicate answer for question "${questionId}"`);
    }
    submittedQuestionIds.add(questionId);

    const question = questionsById.get(questionId);
    if (!question) {
      throw validationError(`Answer references unknown question "${questionId}"`);
    }

    const option = question.options.find(({ id }) => id === selectedOptionId);
    if (!option) {
      throw validationError(
        `Option "${selectedOptionId}" is not valid for question "${questionId}"`
      );
    }

    return Object.freeze({
      questionId,
      selectedOptionId,
      score: option.value,
      dimension: question.dimension,
      weight: question.weight,
    });
  });

  if (resolvedAnswers.length !== questions.length) {
    const missingQuestionIds = questions
      .filter(({ id }) => !submittedQuestionIds.has(id))
      .map(({ id }) => id);
    throw validationError('All assessment questions must be answered', [
      { field: 'answers', issue: `Missing questions: ${missingQuestionIds.join(', ')}` },
    ]);
  }

  return Object.freeze(resolvedAnswers);
};

export const scoreAssessment = ({ questions, answers } = {}) => {
  const validatedQuestions = validateAssessmentQuestions(questions);
  const resolvedAnswers = validateSubmittedAnswers(validatedQuestions, answers);

  const rawScores = Object.fromEntries(CANONICAL_DIMENSIONS.map((dimension) => [dimension, 0]));
  const maxScores = Object.fromEntries(CANONICAL_DIMENSIONS.map((dimension) => [dimension, 0]));

  for (const answer of resolvedAnswers) {
    rawScores[answer.dimension] += answer.score * answer.weight;
    maxScores[answer.dimension] += OPTION_VALUE_MAX * answer.weight;
  }

  const normalizedScores = normalizeAssessmentScores(rawScores, maxScores);

  return Object.freeze({
    scores: normalizedScores,
    rawScores: Object.freeze(rawScores),
    maxScores: Object.freeze(maxScores),
    answers: resolvedAnswers,
  });
};

