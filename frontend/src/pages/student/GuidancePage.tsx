import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { guidanceApi, GuidanceSession } from '@/services/api/guidance.api';
import { assessmentApi } from '@/services/api/assessment.api';
import { careersApi } from '@/services/api/careers.api';
import { AssessmentAttempt, Career } from '@/types/models';
import { Button } from '@/components/shared/Button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export const GuidancePage: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<GuidanceSession[]>([]);
  const [completedAttempts, setCompletedAttempts] = useState<AssessmentAttempt[]>([]);
  const [publishedCareers, setPublishedCareers] = useState<Career[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New session modal / form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState('');
  const [selectedCareerIds, setSelectedCareerIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sessionsRes, attemptsRes, careersRes] = await Promise.all([
        guidanceApi.listSessions(),
        assessmentApi.listAttempts().catch(() => ({ data: [] })),
        careersApi.listCareers({ limit: 50 }).catch(() => ({ data: [] })),
      ]);

      setSessions(sessionsRes.data || []);
      const completed = (attemptsRes.data || []).filter((a) => a.status === 'COMPLETED');
      setCompletedAttempts(completed);
      if (completed.length > 0) {
        setSelectedAttemptId(completed[0].id);
      }
      setPublishedCareers(careersRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guidance sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAttemptId) {
      setCreateError('Please select a completed assessment attempt to ground guidance.');
      return;
    }
    if (selectedCareerIds.length === 0) {
      setCreateError('Please select at least one career to focus the discussion.');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      const res = await guidanceApi.createSession(selectedAttemptId, selectedCareerIds);
      setShowCreateModal(false);
      navigate(`/guidance/${res.data.sessionId}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to initialize guidance session');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to delete this guidance chat history?')) return;
    try {
      await guidanceApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete session');
    }
  };

  const toggleCareerSelection = (careerId: string) => {
    if (selectedCareerIds.includes(careerId)) {
      setSelectedCareerIds(selectedCareerIds.filter((id) => id !== careerId));
    } else {
      if (selectedCareerIds.length >= 5) {
        setCreateError('You can select at most 5 focus careers per session.');
        return;
      }
      setSelectedCareerIds([...selectedCareerIds, careerId]);
    }
  };

  const formatDateTime = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-pink)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            AI Academic Advisor
          </span>
          <h2>MargDarshak AI Career Guidance</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px', maxWidth: '640px' }}>
            Conversational explanations grounded in verified educational catalogue data, NEP 2020 subject streams, and your assessment scores.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          + Start New Guidance Chat
        </Button>
      </div>

      {/* Safety & Grounding Commitment Banner */}
      <div
        className="card"
        style={{
          borderLeft: '4px solid var(--accent-pink)',
          backgroundColor: 'rgba(236, 72, 153, 0.05)',
        }}
      >
        <h3 style={{ marginBottom: 'var(--space-2)', fontSize: '15px' }}>🛡️ Safety & Grounding Commitment</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
          MargDarshak AI never invents or overrides mathematical recommendation scores. All suggestions are strictly referenced against vetted career roadmaps, National Education Policy (NEP 2020) curricular streams, and official entrance examinations.
        </p>
      </div>

      {/* Error Banner */}
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
          <Button size="sm" variant="secondary" onClick={loadData}>Retry</Button>
        </div>
      )}

      {/* Sessions Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-12)' }}>
          <LoadingSpinner />
        </div>
      ) : sessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div style={{ fontSize: '36px', marginBottom: 'var(--space-2)' }}>💬</div>
          <h3>No Guidance Conversations Yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: 'var(--space-2)', maxWidth: '480px', margin: 'var(--space-2) auto var(--space-6)' }}>
            Start an interactive session with MargDarshak AI to explore how your interest profile matches secondary subject streams and careers.
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            Start Your First Guidance Chat
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '16px' }}>Your Guidance Conversations</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            {sessions.map((session) => (
              <div
                key={session.sessionId}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 'var(--space-4)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-pink)', textTransform: 'uppercase' }}>
                      MargDarshak Session
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      {formatDateTime(session.updatedAt || session.createdAt)}
                    </span>
                  </div>
                  <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: '15px' }}>
                    Guidance Exploration
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Session ID: <code style={{ fontSize: '11px' }}>{session.sessionId.slice(0, 8)}...</code>
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Focus Careers: <strong>{session.careerIds?.length || 0}</strong> careers grounded
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/guidance/${session.sessionId}`)}
                    style={{ flex: 1 }}
                  >
                    Open Chat
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteSession(session.sessionId)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Session Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 id="modal-title" style={{ margin: 0 }}>Start New Guidance Chat</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div
                role="alert"
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid var(--danger)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--danger)',
                  fontSize: '13px',
                  marginBottom: 'var(--space-4)',
                }}
              >
                {createError}
              </div>
            )}

            <form onSubmit={handleStartSession} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Select Assessment Attempt */}
              <div>
                <label htmlFor="attempt-select" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Select Completed Assessment Attempt *
                </label>
                {completedAttempts.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--danger)' }}>
                    You need at least one completed assessment attempt to ground guidance. Please take an assessment first.
                  </p>
                ) : (
                  <select
                    id="attempt-select"
                    value={selectedAttemptId}
                    onChange={(e) => setSelectedAttemptId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-base)',
                      color: 'var(--text-main)',
                      fontSize: '14px',
                    }}
                    required
                  >
                    {completedAttempts.map((attempt) => (
                      <option key={attempt.id} value={attempt.id}>
                        Attempt from {formatDateTime(attempt.completedAt || attempt.startedAt)} (Score computed)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Select Focus Careers */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Select Grounding Careers (1 to 5) *
                </label>
                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    backgroundColor: 'var(--bg-base)',
                  }}
                >
                  {publishedCareers.map((c) => {
                    const checked = selectedCareerIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          backgroundColor: checked ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          fontSize: '13px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCareerSelection(c.id)}
                        />
                        <span>{c.title}</span>
                      </label>
                    );
                  })}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                  Selected: {selectedCareerIds.length} / 5
                </span>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating || completedAttempts.length === 0 || selectedCareerIds.length === 0}
                >
                  {creating ? 'Initializing Session...' : 'Launch Chat →'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
