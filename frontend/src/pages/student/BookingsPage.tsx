import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export const BookingsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>My Guidance Appointments</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Review, manage, or cancel your scheduled school counselling sessions.
          </p>
        </div>
        <Button onClick={() => navigate('/counsellors')}>
          Book New Session
        </Button>
      </div>

      <div className="card">
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
            No scheduled counselling appointments found. Browse available advisors to reserve a time slot.
          </p>
        </div>
      </div>
    </div>
  );
};
