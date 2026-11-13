import { apiClient } from './client';
import {
  Assessment,
  AssessmentAttempt,
  AssessmentQuestionsResponse,
  Recommendation,
  SaveAnswerResponse,
  StartAttemptResponse,
  SubmitAttemptResponse,
} from '@/types/models';
import { PaginationParams } from '@/types/api';

export interface ListAttemptsParams extends PaginationParams {
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
}

export interface ListAssessmentsParams extends PaginationParams {
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export const assessmentApi = {
  /**
   * Fetches published assessments available to students (or all for admin).
   * GET /api/v1/assessments
   */
  async listAssessments(params: ListAssessmentsParams = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<Assessment[]>(`/assessments${qs}`);
  },

  /**
   * Fetches assessment metadata by ID.
   * GET /api/v1/assessments/:id
   */
  async getAssessment(id: string) {
    return apiClient<Assessment>(`/assessments/${id}`);
  },

  /**
   * Starts a new attempt or resumes an existing IN_PROGRESS attempt.
   * POST /api/v1/assessments/:assessmentId/attempts
   */
  async startAttempt(assessmentId: string) {
    return apiClient<StartAttemptResponse>(`/assessments/${assessmentId}/attempts`, {
      method: 'POST',
    });
  },

  /**
   * Fetches questions for an assessment without exposing weights or scoring values.
   * GET /api/v1/assessments/:assessmentId/questions
   */
  async getQuestions(assessmentId: string) {
    return apiClient<AssessmentQuestionsResponse>(`/assessments/${assessmentId}/questions`);
  },

  /**
   * Saves or updates a student's answer for a specific question.
   * PUT /api/v1/attempts/:attemptId/answers/:questionId
   */
  async saveAnswer(attemptId: string, questionId: string, optionId: string) {
    return apiClient<SaveAnswerResponse>(`/attempts/${attemptId}/answers/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify({ optionId }),
    });
  },

  /**
   * Finalizes the attempt, computes scores, and generates career recommendations.
   * POST /api/v1/attempts/:attemptId/submit
   */
  async submitAttempt(attemptId: string) {
    return apiClient<SubmitAttemptResponse>(`/attempts/${attemptId}/submit`, {
      method: 'POST',
    });
  },

  /**
   * Lists attempts for the authenticated student.
   * GET /api/v1/attempts
   */
  async listAttempts(params: ListAttemptsParams = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<AssessmentAttempt[]>(`/attempts${qs}`);
  },

  /**
   * Fetches full attempt details including previous answers and dimension scores.
   * GET /api/v1/attempts/:attemptId
   */
  async getAttempt(attemptId: string) {
    return apiClient<AssessmentAttempt>(`/attempts/${attemptId}`);
  },

  /**
   * Fetches ranked career recommendations generated for a completed attempt.
   * GET /api/v1/attempts/:attemptId/recommendations
   */
  async getRecommendations(attemptId: string, page = 1, limit = 20) {
    return apiClient<Recommendation[]>(`/attempts/${attemptId}/recommendations?page=${page}&limit=${limit}`);
  },
};
