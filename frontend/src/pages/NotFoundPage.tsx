import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '480px', margin: 'var(--space-12) auto', textAlign: 'center' }}>
      <div className="card">
        <div style={{ fontSize: '48px', marginBottom: 'var(--space-2)' }}>🧭</div>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>404 — Page Not Found</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-6)' }}>
          The pathway or resource you are looking for does not exist or has been moved.
        </p>
        <Button onClick={() => navigate('/')}>
          Return Home
        </Button>
      </div>
    </div>
  );
};
