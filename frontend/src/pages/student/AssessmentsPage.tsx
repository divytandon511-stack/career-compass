import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';
import { SkeletonLoader } from '@/components/shared/SkeletonLoader';
import { EmptyState } from '@/components/shared/EmptyState';
import { assessmentApi } from '@/services/api/assessment.api';
import { Assessment, AssessmentAttempt } from '@/types/models';

export const AssessmentsPage: React.FC = () => {
  const navigate = useNavigate();

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [assessmentsRes, attemptsRes] = await Promise.all([
        assessmentApi.listAssessments({ limit: 20 }),
        assessmentApi.listAttempts({ limit: 20, sort: 'startedAt', order: 'desc' }),
      ]);
      setAssessments(assessmentsRes.data || []);
      setAttempts(attemptsRes.data || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to load assessments. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map latest attempt per assessment
  const inProgressAttemptMap = new Map<string, AssessmentAttempt>();
  const completedAttemptsMap = new Map<string, AssessmentAttempt[]>();

  attempts.forEach((att) => {
    if (att.status === 'IN_PROGRESS' && !inProgressAttemptMap.has(att.assessmentId)) {
      inProgressAttemptMap.set(att.assessmentId, att);
    } else if (att.status === 'COMPLETED') {
      const list = completedAttemptsMap.get(att.assessmentId) || [];
      list.push(att);
      completedAttemptsMap.set(att.assessmentId, list);
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
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
          NEP 2020 Interest Exploration
        </span>
        <h1 style={{ marginTop: '4px', fontSize: '1.75rem' }}>Interest Assessments</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px', maxWidth: '640px' }}>
          Explore your self-reported preferences across 6 core interest dimensions: Analytical,
          Creative, Social, Practical, Organizational, and Investigative.
        </p>
      </div>

      {/* Error state */}
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
          <Button size="sm" variant="outline" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <SkeletonLoader height="160px" borderRadius="var(--radius-lg)" />
          <SkeletonLoader height="160px" borderRadius="var(--radius-lg)" />
        </div>
      ) : assessments.length === 0 ? (
        <EmptyState
          title="No Published Assessments"
          description="There are currently no active interest explorations published. Please check back soon or consult your school counsellor."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Assessment Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-6)' }}>
            {assessments.map((assessment) => {
              const inProgress = inProgressAttemptMap.get(assessment.id);
              const completedList = completedAttemptsMap.get(assessment.id) || [];
              const latestCompleted = completedList[0];

              return (
                <div
                  key={assessment.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: inProgress
                      ? '1px solid var(--primary)'
                      : '1px solid var(--border-subtle)',
                    position: 'relative',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 'var(--space-3)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor:
                              inProgress
                                ? 'rgba(99, 102, 241, 0.15)'
                                : 'rgba(16, 185, 129, 0.15)',
                            color: inProgress ? 'var(--primary)' : 'var(--success)',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          {inProgress ? 'In Progress' : 'Published'} • v{assessment.version}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                        ⏱️ ~7 minutes
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
                      {assessment.title}
                    </h3>

                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
                      {assessment.description ||
                        'Comprehensive 30-item questionnaire mapping self-reported interests to educational pathways under NEP 2020.'}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginBottom: 'var(--space-6)',
                      }}
                    >
                      <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)' }}>
                        30 Scored Questions
                      </span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)' }}>
                        6 Interest Dimensions
                      </span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)' }}>
                        Deterministic Matching
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)' }}>
                    {inProgress ? (
                      <>
                        <Button onClick={() => navigate(`/assessments/${assessment.id}/take`)}>
                          Resume Assessment →
                        </Button>
                        {latestCompleted && (
                          <Button
                            variant="outline"
                            onClick={() => navigate(`/attempts/${latestCompleted.id}/results`)}
                          >
                            Previous Results
                          </Button>
                        )}
                      </>
                    ) : latestCompleted ? (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => navigate(`/attempts/${latestCompleted.id}/results`)}
                        >
                          View Latest Results →
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => navigate(`/assessments/${assessment.id}/take`)}
                        >
                          Retake Assessment
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => navigate(`/assessments/${assessment.id}/take`)}>
                        Start Assessment →
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Assessment History Section */}
          {attempts.length > 0 && (
            <div className="card" style={{ marginTop: 'var(--space-4)' }}>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>Your Assessment History</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: 'var(--space-4)' }}>
                Review past interest exploration attempts and generated career alignments.
              </p>

              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                    textAlign: 'left',
                  }}
                  aria-label="Assessment history table"
                >
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 12px' }}>Date Started</th>
                      <th style={{ padding: '8px 12px' }}>Status</th>
                      <th style={{ padding: '8px 12px' }}>Algorithm</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map((attempt) => (
                      <tr
                        key={attempt.id}
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          {new Date(attempt.startedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor:
                                attempt.status === 'COMPLETED'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(245, 158, 11, 0.15)',
                              color:
                                attempt.status === 'COMPLETED'
                                  ? 'var(--success)'
                                  : 'var(--warning)',
                            }}
                          >
                            {attempt.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-dim)' }}>
                          {attempt.algorithmVersion || 'Cosine v1.0'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          {attempt.status === 'COMPLETED' ? (
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/attempts/${attempt.id}/results`)}
                              >
                                Results
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => navigate(`/attempts/${attempt.id}/recommendations`)}
                              >
                                Matches
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => navigate(`/assessments/${attempt.assessmentId}/take`)}
                            >
                              Resume
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
