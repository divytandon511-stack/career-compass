import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingApi } from '@/services/api/booking.api';
import { UserProfile, AvailabilitySlot } from '@/types/models';
import { Button } from '@/components/shared/Button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export const CounsellorBookPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [counsellor, setCounsellor] = useState<UserProfile | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [counsellorRes, slotsRes] = await Promise.all([
          bookingApi.getCounsellor(id!),
          bookingApi.getCounsellorSlots(id!),
        ]);
        if (isMounted) {
          setCounsellor(counsellorRes.data);
          // Only show slots that are AVAILABLE
          const availableSlots = (slotsRes.data || []).filter((s) => s.status === 'AVAILABLE');
          setSlots(availableSlots);
          if (availableSlots.length > 0) {
            setSelectedSlotId(availableSlots[0].id);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load counsellor availability');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleBooking = async () => {
    if (!selectedSlotId) return;
    try {
      setBookingInProgress(true);
      setError(null);
      await bookingApi.createBooking(selectedSlotId, note.trim() || undefined);
      setBookingSuccess(true);
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string; status?: number };
      if (errObj.status === 409 || errObj.code === 'CONFLICT') {
        setError('This slot was just reserved by another student. Please choose another available slot.');
        // Refresh slots
        try {
          const freshSlots = await bookingApi.getCounsellorSlots(id!);
          const available = (freshSlots.data || []).filter((s) => s.status === 'AVAILABLE');
          setSlots(available);
          setSelectedSlotId(available[0]?.id || null);
        } catch {
          // ignore
        }
      } else {
        setError(errObj.message || 'Failed to complete booking. Please try again.');
      }
    } finally {
      setBookingInProgress(false);
    }
  };

  const formatSlotTime = (isoStart: string, isoEnd: string) => {
    try {
      const start = new Date(isoStart);
      const end = new Date(isoEnd);
      const dateStr = start.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const startTime = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const endTime = end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return { dateStr, timeStr: `${startTime} – ${endTime}` };
    } catch {
      return { dateStr: isoStart, timeStr: isoEnd };
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (bookingSuccess) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-3)' }}>🎉</div>
          <h2>Appointment Confirmed!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: 'var(--space-2)', lineHeight: 1.6 }}>
            Your guidance appointment with <strong>{counsellor?.displayName}</strong> has been successfully booked.
          </p>
          <div
            style={{
              margin: 'var(--space-6) 0',
              padding: 'var(--space-4)',
              backgroundColor: 'var(--bg-base)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'left',
              fontSize: '13px',
            }}
          >
            <div><strong>Advisor:</strong> {counsellor?.displayName} ({counsellor?.email})</div>
            {note && <div style={{ marginTop: 'var(--space-2)' }}><strong>Discussion Note:</strong> {note}</div>}
            <div style={{ marginTop: 'var(--space-2)', color: 'var(--text-dim)', fontSize: '12px' }}>
              Status: <span style={{ color: 'var(--success)', fontWeight: 600 }}>CONFIRMED</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <Button onClick={() => navigate('/bookings')}>
              Go to My Bookings
            </Button>
            <Button variant="secondary" onClick={() => navigate('/counsellors')}>
              Browse More Advisors
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header breadcrumb */}
      <div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/counsellors')} style={{ marginBottom: 'var(--space-3)' }}>
          ← Back to Counsellors
        </Button>
        <h2>Book Guidance Session</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Reserve dedicated guidance time with verified school advisors.
        </p>
      </div>

      {/* Counsellor Profile Header */}
      {counsellor && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {counsellor.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 style={{ margin: 0 }}>{counsellor.displayName}</h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{counsellor.email}</span>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                  color: 'var(--primary)',
                }}
              >
                Official School Counsellor
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* Slot Selection */}
      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Select an Available Time Slot</h3>
        {slots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-muted)' }}>
            <p>No available slots published for this counsellor at the moment.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/counsellors')}
              style={{ marginTop: 'var(--space-3)' }}
            >
              Choose Another Advisor
            </Button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-6)',
            }}
          >
            {slots.map((slot) => {
              const isSelected = selectedSlotId === slot.id;
              const { dateStr, timeStr } = formatSlotTime(slot.startsAt, slot.endsAt);
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSelectedSlotId(slot.id)}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-base)',
                    color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  aria-pressed={isSelected}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{dateStr}</div>
                  <div style={{ fontSize: '12px', color: isSelected ? 'var(--primary)' : 'var(--text-muted)', marginTop: '2px' }}>
                    {timeStr}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Note input */}
        {slots.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
            <label htmlFor="booking-note" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
              Topics / Questions for the Counsellor (Optional)
            </label>
            <textarea
              id="booking-note"
              rows={3}
              maxLength={500}
              placeholder="e.g., I'd like to discuss choosing between Science and Commerce stream for Grade 11..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-base)',
                color: 'var(--text-main)',
                fontFamily: 'inherit',
                fontSize: '14px',
                resize: 'vertical',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', alignSelf: 'flex-end' }}>
              {note.length} / 500
            </span>
          </div>
        )}

        {/* Action buttons */}
        {slots.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <Button
              onClick={handleBooking}
              disabled={!selectedSlotId || bookingInProgress}
            >
              {bookingInProgress ? 'Confirming Appointment...' : 'Confirm Appointment'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/counsellors')} disabled={bookingInProgress}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
