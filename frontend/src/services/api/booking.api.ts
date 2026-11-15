import { apiClient } from './client';
import { UserProfile, AvailabilitySlot, Booking } from '@/types/models';
import { PaginationParams } from '@/types/api';

export interface ListBookingsParams extends PaginationParams {
  status?: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
}

export const bookingApi = {
  /**
   * Lists approved counsellors for student discovery.
   * GET /api/v1/counsellors
   */
  async listCounsellors(params: PaginationParams & { q?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.q) query.set('q', params.q);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<UserProfile[]>(`/counsellors${qs}`);
  },

  /**
   * Retrieves single counsellor profile.
   * GET /api/v1/counsellors/:id
   */
  async getCounsellor(id: string) {
    return apiClient<UserProfile>(`/counsellors/${id}`);
  },

  /**
   * Retrieves available appointment slots for a counsellor (future slots only).
   * GET /api/v1/counsellors/:counsellorId/slots
   */
  async getCounsellorSlots(counsellorId: string, from?: string, to?: string) {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiClient<AvailabilitySlot[]>(`/counsellors/${counsellorId}/slots${queryString}`);
  },

  /**
   * For counsellors: list own slots (past and future).
   * GET /api/v1/counsellors/me/slots
   */
  async listOwnSlots(from?: string, to?: string) {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<AvailabilitySlot[]>(`/counsellors/me/slots${qs}`);
  },

  /**
   * For counsellors: create a new availability slot.
   * POST /api/v1/counsellors/me/slots
   */
  async createSlot(startsAt: string, endsAt: string) {
    return apiClient<AvailabilitySlot>('/counsellors/me/slots', {
      method: 'POST',
      body: JSON.stringify({ startsAt, endsAt }),
    });
  },

  /**
   * For counsellors: delete an availability slot.
   * DELETE /api/v1/counsellors/me/slots/:id
   */
  async deleteSlot(slotId: string) {
    return apiClient(`/counsellors/me/slots/${slotId}`, {
      method: 'DELETE',
    });
  },

  /**
   * For students: create a booking for an available slot.
   * POST /api/v1/bookings
   */
  async createBooking(slotId: string, note?: string) {
    return apiClient<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify({ slotId, note }),
    });
  },

  /**
   * Lists bookings for the authenticated user (student or counsellor).
   * GET /api/v1/bookings
   */
  async getMyBookings(params: ListBookingsParams = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    if (params.sort) query.set('sort', params.sort);
    if (params.order) query.set('order', params.order);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<Booking[]>(`/bookings${qs}`);
  },

  /**
   * Retrieves single booking details.
   * GET /api/v1/bookings/:id
   */
  async getBooking(id: string) {
    return apiClient<Booking>(`/bookings/${id}`);
  },

  /**
   * Updates booking status:
   * - Student can transition CONFIRMED -> CANCELLED
   * - Counsellor can transition CONFIRMED -> COMPLETED or CANCELLED
   * PATCH /api/v1/bookings/:id/status
   */
  async updateBookingStatus(id: string, status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED') {
    return apiClient<Booking>(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};
