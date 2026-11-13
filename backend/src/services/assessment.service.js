import { AppError } from '../utils/app-error.js';
import {
  answerSchema,
  assessmentIdSchema,
  attemptIdSchema,
  formatValidationIssues,
  assessmentListQuerySchema,
  attemptListQuerySchema,
  paginationQuerySchema,
  questionIdSchema,
} from '../validators/assessment.validator.js';

const parse = (schema, payload) => {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Please correct the supplied fields.',
      422,
      formatValidationIssues(result.error)
    );
  }
  return result.data;
};

export class AssessmentService {
  constructor({ assessmentRepository } = {}) {
    if (!assessmentRepository) {
      throw new Error('AssessmentService requires an assessmentRepository dependency');
    }
    this.assessmentRepository = assessmentRepository;
  }

  listAssessments({ user, query }) {
    const parsedQuery = parse(assessmentListQuerySchema, query);
    return this.assessmentRepository.listAssessments({ role: user.role, ...parsedQuery });
  }

  getAssessment({ user, assessmentId }) {
    const { id } = parse(assessmentIdSchema, { id: assessmentId });
    return this.assessmentRepository.getAssessment({ role: user.role, assessmentId: id });
  }

  getQuestions({ user, assessmentId }) {
    const { id } = parse(assessmentIdSchema, { id: assessmentId });
    return this.assessmentRepository.getQuestions({ role: user.role, assessmentId: id });
  }

  startAttempt({ user, assessmentId }) {
    const { id } = parse(assessmentIdSchema, { id: assessmentId });
    return this.assessmentRepository.createAttempt({ studentId: user.id, assessmentId: id });
  }

  listAttempts({ user, query }) {
    const parsedQuery = parse(attemptListQuerySchema, query);
    return this.assessmentRepository.listAttempts({ studentId: user.id, ...parsedQuery });
  }

  getAttempt({ user, attemptId }) {
    const { id } = parse(attemptIdSchema, { id: attemptId });
    return this.assessmentRepository.getAttempt({ studentId: user.id, attemptId: id });
  }

  saveAnswer({ user, attemptId, questionId, body }) {
    const ids = parse(questionIdSchema, { id: attemptId, questionId });
    const { optionId } = parse(answerSchema, body);
    return this.assessmentRepository.saveAnswer({
      studentId: user.id,
      attemptId: ids.id,
      questionId: ids.questionId,
      selectedOptionId: optionId,
    });
  }

  submitAttempt({ user, attemptId }) {
    const { id } = parse(attemptIdSchema, { id: attemptId });
    return this.assessmentRepository.finalizeAttempt({ studentId: user.id, attemptId: id });
  }

  listRecommendations({ user, attemptId, query }) {
    const { id } = parse(attemptIdSchema, { id: attemptId });
    const parsedQuery = parse(paginationQuerySchema, query);
    return this.assessmentRepository.listRecommendations({
      studentId: user.id,
      attemptId: id,
      ...parsedQuery,
    });
  }
}

export const createAssessmentService = (dependencies) => new AssessmentService(dependencies);

