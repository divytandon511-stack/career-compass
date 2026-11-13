import { apiClient } from './client';
import { Career, SavedCareer } from '@/types/models';
import { PaginationParams } from '@/types/api';

export const careersApi = {
  async listCareers(params: PaginationParams & { q?: string; skillId?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.q) query.set('q', params.q);
    if (params.skillId) query.set('skillId', params.skillId);
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiClient<Career[]>(`/careers${queryString}`, { requiresAuth: false });
  },

  async getCareer(idOrSlug: string) {
    return apiClient<Career>(`/careers/${idOrSlug}`, { requiresAuth: false });
  },

  async getSavedCareers(params: PaginationParams = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiClient<SavedCareer[]>(`/users/me/saved-careers${queryString}`);
  },

  async saveCareer(careerId: string) {
    return apiClient(`/users/me/saved-careers/${careerId}`, { method: 'PUT' });
  },

  async removeSavedCareer(careerId: string) {
    return apiClient(`/users/me/saved-careers/${careerId}`, { method: 'DELETE' });
  },
};
