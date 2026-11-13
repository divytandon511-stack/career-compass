import React from 'react';

export const AdminDashboardPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h2>School Administration & Analytics Hub</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Privacy-preserving aggregate metrics with k-anonymity suppression (k ≥ 5).
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Assessments Completed
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: 'var(--primary)' }}>
            —
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Aggregated cohort count</span>
        </div>

        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Active Counsellor Slots
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: 'var(--secondary)' }}>
            —
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>School-wide availability</span>
        </div>

        <div className="card">
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
            Top Expressed Dimension
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', color: 'var(--success)' }}>
            —
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>k-suppression enforced</span>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-2)' }}>Privacy Suppression Notice</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          In accordance with NEP student privacy standards, aggregate cohorts with fewer than 5 respondents are automatically suppressed to prevent deanonymization.
        </p>
      </div>
    </div>
  );
};
