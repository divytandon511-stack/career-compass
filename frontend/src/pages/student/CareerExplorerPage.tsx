import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { InputField } from '@/components/shared/InputField';
import { SelectField } from '@/components/shared/SelectField';
import { Button } from '@/components/shared/Button';
import { SkeletonLoader } from '@/components/shared/SkeletonLoader';
import { EmptyState } from '@/components/shared/EmptyState';
import { careersApi } from '@/services/api/careers.api';
import { Career, SavedCareer, Skill } from '@/types/models';
import { PaginationMeta } from '@/types/api';
import { useAuth } from '@/hooks/useAuth';

export const CareerExplorerPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user, authUser } = useAuth();

  // Search & Filter state initialized from URL or defaults
  const initialQ = searchParams.get('q') || '';
  const initialSkill = searchParams.get('skillId') || '';
  const initialSort = (searchParams.get('sort') as 'title' | 'createdAt') || 'title';
  const initialOrder = (searchParams.get('order') as 'asc' | 'desc') || 'asc';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  const [query, setQuery] = useState<string>(initialQ);
  const [selectedSkill, setSelectedSkill] = useState<string>(initialSkill);
  const [sortField, setSortField] = useState<'title' | 'createdAt'>(initialSort);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialOrder);
  const [page, setPage] = useState<number>(initialPage);

  // Data state
  const [careers, setCareers] = useState<Career[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [savedCareerMap, setSavedCareerMap] = useState<Map<string, boolean>>(new Map());
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const isStudent = (user?.role || authUser?.role) === 'STUDENT';

  // Load skills for filter dropdown on mount
  useEffect(() => {
    let isMounted = true;
    async function loadSkills() {
      try {
        const res = await careersApi.listSkills({ limit: 50 });
        if (isMounted) {
          setSkills(res.data || []);
        }
      } catch {
        // Non-blocking
      }
    }
    loadSkills();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load saved careers if authenticated student
  const refreshSavedCareers = useCallback(async () => {
    if (!isAuthenticated || !isStudent) return;
    try {
      const res = await careersApi.getSavedCareers({ limit: 100 });
      const map = new Map<string, boolean>();
      (res.data || []).forEach((sc: SavedCareer) => map.set(sc.id, true));
      setSavedCareerMap(map);
    } catch {
      // Non-blocking
    }
  }, [isAuthenticated, isStudent]);

  useEffect(() => {
    refreshSavedCareers();
  }, [refreshSavedCareers]);

  // Main career listing fetch
  useEffect(() => {
    let isMounted = true;
    async function fetchCareers() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await careersApi.listCareers({
          page,
          limit: 12,
          q: query.trim() || undefined,
          skillId: selectedSkill || undefined,
          sort: sortField,
          order: sortOrder,
        });

        if (!isMounted) return;
        setCareers(res.data || []);
        if (res.meta) setMeta(res.meta);
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(
          err instanceof Error ? err.message : 'Unable to load careers directory.'
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchCareers();
    return () => {
      isMounted = false;
    };
  }, [query, selectedSkill, sortField, sortOrder, page]);

  // Sync state to URL search params
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (selectedSkill) params.set('skillId', selectedSkill);
    if (sortField !== 'title') params.set('sort', sortField);
    if (sortOrder !== 'asc') params.set('order', sortOrder);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [query, selectedSkill, sortField, sortOrder, page, setSearchParams]);

  // Handle Save/Unsave Bookmark
  const handleToggleSave = async (careerId: string) => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/careers');
      return;
    }

    const isSaved = savedCareerMap.get(careerId) ?? false;
    const nextSaved = !isSaved;

    // Optimistic update
    setSavedCareerMap((prev) => {
      const next = new Map(prev);
      if (nextSaved) next.set(careerId, true);
      else next.delete(careerId);
      return next;
    });

    setTogglingId(careerId);
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
        if (isSaved) next.set(careerId, true);
        else next.delete(careerId);
        return next;
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleClearFilters = () => {
    setQuery('');
    setSelectedSkill('');
    setSortField('title');
    setSortOrder('asc');
    setPage(1);
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
            Verified Career Pathways • NEP 2020
          </span>
          <h1 style={{ fontSize: '1.75rem', marginTop: '4px' }}>Career Explorer</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px', maxWidth: '640px' }}>
            Discover career blueprints with authenticated educational roadmaps, entrance exams, and subject selection guides.
          </p>
        </div>

        {isAuthenticated && isStudent && (
          <Button variant="secondary" onClick={() => navigate('/saved-careers')}>
            View Saved Careers ({savedCareerMap.size}) ★
          </Button>
        )}
      </div>

      {/* Filter and Search Bar Card */}
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-4)',
            alignItems: 'flex-end',
          }}
        >
          {/* Keyword Search */}
          <InputField
            label="Search Keywords"
            placeholder="Search by title or description..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />

          {/* Skill Filter */}
          <SelectField
            label="Filter by Required Skill"
            value={selectedSkill}
            onChange={(e) => {
              setSelectedSkill(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Standardized Skills' },
              ...skills.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />

          {/* Sort Order */}
          <SelectField
            label="Sort Directory"
            value={`${sortField}-${sortOrder}`}
            onChange={(e) => {
              const [f, o] = e.target.value.split('-') as ['title' | 'createdAt', 'asc' | 'desc'];
              setSortField(f);
              setSortOrder(o);
              setPage(1);
            }}
            options={[
              { value: 'title-asc', label: 'Career Title (A → Z)' },
              { value: 'title-desc', label: 'Career Title (Z → A)' },
              { value: 'createdAt-desc', label: 'Recently Added' },
              { value: 'createdAt-asc', label: 'Oldest Added' },
            ]}
          />

          {/* Reset Filters */}
          {(query || selectedSkill || sortField !== 'title' || sortOrder !== 'asc') && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button variant="outline" size="md" onClick={handleClearFilters}>
                Reset Filters
              </Button>
            </div>
          )}
        </div>
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
          <Button size="sm" variant="outline" onClick={() => setPage(1)}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'var(--space-6)',
          }}
        >
          <SkeletonLoader height="220px" borderRadius="var(--radius-lg)" />
          <SkeletonLoader height="220px" borderRadius="var(--radius-lg)" />
          <SkeletonLoader height="220px" borderRadius="var(--radius-lg)" />
          <SkeletonLoader height="220px" borderRadius="var(--radius-lg)" />
        </div>
      ) : careers.length === 0 ? (
        <EmptyState
          title="No Career Pathways Found"
          description="We couldn't find any published career blueprints matching your search filters. Try clearing your search query or selecting a different skill."
          actionText="Clear All Filters"
          onAction={handleClearFilters}
        />
      ) : (
        <>
          {/* Career Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 'var(--space-6)',
            }}
          >
            {careers.map((career) => {
              const isSaved = savedCareerMap.get(career.id) ?? false;
              const isToggling = togglingId === career.id;

              return (
                <div
                  key={career.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 'var(--space-4)',
                    transition: 'border-color 0.15s ease, transform 0.15s ease',
                  }}
                >
                  <div>
                    {/* Top Row: Meta and Bookmark */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 'var(--space-2)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--primary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Verified Blueprint
                      </span>

                      {/* Bookmark button */}
                      <button
                        type="button"
                        aria-label={isSaved ? `Remove ${career.title} from saved careers` : `Save ${career.title}`}
                        disabled={isToggling}
                        onClick={() => handleToggleSave(career.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '18px',
                          color: isSaved ? 'var(--primary)' : 'var(--text-dim)',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'transform 0.1s ease',
                        }}
                      >
                        {isSaved ? '★' : '☆'}
                      </button>
                    </div>

                    <h2
                      style={{
                        fontSize: '1.25rem',
                        margin: '0 0 var(--space-2) 0',
                        color: 'var(--text-main)',
                      }}
                    >
                      {career.title}
                    </h2>

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
                      {career.summary || career.description || 'Explore educational milestones, entrance exams, and verified career development roadmaps.'}
                    </p>
                  </div>

                  {/* Card Footer Actions */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: 'var(--space-4)',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      v{career.profileVersion || '1.0'}
                    </span>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/careers/${career.slug}`)}
                    >
                      Explore Roadmap →
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {meta && meta.totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 'var(--space-6)',
                padding: 'var(--space-4) 0',
                borderTop: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Previous Page
              </Button>

              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Page {page} of {meta.totalPages} ({meta.total} Total Careers)
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              >
                Next Page →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
