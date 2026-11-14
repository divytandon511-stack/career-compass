import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CounsellorDashboardPage } from '@/pages/counsellor/CounsellorDashboardPage';
import { CounsellorSlotsPage } from '@/pages/counsellor/CounsellorSlotsPage';
import { bookingApi } from '@/services/api/booking.api';
import { Booking, AvailabilitySlot } from '@/types/models';

vi.mock('@/services/api/booking.api', () => ({
  bookingApi: {
    getMyBookings: vi.fn(),
    updateBookingStatus: vi.fn(),
    listOwnSlots: vi.fn(),
    createSlot: vi.fn(),
    deleteSlot: vi.fn(),
  },
}));

const mockCounsellorBooking: Booking = {
  id: 'b-100',
  slotId: 's-100',
  studentId: 'student-99',
  counsellorId: 'counsellor-self',
  status: 'CONFIRMED',
  note: 'Needs guidance on engineering entrance exams',
  startsAt: '2026-11-25T11:00:00.000Z',
  createdAt: '2026-11-14T00:00:00.000Z',
};

const mockSlot1: AvailabilitySlot = {
  id: 's-100',
  counsellorId: 'counsellor-self',
  startsAt: '2026-11-25T11:00:00.000Z',
  endsAt: '2026-11-25T11:45:00.000Z',
  status: 'AVAILABLE',
};

describe('Counsellor Workspace & Slot Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders counsellor dashboard, stats, and completes a session', async () => {
    vi.mocked(bookingApi.getMyBookings).mockResolvedValue({
      data: [mockCounsellorBooking],
    });
    vi.mocked(bookingApi.updateBookingStatus).mockResolvedValue({
      data: { ...mockCounsellorBooking, status: 'COMPLETED' },
    });

    render(
      <MemoryRouter>
        <CounsellorDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Counsellor Workspace')).toBeInTheDocument();
      expect(screen.getByText('Needs guidance on engineering entrance exams')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mark Completed/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Mark Completed/i }));

    await waitFor(() => {
      expect(bookingApi.updateBookingStatus).toHaveBeenCalledWith('b-100', 'COMPLETED');
      expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    });
  });

  it('renders counsellor slot manager, creates slot, and deletes slot', async () => {
    vi.mocked(bookingApi.listOwnSlots).mockResolvedValue({
      data: [mockSlot1],
    });
    vi.mocked(bookingApi.createSlot).mockResolvedValue({
      data: {
        id: 's-200',
        counsellorId: 'counsellor-self',
        startsAt: '2026-11-26T14:00:00.000Z',
        endsAt: '2026-11-26T14:45:00.000Z',
        status: 'AVAILABLE',
      },
    });
    vi.mocked(bookingApi.deleteSlot).mockResolvedValue({ data: {} });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter>
        <CounsellorSlotsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Availability Slot Management')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete Slot/i })).toBeInTheDocument();
    });

    // Open add slot form
    fireEvent.click(screen.getByRole('button', { name: /\+ Add New Slot/i }));
    expect(screen.getByText('Publish New Availability Slot')).toBeInTheDocument();

    // Fill dates
    const startInput = screen.getByLabelText(/Slot Start Time \*/i);
    const endInput = screen.getByLabelText(/Slot End Time \*/i);

    fireEvent.change(startInput, { target: { value: '2026-11-26T14:00' } });
    fireEvent.change(endInput, { target: { value: '2026-11-26T14:45' } });

    fireEvent.click(screen.getByRole('button', { name: /Publish Slot/i }));

    await waitFor(() => {
      expect(bookingApi.createSlot).toHaveBeenCalled();
    });

    // Delete existing slot
    const deleteBtns = screen.getAllByRole('button', { name: /Delete Slot/i });
    fireEvent.click(deleteBtns[1]);

    await waitFor(() => {
      expect(bookingApi.deleteSlot).toHaveBeenCalledWith('s-100');
    });
  });
});
