import React, { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { Breadcrumbs } from './Breadcrumbs';

export interface AppLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, showSidebar = true }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Header />
      <div style={{ display: 'flex', flex: 1 }}>
        {showSidebar && <Sidebar />}
        <main
          id="main-content"
          role="main"
          style={{
            flex: 1,
            padding: 'var(--space-6)',
            backgroundColor: 'var(--bg-base)',
            minHeight: 'calc(100vh - 140px)',
          }}
        >
          <div className="container">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
};
