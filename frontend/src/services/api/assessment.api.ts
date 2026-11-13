import { apiClient } from './client';
import { AssessmentAttempt, Recommendation } from '@/types/models';

export const assessmentApi = {
  async listAssessments() {
    return apiClient<Array<{ id: string; title: string; version: string }>>('/assessments');
  },

  async startAttempt(assessmentId: string) {
    return apiClient<AssessmentAttempt>(`/assessments/${assessmentId}/attempts`, {
      method: 'POST',
    });
  },

  async getQuestions(assessmentId: string) {
    return apiClient<Array<{ id: string; prompt: string; dimension: string; options: Array<{ optionId: string; text: string }> }>>(
      `/assessments/${assessmentId}/questions`
    );
  },

  async saveAnswer(attemptId: string, questionId: string, optionId: string) {
    return apiClient(`/attempts/${attemptId}/answers/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify({ optionId }),
    });
  },

  async submitAttempt(attemptId: string) {
    return apiClient<{ attemptId: string; status: string; dimensionScores: Record<string, number> }>(
      `/attempts/${attemptId}/submit`,
      { method: 'POST' }
    );
  },

  async getAttempt(attemptId: string) {
    return apiClient<AssessmentAttempt>(`/attempts/${attemptId}`);
  },

  async getRecommendations(attemptId: string, page = 1, limit = 20) {
    return apiClient<Recommendation[]>(`/attempts/${attemptId}/recommendations?page=${page}&limit=${limit}`);
  },
};
