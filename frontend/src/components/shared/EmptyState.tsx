import React, { ReactNode } from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-12) var(--space-4)',
        textAlign: 'center',
        backgroundColor: 'var(--bg-surface)',
        border: '1px dashed var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {icon && <div style={{ fontSize: '40px', marginBottom: 'var(--space-4)', color: 'var(--primary)' }}>{icon}</div>}
      <h3 style={{ marginBottom: 'var(--space-2)' }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', maxWidth: '440px', marginBottom: actionText ? 'var(--space-6)' : 0 }}>
        {description}
      </p>
      {actionText && onAction && (
        <Button onClick={onAction}>{actionText}</Button>
      )}
    </div>
  );
};
