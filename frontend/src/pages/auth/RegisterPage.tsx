import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InputField } from '@/components/shared/InputField';
import { SelectField } from '@/components/shared/SelectField';
import { Checkbox } from '@/components/shared/Checkbox';
import { Button } from '@/components/shared/Button';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/client';

export const RegisterPage: React.FC = () => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolGrade, setSchoolGrade] = useState('10');
  const [consentAccepted, setConsentAccepted] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      errors.displayName = 'Full name is required.';
    } else if (trimmedName.length > 100) {
      errors.displayName = 'Display name cannot exceed 100 characters.';
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please provide a valid email address.';
    } else if (trimmedEmail.length > 255) {
      errors.email = 'Email address cannot exceed 255 characters.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 12) {
      errors.password = 'Password must be at least 12 characters long.';
    } else if (new TextEncoder().encode(password).length > 128) {
      errors.password = 'Password cannot exceed 128 bytes.';
    }

    if (!consentAccepted) {
      errors.consentAccepted = 'You must accept the guardian/school policy consent to register.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    try {
      await authApi.register({
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        password,
        schoolGrade: schoolGrade || undefined,
        consentAccepted: true,
      });

      // Navigate to login with prefilled email and registration notice
      navigate('/login', {
        replace: true,
        state: { registered: true, email: email.trim().toLowerCase() },
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.details && Array.isArray(err.details)) {
          const mapped: Record<string, string> = {};
          err.details.forEach((d) => {
            if (d.field) mapped[d.field] = d.issue;
          });
          setFieldErrors(mapped);
        }

        if (err.status === 409) {
          setGeneralError('An account with this email address already exists. Please sign in instead.');
          setFieldErrors((prev) => ({ ...prev, email: 'Account already exists for this email.' }));
        } else if (err.status === 422) {
          setGeneralError('Please correct the highlighted fields before submitting.');
        } else if (err.status === 429) {
          setGeneralError('Too many registration requests. Please wait a few moments before trying again.');
        } else {
          setGeneralError(err.message || 'Registration failed. Please verify your information.');
        }
      } else {
        setGeneralError('Unable to connect to registration services. Please check your network.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '460px', margin: 'var(--space-8) auto' }}>
      <div className="card">
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Student Registration</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-6)' }}>
          Create your account to start your interest assessment and discover aligned career pathways.
        </p>

        {generalError && (
          <div
            role="alert"
            style={{
              padding: '12px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)',
              fontSize: '13px',
              marginBottom: 'var(--space-4)',
            }}
          >
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} noValidate>
          <InputField
            label="Full Name"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (fieldErrors.displayName) setFieldErrors((prev) => ({ ...prev, displayName: '' }));
            }}
            placeholder="Aarav Sharma"
            error={fieldErrors.displayName}
            autoComplete="name"
            required
          />

          <InputField
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
            }}
            placeholder="aarav@school.edu.in"
            error={fieldErrors.email}
            autoComplete="email"
            required
          />

          <InputField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
            }}
            placeholder="Minimum 12 characters"
            helperText="Must be at least 12 characters long"
            error={fieldErrors.password}
            autoComplete="new-password"
            required
          />

          <SelectField
            label="Current Secondary School Grade"
            value={schoolGrade}
            onChange={(e) => setSchoolGrade(e.target.value)}
            options={[
              { value: '9', label: 'Grade 9 (Secondary)' },
              { value: '10', label: 'Grade 10 (Secondary Board)' },
              { value: '11', label: 'Grade 11 (Higher Secondary)' },
              { value: '12', label: 'Grade 12 (Higher Secondary Board)' },
            ]}
          />

          <Checkbox
            checked={consentAccepted}
            onChange={(e) => {
              setConsentAccepted(e.target.checked);
              if (fieldErrors.consentAccepted) setFieldErrors((prev) => ({ ...prev, consentAccepted: '' }));
            }}
            error={fieldErrors.consentAccepted}
            label="I confirm that I am a secondary school student and agree to the school guidance data privacy policy."
          />

          <Button type="submit" isLoading={isLoading} style={{ marginTop: 'var(--space-2)' }}>
            Create Account
          </Button>
        </form>

        <div style={{ marginTop: 'var(--space-6)', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
};
