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
});
