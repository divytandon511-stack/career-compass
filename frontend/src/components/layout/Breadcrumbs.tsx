import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (pathnames.length === 0) return null;

  return (
    <nav aria-label="Breadcrumbs" style={{ padding: 'var(--space-3) 0', fontSize: '13px' }}>
      <ol style={{ display: 'flex', alignItems: 'center', listStyle: 'none', gap: '8px' }}>
        <li>
          <Link to="/" style={{ color: 'var(--text-muted)' }}>Home</Link>
        </li>
        {pathnames.map((name, index) => {
          const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          const formattedName = name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');

          return (
            <React.Fragment key={routeTo}>
              <li style={{ color: 'var(--text-dim)' }}>/</li>
              <li>
                {isLast ? (
                  <span aria-current="page" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                    {formattedName}
                  </span>
                ) : (
                  <Link to={routeTo} style={{ color: 'var(--text-muted)' }}>
                    {formattedName}
                  </Link>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};
