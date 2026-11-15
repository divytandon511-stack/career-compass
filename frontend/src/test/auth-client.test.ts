import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  apiClient,
  setAuthToken,
  getAuthToken,
  ApiError,
  addAuthFailureListener,
  getApiBaseUrl,
  executeTokenRefresh,
} from '@/services/api/client';
import { authApi } from '@/services/api/auth.api';

describe('apiClient & Token Refresh Subsystem', () => {
  beforeEach(() => {
    setAuthToken(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves the configured API base URL with fallback', () => {
    const baseUrl = getApiBaseUrl();
    expect(baseUrl).toBeDefined();
    expect(baseUrl.endsWith('/api/v1')).toBe(true);
  });

  it('attaches Bearer authorization header when token is present', async () => {
    setAuthToken('mock-access-token');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: '123' } }),
    });
    global.fetch = fetchMock;

    await apiClient('/test-endpoint');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer mock-access-token');
    expect(options.credentials).toBe('include');
  });

  it('handles 204 No Content without JSON parsing errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error('Unexpected end of JSON input');
      },
    });

    const result = await apiClient('/auth/logout', { method: 'POST' });
    expect(result).toEqual({ data: {} });
  });

  it('executes single-flight silent refresh on 401 and replays request once', async () => {
    setAuthToken('expired-token');

    let requestCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      requestCount++;
      // First attempt with expired token fails with 401
      if (url.includes('/protected') && requestCount === 1) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
        };
      }
      // Refresh endpoint succeeds and returns fresh token
      if (url.includes('/auth/refresh')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { accessToken: 'fresh-token-xyz', expiresIn: 900 } }),
        };
      }
      // Retried request with fresh token succeeds
      if (url.includes('/protected') && requestCount === 3) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { secret: 'data' } }),
        };
      }
      return { ok: false, status: 500 };
    });

    const response = await apiClient<{ secret: string }>('/protected');

    expect(response.data.secret).toBe('data');
    expect(getAuthToken()).toBe('fresh-token-xyz');
  });

  it('deduplicates concurrent 401s into a single refresh request', async () => {
    setAuthToken('expired-token');

    let refreshCallCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        // Simulate network delay for refresh
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { accessToken: 'deduped-token', expiresIn: 900 } }),
        };
      }

      const headers = (init?.headers as Record<string, string>) || {};
      const authHeader = headers['Authorization'];

      if (authHeader === 'Bearer expired-token') {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }),
        };
      }

      if (authHeader === 'Bearer deduped-token') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { path: url } }),
        };
      }

      return { ok: false, status: 400 };
    });

    // Launch two requests in parallel that both hit 401 simultaneously
    const [res1, res2] = await Promise.all([
      apiClient('/resource-1'),
      apiClient('/resource-2'),
    ]);

    expect(refreshCallCount).toBe(1);
    expect(res1.data).toBeDefined();
    expect(res2.data).toBeDefined();
    expect(getAuthToken()).toBe('deduped-token');
  });

  it('notifies auth failure listeners when refresh definitively fails', async () => {
    setAuthToken('stale-token');
    const failureSpy = vi.fn();
    const unsubscribe = addAuthFailureListener(failureSpy);

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Refresh cookie invalid' } }),
        };
      }
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Session expired' } }),
      };
    });

    await expect(apiClient('/any-endpoint')).rejects.toThrow(ApiError);
    expect(failureSpy).toHaveBeenCalledTimes(1);
    expect(getAuthToken()).toBeNull();

    unsubscribe();
  });

  it('never recursively refreshes a failed refresh request itself', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Cookie missing' } }),
    });

    await expect(apiClient('/auth/refresh', { method: 'POST', _isRefreshRequest: true })).rejects.toThrow(ApiError);
    // Should NOT call fetch again recursively
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent authApi.refresh() calls into a single network request', async () => {
    let refreshCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCount++;
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { accessToken: 'shared-refreshed-token', expiresIn: 900 } }),
        };
      }
      return { ok: false, status: 400 };
    });

    // Invoke 3 concurrent authApi.refresh() calls
    const [r1, r2, r3] = await Promise.all([
      authApi.refresh(),
      authApi.refresh(),
      authApi.refresh(),
    ]);

    expect(refreshCount).toBe(1);
    expect(r1.data.accessToken).toBe('shared-refreshed-token');
    expect(r2.data.accessToken).toBe('shared-refreshed-token');
    expect(r3.data.accessToken).toBe('shared-refreshed-token');
    expect(getAuthToken()).toBe('shared-refreshed-token');
  });

  it('shares single-flight refreshPromise between authApi.refresh() and 401 interceptor', async () => {
    setAuthToken('stale-jwt');
    let refreshCount = 0;

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/auth/refresh')) {
        refreshCount++;
        await new Promise((r) => setTimeout(r, 25));
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { accessToken: 'interceptor-shared-token', expiresIn: 900 } }),
        };
      }

      const headers = (init?.headers as Record<string, string>) || {};
      if (headers['Authorization'] === 'Bearer stale-jwt') {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }),
        };
      }

      if (headers['Authorization'] === 'Bearer interceptor-shared-token') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { success: true } }),
        };
      }

      return { ok: false, status: 400 };
    });

    // Launch authApi.refresh() and an unauthenticated API call at the same time
    const [apiRes, refreshRes] = await Promise.all([
      apiClient('/some-protected-endpoint'),
      authApi.refresh(),
    ]);

    expect(refreshCount).toBe(1);
    expect(refreshRes.data.accessToken).toBe('interceptor-shared-token');
    expect(apiRes.data).toEqual({ success: true });
    expect(getAuthToken()).toBe('interceptor-shared-token');
  });

  it('does NOT notify auth failure when notifyOnFailure is false (passive session restoration)', async () => {
    const failureSpy = vi.fn();
    const unsubscribe = addAuthFailureListener(failureSpy);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'No refresh token' } }),
    });

    const token = await executeTokenRefresh({ notifyOnFailure: false });

    expect(token).toBeNull();
    // Must NOT have notified auth failure listeners
    expect(failureSpy).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('notifies auth failure when notifyOnFailure is true', async () => {
    const failureSpy = vi.fn();
    const unsubscribe = addAuthFailureListener(failureSpy);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } }),
    });

    const token = await executeTokenRefresh({ notifyOnFailure: true });

    expect(token).toBeNull();
    // Must have notified auth failure listeners
    expect(failureSpy).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('does NOT notify auth failure when refresh fails with 429 Too Many Requests or 5xx server errors', async () => {
    const failureSpy = vi.fn();
    const unsubscribe = addAuthFailureListener(failureSpy);

    // Mock 429 Too Many Requests
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } }),
    });

    const token429 = await executeTokenRefresh({ notifyOnFailure: true });
    expect(token429).toBeNull();
    expect(failureSpy).not.toHaveBeenCalled();

    // Mock 500 Internal Server Error
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } }),
    });

    const token500 = await executeTokenRefresh({ notifyOnFailure: true });
    expect(token500).toBeNull();
    expect(failureSpy).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('does NOT notify auth failure on transient network errors during refresh', async () => {
    const failureSpy = vi.fn();
    const unsubscribe = addAuthFailureListener(failureSpy);

    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const token = await executeTokenRefresh({ notifyOnFailure: true });
    expect(token).toBeNull();
    expect(failureSpy).not.toHaveBeenCalled();

    unsubscribe();
  });
});
