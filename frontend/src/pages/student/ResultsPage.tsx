import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';
import { SkeletonLoader } from '@/components/shared/SkeletonLoader';
import { RadarChart } from '@/components/student/RadarChart';
import { assessmentApi } from '@/services/api/assessment.api';
import { AssessmentAttempt, Recommendation } from '@/types/models';
import { DIMENSIONS, DIMENSION_DETAILS } from '@/types/dimensions';

export const ResultsPage: React.FC = () => {
  const { id: attemptId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [topRecommendations, setTopRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;

    let isMounted = true;
    async function loadResults() {
      setIsLoading(true);
      setError(null);
      try {
        const attemptRes = await assessmentApi.getAttempt(attemptId!);
        if (!isMounted) return;

        const attemptData = attemptRes.data;
        setAttempt(attemptData);

        // If completed, fetch top recommendations preview
        if (attemptData.status === 'COMPLETED') {
          try {
            const recRes = await assessmentApi.getRecommendations(attemptId!, 1, 3);
            if (isMounted) {
              setTopRecommendations(recRes.data || []);
            }
          } catch {
            // Non-blocking recommendations fetch
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(
          err instanceof Error ? err.message : 'Unable to load assessment results.'
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadResults();
    return () => {
      isMounted = false;
    };
  }, [attemptId]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '960px', margin: '0 auto' }}>
        <SkeletonLoader height="36px" width="50%" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
          <SkeletonLoader height="320px" borderRadius="var(--radius-lg)" />
          <SkeletonLoader height="320px" borderRadius="var(--radius-lg)" />
        </div>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div style={{ maxWidth: '640px', margin: 'var(--space-12) auto' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--danger, #ef4444)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Assessment Results Not Found</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-4)' }}>
            {error || 'The requested assessment attempt could not be found or you do not have permission to view it.'}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button onClick={() => navigate('/assessments')}>Back to Assessments</Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  // Handle in-progress attempt state
  if (attempt.status !== 'COMPLETED') {
    return (
      <div style={{ maxWidth: '640px', margin: 'var(--space-12) auto' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--warning, #f59e0b)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Assessment In Progress</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-4)' }}>
            This assessment attempt has not been finalized yet. Complete all questions to view your 6-axis profile and personalized career recommendations.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button onClick={() => navigate(`/assessments/${attempt.assessmentId}/take`)}>
              Resume Assessment →
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const scores = attempt.scoresJson || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--success)',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Completed Assessment
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                Attempt ID: {attempt.id.substring(0, 8)}... • Version {attempt.assessmentVersion || '1'}
              </span>
            </div>

            <h1 style={{ fontSize: '1.75rem' }}>Your Interest Exploration Profile</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Completed on{' '}
              {attempt.completedAt
                ? new Date(attempt.completedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recently'}{' '}
              • Algorithm: {attempt.algorithmVersion || 'Cosine v1.0'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button onClick={() => navigate(`/attempts/${attempt.id}/recommendations`)}>
              View Career Matches ({topRecommendations.length > 0 ? `${topRecommendations.length}+` : 'Explore'}) →
            </Button>
          </div>
        </div>
      </div>

      {/* Advisory Banner */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(99, 102, 241, 0.08)',
          borderLeft: '4px solid var(--primary)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          color: 'var(--text-main)',
          lineHeight: 1.5,
        }}
      >
        <strong>NEP 2020 Guidance Notice:</strong> These dimension scores represent your self-reported interests and educational preferences. They are designed to suggest aligned pathways for exploration and do not constitute an aptitude limit or psychological certification.
      </div>

      {/* 2-Column Main Profile Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)' }}>
        {/* Radar Chart Summary */}
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-2)' }}>6-Axis Interest Radar</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: 'var(--space-4)' }}>
            Visual spider plot mapping your preference balance across the 6 normalized interest vectors.
          </p>

          <RadarChart scores={scores} size={300} />

          <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.4, display: 'block' }}>
              * Scores are mathematically normalized from 0.00 to 1.00 based on standard item weighting.
            </span>
          </div>
        </div>

        {/* Detailed Dimension Breakdown */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Dimension-by-Dimension Breakdown</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: 'var(--space-4)' }}>
              Individual score strengths and domain interpretations.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {DIMENSIONS.map((dim) => {
                const rawVal = scores[dim] ?? 0;
                const normalized = Math.min(1.0, Math.max(0.0, rawVal));
                const pct = Math.round(normalized * 100);
                const config = DIMENSION_DETAILS[dim];

                return (
                  <div
                    key={dim}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'var(--bg-base)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: config.color,
                            display: 'inline-block',
                          }}
                        />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {config.label}
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: config.color }}>
                        {pct}% ({normalized.toFixed(2)}/1.00)
                      </span>
                    </div>

                    {/* Progress Bar for Dimension */}
                    <div
                      style={{
                        height: '6px',
                        width: '100%',
                        backgroundColor: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-full)',
                        overflow: 'hidden',
                        marginBottom: '8px',
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

                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                      {config.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Top Recommendations Preview Teaser */}
      {topRecommendations.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div>
              <h3>Top Aligned Career Pathways</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                Highest vector cosine alignment based on your 6-dimension profile.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/attempts/${attempt.id}/recommendations`)}
            >
              View All Recommendations →
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
            {topRecommendations.map((rec) => (
              <div
                key={rec.career.id}
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-base)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'rgba(6, 182, 212, 0.15)',
                        color: 'var(--secondary)',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      Rank #{rec.rank}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                      {Math.round(rec.similarityScore * 100)}% Match
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1.1rem', margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                    {rec.career.title}
                  </h4>

                  {rec.reasons && rec.reasons.length > 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                      • {rec.reasons[0]}
                    </p>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/careers/${rec.career.slug}`)}
                >
                  View Blueprint
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <Button variant="outline" onClick={() => navigate('/assessments')}>
          ← Back to Assessments
        </Button>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button variant="secondary" onClick={() => navigate('/careers')}>
            Browse Career Explorer
          </Button>
          <Button onClick={() => navigate(`/attempts/${attempt.id}/recommendations`)}>
            Explore All Recommended Matches →
          </Button>
        </div>
      </div>
    </div>
  );
};
