import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  apiClient,
  setAuthToken,
  getAuthToken,
  ApiError,
  addAuthFailureListener,
  getApiBaseUrl,
} from '@/services/api/client';

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
});
