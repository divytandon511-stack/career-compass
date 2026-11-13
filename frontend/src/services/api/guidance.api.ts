import { apiClient } from './client';

export interface GuidanceSession {
  sessionId: string;
  studentId: string;
  attemptId?: string;
  careerIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GuidanceMessage {
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  groundingCareerIds?: string[];
}

export const guidanceApi = {
  async listSessions() {
    return apiClient<GuidanceSession[]>('/guidance/sessions');
  },

  async createSession(attemptId?: string, careerIds?: string[]) {
    return apiClient<GuidanceSession>('/guidance/sessions', {
      method: 'POST',
      body: JSON.stringify({ attemptId, careerIds }),
    });
  },

  async getSession(sessionId: string) {
    return apiClient<{ session: GuidanceSession; messages: GuidanceMessage[] }>(
      `/guidance/sessions/${sessionId}`
    );
  },

  async sendMessage(sessionId: string, message: string) {
    return apiClient<GuidanceMessage>(`/guidance/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async deleteSession(sessionId: string) {
    return apiClient(`/guidance/sessions/${sessionId}`, { method: 'DELETE' });
  },
};
