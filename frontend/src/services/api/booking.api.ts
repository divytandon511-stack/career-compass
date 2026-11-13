import { apiClient } from './client';
import { CounsellorProfile, AvailabilitySlot, Booking } from '@/types/models';

export const bookingApi = {
  async listCounsellors() {
    return apiClient<CounsellorProfile[]>('/counsellors');
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

  async getMyBookings() {
    return apiClient<Booking[]>('/bookings');
  },

  async updateBookingStatus(id: string, status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED') {
    return apiClient<Booking>(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};
