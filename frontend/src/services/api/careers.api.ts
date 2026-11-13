import { apiClient } from './client';
import { Career, EducationPathway, SavedCareer, Skill } from '@/types/models';
import { PaginationParams } from '@/types/api';

export const careersApi = {
  /**
   * Public directory listing with keyword search and skill filter.
   * GET /api/v1/careers
   */
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

  /**
   * Retrieves full career blueprint by UUID or URL slug.
   * GET /api/v1/careers/:idOrSlug
   */
  async getCareer(idOrSlug: string) {
    return apiClient<Career>(`/careers/${idOrSlug}`, { requiresAuth: false });
  },

  /**
   * Retrieves educational pathways for a career.
   * GET /api/v1/careers/:idOrSlug/pathways
   */
  async listPathways(idOrSlug: string, params: PaginationParams = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiClient<EducationPathway[]>(`/careers/${idOrSlug}/pathways${queryString}`, { requiresAuth: false });
  },

  /**
   * Lists standardized skills for search filters.
   * GET /api/v1/skills
   */
  async listSkills(params: PaginationParams & { q?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.q) query.set('q', params.q);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiClient<Skill[]>(`/skills${queryString}`, { requiresAuth: false });
  },

  /**
   * Lists bookmarked careers for the authenticated student.
   * GET /api/v1/users/me/saved-careers
   */
  async getSavedCareers(params: PaginationParams = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiClient<SavedCareer[]>(`/users/me/saved-careers${queryString}`);
  },

  /**
   * Saves a career for the authenticated student.
   * PUT /api/v1/users/me/saved-careers/:careerId
   */
  async saveCareer(careerId: string) {
    return apiClient<{ career: Career; savedAt: string }>(`/users/me/saved-careers/${careerId}`, {
      method: 'PUT',
    });
  },

  /**
   * Removes a saved career.
   * DELETE /api/v1/users/me/saved-careers/:careerId
   */
  async removeSavedCareer(careerId: string) {
    return apiClient<Record<string, never>>(`/users/me/saved-careers/${careerId}`, {
      method: 'DELETE',
    });
  },
};
