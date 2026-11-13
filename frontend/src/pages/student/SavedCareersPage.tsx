import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/shared/Button';
import { SkeletonLoader } from '@/components/shared/SkeletonLoader';
import { EmptyState } from '@/components/shared/EmptyState';
import { careersApi } from '@/services/api/careers.api';
import { SavedCareer } from '@/types/models';
import { PaginationMeta } from '@/types/api';

export const SavedCareersPage: React.FC = () => {
  const navigate = useNavigate();

  const [savedCareers, setSavedCareers] = useState<SavedCareer[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchSaved = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await careersApi.getSavedCareers({
        page,
        limit: 12,
        sort: 'savedAt',
        order: 'desc',
      });
      setSavedCareers(res.data || []);
      if (res.meta) setMeta(res.meta);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to load bookmarked careers.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const handleRemove = async (careerId: string) => {
    const itemToRemove = savedCareers.find((c) => c.id === careerId);
    if (!itemToRemove) return;

    // Optimistic removal
    setSavedCareers((prev) => prev.filter((c) => c.id !== careerId));
    setRemovingId(careerId);

    try {
      await careersApi.removeSavedCareer(careerId);
    } catch {
      // Rollback on failure
      setSavedCareers((prev) => [itemToRemove, ...prev]);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Student Workspace • Bookmarks
          </span>
          <h1 style={{ fontSize: '1.75rem', marginTop: '4px' }}>Saved Careers</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Your bookmarked career blueprints and verified educational roadmaps for future reference.
          </p>
        </div>

        <Button variant="outline" onClick={() => navigate('/careers')}>
          Explore More Careers →
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderLeft: '4px solid var(--danger, #ef4444)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '14px', color: 'var(--text-main)' }}>{error}</span>
          <Button size="sm" variant="outline" onClick={fetchSaved}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'var(--space-6)',
          }}
        >
          <SkeletonLoader height="160px" borderRadius="var(--radius-lg)" />
          <SkeletonLoader height="160px" borderRadius="var(--radius-lg)" />
          <SkeletonLoader height="160px" borderRadius="var(--radius-lg)" />
        </div>
      ) : savedCareers.length === 0 ? (
        <EmptyState
          title="No Bookmarked Careers Yet"
          description="You haven't saved any career blueprints. Browse the Career Explorer directory to discover pathways that interest you and save them for review."
          actionText="Browse Career Explorer"
          onAction={() => navigate('/careers')}
        />
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 'var(--space-6)',
            }}
          >
            {savedCareers.map((saved) => (
              <div
                key={saved.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 'var(--space-4)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      Saved on{' '}
                      {saved.savedAt
                        ? new Date(saved.savedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Recently'}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${saved.title} from saved careers`}
                      disabled={removingId === saved.id}
                      onClick={() => handleRemove(saved.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: 'var(--danger, #ef4444)',
                        textDecoration: 'underline',
                        padding: 0,
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  <h3 style={{ fontSize: '1.2rem', margin: '0 0 6px 0' }}>
                    <Link
                      to={`/careers/${saved.slug}`}
                      style={{ color: 'var(--text-main)', textDecoration: 'none' }}
                    >
                      {saved.title}
                    </Link>
                  </h3>

                  <p
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {saved.summary || saved.description || 'Verified Indian educational milestone blueprint.'}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: 'var(--space-4)',
                  }}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/careers/${saved.slug}`)}
                  >
                    View Blueprint →
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 'var(--space-6)',
              }}
            >
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </Button>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Page {page} of {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
