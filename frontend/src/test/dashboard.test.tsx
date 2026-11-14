import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '@/pages/student/DashboardPage';
import { AuthContext, AuthContextType } from '@/context/AuthContext';
import { userApi } from '@/services/api/user.api';
import { assessmentApi } from '@/services/api/assessment.api';
import { careersApi } from '@/services/api/careers.api';
import { bookingApi } from '@/services/api/booking.api';
import { UserProfile, AssessmentAttempt, Recommendation } from '@/types/models';

vi.mock('@/services/api/user.api', () => ({
  userApi: {
    getProfile: vi.fn(),
  },
}));

vi.mock('@/services/api/assessment.api', () => ({
  assessmentApi: {
    listAttempts: vi.fn(),
    getAttempt: vi.fn(),
    getRecommendations: vi.fn(),
  },
}));

vi.mock('@/services/api/careers.api', () => ({
  careersApi: {
    getSavedCareers: vi.fn(),
  },
}));

vi.mock('@/services/api/booking.api', () => ({
  bookingApi: {
    getMyBookings: vi.fn(),
  },
}));

const mockStudentUser: UserProfile = {
  id: 'usr_student_dhavika',
  email: 'dhavika@example.com',
  displayName: 'Dhavika Bika',
  role: 'STUDENT',
  status: 'ACTIVE',
  profile: {
    userId: 'usr_student_dhavika',
    schoolGrade: '11',
    consentAccepted: true,
  },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const createMockAuthContext = (overrides: Partial<AuthContextType> = {}): AuthContextType => ({
  user: mockStudentUser,
  authUser: {
    id: mockStudentUser.id,
    email: mockStudentUser.email,
    role: 'STUDENT',
    displayName: mockStudentUser.displayName,
  },
  token: 'mock-token',
  isLoading: false,
  isAuthenticated: true,
  sessionError: null,
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  updateProfile: vi.fn(),
  ...overrides,
});

describe('Student DashboardPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state without charts during initial multi-resource fetch', async () => {
    // Return pending promises to test loading skeleton state
    vi.mocked(userApi.getProfile).mockReturnValue(new Promise(() => {}));
    vi.mocked(assessmentApi.listAttempts).mockReturnValue(new Promise(() => {}));
    vi.mocked(careersApi.getSavedCareers).mockReturnValue(new Promise(() => {}));
    vi.mocked(bookingApi.getMyBookings).mockReturnValue(new Promise(() => {}));

    render(
      <AuthContext.Provider value={createMockAuthContext()}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // During loading, radar canvas and onboarding card should not be present
    expect(screen.queryByRole('img', { name: /student 6-axis/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /begin your interest exploration/i })).not.toBeInTheDocument();
    expect(screen.getByText(/welcome back, dhavika bika/i)).toBeInTheDocument();
  });

  it('renders WelcomeAssessmentCard empty state when student has no completed assessment', async () => {
    vi.mocked(userApi.getProfile).mockResolvedValueOnce({ data: mockStudentUser });
    vi.mocked(assessmentApi.listAttempts).mockResolvedValueOnce({ data: [] });
    vi.mocked(careersApi.getSavedCareers).mockResolvedValueOnce({ data: [] });
    vi.mocked(bookingApi.getMyBookings).mockResolvedValueOnce({ data: [] });

    render(
      <AuthContext.Provider value={createMockAuthContext()}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(
      await screen.findByRole('heading', { name: /welcome to careercompass/i })
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /begin your interest exploration/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /student 6-axis/i })).toBeInTheDocument();
    expect(screen.getAllByText('0.00 / 1.00').length).toBe(6);
  });

  it('renders populated state with RadarChart, recommendation, and bookings when completed attempt exists', async () => {
    const completedAttempt: AssessmentAttempt = {
      id: 'att_completed_1',
      studentId: 'usr_student_dhavika',
      assessmentId: 'asm_nep2020_v1',
      assessmentVersion: 1,
      status: 'COMPLETED',
      startedAt: '2026-03-01T10:00:00Z',
      completedAt: '2026-03-01T10:25:00Z',
      scoresJson: {
        ANALYTICAL: 0.92,
        CREATIVE: 0.74,
        SOCIAL: 0.55,
        PRACTICAL: 0.42,
        ORGANIZATIONAL: 0.68,
        INVESTIGATIVE: 0.88,
      },
    };

    const topRec: Recommendation = {
      career: {
        id: 'car_ai_researcher',
        slug: 'ai-research-scientist',
        title: 'AI Research Scientist',
      },
      rank: 1,
      similarityScore: 0.942,
      algorithmVersion: 'v1.0.0',
      careerProfileVersion: 1,
      reasons: ['Exceptional match for high Analytical and Investigative scores'],
      cautions: ['Requires advanced quantitative and postgraduate training'],
    };

    vi.mocked(userApi.getProfile).mockResolvedValueOnce({ data: mockStudentUser });
    vi.mocked(assessmentApi.listAttempts).mockResolvedValueOnce({ data: [completedAttempt] });
    vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({ data: completedAttempt });
    vi.mocked(assessmentApi.getRecommendations).mockResolvedValueOnce({ data: [topRec] });
    vi.mocked(careersApi.getSavedCareers).mockResolvedValueOnce({ data: [] });
    vi.mocked(bookingApi.getMyBookings).mockResolvedValueOnce({
      data: [
        {
          id: 'bk_1',
          slotId: 'slot_1',
          studentId: 'usr_student_dhavika',
          counsellorId: 'usr_counsellor_1',
          status: 'CONFIRMED',
          startsAt: '2026-12-01T14:00:00Z',
          endsAt: '2026-12-01T14:45:00Z',
          createdAt: '2026-11-01T10:00:00Z',
          updatedAt: '2026-11-01T10:00:00Z',
        },
      ],
    });

    render(
      <AuthContext.Provider value={createMockAuthContext()}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // WelcomeAssessmentCard button should NOT be shown
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /begin your interest exploration/i })
      ).not.toBeInTheDocument();
    });

    // Radar chart canvas & table scores
    expect(
      screen.getByRole('img', { name: /student 6-axis interest dimension profile radar chart/i })
    ).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('AI Research Scientist')).toBeInTheDocument();
    expect(screen.getByText('94% Similarity')).toBeInTheDocument();
    expect(screen.getByText(/Session ID: bk_1/i)).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
  });

  it('demonstrates resilience via Promise.allSettled when secondary service calls fail', async () => {
    const completedAttempt: AssessmentAttempt = {
      id: 'att_completed_2',
      studentId: 'usr_student_dhavika',
      assessmentId: 'asm_nep2020_v1',
      assessmentVersion: 1,
      status: 'COMPLETED',
      startedAt: '2026-03-01T10:00:00Z',
      completedAt: '2026-03-01T10:25:00Z',
      scoresJson: {
        ANALYTICAL: 0.8,
        CREATIVE: 0.5,
        SOCIAL: 0.5,
        PRACTICAL: 0.5,
        ORGANIZATIONAL: 0.5,
        INVESTIGATIVE: 0.5,
      },
    };

    vi.mocked(userApi.getProfile).mockResolvedValueOnce({ data: mockStudentUser });
    vi.mocked(assessmentApi.listAttempts).mockResolvedValueOnce({ data: [completedAttempt] });
    vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({ data: completedAttempt });
    vi.mocked(assessmentApi.getRecommendations).mockResolvedValueOnce({ data: [] });
    vi.mocked(careersApi.getSavedCareers).mockRejectedValueOnce(new Error('Saved careers DB timeout'));
    vi.mocked(bookingApi.getMyBookings).mockRejectedValueOnce(new Error('Booking service unavailable'));

    render(
      <AuthContext.Provider value={createMockAuthContext()}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Notice banner is rendered instead of a total page crash
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/some dashboard modules could not be updated/i)).toBeInTheDocument();
    expect(screen.getByText(/unable to load bookmarked careers/i)).toBeInTheDocument();

    // Radar chart and primary profile still render successfully
    expect(
      screen.getByRole('img', { name: /student 6-axis interest dimension profile radar chart/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/welcome back, dhavika bika/i)).toBeInTheDocument();
  });
});
