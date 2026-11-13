import { apiClient, setAuthToken } from './client';
import { User } from '@/types/models';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
  schoolGrade?: string;
  consentAccepted: boolean;
}

export interface AuthResponseData {
  accessToken: string;
  expiresIn: number;
  user: User;
}

export const authApi = {
  async register(payload: RegisterPayload) {
    return apiClient<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: false,
    });
  },

  async login(payload: LoginPayload) {
    const response = await apiClient<AuthResponseData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: false,
    });
    setAuthToken(response.data.accessToken);
    return response;
  },

  async refresh() {
    const response = await apiClient<{ accessToken: string; expiresIn: number }>('/auth/refresh', {
      method: 'POST',
      requiresAuth: false,
    });
    setAuthToken(response.data.accessToken);
    return response;
  },

  async logout() {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
    }
  },

  async getMe() {
    return apiClient<{ user: User }>('/auth/me');
  },
};
