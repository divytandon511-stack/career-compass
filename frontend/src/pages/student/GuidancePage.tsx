import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export const GuidancePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h2>MargDarshak AI Career Guidance</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Conversational explanations grounded in verified educational catalogue data and your assessment scores.
        </p>
      </div>

      <div
        className="card"
        style={{
          borderLeft: '4px solid var(--accent-pink)',
          backgroundColor: 'rgba(236, 72, 153, 0.05)',
        }}
      >
        <h3 style={{ marginBottom: 'var(--space-2)' }}>Safety & Grounding Commitment</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
          MargDarshak AI never calculates, modifies, or overrides mathematical recommendation scores. All suggestions are strictly referenced against vetted career roadmaps and school curricula.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Start a New Guidance Exploration</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-6)' }}>
          Ask questions such as "Which Class 11 stream best supports my analytical interest profile?" or "What are the entrance exams for becoming a Data Scientist?"
        </p>
        <Button onClick={() => navigate('/guidance/session-demo')}>
          Launch Interactive Guidance Chat →
        </Button>
      </div>
    </div>
  );
};
