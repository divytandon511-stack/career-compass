import { apiClient } from './client';
import { UserProfile, OverviewAnalytics, CareerInterestAnalytic, Career, Assessment, AssessmentQuestion } from '@/types/models';
import { PaginationParams } from '@/types/api';
import { Dimension } from '@/types/dimensions';

export interface ListUsersParams extends PaginationParams {
  role?: 'STUDENT' | 'COUNSELLOR' | 'ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED';
  sort?: 'createdAt' | 'email';
  order?: 'asc' | 'desc';
}

export interface CreateCareerPayload {
  slug: string;
  title: string;
  description?: string;
  dimensionProfile: Record<Dimension, number>;
  skillIds?: string[];
  pathways?: Array<{
    stage: string;
    qualification: string;
    notes?: string;
    verifiedAt?: string;
  }>;
}

export interface UpdateCareerPayload {
  title?: string;
  description?: string;
  dimensionProfile?: Record<Dimension, number>;
  skillIds?: string[];
}

export interface CreateAssessmentPayload {
  title: string;
  description?: string;
  version: number;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export interface CreateQuestionPayload {
  prompt: string;
  dimension: Dimension;
  weight: number;
  position: number;
  options: Array<{
    id: string;
    label: string;
    value: number;
  }>;
}

export const adminApi = {
  /**
   * Fetches privacy-preserving platform overview metrics.
   * GET /api/v1/analytics/overview
   */
  async getOverviewAnalytics(from?: string, to?: string) {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<OverviewAnalytics>(`/analytics/overview${qs}`);
  },

  /**
   * Fetches aggregate interest dimensions distribution across students.
   * GET /api/v1/analytics/career-interests
   */
  async getCareerInterestAnalytics(params: PaginationParams = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<CareerInterestAnalytic[]>(`/analytics/career-interests${qs}`);
  },

  /**
   * Lists registered user accounts with role and status filtering.
   * GET /api/v1/admin/users
   */
  async listUsers(params: ListUsersParams = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.role) query.set('role', params.role);
    if (params.status) query.set('status', params.status);
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<UserProfile[]>(`/admin/users${qs}`);
  },

  /**
   * Updates an account's status (e.g. SUSPENDED or ACTIVE).
   * PATCH /api/v1/admin/users/:id/status
   */
  async updateUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED') {
    return apiClient<UserProfile>(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  /**
   * Creates a new career entry in the official career catalogue.
   * POST /api/v1/careers
   */
  async createCareer(payload: CreateCareerPayload) {
    return apiClient<Career>('/careers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Updates an existing career.
   * PATCH /api/v1/careers/:id
   */
  async updateCareer(careerId: string, payload: UpdateCareerPayload) {
    return apiClient<Career>(`/careers/${careerId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Archives (unpublishes) a career.
   * DELETE /api/v1/careers/:id
   */
  async archiveCareer(careerId: string) {
    return apiClient(`/careers/${careerId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Creates a new assessment draft.
   * POST /api/v1/assessments
   */
  async createAssessment(payload: CreateAssessmentPayload) {
    return apiClient<Assessment>('/assessments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Updates an assessment (e.g. status to PUBLISHED).
   * PATCH /api/v1/assessments/:id
   */
  async updateAssessment(assessmentId: string, payload: Partial<CreateAssessmentPayload>) {
    return apiClient<Assessment>(`/assessments/${assessmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Adds a question to an assessment.
   * POST /api/v1/assessments/:id/questions
   */
  async createQuestion(assessmentId: string, payload: CreateQuestionPayload) {
    return apiClient<AssessmentQuestion>(`/assessments/${assessmentId}/questions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
