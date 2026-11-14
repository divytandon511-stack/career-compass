import { ApiResponse, ApiErrorEnvelope, ApiErrorDetail } from '@/types/api';

const resolveBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  return (envUrl || 'http://localhost:4000/api/v1').replace(/\/$/, '');
};

const API_BASE_URL = resolveBaseUrl();

export const getApiBaseUrl = (): string => API_BASE_URL;

let inMemoryToken: string | null = null;

export const setAuthToken = (token: string | null): void => {
  inMemoryToken = token;
};

export const getAuthToken = (): string | null => inMemoryToken;

type AuthFailureListener = () => void;
const authFailureListeners = new Set<AuthFailureListener>();

export const addAuthFailureListener = (listener: AuthFailureListener): (() => void) => {
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
};

const notifyAuthFailure = (): void => {
  inMemoryToken = null;
  authFailureListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error in auth failure listener:', e);
    }
  });
};

export class ApiError extends Error {
  code: string;
  status: number;
  details?: ApiErrorDetail[];

  constructor(message: string, code: string, status: number, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
  _retry?: boolean;
  _isRefreshRequest?: boolean;
}

// Single-flight refresh promise to handle concurrent 401s cleanly
let refreshPromise: Promise<string | null> | null = null;

async function executeTokenRefresh(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshUrl = `${API_BASE_URL}/auth/refresh`;
      const response = await fetch(refreshUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        notifyAuthFailure();
        return null;
      }

      const body = await response.json();
      const newToken = body?.data?.accessToken;
      if (typeof newToken === 'string' && newToken.length > 0) {
        setAuthToken(newToken);
        return newToken;
      }

      notifyAuthFailure();
      return null;
    } catch {
      notifyAuthFailure();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    requiresAuth = true,
    headers: customHeaders,
    _retry = false,
    _isRefreshRequest = false,
    ...restOptions
  } = options;

  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = `${API_BASE_URL}/${cleanEndpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (requiresAuth && inMemoryToken) {
    headers['Authorization'] = `Bearer ${inMemoryToken}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...restOptions,
      headers,
      credentials: 'include', // sends and receives HttpOnly refresh cookie
    });
  } catch (netErr) {
    throw new ApiError(
      netErr instanceof Error ? netErr.message : 'Network request failed',
      'NETWORK_ERROR',
      0
    );
  }

  // Handle 401 Unauthorized with single-flight silent refresh (except for refresh endpoint itself or already retried requests)
  if (response.status === 401 && !_retry && !_isRefreshRequest && !cleanEndpoint.startsWith('auth/refresh')) {
    const newToken = await executeTokenRefresh();
    if (newToken) {
      // Retry original request exactly once with new token
      return apiClient<T>(endpoint, {
        ...options,
        _retry: true,
        headers: {
          ...customHeaders,
          Authorization: `Bearer ${newToken}`,
        },
      });
    }
  }

  if (!response.ok) {
    let errorData: ApiErrorEnvelope | null = null;
    try {
      errorData = await response.json();
    } catch {
      // response body was empty or not JSON
    }

    const message = errorData?.error?.message || `API Request failed with status ${response.status}`;
    const code = errorData?.error?.code || (response.status === 401 ? 'UNAUTHORIZED' : 'HTTP_ERROR');
    const details = errorData?.error?.details;

    throw new ApiError(message, code, response.status, details);
  }

  // Handle 204 No Content without JSON parsing errors
  if (response.status === 204) {
    return { data: {} as T };
  }

  try {
    return await response.json();
  } catch {
    return { data: {} as T };
  }
}
