import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '@/services/api/booking.api';
import { Booking } from '@/types/models';
import { Button } from '@/components/shared/Button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export const CounsellorDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = statusFilter === 'ALL' ? {} : { status: statusFilter };
      const res = await bookingApi.getMyBookings(params);
      setBookings(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load counsellor appointments');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleUpdateStatus = async (bookingId: string, status: 'COMPLETED' | 'CANCELLED') => {
    try {
      setActionInProgress(bookingId);
      await bookingApi.updateBookingStatus(bookingId, status);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to mark booking as ${status}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const confirmedCount = bookings.filter((b) => b.status === 'CONFIRMED').length;
  const completedCount = bookings.filter((b) => b.status === 'COMPLETED').length;
  const cancelledCount = bookings.filter((b) => b.status === 'CANCELLED').length;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Advisor Portal
          </span>
          <h2>Counsellor Workspace</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Review assigned student guidance appointments, manage attendance, and prepare recommendations.
          </p>
        </div>
        <Button onClick={() => navigate('/counsellor/slots')}>
          Manage Availability Slots
        </Button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Upcoming / Confirmed
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: 'var(--primary)' }}>
            {confirmedCount}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sessions scheduled</span>
        </div>

        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Completed Sessions
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: 'var(--success)' }}>
            {completedCount}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Conducted advice meetings</span>
        </div>

        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Cancelled
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: 'var(--danger)' }}>
            {cancelledCount}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cancelled appointments</span>
        </div>
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
              backgroundColor: statusFilter === tab ? 'var(--secondary)' : 'transparent',
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
          <div style={{ fontSize: '36px', marginBottom: 'var(--space-2)' }}>📋</div>
          <h3>No Appointments Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: 'var(--space-2)', maxWidth: '440px', margin: 'var(--space-2) auto var(--space-6)' }}>
            {statusFilter === 'ALL'
              ? 'No student appointments have been booked yet. Ensure your calendar slots are published in Slot Management.'
              : `No appointments with status "${statusFilter}".`}
          </p>
          <Button onClick={() => navigate('/counsellor/slots')}>
            Manage Availability Slots
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
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor:
                        booking.status === 'CONFIRMED'
                          ? 'rgba(99, 102, 241, 0.1)'
                          : booking.status === 'COMPLETED'
                          ? 'rgba(16, 185, 129, 0.1)'
                          : 'rgba(239, 68, 68, 0.1)',
                      color:
                        booking.status === 'CONFIRMED'
                          ? 'var(--primary)'
                          : booking.status === 'COMPLETED'
                          ? 'var(--success)'
                          : 'var(--danger)',
                    }}
                  >
                    {booking.status}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>
                    {formatDateTime(booking.startsAt || booking.slot?.startsAt || booking.createdAt)}
                  </span>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span>Student ID: </span>
                  <code style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                    {booking.studentId}
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
                    <strong>Student Note:</strong> {booking.note}
                  </div>
                )}
              </div>

              {booking.status === 'CONFIRMED' && (
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button
                    size="sm"
                    disabled={actionInProgress === booking.id}
                    onClick={() => handleUpdateStatus(booking.id, 'COMPLETED')}
                  >
                    {actionInProgress === booking.id ? 'Updating...' : 'Mark Completed'}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={actionInProgress === booking.id}
                    onClick={() => {
                      if (window.confirm('Cancel this student appointment?')) {
                        handleUpdateStatus(booking.id, 'CANCELLED');
                      }
                    }}
                  >
                    Cancel
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
