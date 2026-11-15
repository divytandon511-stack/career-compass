import React, { InputHTMLAttributes } from 'react';

export interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  id,
  label,
  error,
  helperText,
  style,
  ...props
}) => {
  const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      <label
        htmlFor={inputId}
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--text-main)',
        }}
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-surface)',
          border: `1px solid ${error ? 'var(--danger)' : 'var(--border-subtle)'}`,
          color: 'var(--text-main)',
          outline: 'none',
          transition: 'border-color 0.15s ease',
          ...style,
        }}
        {...props}
      />
      {error && (
        <span id={`${inputId}-error`} style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 500 }}>
          {error}
        </span>
      )}
      {!error && helperText && (
        <span id={`${inputId}-helper`} style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {helperText}
        </span>
      )}
    </div>
  );
};
