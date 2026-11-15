import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-surface)',
        padding: 'var(--space-8) 0',
        marginTop: 'auto',
      }}
    >
      <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h4 style={{ fontSize: '1rem', marginBottom: '4px' }}>CareerCompass Guidance System</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Empowering Grades 9–12 students with transparent, interest-aligned educational pathways.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>WCAG 2.1 AA Compliant</span>
            <span style={{ color: 'var(--text-muted)' }}>Zero Psychological Certification</span>
            <span style={{ color: 'var(--text-muted)' }}>Privacy-Preserved</span>
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 'var(--space-4)',
            fontSize: '12px',
            color: 'var(--text-dim)',
            lineHeight: 1.5,
          }}
        >
          Disclaimer: CareerCompass provides informational educational roadmaps and interest profiling based on self-reported inputs. Recommendations are deterministic vector alignments and do not guarantee career placement, admission, or examination results.
        </div>
      </div>
    </footer>
  );
};
