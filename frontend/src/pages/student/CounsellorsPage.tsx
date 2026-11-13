import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';

export const CounsellorsPage: React.FC = () => {
  const navigate = useNavigate();

  const counsellors = [
    { id: 'counsellor-001', name: 'Dr. Sunita Rao', role: 'Senior Academic Counsellor', languages: 'English, Hindi', focus: 'STEM & Medical Streams' },
    { id: 'counsellor-002', name: 'Prof. Rajesh Kulkarni', role: 'Guidance Advisor', languages: 'English, Marathi', focus: 'Commerce & Humanities' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h2>Verified School Counsellors</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Schedule conflict-free one-on-one sessions with designated academic guidance advisors.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {counsellors.map((c) => (
          <div key={c.id} className="card">
            <h3 style={{ marginBottom: '4px' }}>{c.name}</h3>
            <span style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>{c.role}</span>
            <div style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-4)', fontSize: '13px', color: 'var(--text-muted)' }}>
              <div><strong>Focus:</strong> {c.focus}</div>
              <div><strong>Languages:</strong> {c.languages}</div>
            </div>
            <Button size="sm" onClick={() => navigate(`/counsellors/${c.id}/book`)}>
              View Available Slots & Book
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
