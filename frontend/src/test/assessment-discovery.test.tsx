import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AssessmentsPage } from '@/pages/student/AssessmentsPage';
import { assessmentApi } from '@/services/api/assessment.api';
import { Assessment, AssessmentAttempt } from '@/types/models';

vi.mock('@/services/api/assessment.api', () => ({
  assessmentApi: {
    listAssessments: vi.fn(),
    listAttempts: vi.fn(),
  },
}));

const mockAssessments: Assessment[] = [
  {
    id: 'asm-1',
    title: 'Secondary School Career Interest Profiler',
    description: 'NEP 2020 aligned interest exploration questionnaire.',
    version: 1,
    status: 'PUBLISHED',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('Assessment Discovery (AssessmentsPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders available published assessments with start action for unassessed students', async () => {
    vi.mocked(assessmentApi.listAssessments).mockResolvedValueOnce({
      data: mockAssessments,
    });
    vi.mocked(assessmentApi.listAttempts).mockResolvedValueOnce({
      data: [],
    });

    render(
      <MemoryRouter>
        <AssessmentsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Secondary School Career Interest Profiler')).toBeInTheDocument();
    expect(screen.getByText('Start Assessment →')).toBeInTheDocument();
    expect(screen.getByText(/~7 minutes/i)).toBeInTheDocument();
  });

  it('shows Resume Assessment action when student has an IN_PROGRESS attempt', async () => {
    const inProgressAttempt: AssessmentAttempt = {
      id: 'att-in-progress',
      assessmentId: 'asm-1',
      status: 'IN_PROGRESS',
      startedAt: '2026-11-14T10:00:00Z',
    };

    vi.mocked(assessmentApi.listAssessments).mockResolvedValueOnce({
      data: mockAssessments,
    });
    vi.mocked(assessmentApi.listAttempts).mockResolvedValueOnce({
      data: [inProgressAttempt],
    });

    render(
      <MemoryRouter>
        <AssessmentsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Resume Assessment →')).toBeInTheDocument();
    expect(screen.getByText(/IN PROGRESS • v1/i)).toBeInTheDocument();
  });

  it('renders previous attempts history table for completed assessments', async () => {
    const completedAttempt: AssessmentAttempt = {
      id: 'att-completed-1',
      assessmentId: 'asm-1',
      status: 'COMPLETED',
      startedAt: '2026-11-10T10:00:00Z',
      completedAt: '2026-11-10T10:25:00Z',
      algorithmVersion: 'cosine-v1',
    };

    vi.mocked(assessmentApi.listAssessments).mockResolvedValueOnce({
      data: mockAssessments,
    });
    vi.mocked(assessmentApi.listAttempts).mockResolvedValueOnce({
      data: [completedAttempt],
    });

    render(
      <MemoryRouter>
        <AssessmentsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Your Assessment History')).toBeInTheDocument();
    expect(screen.getByText('View Latest Results →')).toBeInTheDocument();
    expect(screen.getByText('cosine-v1')).toBeInTheDocument();
  });

  it('displays empty state when no published assessments exist', async () => {
    vi.mocked(assessmentApi.listAssessments).mockResolvedValueOnce({
      data: [],
    });
    vi.mocked(assessmentApi.listAttempts).mockResolvedValueOnce({
      data: [],
    });

    render(
      <MemoryRouter>
        <AssessmentsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('No Published Assessments')).toBeInTheDocument();
  });
});
