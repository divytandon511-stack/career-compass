import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/shared/Button';
import { SkeletonLoader } from '@/components/shared/SkeletonLoader';
import { EmptyState } from '@/components/shared/EmptyState';
import { assessmentApi } from '@/services/api/assessment.api';
import { careersApi } from '@/services/api/careers.api';
import { Recommendation, SavedCareer } from '@/types/models';
import { PaginationMeta } from '@/types/api';

export const RecommendationsPage: React.FC = () => {
  const { id: attemptId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [savedCareerMap, setSavedCareerMap] = useState<Map<string, boolean>>(new Map());
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCareerId, setSavingCareerId] = useState<string | null>(null);

  // Load recommendations and saved careers
  useEffect(() => {
    if (!attemptId) return;

    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [recsRes, savedRes] = await Promise.all([
          assessmentApi.getRecommendations(attemptId!, currentPage, 10),
          careersApi.getSavedCareers({ limit: 50 }).catch(() => ({ data: [] as SavedCareer[] })),
        ]);

        if (!isMounted) return;

        setRecommendations(recsRes.data || []);
        if (recsRes.meta) setMeta(recsRes.meta);

        // Map saved career IDs
        const map = new Map<string, boolean>();
        (savedRes.data || []).forEach((sc) => {
          map.set(sc.id, true);
        });
        setSavedCareerMap(map);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(
          err instanceof Error ? err.message : 'Unable to load career recommendations.'
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [attemptId, currentPage]);

  // Toggle Save/Unsave Career
  const handleToggleSave = async (careerId: string) => {
    const isCurrentlySaved = savedCareerMap.get(careerId) ?? false;
    const nextSaved = !isCurrentlySaved;

    // Optimistic update
    setSavedCareerMap((prev) => {
      const next = new Map(prev);
      if (nextSaved) next.set(careerId, true);
      else next.delete(careerId);
      return next;
    });

    setSavingCareerId(careerId);
    try {
      if (nextSaved) {
        await careersApi.saveCareer(careerId);
      } else {
        await careersApi.removeSavedCareer(careerId);
      }
    } catch {
      // Rollback on failure
      setSavedCareerMap((prev) => {
        const next = new Map(prev);
        if (isCurrentlySaved) next.set(careerId, true);
        else next.delete(careerId);
        return next;
      });
    } finally {
      setSavingCareerId(null);
    }
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <SkeletonLoader height="36px" width="40%" />
        <SkeletonLoader height="180px" borderRadius="var(--radius-lg)" />
        <SkeletonLoader height="180px" borderRadius="var(--radius-lg)" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '640px', margin: 'var(--space-12) auto' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--danger, #ef4444)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Unable to Load Recommendations</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-4)' }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button onClick={() => window.location.reload()}>Retry</Button>
            <Button variant="outline" onClick={() => navigate('/assessments')}>
              Back to Assessments
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Deterministic Vector Matching • NEP 2020
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              Attempt: {attemptId?.substring(0, 8)}...
            </span>
          </div>

          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Career Recommendations</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Ranked by multi-dimensional cosine similarity matching your 6 interest vectors with verified career profiles.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button variant="outline" onClick={() => navigate(`/attempts/${attemptId}/results`)}>
            ← View 6-Axis Profile
          </Button>
          <Button variant="secondary" onClick={() => navigate('/saved-careers')}>
            View Saved Careers ({savedCareerMap.size})
          </Button>
        </div>
      </div>

      {/* Zero Recommendations State */}
      {recommendations.length === 0 ? (
        <EmptyState
          title="No Career Matches Generated"
          description="We couldn't generate career recommendations for this attempt. Ensure all questions were answered or try retaking the exploration."
          actionText="Retake Assessment"
          onAction={() => navigate('/assessments')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Recommendations List */}
          {recommendations.map((rec) => {
            const isSaved = savedCareerMap.get(rec.career.id) ?? false;
            const isToggling = savingCareerId === rec.career.id;
            const pct = Math.round(rec.similarityScore * 100);

            return (
              <div
                key={rec.career.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-4)',
                  borderLeft: rec.rank === 1 ? '4px solid var(--primary)' : '1px solid var(--border-subtle)',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor:
                            rec.rank === 1
                              ? 'rgba(99, 102, 241, 0.15)'
                              : 'rgba(6, 182, 212, 0.15)',
                          color: rec.rank === 1 ? 'var(--primary)' : 'var(--secondary)',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        Rank #{rec.rank}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          color: 'var(--success, #10b981)',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        {pct}% Vector Alignment
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        Cosine: {rec.similarityScore.toFixed(3)}
                      </span>
                    </div>

                    <h2 style={{ fontSize: '1.35rem', margin: '4px 0' }}>
                      <Link
                        to={`/careers/${rec.career.slug}`}
                        style={{ color: 'var(--text-main)', textDecoration: 'none' }}
                      >
                        {rec.career.title}
                      </Link>
                    </h2>
                  </div>

                  {/* Bookmark Button */}
                  <Button
                    size="sm"
                    variant={isSaved ? 'primary' : 'outline'}
                    disabled={isToggling}
                    onClick={() => handleToggleSave(rec.career.id)}
                  >
                    {isSaved ? '★ Saved' : '☆ Save Career'}
                  </Button>
                </div>

                {/* Reasons List */}
                {rec.reasons && rec.reasons.length > 0 && (
                  <div
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'var(--bg-base)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--success, #10b981)',
                        display: 'block',
                        marginBottom: '6px',
                      }}
                    >
                      Key Alignment Factors:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                      {rec.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cautions List if present */}
                {rec.cautions && rec.cautions.length > 0 && (
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'rgba(245, 158, 11, 0.08)',
                      borderRadius: 'var(--radius-md)',
                      borderLeft: '3px solid var(--warning, #f59e0b)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--warning, #f59e0b)',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                    >
                      Important Considerations:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {rec.cautions.map((caution, idx) => (
                        <li key={idx}>{caution}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer Action */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/careers/${rec.career.slug}`)}
                  >
                    Explore Career Roadmap & Pathways →
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3) 0',
              }}
            >
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ← Previous Page
              </Button>

              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Page {currentPage} of {meta.totalPages} ({meta.total} Total Matches)
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= meta.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(meta.totalPages, p + 1))}
              >
                Next Page →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
