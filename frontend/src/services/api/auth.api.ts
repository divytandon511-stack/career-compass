import { apiClient, setAuthToken } from './client';
import { AuthUser } from '@/types/models';

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
  user: AuthUser;
}

export const authApi = {
  /**
   * Registers a new student account.
   * POST /api/v1/auth/register
   */
  async register(payload: RegisterPayload) {
    return apiClient<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: false,
    });
  },

  /**
   * Authenticates user credentials, sets HttpOnly refresh cookie, and stores access token.
   * POST /api/v1/auth/login
   */
  async login(payload: LoginPayload) {
    const response = await apiClient<AuthResponseData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      requiresAuth: false,
    });
    setAuthToken(response.data.accessToken);
    return response;
  },

  /**
   * Rotates refresh token from HttpOnly cookie and issues fresh access token.
   * POST /api/v1/auth/refresh
   */
  async refresh() {
    const response = await apiClient<{ accessToken: string; expiresIn: number }>('/auth/refresh', {
      method: 'POST',
      requiresAuth: false,
      _isRefreshRequest: true,
    });
    setAuthToken(response.data.accessToken);
    return response;
  },

  /**
   * Revokes active refresh session and clears cookie.
   * POST /api/v1/auth/logout
   */
  async logout(payload?: { allDevices?: boolean }) {
    try {
      await apiClient('/auth/logout', {
        method: 'POST',
        body: payload ? JSON.stringify(payload) : undefined,
      });
    } finally {
      setAuthToken(null);
    }
  },

  /**
   * Returns verified cryptographic token identity.
   * GET /api/v1/auth/me
   */
  async getMe() {
    return apiClient<{ user: AuthUser }>('/auth/me');
  },
};
