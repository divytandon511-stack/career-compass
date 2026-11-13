import { apiClient } from './client';
import { CounsellorProfile, AvailabilitySlot, Booking } from '@/types/models';
import { PaginationParams } from '@/types/api';

export interface ListBookingsParams extends PaginationParams {
  status?: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
}

export const bookingApi = {
  async listCounsellors(params: PaginationParams & { q?: string } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.q) query.set('q', params.q);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiClient<CounsellorProfile[]>(`/counsellors${qs}`);
  },

  async getCounsellor(id: string) {
    return apiClient<CounsellorProfile>(`/counsellors/${id}`);
  },

  async getCounsellorSlots(counsellorId: string, from?: string, to?: string) {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiClient<AvailabilitySlot[]>(`/counsellors/${counsellorId}/slots${queryString}`);
  },

  async createBooking(slotId: string, note?: string) {
    return apiClient<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify({ slotId, note }),
    });
  },

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

  async updateBookingStatus(id: string, status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED') {
    return apiClient<Booking>(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};
