import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '@/services/api/booking.api';
import { UserProfile } from '@/types/models';
import { Button } from '@/components/shared/Button';
import { InputField } from '@/components/shared/InputField';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export const CounsellorsPage: React.FC = () => {
  const navigate = useNavigate();
  const [counsellors, setCounsellors] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCounsellors = useCallback(async (q?: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await bookingApi.listCounsellors({ q });
      setCounsellors(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load counsellors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCounsellors(searchQuery.trim() || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchCounsellors]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Academic Guidance
          </span>
        </div>
        <h2>Verified School Counsellors</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px', maxWidth: '680px' }}>
          Schedule conflict-free one-on-one sessions with designated school academic advisors. Discuss stream selection, entrance examinations, and personal career roadmaps.
        </p>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <InputField
              label=""
              placeholder="Search advisors by name or guidance specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search counsellors"
            />
          </div>
          {searchQuery && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSearchQuery('')}
              style={{ height: '42px' }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={() => fetchCounsellors(searchQuery.trim() || undefined)}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <LoadingSpinner />
        </div>
      ) : counsellors.length === 0 ? (
        /* Empty state */
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div style={{ fontSize: '36px', marginBottom: 'var(--space-2)' }}>👨‍🏫</div>
          <h3>No Counsellors Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: 'var(--space-2)', maxWidth: '440px', margin: 'var(--space-2) auto 0' }}>
            {searchQuery
              ? `No advisors match "${searchQuery}". Try a different search term.`
              : 'There are no active counsellors registered on the platform at this time.'}
          </p>
        </div>
      ) : (
        /* Counsellor Grid */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 'var(--space-6)',
          }}
        >
          {counsellors.map((counsellor) => {
            const profile = counsellor.profile as { bio?: string | null; active?: boolean } | null;
            return (
              <div
                key={counsellor.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 'var(--space-4)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {counsellor.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px' }}>{counsellor.displayName}</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{counsellor.email}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        color: 'var(--primary)',
                      }}
                    >
                      Verified Advisor
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: 'var(--success)',
                      }}
                    >
                      Available
                    </span>
                  </div>

                  {profile?.bio ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {profile.bio}
                    </p>
                  ) : (
                    <p style={{ fontSize: '13px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      Certified academic and career guidance counsellor.
                    </p>
                  )}
                </div>

                <Button
                  size="sm"
                  onClick={() => navigate(`/counsellors/${counsellor.id}/book`)}
                  style={{ width: '100%' }}
                >
                  View Available Slots & Book
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
