import { apiClient } from './client';
import { UserProfile } from '@/types/models';

export interface UpdateProfilePayload {
  displayName?: string;
  schoolGrade?: string;
}

export const userApi = {
  /**
   * Fetches the full profile for the authenticated user (student or staff).
   * GET /api/v1/users/me
   */
  async getProfile() {
    return apiClient<UserProfile>('/users/me');
  },

  /**
   * Updates display name or school grade (grade is student-only).
   * PATCH /api/v1/users/me
   */
  async updateProfile(payload: UpdateProfilePayload) {
    return apiClient<UserProfile>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
