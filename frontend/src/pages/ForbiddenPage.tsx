import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '480px', margin: 'var(--space-12) auto', textAlign: 'center' }}>
      <div className="card">
        <div style={{ fontSize: '48px', marginBottom: 'var(--space-2)' }}>🔒</div>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>403 — Access Forbidden</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-6)' }}>
          You do not have permission to access this resource. Please sign in with an authorized account or return to the student portal.
        </p>
        <Button onClick={() => navigate('/dashboard')}>
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
};
