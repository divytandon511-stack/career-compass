import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthContext } from '@/context/AuthContext';

export const Sidebar: React.FC = () => {
  const auth = useContext(AuthContext);
  const role = auth?.user?.role || auth?.authUser?.role;

  const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: '14px',
    fontWeight: 500,
    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
    textDecoration: 'none',
    transition: 'all 0.15s ease',
  });

  return (
    <aside
      aria-label="Sidebar Navigation"
      style={{
        width: '240px',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        padding: 'var(--space-6) var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}
    >
      {/* Student Links — rendered when role is STUDENT or by default for navigation */}
      {(!role || role === 'STUDENT') && (
        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-dim)',
              paddingLeft: 'var(--space-2)',
              display: 'block',
              marginBottom: 'var(--space-2)',
            }}
          >
            Student Workspace
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <NavLink to="/dashboard" style={navLinkStyle}>Dashboard</NavLink>
            <NavLink to="/assessments" style={navLinkStyle}>Assessments</NavLink>
            <NavLink to="/careers" style={navLinkStyle}>Career Explorer</NavLink>
            <NavLink to="/saved-careers" style={navLinkStyle}>Saved Careers</NavLink>
            <NavLink to="/counsellors" style={navLinkStyle}>Counsellors</NavLink>
            <NavLink to="/bookings" style={navLinkStyle}>My Bookings</NavLink>
            <NavLink to="/guidance" style={navLinkStyle}>MargDarshak AI</NavLink>
            <NavLink to="/profile" style={navLinkStyle}>My Profile</NavLink>
          </div>
        </div>
      )}

      {role === 'COUNSELLOR' && (
        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--secondary)',
              paddingLeft: 'var(--space-2)',
              display: 'block',
              marginBottom: 'var(--space-2)',
            }}
          >
            Counsellor Portal
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <NavLink to="/counsellor/dashboard" style={navLinkStyle}>Appointments</NavLink>
            <NavLink to="/counsellor/slots" style={navLinkStyle}>Manage Slots</NavLink>
            <NavLink to="/careers" style={navLinkStyle}>Career Catalogue</NavLink>
          </div>
        </div>
      )}

      {role === 'ADMIN' && (
        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--warning)',
              paddingLeft: 'var(--space-2)',
              display: 'block',
              marginBottom: 'var(--space-2)',
            }}
          >
            School Administration
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <NavLink to="/admin/dashboard" style={navLinkStyle}>Analytics Hub</NavLink>
            <NavLink to="/admin/careers" style={navLinkStyle}>Career Catalogue</NavLink>
            <NavLink to="/admin/users" style={navLinkStyle}>User Management</NavLink>
          </div>
        </div>
      )}
    </aside>
  );
};
