import { ApiResponse, ApiErrorEnvelope } from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

let inMemoryToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  inMemoryToken = token;
};

export const getAuthToken = () => inMemoryToken;

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { requiresAuth = true, headers: customHeaders, ...restOptions } = options;

  const url = `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (requiresAuth && inMemoryToken) {
    headers['Authorization'] = `Bearer ${inMemoryToken}`;
  }

  const response = await fetch(url, {
    ...restOptions,
    headers,
    credentials: 'include', // ensures HttpOnly refresh cookie is sent
  });

  if (!response.ok) {
    let errorData: ApiErrorEnvelope | null = null;
    try {
      errorData = await response.json();
    } catch {
      // response wasn't JSON
    }

    const message = errorData?.error?.message || `API Request failed with status ${response.status}`;
    const code = errorData?.error?.code || 'HTTP_ERROR';
    const details = errorData?.error?.details;

    throw new ApiError(message, code, response.status, details);
  }

  if (response.status === 204) {
    return { data: {} as T };
  }

  return response.json();
}
