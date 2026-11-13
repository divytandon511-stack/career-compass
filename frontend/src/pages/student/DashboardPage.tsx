import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/shared/Button';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Welcome Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px',
              }}
            >
              Student Guidance Hub • Grade 10
            </div>
            <h2>Welcome back, {user?.displayName || 'Student'}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Explore interest-aligned careers, review past assessment results, or schedule a session with your guidance counsellor.
            </p>
          </div>
          <Button onClick={() => navigate('/assessments')}>
            Start New Assessment →
          </Button>
        </div>
      </div>

      {/* Grid of Section Teasers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' }}>
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-2)' }}>Assessment Profile</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-4)' }}>
            Your self-reported interest dimensions across Analytical, Creative, Social, Practical, Organizational, and Investigative fields.
          </p>
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--bg-base)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: '13px',
              marginBottom: 'var(--space-4)',
            }}
          >
            Radar Chart & Dimension Summary Placeholder (Stage D2 Foundation)
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/assessments')}>
            View Assessments
          </Button>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-2)' }}>Upcoming Appointments</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-4)' }}>
            One-on-one sessions scheduled with designated school academic guidance counsellors.
          </p>
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--bg-base)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: '13px',
              marginBottom: 'var(--space-4)',
            }}
          >
            No upcoming counselling sessions scheduled.
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/counsellors')}>
            Book a Counsellor
          </Button>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-2)' }}>MargDarshak AI Guidance</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-4)' }}>
            Ask natural language questions grounded in official educational pathways and career requirements.
          </p>
          <div
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--bg-base)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: '13px',
              marginBottom: 'var(--space-4)',
            }}
          >
            AI Guidance Companion Ready
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/guidance')}>
            Open MargDarshak AI
          </Button>
        </div>
      </div>
    </div>
  );
};
