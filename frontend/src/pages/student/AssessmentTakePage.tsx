import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export const AssessmentTakePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Assessment ID: {id}
          </span>
          <span
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--primary)',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            ANALYTICAL DIMENSION
          </span>
        </div>

        <h3 style={{ marginBottom: 'var(--space-4)' }}>
          Interactive Assessment Runner (Placeholder — Stage D2 Foundation)
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-6)' }}>
          In Stage D3, this wizard renders the 30-question bank with dynamic progress bar, question status palette, auto-save PUT requests, and review modal.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <Button onClick={() => navigate('/attempts/latest/results')}>
            Simulate Complete & View Results
          </Button>
          <Button variant="secondary" onClick={() => navigate('/assessments')}>
            Return to Assessments
          </Button>
        </div>
      </div>
    </div>
  );
};
