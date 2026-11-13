import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export const CounsellorBookPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="card">
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Book Guidance Session</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-6)' }}>
          Selected Advisor: {id} • Real-time slot availability managed with PostgreSQL concurrency control.
        </p>

        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h4 style={{ marginBottom: 'var(--space-3)' }}>Select Available Slot</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
            {['10:00 AM - 10:45 AM', '02:00 PM - 02:45 PM', '04:00 PM - 04:45 PM'].map((slot, i) => (
              <button
                key={i}
                type="button"
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  textAlign: 'center',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <Button onClick={() => navigate('/bookings')}>
            Confirm Appointment
          </Button>
          <Button variant="secondary" onClick={() => navigate('/counsellors')}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
