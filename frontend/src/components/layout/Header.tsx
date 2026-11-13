import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '@/context/AuthContext';
import { ThemeContext } from '@/context/ThemeContext';
import { Button } from '../shared/Button';

export const Header: React.FC = () => {
  const auth = useContext(AuthContext);
  const themeCtx = useContext(ThemeContext);
  const navigate = useNavigate();

  return (
    <header style={{ width: '100%', position: 'sticky', top: 0, zIndex: 100 }}>
      {/* MoE / Samagra Shiksha Policy Banner Strip */}
      <div
        style={{
          background: 'linear-gradient(90deg, #1e3a8a, #3b82f6)',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 600,
          padding: '4px var(--space-4)',
          textAlign: 'center',
          letterSpacing: '0.025em',
        }}
      >
        Government of India • Ministry of Education • Samagra Shiksha Abhiyan • NEP 2020 Aligned
      </div>

      {/* Main Navigation Bar */}
      <nav
        aria-label="Main Navigation"
        style={{
          backgroundColor: 'var(--bg-glass)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: 'var(--space-3) 0',
        }}
      >
        <div className="container flex items-center justify-between">
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              color: 'var(--text-main)',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--primary-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: '18px',
              }}
            >
              C
            </div>
            <div>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                CareerCompass
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                }}
              >
                Secondary School Guidance
              </span>
            </div>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-6" style={{ fontSize: '14px', fontWeight: 500 }}>
            <Link to="/careers" style={{ color: 'var(--text-main)' }}>Career Explorer</Link>
            <Link to="/counsellors" style={{ color: 'var(--text-main)' }}>Counsellors</Link>
            {auth?.user && (
              <>
                <Link to="/dashboard" style={{ color: 'var(--text-main)' }}>Dashboard</Link>
                <Link to="/assessments" style={{ color: 'var(--text-main)' }}>Assessments</Link>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {themeCtx && (
              <button
                onClick={themeCtx.toggleTheme}
                aria-label={`Switch to ${themeCtx.theme === 'dark' ? 'light' : 'dark'} mode`}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                }}
              >
                {themeCtx.theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
              </button>
            )}

            {auth?.user ? (
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {auth.user.displayName || auth.user.email}
                </span>
                <Button variant="secondary" size="sm" onClick={() => auth.logout()}>
                  Log Out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => navigate('/login')}>
                  Log In
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/register')}>
                  Register
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};
