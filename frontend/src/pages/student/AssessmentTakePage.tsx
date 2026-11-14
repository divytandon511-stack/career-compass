import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { SkeletonLoader } from '@/components/shared/SkeletonLoader';
import { assessmentApi } from '@/services/api/assessment.api';
import { Assessment, AssessmentQuestion } from '@/types/models';
import { DIMENSION_DETAILS } from '@/types/dimensions';

export const AssessmentTakePage: React.FC = () => {
  const { id: assessmentId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Wizard state
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // Selected option (UI)
  const [persistedAnswers, setPersistedAnswers] = useState<Record<string, string>>({}); // Confirmed saved to backend
  const [failedQuestions, setFailedQuestions] = useState<Record<string, string>>({}); // questionId -> error message
  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set()); // Set of questionIds with in-flight saves
  const [isResumed, setIsResumed] = useState<boolean>(false);

  // Status flags
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load assessment metadata and questions
  useEffect(() => {
    if (!assessmentId) return;

    let isMounted = true;
    async function init() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [assessRes, questionsRes] = await Promise.all([
          assessmentApi.getAssessment(assessmentId!).catch(() => ({ data: null })),
          assessmentApi.getQuestions(assessmentId!),
        ]);

        if (!isMounted) return;

        if (assessRes.data) {
          setAssessment(assessRes.data);
        }

        let questionList = questionsRes.data?.questions ? [...questionsRes.data.questions] : [];

        // If the backend returned a paginated response with multiple pages, fetch remaining pages
        if (questionsRes.meta && questionsRes.meta.totalPages > 1) {
          const remainingPromises = [];
          for (let p = 2; p <= questionsRes.meta.totalPages; p++) {
            remainingPromises.push(
              assessmentApi.getQuestions(assessmentId!, p, questionsRes.meta.limit)
            );
          }
          const remainingResponses = await Promise.all(remainingPromises);
          for (const resp of remainingResponses) {
            if (resp.data?.questions) {
              questionList = questionList.concat(resp.data.questions);
            }
          }
        }

        // Sort questions by position ascending
        questionList.sort((a, b) => a.position - b.position);
        setQuestions(questionList);
      } catch (err: unknown) {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load assessment questions. Please try again.'
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, [assessmentId]);

  // Handle starting/resuming the attempt
  const handleStartAttempt = async () => {
    if (!assessmentId) return;

    setIsLoading(true);
    setLoadError(null);
    try {
      const startRes = await assessmentApi.startAttempt(assessmentId);
      const newAttemptId = startRes.data.id;
      setAttemptId(newAttemptId);
      setIsResumed(Boolean(startRes.data.isResumed));

      // Hydrate previous answers if this attempt is resumed
      try {
        const attemptRes = await assessmentApi.getAttempt(newAttemptId);
        if (attemptRes.data?.answers && Array.isArray(attemptRes.data.answers)) {
          const loadedAnswers: Record<string, string> = {};
          attemptRes.data.answers.forEach((ans) => {
            loadedAnswers[ans.questionId] = ans.selectedOptionId;
          });
          setAnswers(loadedAnswers);
          setPersistedAnswers(loadedAnswers);
          setFailedQuestions({});

          // Find first unanswered question to jump to
          const firstUnanswered = questions.findIndex((q) => !loadedAnswers[q.id]);
          if (firstUnanswered !== -1) {
            setCurrentIndex(firstUnanswered);
          }
        }
      } catch {
        // Non-blocking: proceed with empty answers
      }

      setHasStarted(true);
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to initialize assessment attempt.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Per-question request sequence tracker to eliminate out-of-order save race conditions
  const saveSeqRef = React.useRef<Record<string, number>>({});

  // Save answer to backend with race-condition safety and persistence guarantees
  const handleSelectOption = useCallback(
    async (questionId: string, optionId: string) => {
      if (!attemptId) return;

      // Optimistically record the user's latest selection in UI
      setAnswers((prev) => ({ ...prev, [questionId]: optionId }));

      // Clear any prior failure record for this question
      setFailedQuestions((prev) => {
        if (!prev[questionId]) return prev;
        const next = { ...prev };
        delete next[questionId];
        return next;
      });

      // Increment sequence counter to uniquely identify this specific request
      const seq = (saveSeqRef.current[questionId] || 0) + 1;
      saveSeqRef.current[questionId] = seq;

      // Track question as pending in-flight save
      setPendingSaves((prev) => new Set(prev).add(questionId));
      setSaveStatus('saving');
      setSaveErrorMessage(null);

      try {
        await assessmentApi.saveAnswer(attemptId, questionId, optionId);

        // Only commit if this response corresponds to the latest requested option for this question
        if (saveSeqRef.current[questionId] === seq) {
          setPersistedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
          setPendingSaves((prev) => {
            const next = new Set(prev);
            next.delete(questionId);
            return next;
          });
          setSaveStatus('saved');
        }
      } catch (err: unknown) {
        // Only record failure if this response corresponds to the latest requested option
        if (saveSeqRef.current[questionId] === seq) {
          const message =
            err instanceof Error ? err.message : 'Failed to save answer. Click to retry.';
          setFailedQuestions((prev) => ({ ...prev, [questionId]: message }));
          // CRITICAL: Failed saves cannot silently count as successfully persisted!
          setPersistedAnswers((prev) => {
            if (!prev[questionId]) return prev;
            const next = { ...prev };
            delete next[questionId];
            return next;
          });
          setPendingSaves((prev) => {
            const next = new Set(prev);
            next.delete(questionId);
            return next;
          });
          setSaveStatus('error');
          setSaveErrorMessage(message);
        }
      }
    },
    [attemptId]
  );

  // Final submission
  const handleSubmitAssessment = async () => {
    if (!attemptId) return;

    if (isSavingAny) {
      setSubmitError('Please wait for pending answer saves to complete before submitting.');
      return;
    }

    if (failedIndices.length > 0) {
      setSubmitError(
        `Cannot submit: ${failedIndices.length} question(s) failed to save. Please retry saving.`
      );
      return;
    }

    if (unpersistedIndices.length > 0) {
      setSubmitError(
        `All ${totalCount} questions must be answered and saved before submitting.`
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const submitRes = await assessmentApi.submitAttempt(attemptId);
      setIsSubmitModalOpen(false);
      // Navigate to results
      navigate(`/attempts/${submitRes.data.attemptId}/results`, { replace: true });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        // Attempt already finalized -> navigate directly to results
        navigate(`/attempts/${attemptId}/results`, { replace: true });
        return;
      }
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Submission failed. Please check your connection and try again.'
      );
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!hasStarted || questions.length === 0 || isSubmitModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' && currentIndex < questions.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      } else if (/^[1-5]$/.test(e.key)) {
        // Option index 0-4
        const optIdx = parseInt(e.key, 10) - 1;
        const currentQ = questions[currentIndex];
        if (currentQ && currentQ.options[optIdx]) {
          handleSelectOption(currentQ.id, currentQ.options[optIdx].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted, currentIndex, questions, isSubmitModalOpen, handleSelectOption]);

  const currentQuestion = questions[currentIndex];
  const totalCount = questions.length;

  // Unpersisted = questions that either have no selection, are currently saving, or failed to save
  const unpersistedIndices = questions
    .map((q, idx) => (!persistedAnswers[q.id] ? idx : null))
    .filter((idx): idx is number => idx !== null);

  // Failed saves = questions where save definitively failed
  const failedIndices = questions
    .map((q, idx) => (failedQuestions[q.id] ? idx : null))
    .filter((idx): idx is number => idx !== null);

  const isSavingAny = pendingSaves.size > 0;
  const answeredCount = Object.keys(persistedAnswers).length;
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  // Loading Screen
  if (isLoading && !hasStarted) {
    return (
      <div style={{ maxWidth: '720px', margin: 'var(--space-8) auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <SkeletonLoader height="32px" width="60%" />
        <SkeletonLoader height="220px" borderRadius="var(--radius-lg)" />
        <SkeletonLoader height="48px" width="40%" />
      </div>
    );
  }

  // Error loading questions
  if (loadError && !hasStarted) {
    return (
      <div style={{ maxWidth: '640px', margin: 'var(--space-12) auto' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--danger, #ef4444)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Unable to Start Assessment</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-4)' }}>
            {loadError}
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

  // 1. Pre-flight Instructions Screen (Shown before question 1)
  if (!hasStarted) {
    return (
      <div style={{ maxWidth: '760px', margin: 'var(--space-8) auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className="card" style={{ padding: 'var(--space-8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
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
                NEP 2020 Framework • Student Exploration
              </span>
              <h1 style={{ fontSize: '1.75rem', marginTop: '4px' }}>
                {assessment?.title || 'Interest Assessment'}
              </h1>
            </div>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                color: 'var(--primary)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              ⏱️ ~7 minutes
            </span>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, margin: 'var(--space-4) 0' }}>
            {assessment?.description ||
              'This assessment evaluates your unique interest preferences across 6 core domains. There are no right or wrong answers, and it is not a test of intellectual capacity or psychological diagnosis.'}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-3)',
              margin: 'var(--space-6) 0',
            }}
          >
            <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                📝 {questions.length} Preference Questions
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Rate statements based on what genuinely interests you.
              </p>
            </div>
            <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                💾 Automatic Cloud Save
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Every response is saved instantly. Resume anytime.
              </p>
            </div>
            <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                🎯 Deterministic Matching
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Generates vector alignments with verified Indian career roadmaps.
              </p>
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              borderLeft: '4px solid var(--warning, #f59e0b)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              color: 'var(--text-main)',
              marginBottom: 'var(--space-6)',
              lineHeight: 1.5,
            }}
          >
            <strong>Tips:</strong> You can navigate freely between questions using the numbers drawer or keyboard arrow keys. Once finalized, your responses will compute your 6-axis radar profile.
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <Button size="lg" onClick={handleStartAttempt}>
              Begin Assessment Questions →
            </Button>
            <Button variant="outline" onClick={() => navigate('/assessments')}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentDimConfig = currentQuestion
    ? DIMENSION_DETAILS[currentQuestion.dimension] || { label: currentQuestion.dimension, color: '#6366f1' }
    : null;

  // 2. Interactive Assessment Runner
  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Top Bar: Progress and Save Status */}
      <div className="card" style={{ padding: 'var(--space-4) var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
              Question {currentIndex + 1} of {totalCount}
            </span>
            {isResumed && (
              <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                (Resumed Session)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            {/* Auto-save status feedback */}
            <span
              style={{
                fontSize: '12px',
                color:
                  saveStatus === 'error'
                    ? 'var(--danger, #ef4444)'
                    : saveStatus === 'saving'
                    ? 'var(--warning, #f59e0b)'
                    : 'var(--text-dim)',
              }}
              role="status"
            >
              {saveStatus === 'saving' && 'Saving response...'}
              {saveStatus === 'saved' && '✓ Saved'}
              {saveStatus === 'error' && (saveErrorMessage || 'Save failed')}
            </span>

            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {answeredCount}/{totalCount} Answered ({progressPercent}%)
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
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
              width: `${progressPercent}%`,
              background: 'var(--primary-gradient)',
              transition: 'width 0.25s ease',
            }}
          />
        </div>
      </div>

      {/* Question Card */}
      {currentQuestion && (
        <div
          className="card"
          style={{
            padding: 'var(--space-8)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-6)',
          }}
        >
          {/* Dimension badge */}
          <div>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: `${currentDimConfig?.color}20`,
                color: currentDimConfig?.color,
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {currentDimConfig?.label || currentQuestion.dimension} Dimension
            </span>
          </div>

          {/* Question Prompt */}
          <h2
            style={{
              fontSize: '1.4rem',
              lineHeight: 1.4,
              color: 'var(--text-main)',
              margin: 0,
            }}
          >
            {currentQuestion.prompt}
          </h2>

          {/* Failed Save Error Feedback */}
          {failedQuestions[currentQuestion.id] && (
            <div
              role="alert"
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderLeft: '4px solid var(--danger, #ef4444)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                color: 'var(--danger, #ef4444)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>⚠️ {failedQuestions[currentQuestion.id]}</span>
              {answers[currentQuestion.id] && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleSelectOption(currentQuestion.id, answers[currentQuestion.id])
                  }
                >
                  Retry Save
                </Button>
              )}
            </div>
          )}

          {/* Options List */}
          <div
            role="radiogroup"
            aria-label={`Options for Question ${currentIndex + 1}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            {currentQuestion.options.map((option, optIdx) => {
              const isSelected = answers[currentQuestion.id] === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelectOption(currentQuestion.id, option.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected
                      ? '2px solid var(--primary)'
                      : '1px solid var(--border-subtle)',
                    backgroundColor: isSelected
                      ? 'rgba(99, 102, 241, 0.12)'
                      : 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    fontSize: '15px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: isSelected
                          ? '6px solid var(--primary)'
                          : '2px solid var(--border-subtle)',
                        backgroundColor: 'var(--bg-base)',
                        display: 'inline-block',
                        flexShrink: 0,
                        transition: 'border 0.15s ease',
                      }}
                    />
                    <span style={{ fontWeight: isSelected ? 600 : 400 }}>
                      {option.label}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-dim)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-base)',
                    }}
                  >
                    Key {optIdx + 1}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'var(--space-4)',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 'var(--space-6)',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
            }}
          >
            <Button
              variant="outline"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            >
              ← Previous
            </Button>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {currentIndex < totalCount - 1 ? (
                <Button
                  onClick={() => setCurrentIndex((prev) => Math.min(totalCount - 1, prev + 1))}
                >
                  Next Question →
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => setIsSubmitModalOpen(true)}
                >
                  Review & Finalize Assessment →
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Question Jump Grid Palette */}
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '14px', margin: 0 }}>Questions Overview</h3>
          <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-dim)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
              Answered ({answeredCount})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1px solid var(--border-subtle)' }} />
              Unanswered ({totalCount - answeredCount})
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))',
            gap: '8px',
          }}
          aria-label="Question jump palette"
        >
          {questions.map((q, idx) => {
            const isAnswered = Boolean(persistedAnswers[q.id]);
            const hasFailed = Boolean(failedQuestions[q.id]);
            const isPending = pendingSaves.has(q.id);
            const isCurrent = idx === currentIndex;

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Jump to question ${idx + 1}${
                  hasFailed
                    ? ' (Save Failed)'
                    : isPending
                    ? ' (Saving)'
                    : isAnswered
                    ? ' (Answered)'
                    : ' (Unanswered)'
                }`}
                style={{
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  border: isCurrent
                    ? '2px solid var(--primary)'
                    : hasFailed
                    ? '1px solid var(--danger, #ef4444)'
                    : isAnswered
                    ? '1px solid rgba(99, 102, 241, 0.4)'
                    : '1px solid var(--border-subtle)',
                  backgroundColor: isCurrent
                    ? 'rgba(99, 102, 241, 0.25)'
                    : hasFailed
                    ? 'rgba(239, 68, 68, 0.15)'
                    : isAnswered
                    ? 'rgba(99, 102, 241, 0.12)'
                    : 'var(--bg-base)',
                  color: isCurrent
                    ? 'var(--primary)'
                    : hasFailed
                    ? 'var(--danger, #ef4444)'
                    : isAnswered
                    ? 'var(--text-main)'
                    : 'var(--text-dim)',
                  fontWeight: isCurrent || isAnswered || hasFailed ? 700 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Shortcut Action to Submit */}
        <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setIsSubmitModalOpen(true)}>
            Submit Assessment ({answeredCount}/{totalCount} Completed)
          </Button>
        </div>
      </div>

      {/* Confirmation & Review Modal */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => !isSubmitting && setIsSubmitModalOpen(false)}
        title="Finalize & Submit Assessment"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {failedIndices.length > 0 ? (
            <div
              style={{
                padding: '14px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderLeft: '4px solid var(--danger, #ef4444)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--danger, #ef4444)' }}>
                ⚠️ Save Failed ({failedIndices.length} Remaining)
              </div>
              <p style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {failedIndices.length === 1
                  ? `Question #${failedIndices[0] + 1} failed to save due to a network error.`
                  : `Questions ${failedIndices.map((i) => `#${i + 1}`).join(', ')} failed to save.`}{' '}
                Answers must be successfully saved to the server before results can be computed.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCurrentIndex(failedIndices[0]);
                  setIsSubmitModalOpen(false);
                }}
              >
                Jump to Question #{failedIndices[0] + 1} to Retry →
              </Button>
            </div>
          ) : isSavingAny ? (
            <div
              style={{
                padding: '14px 16px',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderLeft: '4px solid var(--primary, #6366f1)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--primary, #6366f1)' }}>
                ⏳ Saving Answers in Progress...
              </div>
              <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Your responses are currently being securely transmitted to the server. Please wait a moment.
              </p>
            </div>
          ) : unpersistedIndices.length > 0 ? (
            <div
              style={{
                padding: '14px 16px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderLeft: '4px solid var(--warning, #f59e0b)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                ⚠️ Completion Required ({unpersistedIndices.length} Remaining)
              </div>
              <p style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                All {totalCount} questions must be answered before your results can be calculated. Unanswered questions:{' '}
                <strong>
                  {unpersistedIndices.slice(0, 5).map((i) => `#${i + 1}`).join(', ')}
                  {unpersistedIndices.length > 5 ? ` and ${unpersistedIndices.length - 5} more` : ''}
                </strong>
                .
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCurrentIndex(unpersistedIndices[0]);
                  setIsSubmitModalOpen(false);
                }}
              >
                Jump to Question #{unpersistedIndices[0] + 1} →
              </Button>
            </div>
          ) : (
            <div
              style={{
                padding: '14px 16px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderLeft: '4px solid var(--success, #10b981)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                color: 'var(--success, #10b981)',
                fontWeight: 600,
              }}
            >
              ✓ All {totalCount} questions have been answered!
            </div>
          )}

          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
            Once submitted, your responses will be evaluated using deterministic cosine vector matching to compute your 6-axis interest radar profile and personalized career recommendations.
          </p>

          {submitError && (
            <div
              role="alert"
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--danger, #ef4444)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
              }}
            >
              {submitError}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-3)',
              marginTop: 'var(--space-4)',
            }}
          >
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setIsSubmitModalOpen(false)}
            >
              Keep Editing
            </Button>
            <Button
              disabled={isSubmitting || isSavingAny || unpersistedIndices.length > 0 || failedIndices.length > 0}
              onClick={handleSubmitAssessment}
            >
              {isSubmitting
                ? 'Calculating Profile...'
                : isSavingAny
                ? 'Saving Answers...'
                : 'Confirm & Calculate Results'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
