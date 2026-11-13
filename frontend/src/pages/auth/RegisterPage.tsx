import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InputField } from '@/components/shared/InputField';
import { SelectField } from '@/components/shared/SelectField';
import { Checkbox } from '@/components/shared/Checkbox';
import { Button } from '@/components/shared/Button';
import { authApi } from '@/services/api/auth.api';

export const RegisterPage: React.FC = () => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolGrade, setSchoolGrade] = useState('10th');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentAccepted) {
      setError('You must accept the guardian/school policy consent to register.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await authApi.register({
        displayName,
        email,
        password,
        schoolGrade,
        consentAccepted,
      });
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please check the supplied fields.');
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

        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)',
              fontSize: '13px',
              marginBottom: 'var(--space-4)',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <InputField
            label="Full Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Aarav Sharma"
            required
          />
          <InputField
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="aarav@school.edu.in"
            required
          />
          <InputField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 12 characters"
            helperText="Must be at least 12 characters"
            required
          />
          <SelectField
            label="Current Secondary School Grade"
            value={schoolGrade}
            onChange={(e) => setSchoolGrade(e.target.value)}
            options={[
              { value: '9th', label: 'Grade 9 (Secondary)' },
              { value: '10th', label: 'Grade 10 (Secondary Board)' },
              { value: '11th', label: 'Grade 11 (Higher Secondary)' },
              { value: '12th', label: 'Grade 12 (Higher Secondary Board)' },
            ]}
          />
          <Checkbox
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
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
