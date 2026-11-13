import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InputField } from '@/components/shared/InputField';
import { Button } from '@/components/shared/Button';

export const CareerExplorerPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const curatedCareers = [
    { slug: 'data-scientist', title: 'Data Scientist', domain: 'STEM', match: 'Analytical / Investigative' },
    { slug: 'ui-ux-designer', title: 'UI/UX Product Designer', domain: 'Design', match: 'Creative / Social' },
    { slug: 'chartered-accountant', title: 'Chartered Accountant', domain: 'Commerce', match: 'Organizational / Analytical' },
    { slug: 'clinical-psychologist', title: 'Clinical Psychologist', domain: 'Humanities', match: 'Social / Investigative' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h2>Career Explorer Directory</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Explore curated careers with verified Indian educational roadmaps and entrance examinations.
        </p>
      </div>

      <div style={{ maxWidth: '480px' }}>
        <InputField
          label="Search Careers"
          placeholder="Filter by title, discipline, or skills..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        {curatedCareers.map((career) => (
          <div key={career.slug} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
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
                {career.domain}
              </span>
              <h3 style={{ marginTop: '4px', marginBottom: '8px' }}>{career.title}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                Aligned with {career.match} preferences.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/careers/${career.slug}`)}>
              View Pathway Blueprint →
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
