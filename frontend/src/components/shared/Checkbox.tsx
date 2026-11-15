import React, { InputHTMLAttributes } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode;
  error?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  id,
  label,
  error,
  style,
  ...props
}) => {
  const checkboxId = id || `checkbox-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <input
          id={checkboxId}
          type="checkbox"
          style={{
            marginTop: '3px',
            width: '18px',
            height: '18px',
            accentColor: 'var(--primary)',
            cursor: 'pointer',
            ...style,
          }}
          {...props}
        />
        <label
          htmlFor={checkboxId}
          style={{
            fontSize: '14px',
            lineHeight: 1.4,
            color: 'var(--text-main)',
            cursor: 'pointer',
          }}
        >
          {label}
        </label>
      </div>
      {error && (
        <span style={{ fontSize: '12px', color: 'var(--danger)', marginLeft: '28px' }}>
          {error}
        </span>
      )}
    </div>
  );
};
