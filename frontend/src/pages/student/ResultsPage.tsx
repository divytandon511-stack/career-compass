import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export const ResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h2>Assessment Interest Profile</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Attempt: {id} • Calculated across 6 interest dimensions
        </p>
      </div>

      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderLeft: '4px solid var(--primary)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          color: 'var(--text-main)',
        }}
      >
        Notice: These scores reflect your expressed interests and self-reported preferences, not an aptitude test or psychological certification.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-4)' }}>6-Axis Radar Summary</h3>
          <div
            style={{
              height: '240px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-base)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-dim)',
              fontSize: '13px',
            }}
          >
            Native HTML5 Canvas Spider Plot Placeholder
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-4)' }}>Dimension Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[
              { name: 'Analytical', color: 'var(--dim-analytical)' },
              { name: 'Creative', color: 'var(--dim-creative)' },
              { name: 'Social', color: 'var(--dim-social)' },
              { name: 'Practical', color: 'var(--dim-practical)' },
              { name: 'Organizational', color: 'var(--dim-organizational)' },
              { name: 'Investigative', color: 'var(--dim-investigative)' },
            ].map((dim) => (
              <div key={dim.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: dim.color }}>{dim.name}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Awaiting Attempt Scoring</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Button onClick={() => navigate(`/attempts/${id}/recommendations`)}>
          View Matched Career Recommendations →
        </Button>
      </div>
    </div>
  );
};
