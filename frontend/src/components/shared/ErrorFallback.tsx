import React from 'react';
import { Button } from './Button';

export interface ErrorFallbackProps {
  error?: Error;
  resetErrorBoundary?: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetErrorBoundary }) => {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '280px',
        padding: 'var(--space-8)',
        textAlign: 'center',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--danger)',
        borderRadius: 'var(--radius-lg)',
        margin: 'var(--space-6) 0',
      }}
    >
      <h2 style={{ color: 'var(--danger)', marginBottom: 'var(--space-3)' }}>
        Something went wrong
      </h2>
      <p style={{ color: 'var(--text-muted)', maxWidth: '480px', marginBottom: 'var(--space-6)' }}>
        {error?.message || 'An unexpected error occurred while loading this view.'}
      </p>
      {resetErrorBoundary && (
        <Button variant="secondary" onClick={resetErrorBoundary}>
          Try Again
        </Button>
      )}
    </div>
  );
};
