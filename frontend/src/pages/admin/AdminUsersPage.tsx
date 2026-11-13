import React from 'react';

export const AdminUsersPage: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h2>User Account Management</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Manage student, counsellor, and administrative roles and status.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Registered Accounts</h3>
        <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>
            User table loaded from <code>GET /api/v1/admin/users</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
