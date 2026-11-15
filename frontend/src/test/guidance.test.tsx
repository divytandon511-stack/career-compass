import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { GuidancePage } from '@/pages/student/GuidancePage';
import { GuidanceChatPage } from '@/pages/student/GuidanceChatPage';
import { guidanceApi, GuidanceSession } from '@/services/api/guidance.api';
import { assessmentApi } from '@/services/api/assessment.api';
import { careersApi } from '@/services/api/careers.api';
import { AssessmentAttempt, Career } from '@/types/models';

vi.mock('@/services/api/guidance.api', () => ({
  guidanceApi: {
    listSessions: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    sendMessage: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

vi.mock('@/services/api/assessment.api', () => ({
  assessmentApi: {
    listAttempts: vi.fn(),
  },
}));

vi.mock('@/services/api/careers.api', () => ({
  careersApi: {
    listCareers: vi.fn(),
  },
}));

const mockAttempt: AssessmentAttempt = {
  id: 'att-1',
  assessmentId: 'asm-1',
  status: 'COMPLETED',
  startedAt: '2026-11-10T10:00:00.000Z',
  completedAt: '2026-11-10T10:30:00.000Z',
  scoresJson: { ANALYTICAL: 85, CREATIVE: 40 },
};

const mockCareer: Career = {
  id: 'car-1',
  title: 'Data Analyst',
  slug: 'data-analyst',
  description: 'Analyzes structured datasets.',
  published: true,
  dimensions: [{ dimension: 'ANALYTICAL', targetWeight: 0.9 }],
  skills: [],
  pathways: [],
};

const mockSession: GuidanceSession = {
  sessionId: 'session-abc-123',
  attemptId: 'att-1',
  careerIds: ['car-1'],
  messages: [
    {
      role: 'user',
      text: 'Which stream in Class 11 should I choose for Data Analyst?',
      createdAt: '2026-11-14T01:00:00.000Z',
    },
    {
      role: 'assistant',
      text: 'For Data Analyst, Mathematics is highly recommended in Class 11.',
      groundingCareerIds: ['car-1'],
      createdAt: '2026-11-14T01:00:05.000Z',
    },
  ],
  createdAt: '2026-11-14T01:00:00.000Z',
  updatedAt: '2026-11-14T01:00:05.000Z',
};

describe('MargDarshak AI Guidance Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ScrollIntoView mock
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders guidance home with safety commitment and previous sessions', async () => {
    vi.mocked(guidanceApi.listSessions).mockResolvedValue({
      data: [mockSession],
    });
    vi.mocked(assessmentApi.listAttempts).mockResolvedValue({
      data: [mockAttempt],
    });
    vi.mocked(careersApi.listCareers).mockResolvedValue({
      data: [mockCareer],
    });

    render(
      <MemoryRouter>
        <GuidancePage />
      </MemoryRouter>
    );

    expect(screen.getByText('MargDarshak AI Career Guidance')).toBeInTheDocument();
    expect(screen.getByText(/Safety & Grounding Commitment/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Open Chat/i)).toBeInTheDocument();
      expect(screen.getByText(/Focus Careers:/i)).toBeInTheDocument();
    });
  });

  it('renders guidance chat session and exchanges messages', async () => {
    vi.mocked(guidanceApi.getSession).mockResolvedValue({
      data: mockSession,
    });
    vi.mocked(careersApi.listCareers).mockResolvedValue({
      data: [mockCareer],
    });
    vi.mocked(guidanceApi.sendMessage).mockResolvedValue({
      data: {
        sessionId: 'session-abc-123',
        message: {
          text: 'You should consider CBSE Science or Commerce with Informatics Practices.',
          groundingCareerIds: ['car-1'],
          createdAt: '2026-11-14T01:01:00.000Z',
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/guidance/session-abc-123']}>
        <Routes>
          <Route path="/guidance/:sessionId" element={<GuidanceChatPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Which stream in Class 11 should I choose for Data Analyst?')).toBeInTheDocument();
      expect(screen.getByText('For Data Analyst, Mathematics is highly recommended in Class 11.')).toBeInTheDocument();
    });

    // Type a new message
    const input = screen.getByLabelText(/Your message to MargDarshak AI/i);
    fireEvent.change(input, { target: { value: 'What about Commerce stream?' } });

    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(guidanceApi.sendMessage).toHaveBeenCalledWith('session-abc-123', 'What about Commerce stream?');
      expect(
        screen.getByText('You should consider CBSE Science or Commerce with Informatics Practices.')
      ).toBeInTheDocument();
    });
  });
});
