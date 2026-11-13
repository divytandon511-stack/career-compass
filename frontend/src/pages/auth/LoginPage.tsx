import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { InputField } from '@/components/shared/InputField';
import { Button } from '@/components/shared/Button';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/api/client';
import { UserRole } from '@/types/models';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login, isAuthenticated, user, authUser, sessionError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const registeredNotice = (location.state as { registered?: boolean; email?: string } | null)?.registered;
  const prefillEmail = (location.state as { email?: string } | null)?.email;

  useEffect(() => {
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, [prefillEmail]);

  // Determine role-appropriate landing destination
  const getDestinationForRole = (role?: UserRole): string => {
    const redirectParam = searchParams.get('redirect');
    if (redirectParam) {
      try {
        const decoded = decodeURIComponent(redirectParam);
        if (decoded.startsWith('/') && !decoded.startsWith('//')) {
          return decoded;
        }
      } catch {
        // invalid URI component
      }
    }

    switch (role) {
      case 'COUNSELLOR':
        return '/counsellor/dashboard';
      case 'ADMIN':
        return '/admin/dashboard';
      case 'STUDENT':
      default:
        return '/dashboard';
    }
  };

  // If already authenticated, redirect to intended destination
  useEffect(() => {
    if (isAuthenticated) {
      const activeRole = user?.role || authUser?.role;
      navigate(getDestinationForRole(activeRole), { replace: true });
    }
  }, [isAuthenticated, user, authUser, navigate]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
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
      const authenticatedUser = await login({ email: email.trim(), password });
      navigate(getDestinationForRole(authenticatedUser.role), { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.details && Array.isArray(err.details)) {
          const mapped: Record<string, string> = {};
          err.details.forEach((d) => {
            if (d.field) mapped[d.field] = d.issue;
          });
          setFieldErrors(mapped);
        }
        if (err.status === 401) {
          setGeneralError('Invalid email or password. Please verify your credentials and try again.');
        } else if (err.status === 429) {
          setGeneralError('Too many login attempts. Please wait a few moments before trying again.');
        } else {
          setGeneralError(err.message || 'Authentication failed. Please try again.');
        }
      } else {
        setGeneralError('Network connection failed. Please ensure the backend service is running.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '420px', margin: 'var(--space-12) auto' }}>
      <div className="card">
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Student & Staff Sign In</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-6)' }}>
          Access your CareerCompass assessment history, guidance notes, and verified roadmaps.
        </p>

        {registeredNotice && (
          <div
            role="status"
            style={{
              padding: '12px 14px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid var(--success)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--success)',
              fontSize: '13px',
              marginBottom: 'var(--space-4)',
            }}
          >
            Account created successfully! Please sign in with your password to continue.
          </div>
        )}

        {sessionError && !registeredNotice && (
          <div
            role="alert"
            style={{
              padding: '12px 14px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid var(--warning)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--warning)',
              fontSize: '13px',
              marginBottom: 'var(--space-4)',
            }}
          >
            {sessionError}
          </div>
        )}

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
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
            }}
            placeholder="student@school.edu.in"
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
            placeholder="Enter your password"
            error={fieldErrors.password}
            autoComplete="current-password"
            required
          />

          <Button type="submit" isLoading={isLoading} style={{ marginTop: 'var(--space-2)' }}>
            Sign In
          </Button>
        </form>

        <div style={{ marginTop: 'var(--space-6)', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
          Don't have an account yet?{' '}
          <Link to="/register" style={{ fontWeight: 600 }}>Create student account</Link>
        </div>
      </div>
    </div>
  );
};
