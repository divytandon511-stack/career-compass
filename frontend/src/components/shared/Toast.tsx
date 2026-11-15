import React from 'react';

export interface ToastProps {
  type?: 'success' | 'warning' | 'error' | 'info';
  message: string;
  onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ type = 'info', message, onDismiss }) => {
  const getBorderColor = () => {
    switch (type) {
      case 'success': return 'var(--success)';
      case 'warning': return 'var(--warning)';
      case 'error': return 'var(--danger)';
      case 'info':
      default: return 'var(--primary)';
    }
  };

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: 'var(--bg-surface)',
        borderLeft: `4px solid ${getBorderColor()}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        color: 'var(--text-main)',
        fontSize: '14px',
        gap: '12px',
      }}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss alert"
          style={{ color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer' }}
        >
          &times;
        </button>
      )}
    </div>
  );
};
