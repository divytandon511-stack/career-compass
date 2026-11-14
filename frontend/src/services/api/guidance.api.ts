import { apiClient } from './client';
import { PaginationParams } from '@/types/api';

export interface GuidanceMessage {
  role: 'user' | 'assistant';
  text: string;
  groundingCareerIds?: string[];
  createdAt?: string;
}

export interface GuidanceSession {
  sessionId: string;
  attemptId: string;
  careerIds: string[];
  messages: GuidanceMessage[];
  model?: string;
  consentVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageResponse {
  sessionId: string;
  message: {
    text: string;
    groundingCareerIds: string[];
    createdAt: string;
  };
}

export const guidanceApi = {
  /**
   * Lists past guidance sessions for the student.
   * GET /api/v1/guidance/sessions
   */
  async listSessions(params: PaginationParams = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<GuidanceSession[]>(`/guidance/sessions${qs}`);
  },

  /**
   * Initiates a new grounded AI guidance session with an attempt and selected careers.
   * POST /api/v1/guidance/sessions
   */
  async createSession(attemptId: string, careerIds: string[]) {
    return apiClient<GuidanceSession>('/guidance/sessions', {
      method: 'POST',
      body: JSON.stringify({ attemptId, careerIds }),
    });
  },

  /**
   * Retrieves single guidance session with full chat history.
   * GET /api/v1/guidance/sessions/:id
   */
  async getSession(sessionId: string) {
    return apiClient<GuidanceSession>(`/guidance/sessions/${sessionId}`);
  },

  /**
   * Sends a student question to MargDarshak AI grounded in assessment and career context.
   * POST /api/v1/guidance/sessions/:id/messages
   */
  async sendMessage(sessionId: string, message: string) {
    return apiClient<SendMessageResponse>(`/guidance/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  /**
   * Deletes a guidance session.
   * DELETE /api/v1/guidance/sessions/:id
   */
  async deleteSession(sessionId: string) {
    return apiClient(`/guidance/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },
};
