import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export const RecommendationsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h2>Career Recommendations</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Deterministic vector alignment based on your assessment results (Attempt: {id}).
        </p>
      </div>

      <div
        className="card"
        style={{
          borderLeft: '4px solid var(--secondary)',
          backgroundColor: 'rgba(6, 182, 212, 0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Rank #1 • 92% Alignment
            </span>
            <h3 style={{ marginTop: '4px' }}>Data Scientist / Quantitative Analyst</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Vector Alignment: Strong analytical and investigative interest dimensions.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button size="sm" variant="secondary" onClick={() => navigate('/careers/data-scientist')}>
              View Blueprint
            </Button>
            <Button size="sm" onClick={() => navigate('/guidance')}>
              Ask MargDarshak AI
            </Button>
          </div>
        </div>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
          Full algorithmic recommendation cards with structured reasons and cautions will be populated via <code>GET /api/v1/attempts/:id/recommendations</code>.
        </p>
      </div>
    </div>
  );
};
