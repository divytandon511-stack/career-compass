import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export interface WelcomeAssessmentCardProps {
  studentName?: string;
}

export const WelcomeAssessmentCard: React.FC<WelcomeAssessmentCardProps> = ({ studentName }) => {
  const navigate = useNavigate();

  return (
    <div
      className="card"
      style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(6, 182, 212, 0.12))',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        padding: 'var(--space-8)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            First-Time Onboarding • NEP 2020 Framework
          </span>
          <h2 style={{ fontSize: '1.5rem', marginTop: 'var(--space-1)' }}>
            Welcome to CareerCompass{studentName ? `, ${studentName}` : ''}!
          </h2>
        </div>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            fontSize: '12px',
            color: 'var(--text-main)',
            fontWeight: 600,
          }}
        >
          ⏱️ ~7 minutes
        </span>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, maxWidth: '680px' }}>
        Discover your unique educational pathway. Our 30-question self-reported exploration evaluates your interest preferences across Analytical, Creative, Social, Practical, Organizational, and Investigative domains.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center', marginTop: 'var(--space-2)' }}>
        <Button onClick={() => navigate('/assessments')}>
          Begin Your Interest Exploration →
        </Button>
        <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
          Transparent, deterministic matching • Zero psychological diagnosis
        </span>
      </div>
    </div>
  );
};
