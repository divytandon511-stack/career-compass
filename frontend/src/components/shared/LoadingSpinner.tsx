import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  style?: React.CSSProperties;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'var(--primary)',
  style,
}) => {
  const pixelSize = size === 'sm' ? '16px' : size === 'lg' ? '40px' : '24px';
  const borderWidth = size === 'sm' ? '2px' : '3px';

  return (
    <div
      role="status"
      aria-label="Loading..."
      style={{
        display: 'inline-block',
        width: pixelSize,
        height: pixelSize,
        border: `${borderWidth} solid rgba(99, 102, 241, 0.2)`,
        borderTop: `${borderWidth} solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        ...style,
      }}
    />
  );
};
