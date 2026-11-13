import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', padding: 'var(--space-8) 0' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            color: 'var(--primary)',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 'var(--space-4)',
          }}
        >
          NEP 2020 Aligned School Guidance
        </div>
        <h1 style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)', fontWeight: 800 }}>
          Find Your Academic Stream and Career Pathway
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
          CareerCompass helps secondary school students (Grades 9–12) explore verified educational roadmaps, understand interest profiles, and connect with certified school counsellors.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button size="lg" onClick={() => navigate('/register')}>
            Begin Assessment Exploration →
          </Button>
          <Button size="lg" variant="secondary" onClick={() => navigate('/careers')}>
            Explore Career Blueprints
          </Button>
        </div>
      </section>

      {/* Feature Grid */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)' }}>
        <div className="card">
          <div style={{ fontSize: '24px', marginBottom: 'var(--space-2)' }}>🎯</div>
          <h3 style={{ marginBottom: 'var(--space-2)' }}>Interest Profiling</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            A 30-question self-reported assessment evaluating 6 core interest dimensions: Analytical, Creative, Social, Practical, Organizational, and Investigative.
          </p>
        </div>

        <div className="card">
          <div style={{ fontSize: '24px', marginBottom: 'var(--space-2)' }}>📊</div>
          <h3 style={{ marginBottom: 'var(--space-2)' }}>Mathematical Ranking</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Transparent weighted cosine similarity matches student vectors against curated career vectors. Deterministic, explainable, and zero psychometric certification.
          </p>
        </div>

        <div className="card">
          <div style={{ fontSize: '24px', marginBottom: 'var(--space-2)' }}>🏫</div>
          <h3 style={{ marginBottom: 'var(--space-2)' }}>Counsellor Guidance</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Conflict-free slot booking with school guidance advisors. One-on-one sessions grounded in objective student interest profiles.
          </p>
        </div>
      </section>
    </div>
  );
};
