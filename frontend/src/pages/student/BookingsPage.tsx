import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '@/services/api/booking.api';
import { Booking } from '@/types/models';
import { Button } from '@/components/shared/Button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export const BookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = statusFilter === 'ALL' ? {} : { status: statusFilter };
      const res = await bookingApi.getMyBookings(params);
      setBookings(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCancelBooking = async (bookingId: string) => {
    try {
      setCancellingId(bookingId);
      setActionError(null);
      await bookingApi.updateBookingStatus(bookingId, 'CANCELLED');
      // Update local state
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'CANCELLED' } : b))
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel appointment');
    } finally {
      setCancellingId(null);
    }
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED') => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              color: 'var(--primary)',
            }}
          >
            Confirmed
          </span>
        );
      case 'COMPLETED':
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--success)',
            }}
          >
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--danger)',
            }}
          >
            Cancelled
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Appointments
          </span>
          <h2>My Guidance Appointments</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Review, track, and manage your scheduled sessions with school career counsellors.
          </p>
        </div>
        <Button onClick={() => navigate('/counsellors')}>
          Book New Session
        </Button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
        {(['ALL', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatusFilter(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: statusFilter === tab ? 'var(--primary)' : 'transparent',
              color: statusFilter === tab ? '#fff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Action error banner */}
      {actionError && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '13px',
          }}
        >
          {actionError}
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div
          role="alert"
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={fetchBookings}>Retry</Button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div style={{ fontSize: '36px', marginBottom: 'var(--space-2)' }}>📅</div>
          <h3>No Appointments Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: 'var(--space-2)', maxWidth: '440px', margin: 'var(--space-2) auto var(--space-6)' }}>
            {statusFilter === 'ALL'
              ? 'You have not booked any counselling sessions yet. Browse verified advisors to schedule an appointment.'
              : `You have no ${statusFilter.toLowerCase()} appointments.`}
          </p>
          <Button onClick={() => navigate('/counsellors')}>
            Browse Available Advisors
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-4)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  {getStatusBadge(booking.status)}
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>
                    {formatDateTime(booking.startsAt || booking.slot?.startsAt || booking.createdAt)}
                  </span>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span>Advisor ID: </span>
                  <code style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                    {booking.counsellorId}
                  </code>
                </div>

                {booking.note && (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-main)',
                      backgroundColor: 'var(--bg-base)',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      maxWidth: '520px',
                    }}
                  >
                    <strong>Your Note:</strong> {booking.note}
                  </div>
                )}
              </div>

              {booking.status === 'CONFIRMED' && (
                <div>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={cancellingId === booking.id}
                    onClick={() => {
                      if (window.confirm('Are you sure you want to cancel this guidance appointment?')) {
                        handleCancelBooking(booking.id);
                      }
                    }}
                  >
                    {cancellingId === booking.id ? 'Cancelling...' : 'Cancel Appointment'}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
