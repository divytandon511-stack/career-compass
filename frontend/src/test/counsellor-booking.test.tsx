import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CounsellorsPage } from '@/pages/student/CounsellorsPage';
import { CounsellorBookPage } from '@/pages/student/CounsellorBookPage';
import { BookingsPage } from '@/pages/student/BookingsPage';
import { bookingApi } from '@/services/api/booking.api';
import { UserProfile, AvailabilitySlot, Booking } from '@/types/models';

vi.mock('@/services/api/booking.api', () => ({
  bookingApi: {
    listCounsellors: vi.fn(),
    getCounsellor: vi.fn(),
    getCounsellorSlots: vi.fn(),
    createBooking: vi.fn(),
    getMyBookings: vi.fn(),
    updateBookingStatus: vi.fn(),
  },
}));

const mockCounsellor: UserProfile = {
  id: 'counsellor-1',
  email: 'sunita.rao@school.edu',
  displayName: 'Dr. Sunita Rao',
  role: 'COUNSELLOR',
  status: 'ACTIVE',
  profile: {
    userId: 'counsellor-1',
    displayName: 'Dr. Sunita Rao',
    bio: 'Senior academic and STEM advisor.',
    active: true,
  },
  createdAt: '2026-01-01T00:00:00Z',
};

const mockSlot: AvailabilitySlot = {
  id: 'slot-1',
  counsellorId: 'counsellor-1',
  startsAt: '2026-11-20T10:00:00.000Z',
  endsAt: '2026-11-20T10:45:00.000Z',
  status: 'AVAILABLE',
};

const mockBooking: Booking = {
  id: 'booking-1',
  slotId: 'slot-1',
  studentId: 'student-1',
  counsellorId: 'counsellor-1',
  status: 'CONFIRMED',
  note: 'Discuss Class 11 subject combination',
  startsAt: '2026-11-20T10:00:00.000Z',
  createdAt: '2026-11-14T00:00:00.000Z',
};

describe('Student Counsellor Discovery and Booking Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders counsellor list with verified advisors', async () => {
    vi.mocked(bookingApi.listCounsellors).mockResolvedValue({
      data: [mockCounsellor],
    });

    render(
      <MemoryRouter>
        <CounsellorsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Verified School Counsellors')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Dr. Sunita Rao')).toBeInTheDocument();
      expect(screen.getByText('sunita.rao@school.edu')).toBeInTheDocument();
      expect(screen.getByText('Senior academic and STEM advisor.')).toBeInTheDocument();
    });
  });

  it('renders counsellor booking page and books available slot', async () => {
    vi.mocked(bookingApi.getCounsellor).mockResolvedValue({ data: mockCounsellor });
    vi.mocked(bookingApi.getCounsellorSlots).mockResolvedValue({ data: [mockSlot] });
    vi.mocked(bookingApi.createBooking).mockResolvedValue({ data: mockBooking });

    render(
      <MemoryRouter initialEntries={['/counsellors/counsellor-1/book']}>
        <Routes>
          <Route path="/counsellors/:id/book" element={<CounsellorBookPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dr. Sunita Rao')).toBeInTheDocument();
      expect(screen.getByText('Select an Available Time Slot')).toBeInTheDocument();
    });

    // Enter discussion note
    const noteInput = screen.getByLabelText(/Topics \/ Questions for the Counsellor/i);
    fireEvent.change(noteInput, { target: { value: 'Discuss STEM entrance options' } });

    // Click confirm appointment
    const confirmBtn = screen.getByRole('button', { name: /Confirm Appointment/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(bookingApi.createBooking).toHaveBeenCalledWith('slot-1', 'Discuss STEM entrance options');
      expect(screen.getByText('Appointment Confirmed!')).toBeInTheDocument();
    });
  });

  it('handles 409 conflict when slot is already reserved', async () => {
    vi.mocked(bookingApi.getCounsellor).mockResolvedValue({ data: mockCounsellor });
    vi.mocked(bookingApi.getCounsellorSlots).mockResolvedValue({ data: [mockSlot] });
    vi.mocked(bookingApi.createBooking).mockRejectedValue({
      status: 409,
      code: 'CONFLICT',
      message: 'Slot has been reserved',
    });

    render(
      <MemoryRouter initialEntries={['/counsellors/counsellor-1/book']}>
        <Routes>
          <Route path="/counsellors/:id/book" element={<CounsellorBookPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm Appointment/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirm Appointment/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/This slot was just reserved by another student/i)
      ).toBeInTheDocument();
    });
  });

  it('lists student appointments and allows cancelling confirmed booking', async () => {
    vi.mocked(bookingApi.getMyBookings).mockResolvedValue({
      data: [mockBooking],
    });
    vi.mocked(bookingApi.updateBookingStatus).mockResolvedValue({
      data: { ...mockBooking, status: 'CANCELLED' },
    });

    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter>
        <BookingsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('My Guidance Appointments')).toBeInTheDocument();
      expect(screen.getByText('Discuss Class 11 subject combination')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel Appointment/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Cancel Appointment/i }));

    await waitFor(() => {
      expect(bookingApi.updateBookingStatus).toHaveBeenCalledWith('booking-1', 'CANCELLED');
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });
  });
});
