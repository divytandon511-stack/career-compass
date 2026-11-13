import React from 'react';
import { Button } from '@/components/shared/Button';

export const AdminCareersPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Career Catalogue Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Curate verified career roadmaps, subject requirements, and entrance examinations.
          </p>
        </div>
        <Button>+ Add New Career</Button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Curated Catalogue</h3>
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
            Catalogue items loaded from <code>GET /api/v1/careers</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
