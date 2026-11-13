import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export const CareerDetailPage: React.FC = () => {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
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
          Verified Government & Educational Pathway
        </span>
        <h2 style={{ textTransform: 'capitalize', marginTop: '4px' }}>
          {idOrSlug?.replace(/-/g, ' ')}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Verified roadmap covering secondary school subject choices, undergraduate degrees, and entrance exams.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-3)' }}>Chronological Pathway</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', fontSize: '14px' }}>
            <div>
              <strong>1. Secondary / Higher Secondary:</strong>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Class 11-12 with relevant core subjects.</p>
            </div>
            <div>
              <strong>2. Entrance Examinations:</strong>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>CUET / National / State level entrance tests.</p>
            </div>
            <div>
              <strong>3. Undergraduate Degree:</strong>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>3–4 Year accredited Bachelor's program.</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-3)' }}>Guidance Actions</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-6)' }}>
            Discuss this career roadmap with your school counsellor or ask MargDarshak AI for specific subject stream recommendations.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Button onClick={() => navigate('/counsellors')}>
              Book Counsellor Discussion
            </Button>
            <Button variant="secondary" onClick={() => navigate('/guidance')}>
              Ask MargDarshak AI
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
