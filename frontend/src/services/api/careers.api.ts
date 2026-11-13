import { apiClient } from './client';
import { Career } from '@/types/models';

export const careersApi = {
  async listCareers(params: { page?: number; limit?: number; q?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.q) query.set('q', params.q);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiClient<Career[]>(`/careers${queryString}`, { requiresAuth: false });
  },

  async getCareer(idOrSlug: string) {
    return apiClient<Career>(`/careers/${idOrSlug}`, { requiresAuth: false });
  },

  async getSavedCareers() {
    return apiClient<Career[]>('/users/me/saved-careers');
  },

  async saveCareer(careerId: string) {
    return apiClient(`/users/me/saved-careers/${careerId}`, { method: 'PUT' });
  },

  async removeSavedCareer(careerId: string) {
    return apiClient(`/users/me/saved-careers/${careerId}`, { method: 'DELETE' });
  },
};
