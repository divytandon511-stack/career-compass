import React, { useEffect, useState, useContext } from 'react';
import { userApi } from '@/services/api/user.api';
import { AuthContext } from '@/context/AuthContext';
import { UserProfile } from '@/types/models';
import { Button } from '@/components/shared/Button';
import { InputField } from '@/components/shared/InputField';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export const ProfilePage: React.FC = () => {
  const auth = useContext(AuthContext);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [schoolGrade, setSchoolGrade] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);
        const res = await userApi.getProfile();
        if (isMounted && res.data) {
          setProfile(res.data);
          setDisplayName(res.data.displayName || '');
          const studentProfile = res.data.profile as { schoolGrade?: string | null } | null;
          setSchoolGrade(studentProfile?.schoolGrade || '');
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load user profile');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Display name cannot be empty');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      const res = await userApi.updateProfile({
        displayName: displayName.trim(),
        schoolGrade: schoolGrade.trim() || undefined,
      });
      setProfile(res.data);
      setSuccessMessage('Profile updated successfully!');
      // Update in auth context if method exists
      if (auth?.refreshSession) {
        await auth.refreshSession();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Account Settings
        </span>
        <h2>Student Profile</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Manage your personal details and academic grade level.
        </p>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div
          role="status"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid var(--success)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--success)',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* Account Info Card */}
      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Account Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Email Address
            </span>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
              {profile?.email}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Role
            </span>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', marginTop: '2px' }}>
              {profile?.role}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
              Account Status
            </span>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--success)', marginTop: '2px' }}>
              {profile?.status}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Edit Details</h3>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <InputField
            label="Display Name"
            name="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your full name"
            required
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="school-grade-select" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
              School Grade (Class)
            </label>
            <select
              id="school-grade-select"
              value={schoolGrade}
              onChange={(e) => setSchoolGrade(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-base)',
                color: 'var(--text-main)',
                fontSize: '14px',
                outline: 'none',
              }}
            >
              <option value="">Select your class...</option>
              <option value="Class 9">Class 9 (Secondary Foundation)</option>
              <option value="Class 10">Class 10 (Secondary Board Year)</option>
              <option value="Class 11">Class 11 (Higher Secondary Stream Specialization)</option>
              <option value="Class 12">Class 12 (Higher Secondary Board & Competitive Prep)</option>
            </select>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Grade level ensures stream pathways and subject recommendations align with your CBSE/ICSE/State curriculum stage.
            </span>
          </div>

          <div style={{ marginTop: 'var(--space-2)' }}>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving Changes...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
