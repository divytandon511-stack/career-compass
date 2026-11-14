import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AssessmentTakePage } from '@/pages/student/AssessmentTakePage';
import { assessmentApi } from '@/services/api/assessment.api';
import { AssessmentQuestion } from '@/types/models';

vi.mock('@/services/api/assessment.api', () => ({
  assessmentApi: {
    getAssessment: vi.fn(),
    getQuestions: vi.fn(),
    startAttempt: vi.fn(),
    getAttempt: vi.fn(),
    saveAnswer: vi.fn(),
    submitAttempt: vi.fn(),
  },
}));

const mockQuestions: AssessmentQuestion[] = [
  {
    id: 'q-1',
    assessmentId: 'asm-test',
    dimension: 'ANALYTICAL',
    prompt: 'I enjoy solving quantitative puzzles and mathematical problems.',
    position: 1,
    options: [
      { id: 'opt-1-1', label: 'Strongly Disagree' },
      { id: 'opt-1-2', label: 'Disagree' },
      { id: 'opt-1-3', label: 'Neutral' },
      { id: 'opt-1-4', label: 'Agree' },
      { id: 'opt-1-5', label: 'Strongly Agree' },
    ],
  },
  {
    id: 'q-2',
    assessmentId: 'asm-test',
    dimension: 'CREATIVE',
    prompt: 'I like creating visual art, music, or writing imaginative stories.',
    position: 2,
    options: [
      { id: 'opt-2-1', label: 'Strongly Disagree' },
      { id: 'opt-2-2', label: 'Disagree' },
      { id: 'opt-2-3', label: 'Neutral' },
      { id: 'opt-2-4', label: 'Agree' },
      { id: 'opt-2-5', label: 'Strongly Agree' },
    ],
  },
];

describe('Assessment Runner (AssessmentTakePage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders instructions screen first and starts attempt on click', async () => {
    vi.mocked(assessmentApi.getAssessment).mockResolvedValueOnce({
      data: {
        id: 'asm-test',
        title: 'NEP 2020 Exploration',
        version: 1,
        status: 'PUBLISHED',
      },
    });
    vi.mocked(assessmentApi.getQuestions).mockResolvedValueOnce({
      data: {
        assessmentId: 'asm-test',
        version: 1,
        questions: mockQuestions,
      },
    });
    vi.mocked(assessmentApi.startAttempt).mockResolvedValueOnce({
      data: {
        id: 'att-123',
        assessmentId: 'asm-test',
        assessmentVersion: 1,
        status: 'IN_PROGRESS',
        startedAt: '2026-11-14T00:00:00Z',
      },
    });
    vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({
      data: {
        id: 'att-123',
        assessmentId: 'asm-test',
        status: 'IN_PROGRESS',
        startedAt: '2026-11-14T00:00:00Z',
        answers: [],
      },
    });

    render(
      <MemoryRouter initialEntries={['/assessments/asm-test/take']}>
        <Routes>
          <Route path="/assessments/:id/take" element={<AssessmentTakePage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify Instructions step
    expect(await screen.findByText('NEP 2020 Framework • Student Exploration')).toBeInTheDocument();
    expect(screen.getByText('Begin Assessment Questions →')).toBeInTheDocument();

    // Click to start
    fireEvent.click(screen.getByText('Begin Assessment Questions →'));

    // Question 1 rendered
    expect(
      await screen.findByText('I enjoy solving quantitative puzzles and mathematical problems.')
    ).toBeInTheDocument();
    expect(screen.getByText(/ANALYTICAL Dimension/i)).toBeInTheDocument();
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
  });

  it('saves answer via PUT when an option is selected and updates progress', async () => {
    vi.mocked(assessmentApi.getAssessment).mockResolvedValueOnce({
      data: { id: 'asm-test', title: 'Exploration', version: 1, status: 'PUBLISHED' },
    });
    vi.mocked(assessmentApi.getQuestions).mockResolvedValueOnce({
      data: { assessmentId: 'asm-test', version: 1, questions: mockQuestions },
    });
    vi.mocked(assessmentApi.startAttempt).mockResolvedValueOnce({
      data: { id: 'att-123', assessmentId: 'asm-test', assessmentVersion: 1, status: 'IN_PROGRESS', startedAt: '2026-11-14T00:00:00Z' },
    });
    vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({
      data: { id: 'att-123', assessmentId: 'asm-test', status: 'IN_PROGRESS', startedAt: '2026-11-14T00:00:00Z', answers: [] },
    });
    vi.mocked(assessmentApi.saveAnswer).mockResolvedValueOnce({
      data: { id: 'ans-1', attemptId: 'att-123', questionId: 'q-1', selectedOptionId: 'opt-1-5', answeredAt: '2026-11-14T00:01:00Z' },
    });

    render(
      <MemoryRouter initialEntries={['/assessments/asm-test/take']}>
        <Routes>
          <Route path="/assessments/:id/take" element={<AssessmentTakePage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('Begin Assessment Questions →'));

    // Select "Strongly Agree" option
    const stronglyAgreeOpt = await screen.findByRole('radio', { name: /Strongly Agree/i });
    fireEvent.click(stronglyAgreeOpt);

    await waitFor(() => {
      expect(assessmentApi.saveAnswer).toHaveBeenCalledWith('att-123', 'q-1', 'opt-1-5');
    });

    expect(await screen.findByText('✓ Saved')).toBeInTheDocument();
    expect(screen.getByText('1/2 Answered (50%)')).toBeInTheDocument();
  });

  it('navigates between questions using Next and Previous buttons and jump palette', async () => {
    vi.mocked(assessmentApi.getAssessment).mockResolvedValueOnce({
      data: { id: 'asm-test', title: 'Exploration', version: 1, status: 'PUBLISHED' },
    });
    vi.mocked(assessmentApi.getQuestions).mockResolvedValueOnce({
      data: { assessmentId: 'asm-test', version: 1, questions: mockQuestions },
    });
    vi.mocked(assessmentApi.startAttempt).mockResolvedValueOnce({
      data: { id: 'att-123', assessmentId: 'asm-test', assessmentVersion: 1, status: 'IN_PROGRESS', startedAt: '2026-11-14T00:00:00Z' },
    });
    vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({
      data: { id: 'att-123', assessmentId: 'asm-test', status: 'IN_PROGRESS', startedAt: '2026-11-14T00:00:00Z', answers: [] },
    });

    render(
      <MemoryRouter initialEntries={['/assessments/asm-test/take']}>
        <Routes>
          <Route path="/assessments/:id/take" element={<AssessmentTakePage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('Begin Assessment Questions →'));
    expect(await screen.findByText('Question 1 of 2')).toBeInTheDocument();

    // Click Next
    fireEvent.click(screen.getByText('Next Question →'));
    expect(await screen.findByText('Question 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('I like creating visual art, music, or writing imaginative stories.')).toBeInTheDocument();

    // Click Previous
    fireEvent.click(screen.getByText('← Previous'));
    expect(await screen.findByText('Question 1 of 2')).toBeInTheDocument();

    // Jump via question palette button '2'
    fireEvent.click(screen.getByRole('button', { name: /Jump to question 2/i }));
    expect(await screen.findByText('Question 2 of 2')).toBeInTheDocument();
  });

  it('submits finalized assessment and navigates to results', async () => {
    vi.mocked(assessmentApi.getAssessment).mockResolvedValueOnce({
      data: { id: 'asm-test', title: 'Exploration', version: 1, status: 'PUBLISHED' },
    });
    vi.mocked(assessmentApi.getQuestions).mockResolvedValueOnce({
      data: { assessmentId: 'asm-test', version: 1, questions: mockQuestions },
    });
    vi.mocked(assessmentApi.startAttempt).mockResolvedValueOnce({
      data: { id: 'att-123', assessmentId: 'asm-test', assessmentVersion: 1, status: 'IN_PROGRESS', startedAt: '2026-11-14T00:00:00Z' },
    });
    vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({
      data: {
        id: 'att-123',
        assessmentId: 'asm-test',
        status: 'IN_PROGRESS',
        startedAt: '2026-11-14T00:00:00Z',
        answers: [
          { questionId: 'q-1', selectedOptionId: 'opt-1-5', answeredAt: '2026-11-14T00:01:00Z' },
          { questionId: 'q-2', selectedOptionId: 'opt-2-4', answeredAt: '2026-11-14T00:02:00Z' },
        ],
      },
    });
    vi.mocked(assessmentApi.submitAttempt).mockResolvedValueOnce({
      data: {
        attemptId: 'att-123',
        status: 'COMPLETED',
        assessmentVersion: 1,
        algorithmVersion: 'cosine-v1',
        dimensionScores: { ANALYTICAL: 1, CREATIVE: 0.8 },
        completedAt: '2026-11-14T00:05:00Z',
        recommendationsUrl: '/api/v1/attempts/att-123/recommendations',
      },
    });

    render(
      <MemoryRouter initialEntries={['/assessments/asm-test/take']}>
        <Routes>
          <Route path="/assessments/:id/take" element={<AssessmentTakePage />} />
          <Route path="/attempts/:id/results" element={<div>Results Page Landed</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('Begin Assessment Questions →'));

    // Trigger review & submit via the overview palette submit button
    const submitBtn = await screen.findByRole('button', { name: /Submit Assessment/i });
    fireEvent.click(submitBtn);

    // Modal appears
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('✓ All 2 questions have been answered!')).toBeInTheDocument();

    // Confirm submission
    fireEvent.click(screen.getByText('Confirm & Calculate Results'));

    // Should navigate to results
    expect(await screen.findByText('Results Page Landed')).toBeInTheDocument();
    expect(assessmentApi.submitAttempt).toHaveBeenCalledWith('att-123');
  });

  it('prevents submission when questions are unanswered and allows jumping to unanswered question', async () => {
    vi.mocked(assessmentApi.getAssessment).mockResolvedValueOnce({
      data: { id: 'asm-test', title: 'Exploration', version: 1, status: 'PUBLISHED' },
    });
    vi.mocked(assessmentApi.getQuestions).mockResolvedValueOnce({
      data: { assessmentId: 'asm-test', version: 1, questions: mockQuestions },
    });
    vi.mocked(assessmentApi.startAttempt).mockResolvedValueOnce({
      data: { id: 'att-123', assessmentId: 'asm-test', assessmentVersion: 1, status: 'IN_PROGRESS', startedAt: '2026-11-14T00:00:00Z' },
    });
    vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({
      data: {
        id: 'att-123',
        assessmentId: 'asm-test',
        status: 'IN_PROGRESS',
        startedAt: '2026-11-14T00:00:00Z',
        answers: [
          { questionId: 'q-1', selectedOptionId: 'opt-1-5', answeredAt: '2026-11-14T00:01:00Z' },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={['/assessments/asm-test/take']}>
        <Routes>
          <Route path="/assessments/:id/take" element={<AssessmentTakePage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('Begin Assessment Questions →'));

    // Click submit button while Question 2 is unanswered
    const submitBtn = await screen.findByRole('button', { name: /Submit Assessment/i });
    fireEvent.click(submitBtn);

    // Modal appears
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Completion Required \(1 Remaining\)/i)).toBeInTheDocument();

    // Confirm button is disabled
    const confirmBtn = screen.getByText('Confirm & Calculate Results');
    expect(confirmBtn).toBeDisabled();

    // Click "Jump to Question #2 →"
    const jumpBtn = screen.getByText(/Jump to Question #2/i);
    fireEvent.click(jumpBtn);

    // Modal closes and question 2 is active
    expect(await screen.findByText('Question 2 of 2')).toBeInTheDocument();
  });

  it('handles answer save failure gracefully and displays error alert while retaining selection', async () => {
    vi.mocked(assessmentApi.getAssessment).mockResolvedValueOnce({
      data: { id: 'asm-test', title: 'Exploration', version: 1, status: 'PUBLISHED' },
    });
    vi.mocked(assessmentApi.getQuestions).mockResolvedValueOnce({
      data: { assessmentId: 'asm-test', version: 1, questions: mockQuestions },
    });
    vi.mocked(assessmentApi.startAttempt).mockResolvedValueOnce({
      data: { id: 'att-123', assessmentId: 'asm-test', assessmentVersion: 1, status: 'IN_PROGRESS', startedAt: '2026-11-14T00:00:00Z' },
    });
    vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({
      data: { id: 'att-123', assessmentId: 'asm-test', status: 'IN_PROGRESS', startedAt: '2026-11-14T00:00:00Z', answers: [] },
    });
    vi.mocked(assessmentApi.saveAnswer).mockRejectedValueOnce(new Error('Network connection timeout'));

    render(
      <MemoryRouter initialEntries={['/assessments/asm-test/take']}>
        <Routes>
          <Route path="/assessments/:id/take" element={<AssessmentTakePage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('Begin Assessment Questions →'));

    const stronglyAgreeOpt = await screen.findByRole('radio', { name: /Strongly Agree/i });
    fireEvent.click(stronglyAgreeOpt);

    // Expect error message to be displayed
    expect(await screen.findByText('Network connection timeout')).toBeInTheDocument();
  });

  it('resumes an in-progress attempt with hydrated answers and navigates to first unanswered', async () => {
    vi.mocked(assessmentApi.getAssessment).mockResolvedValueOnce({
      data: { id: 'asm-test', title: 'Exploration', version: 1, status: 'PUBLISHED' },
    });
    vi.mocked(assessmentApi.getQuestions).mockResolvedValueOnce({
      data: { assessmentId: 'asm-test', version: 1, questions: mockQuestions },
    });
    vi.mocked(assessmentApi.startAttempt).mockResolvedValueOnce({
      data: {
        id: 'att-123',
        assessmentId: 'asm-test',
        assessmentVersion: 1,
        status: 'IN_PROGRESS',
        isResumed: true,
        startedAt: '2026-11-14T00:00:00Z',
      },
    });
    vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({
      data: {
        id: 'att-123',
        assessmentId: 'asm-test',
        status: 'IN_PROGRESS',
        startedAt: '2026-11-14T00:00:00Z',
        answers: [
          { questionId: 'q-1', selectedOptionId: 'opt-1-5', answeredAt: '2026-11-14T00:01:00Z' },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={['/assessments/asm-test/take']}>
        <Routes>
          <Route path="/assessments/:id/take" element={<AssessmentTakePage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('Begin Assessment Questions →'));

    // Should detect resumed state
    expect(await screen.findByText(/\(Resumed Session\)/i)).toBeInTheDocument();
    // Should have jumped to question 2 (first unanswered)
    expect(await screen.findByText('Question 2 of 2')).toBeInTheDocument();
  });

  it('serializes answer saves per question, ensuring subsequent option is queued and final server write is latest selection', async () => {
    vi.mocked(assessmentApi.getAssessment).mockResolvedValueOnce({
      data: { id: 'asm-test', title: 'Exploration', version: 1, status: 'PUBLISHED' },
    });
    vi.mocked(assessmentApi.getQuestions).mockResolvedValueOnce({
      data: { assessmentId: 'asm-test', version: 1, questions: mockQuestions },
    });
    vi.mocked(assessmentApi.startAttempt).mockResolvedValueOnce({
      data: { id: 'att-123', assessmentId: 'asm-test', assessmentVersion: 1, status: 'IN_PROGRESS', startedAt: '2026-11-14T00:00:00Z' },
    });
    vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({
      data: { id: 'att-123', assessmentId: 'asm-test', status: 'IN_PROGRESS', startedAt: '2026-11-14T00:00:00Z', answers: [] },
    });

    let resolveFirstSave: (val: any) => void;
    let resolveSecondSave: (val: any) => void;

    // First save is held in flight
    vi.mocked(assessmentApi.saveAnswer).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirstSave = resolve;
        })
    );
    // Second save is queued behind first
    vi.mocked(assessmentApi.saveAnswer).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecondSave = resolve;
        })
    );

    render(
      <MemoryRouter initialEntries={['/assessments/asm-test/take']}>
        <Routes>
          <Route path="/assessments/:id/take" element={<AssessmentTakePage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('Begin Assessment Questions →'));

    // Student selects Option 1 ("Strongly Disagree")
    const opt1 = await screen.findByRole('radio', { name: /Strongly Disagree/i });
    fireEvent.click(opt1);

    // Save 1 has been called with opt-1-1
    expect(assessmentApi.saveAnswer).toHaveBeenCalledTimes(1);
    expect(assessmentApi.saveAnswer).toHaveBeenCalledWith('att-123', 'q-1', 'opt-1-1');

    // Student immediately switches to Option 2 ("Disagree Key 2") while save 1 is still in flight
    const opt2 = await screen.findByRole('radio', { name: /Disagree Key 2/i });
    fireEvent.click(opt2);

    // UI optimistically shows Disagree selected
    expect(opt2).toHaveAttribute('aria-checked', 'true');

    // CRITICAL: Save 2 has NOT been dispatched to the server yet because save 1 is still in flight!
    // This guarantees server-side serialization and eliminates out-of-order writes in database!
    expect(assessmentApi.saveAnswer).toHaveBeenCalledTimes(1);

    // Now complete the first server write
    resolveFirstSave!({
      data: { id: 'ans-1', attemptId: 'att-123', questionId: 'q-1', selectedOptionId: 'opt-1-1' },
    });

    // The sequential worker now immediately dispatches the queued second save to the server
    await waitFor(() => {
      expect(assessmentApi.saveAnswer).toHaveBeenCalledTimes(2);
    });
    expect(assessmentApi.saveAnswer).toHaveBeenLastCalledWith('att-123', 'q-1', 'opt-1-2');

    // Complete the second server write
    resolveSecondSave!({
      data: { id: 'ans-2', attemptId: 'att-123', questionId: 'q-1', selectedOptionId: 'opt-1-2' },
    });

    await waitFor(() => {
      expect(screen.getByText('✓ Saved')).toBeInTheDocument();
    });

    // Both UI and final server-side persisted value are confirmed to be opt-1-2 (Option 2)
    expect(opt2).toHaveAttribute('aria-checked', 'true');
    expect(assessmentApi.saveAnswer).toHaveBeenLastCalledWith('att-123', 'q-1', 'opt-1-2');
  });

  it('does not allow submission while any answer save request is in flight', async () => {
    vi.mocked(assessmentApi.getAssessment).mockResolvedValueOnce({
      data: { id: 'asm-test', title: 'Exploration', version: 1, status: 'PUBLISHED' },
    });
    vi.mocked(assessmentApi.getQuestions).mockResolvedValueOnce({
      data: { assessmentId: 'asm-test', version: 1, questions: mockQuestions },
    });
    vi.mocked(assessmentApi.startAttempt).mockResolvedValueOnce({
      data: { id: 'att-123', assessmentId: 'asm-test', assessmentVersion: 1, status: 'IN_PROGRESS', startedAt: '2026-11-14T00:00:00Z' },
    });
    vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({
      data: {
        id: 'att-123',
        assessmentId: 'asm-test',
        status: 'IN_PROGRESS',
        startedAt: '2026-11-14T00:00:00Z',
        answers: [
          // Question 1 already answered
          { questionId: 'q-1', selectedOptionId: 'opt-1-5', answeredAt: '2026-11-14T00:01:00Z' },
        ],
      },
    });

    let resolveQ2Save: (val: any) => void;
    vi.mocked(assessmentApi.saveAnswer).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveQ2Save = resolve;
        })
    );
    vi.mocked(assessmentApi.submitAttempt).mockResolvedValueOnce({
      data: {
        attemptId: 'att-123',
        status: 'COMPLETED',
        assessmentVersion: 1,
        algorithmVersion: 'cosine-v1',
        dimensionScores: { ANALYTICAL: 1, CREATIVE: 1 },
        completedAt: '2026-11-14T00:10:00Z',
        recommendationsUrl: '/api/v1/attempts/att-123/recommendations',
      },
    });

    render(
      <MemoryRouter initialEntries={['/assessments/asm-test/take']}>
        <Routes>
          <Route path="/assessments/:id/take" element={<AssessmentTakePage />} />
          <Route path="/attempts/:id/results" element={<div>Results Page Landed</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('Begin Assessment Questions →'));
    expect(await screen.findByText('Question 2 of 2')).toBeInTheDocument();

    // Select option for Question 2 (held in flight)
    const optAgree = screen.getByRole('radio', { name: /Strongly Agree/i });
    fireEvent.click(optAgree);

    // Open submit review modal while save is still in flight
    const reviewBtn = screen.getByRole('button', { name: /Review & Finalize Assessment/i });
    fireEvent.click(reviewBtn);

    // Modal appears and shows in-flight saving banner
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Saving Answers in Progress/i)).toBeInTheDocument();

    // Confirm button MUST be disabled while any save is in flight
    const confirmBtn = screen.getByText('Saving Answers...');
    expect(confirmBtn).toBeDisabled();

    // Resolving the in-flight server save completes persistence
    resolveQ2Save!({
      data: { id: 'ans-2', attemptId: 'att-123', questionId: 'q-2', selectedOptionId: 'opt-2-5' },
    });

    // Modal updates to ready
    expect(await screen.findByText(/All 2 questions have been answered!/i)).toBeInTheDocument();
    const readyConfirmBtn = screen.getByText('Confirm & Calculate Results');
    expect(readyConfirmBtn).toBeEnabled();

    // Confirm submission
    fireEvent.click(readyConfirmBtn);
    expect(await screen.findByText('Results Page Landed')).toBeInTheDocument();
    expect(assessmentApi.submitAttempt).toHaveBeenCalledWith('att-123');
  });

  it('strictly blocks submission when answer saves have failed and requires successful retry', async () => {
    vi.mocked(assessmentApi.getAssessment).mockResolvedValueOnce({
      data: { id: 'asm-test', title: 'Exploration', version: 1, status: 'PUBLISHED' },
    });
    vi.mocked(assessmentApi.getQuestions).mockResolvedValueOnce({
      data: { assessmentId: 'asm-test', version: 1, questions: mockQuestions },
    });
    vi.mocked(assessmentApi.startAttempt).mockResolvedValueOnce({
      data: { id: 'att-123', assessmentId: 'asm-test', assessmentVersion: 1, status: 'IN_PROGRESS', startedAt: '2026-11-14T00:00:00Z' },
    });
    vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({
      data: {
        id: 'att-123',
        assessmentId: 'asm-test',
        status: 'IN_PROGRESS',
        startedAt: '2026-11-14T00:00:00Z',
        answers: [
          // Question 1 is already answered
          { questionId: 'q-1', selectedOptionId: 'opt-1-5', answeredAt: '2026-11-14T00:01:00Z' },
        ],
      },
    });

    // Question 2 save first fails with network error
    vi.mocked(assessmentApi.saveAnswer).mockRejectedValueOnce(new Error('HTTP 503 Service Unavailable'));
    // Retry resolves successfully
    vi.mocked(assessmentApi.saveAnswer).mockResolvedValueOnce({
      data: { id: 'ans-2', attemptId: 'att-123', questionId: 'q-2', selectedOptionId: 'opt-2-5', answeredAt: '2026-11-14T00:05:00Z' },
    });

    render(
      <MemoryRouter initialEntries={['/assessments/asm-test/take']}>
        <Routes>
          <Route path="/assessments/:id/take" element={<AssessmentTakePage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('Begin Assessment Questions →'));

    // Question 2 is auto-selected because question 1 was hydrated
    expect(await screen.findByText('Question 2 of 2')).toBeInTheDocument();

    // Select an option for question 2 (which fails)
    const optAgree = screen.getByRole('radio', { name: /Strongly Agree/i });
    fireEvent.click(optAgree);

    // Failure alert appears
    const failureAlert = await screen.findByRole('alert');
    expect(failureAlert).toHaveTextContent(/HTTP 503 Service Unavailable/i);

    // Open submit review modal
    const reviewBtn = screen.getByRole('button', { name: /Review & Finalize Assessment/i });
    fireEvent.click(reviewBtn);

    // Modal dialog must show save failure banner, NOT all answered!
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Save Failed \(1 Remaining\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Question #2 failed to save due to a network error/i)).toBeInTheDocument();

    // Confirm button MUST be disabled
    const confirmBtn = screen.getByText('Confirm & Calculate Results');
    expect(confirmBtn).toBeDisabled();

    // Click retry button in modal jumps to failed question
    const retryJumpBtn = screen.getByText(/Jump to Question #2 to Retry →/i);
    fireEvent.click(retryJumpBtn);

    expect(await screen.findByText('Question 2 of 2')).toBeInTheDocument();

    // Click "Retry Save" on Question 2
    const retrySaveBtn = screen.getByText('Retry Save');
    fireEvent.click(retrySaveBtn);

    // Now save succeeds
    expect(await screen.findByText('✓ Saved')).toBeInTheDocument();

    // Now open submit review modal again
    fireEvent.click(screen.getByRole('button', { name: /Review & Finalize Assessment/i }));
    expect(await screen.findByText(/All 2 questions have been answered!/i)).toBeInTheDocument();
    expect(screen.getByText('Confirm & Calculate Results')).toBeEnabled();
  });
});
