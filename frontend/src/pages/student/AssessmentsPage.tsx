import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export const AssessmentsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h2>Interest Assessments</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Standardized 30-question self-reported explorations assessing 6 NEP-aligned interest dimensions.
        </p>
      </div>

      <div className="card" style={{ maxWidth: '640px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--success)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Active • v1.0
            </span>
            <h3 style={{ marginTop: '4px' }}>Secondary School Career Interest Profiler</h3>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>~7 mins</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-6)' }}>
          Explores your preferences across Analytical, Creative, Social, Practical, Organizational, and Investigative domains.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <Button onClick={() => navigate('/assessments/default-v1/take')}>
            Start Assessment →
          </Button>
          <Button variant="outline" onClick={() => navigate('/attempts/latest/results')}>
            View Previous Results
          </Button>
        </div>
      </div>
    </div>
  );
};
