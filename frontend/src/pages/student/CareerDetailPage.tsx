import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';
import { SkeletonLoader } from '@/components/shared/SkeletonLoader';
import { careersApi } from '@/services/api/careers.api';
import { Career, SavedCareer } from '@/types/models';
import { DIMENSION_DETAILS } from '@/types/dimensions';
import { useAuth } from '@/hooks/useAuth';

export const CareerDetailPage: React.FC = () => {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user, authUser } = useAuth();

  const [career, setCareer] = useState<Career | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingSave, setIsTogglingSave] = useState<boolean>(false);

  const isStudent = (user?.role || authUser?.role) === 'STUDENT';

  // Check saved state for this career
  const checkSavedState = useCallback(async (careerId: string) => {
    if (!isAuthenticated || !isStudent) return;
    try {
      const res = await careersApi.getSavedCareers({ limit: 100 });
      const found = (res.data || []).some((sc: SavedCareer) => sc.id === careerId);
      setIsSaved(found);
    } catch {
      // Non-blocking
    }
  }, [isAuthenticated, isStudent]);

  // Load career detail
  useEffect(() => {
    if (!idOrSlug) return;

    let isMounted = true;
    async function loadCareer() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await careersApi.getCareer(idOrSlug!);
        if (!isMounted) return;

        const careerData = res.data;
        setCareer(careerData);

        if (careerData?.id) {
          checkSavedState(careerData.id);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(
          err instanceof Error ? err.message : 'Career pathway not found.'
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadCareer();
    return () => {
      isMounted = false;
    };
  }, [idOrSlug, checkSavedState]);

  // Handle Save / Unsave
  const handleToggleSave = async () => {
    if (!career) return;
    if (!isAuthenticated) {
      navigate(`/login?redirect=/careers/${idOrSlug}`);
      return;
    }

    const nextState = !isSaved;
    setIsSaved(nextState);
    setIsTogglingSave(true);

    try {
      if (nextState) {
        await careersApi.saveCareer(career.id);
      } else {
        await careersApi.removeSavedCareer(career.id);
      }
    } catch {
      // Rollback
      setIsSaved(!nextState);
    } finally {
      setIsTogglingSave(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <SkeletonLoader height="32px" width="30%" />
        <SkeletonLoader height="160px" borderRadius="var(--radius-lg)" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-6)' }}>
          <SkeletonLoader height="280px" borderRadius="var(--radius-lg)" />
          <SkeletonLoader height="280px" borderRadius="var(--radius-lg)" />
        </div>
      </div>
    );
  }

  if (error || !career) {
    return (
      <div style={{ maxWidth: '640px', margin: 'var(--space-12) auto' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--danger, #ef4444)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Career Blueprint Not Found</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-4)' }}>
            {error || 'The requested career pathway could not be found.'}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button onClick={() => navigate('/careers')}>Browse Career Explorer</Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Navigation Breadcrumb Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="outline" size="sm" onClick={() => navigate('/careers')}>
          ← Back to Career Explorer
        </Button>

        {isStudent && (
          <Button
            size="sm"
            variant={isSaved ? 'primary' : 'outline'}
            disabled={isTogglingSave}
            onClick={handleToggleSave}
          >
            {isSaved ? '★ Saved to Bookmarks' : '☆ Save to Bookmarks'}
          </Button>
        )}
      </div>

      {/* Hero Header Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(6, 182, 212, 0.12))',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          padding: 'var(--space-8)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--success, #10b981)',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Verified Educational Blueprint
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Profile v{career.profileVersion || '1.0'}
              </span>
            </div>

            <h1 style={{ fontSize: '2rem', margin: '0 0 var(--space-3) 0' }}>
              {career.title}
            </h1>

            <p style={{ color: 'var(--text-main)', fontSize: '15px', lineHeight: 1.6, maxWidth: '720px', margin: 0 }}>
              {career.description || career.summary || 'Detailed roadmap for secondary and higher secondary students navigating academic requirements and career milestones.'}
            </p>
          </div>
        </div>

        {career.sourceNote && (
          <div style={{ marginTop: 'var(--space-4)', fontSize: '12px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
            Source: {career.sourceNote}
          </div>
        )}
      </div>

      {/* 2-Column Content Layout: Pathways & Dimensions/Skills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Left Column: Educational Pathways */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>Chronological Education Roadmap</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
              Milestones from Secondary School (Classes 9-12) to Higher Education and Professional Entry.
            </p>
          </div>

          {career.pathways && career.pathways.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
              {career.pathways.map((pathway, idx) => (
                <div
                  key={pathway.id || idx}
                  style={{
                    position: 'relative',
                    paddingLeft: '24px',
                    borderLeft: '2px solid var(--primary)',
                  }}
                >
                  {/* Step dot */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-7px',
                      top: '2px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                      border: '2px solid var(--bg-surface)',
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                      Stage {idx + 1}: {pathway.stage}
                    </span>
                    {pathway.verifiedAt && (
                      <span style={{ fontSize: '10px', color: 'var(--success, #10b981)', fontWeight: 600 }}>
                        ✓ Verified
                      </span>
                    )}
                  </div>

                  <h4 style={{ fontSize: '14px', margin: '2px 0 4px 0', color: 'var(--text-main)' }}>
                    {pathway.qualification}
                  </h4>

                  {pathway.notes && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                      {pathway.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', padding: 'var(--space-4) 0' }}>
              Standard educational progression typically requires graduation in a related field and relevant entrance examinations. Consult your school counsellor for customized guidance.
            </p>
          )}
        </div>

        {/* Right Column: Required Skills & Interest Dimension Alignment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Skills Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>Essential Skills & Competencies</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: 'var(--space-4)' }}>
              Core foundational abilities emphasized in this career pathway.
            </p>

            {career.skills && career.skills.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {career.skills.map((skill) => (
                  <span
                    key={skill.id}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--bg-base)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                    }}
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                General foundational competencies across quantitative analysis, communication, and technical problem solving.
              </p>
            )}
          </div>

          {/* Dimension Alignment Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>NEP 2020 Dimension Weights</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: 'var(--space-4)' }}>
              Target preference profile used by the deterministic matching algorithm.
            </p>

            {career.dimensions && career.dimensions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {career.dimensions.map((dim) => {
                  const config = DIMENSION_DETAILS[dim.dimension] || { label: dim.dimension, color: '#6366f1' };
                  const pct = Math.round(dim.targetWeight * 100);

                  return (
                    <div key={dim.dimension}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: config.color }}>{config.label}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{pct}% Target</span>
                      </div>
                      <div
                        style={{
                          height: '6px',
                          width: '100%',
                          backgroundColor: 'var(--bg-base)',
                          borderRadius: 'var(--radius-full)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: config.color,
                            borderRadius: 'var(--radius-full)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                Balanced multidimensional interest profile.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <h4 style={{ margin: '0 0 4px 0' }}>Curious how your interests align with this career?</h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            Take our 30-question self-reported exploration to see your mathematical cosine alignment score.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button variant="secondary" onClick={() => navigate('/guidance')}>
            Ask Guidance Assistant
          </Button>
          <Button onClick={() => navigate('/assessments')}>
            Take Interest Assessment →
          </Button>
        </div>
      </div>
    </div>
  );
};
