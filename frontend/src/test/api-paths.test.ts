import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setAuthToken, getApiBaseUrl } from '@/services/api/client';
import { careersApi } from '@/services/api/careers.api';
import { bookingApi } from '@/services/api/booking.api';
import { assessmentApi } from '@/services/api/assessment.api';
import { userApi } from '@/services/api/user.api';

/**
 * Validates that frontend API service modules resolve to the exact
 * backend route paths defined in the authoritative backend router files:
 *
 *   career.routes.js    → GET /users/me/saved-careers
 *   platform.routes.js  → GET /bookings
 *   assessment.routes.js → GET /attempts
 *   platform.routes.js  → GET /users/me
 *
 * All under the /api/v1 prefix.
 */
describe('Backend Contract: API Path Verification', () => {
  const baseUrl = getApiBaseUrl();
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setAuthToken('valid-token');
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    setAuthToken(null);
    vi.restoreAllMocks();
  });

  it('getSavedCareers calls GET /users/me/saved-careers (not /saved-careers)', async () => {
    await careersApi.getSavedCareers({ limit: 5 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl: string = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toBe(`${baseUrl}/users/me/saved-careers?limit=5`);
  });

  it('getMyBookings calls GET /bookings (not /bookings/mine)', async () => {
    await bookingApi.getMyBookings({ limit: 5, sort: 'startsAt', order: 'asc' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl: string = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toBe(`${baseUrl}/bookings?limit=5&sort=startsAt&order=asc`);
  });

  it('listAttempts calls GET /attempts with correct query params', async () => {
    await assessmentApi.listAttempts({ limit: 10, sort: 'startedAt', order: 'desc' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl: string = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toBe(`${baseUrl}/attempts?limit=10&sort=startedAt&order=desc`);
  });

  it('getProfile calls GET /users/me', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 'u1', email: 'x@y.com', role: 'STUDENT' } }),
    });

    await userApi.getProfile();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl: string = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toBe(`${baseUrl}/users/me`);
  });

  it('getRecommendations calls GET /attempts/:id/recommendations with pagination', async () => {
    await assessmentApi.getRecommendations('att-uuid-123', 1, 1);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl: string = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toBe(`${baseUrl}/attempts/att-uuid-123/recommendations?page=1&limit=1`);
  });

  it('getAttempt calls GET /attempts/:id', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 'att-1', status: 'COMPLETED' } }),
    });

    await assessmentApi.getAttempt('att-uuid-456');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl: string = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toBe(`${baseUrl}/attempts/att-uuid-456`);
  });
});
