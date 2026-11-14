import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '@/services/api/booking.api';
import { AvailabilitySlot } from '@/types/models';
import { Button } from '@/components/shared/Button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export const CounsellorSlotsPage: React.FC = () => {
  const navigate = useNavigate();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New slot form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await bookingApi.listOwnSlots();
      setSlots(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load availability slots');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startsAt || !endsAt) {
      setFormError('Please provide both start and end times.');
      return;
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    if (endDate <= startDate) {
      setFormError('End time must be strictly after start time.');
      return;
    }

    try {
      setCreating(true);
      setFormError(null);
      const res = await bookingApi.createSlot(startDate.toISOString(), endDate.toISOString());
      if (res.data) {
        setSlots((prev) => [res.data, ...prev]);
      }
      setShowAddForm(false);
      setStartsAt('');
      setEndsAt('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create availability slot');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!window.confirm('Are you sure you want to remove this availability slot?')) return;
    try {
      setDeletingId(slotId);
      await bookingApi.deleteSlot(slotId);
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete slot');
    } finally {
      setDeletingId(null);
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
        year: 'numeric',
      });
      const startTime = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const endTime = end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return { dateStr, timeStr: `${startTime} – ${endTime}` };
    } catch {
      return { dateStr: isoStart, timeStr: isoEnd };
    }
  };

  const availableCount = slots.filter((s) => s.status === 'AVAILABLE').length;
  const bookedCount = slots.filter((s) => s.status === 'BOOKED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/counsellor/dashboard')} style={{ marginBottom: 'var(--space-2)' }}>
            ← Back to Appointments
          </Button>
          <h2>Availability Slot Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Publish future calendar slots for secondary school students to reserve guidance sessions.
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Close Form' : '+ Add New Slot'}
        </Button>
      </div>

      {/* KPI stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Total Slots
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: 'var(--text-main)' }}>
            {slots.length}
          </div>
        </div>
        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Available for Booking
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: 'var(--success)' }}>
            {availableCount}
          </div>
        </div>
        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Booked by Students
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: 'var(--primary)' }}>
            {bookedCount}
          </div>
        </div>
      </div>

      {/* Add Slot Form Modal / Inline */}
      {showAddForm && (
        <div className="card" style={{ border: '2px solid var(--secondary)' }}>
          <h3 style={{ marginBottom: 'var(--space-4)' }}>Publish New Availability Slot</h3>

          {formError && (
            <div
              role="alert"
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger)',
                fontSize: '13px',
                marginBottom: 'var(--space-4)',
              }}
            >
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateSlot} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
            <div>
              <label htmlFor="slot-start" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Slot Start Time *
              </label>
              <input
                id="slot-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-base)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label htmlFor="slot-end" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Slot End Time *
              </label>
              <input
                id="slot-end"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-base)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" type="button" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Publishing Slot...' : 'Publish Slot'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Main slot list */}
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
          <Button size="sm" variant="secondary" onClick={fetchSlots}>Retry</Button>
        </div>
      ) : slots.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div style={{ fontSize: '36px', marginBottom: 'var(--space-2)' }}>⏰</div>
          <h3>No Availability Slots Published</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: 'var(--space-2)', maxWidth: '440px', margin: 'var(--space-2) auto var(--space-6)' }}>
            You haven't scheduled any guidance slots yet. Add available time slots so secondary school students can book consultations with you.
          </p>
          <Button onClick={() => setShowAddForm(true)}>
            + Create First Slot
          </Button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {slots.map((slot) => {
            const { dateStr, timeStr } = formatSlotTime(slot.startsAt, slot.endsAt);
            const isAvailable = slot.status === 'AVAILABLE';
            return (
              <div
                key={slot.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: isAvailable ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                        color: isAvailable ? 'var(--success)' : 'var(--primary)',
                      }}
                    >
                      {slot.status}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      ID: {slot.id.slice(0, 6)}
                    </span>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '15px' }}>{dateStr}</h4>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {timeStr}
                  </div>
                </div>

                <div>
                  {isAvailable ? (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={deletingId === slot.id}
                      onClick={() => handleDeleteSlot(slot.id)}
                      style={{ width: '100%' }}
                    >
                      {deletingId === slot.id ? 'Deleting...' : 'Delete Slot'}
                    </Button>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontStyle: 'italic', display: 'block', textAlign: 'center' }}>
                      Reserved by Student
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
