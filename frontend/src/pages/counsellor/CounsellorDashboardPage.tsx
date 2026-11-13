import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export const CounsellorDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Counsellor Workspace</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Review assigned student guidance appointments and prepare session notes.
          </p>
        </div>
        <Button onClick={() => navigate('/counsellor/slots')}>
          Manage Availability Slots
        </Button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Assigned Sessions</h3>
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
            No assigned student appointments scheduled for today.
          </p>
        </div>
      </div>
    </div>
  );
};
