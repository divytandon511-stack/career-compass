import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CareerExplorerPage } from '@/pages/student/CareerExplorerPage';
import { CareerDetailPage } from '@/pages/student/CareerDetailPage';
import { SavedCareersPage } from '@/pages/student/SavedCareersPage';
import { careersApi } from '@/services/api/careers.api';
import { Career, SavedCareer, Skill } from '@/types/models';
import { AuthContext, AuthContextType } from '@/context/AuthContext';

vi.mock('@/services/api/careers.api', () => ({
  careersApi: {
    listCareers: vi.fn(),
    getCareer: vi.fn(),
    listSkills: vi.fn(),
    getSavedCareers: vi.fn(),
    saveCareer: vi.fn(),
    removeSavedCareer: vi.fn(),
  },
}));

const mockSkills: Skill[] = [
  { id: 'sk-1', name: 'Statistical Modeling' },
  { id: 'sk-2', name: 'Machine Learning' },
];

const mockCareers: Career[] = [
  {
    id: 'c-1',
    slug: 'ai-research-scientist',
    title: 'AI Research Scientist',
    summary: 'Designs novel neural network architectures and machine learning systems.',
    published: true,
    profileVersion: 1,
  },
  {
    id: 'c-2',
    slug: 'robotics-engineer',
    title: 'Robotics Engineer',
    summary: 'Builds automated control systems and electromechanical robots.',
    published: true,
    profileVersion: 1,
  },
];

const mockCareerDetail: Career = {
  id: 'c-1',
  slug: 'ai-research-scientist',
  title: 'AI Research Scientist',
  description: 'Full roadmap detailing Class 11-12 subject choices, B.Tech/M.Tech degrees, and GATE/PhD milestones.',
  published: true,
  profileVersion: 1,
  sourceNote: 'Government NEP 2020 Career Framework',
  skills: mockSkills,
  dimensions: [
    { dimension: 'ANALYTICAL', targetWeight: 0.95 },
    { dimension: 'INVESTIGATIVE', targetWeight: 0.9 },
  ],
  pathways: [
    {
      id: 'pw-1',
      stage: 'Higher Secondary',
      qualification: 'Class 11-12 with Physics, Chemistry, and Mathematics (PCM)',
      notes: 'Minimum 75% aggregate required for JEE eligibility.',
      verifiedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'pw-2',
      stage: 'Undergraduate',
      qualification: 'B.Tech / B.E. in Computer Science or Artificial Intelligence',
      notes: 'Admissions via JEE Advanced / State Engineering Entrance.',
      verifiedAt: '2026-01-01T00:00:00Z',
    },
  ],
};

const createMockAuth = (): AuthContextType => ({
  user: {
    id: 'usr-student',
    email: 'student@example.com',
    displayName: 'Student',
    role: 'STUDENT',
    status: 'ACTIVE',
    profile: null,
    createdAt: '2026-01-01T00:00:00Z',
  },
  authUser: {
    id: 'usr-student',
    email: 'student@example.com',
    role: 'STUDENT',
  },
  token: 'mock-token',
  isLoading: false,
  isAuthenticated: true,
  sessionError: null,
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  updateProfile: vi.fn(),
});

describe('Career Explorer & Details (CareerExplorerPage, CareerDetailPage, SavedCareersPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CareerExplorerPage', () => {
    it('renders career directory with search inputs and career cards', async () => {
      vi.mocked(careersApi.listSkills).mockResolvedValueOnce({ data: mockSkills });
      vi.mocked(careersApi.listCareers).mockResolvedValueOnce({
        data: mockCareers,
        meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
      });
      vi.mocked(careersApi.getSavedCareers).mockResolvedValueOnce({ data: [] });

      render(
        <AuthContext.Provider value={createMockAuth()}>
          <MemoryRouter>
            <CareerExplorerPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(await screen.findByText('Career Explorer')).toBeInTheDocument();
      expect(screen.getByText('AI Research Scientist')).toBeInTheDocument();
      expect(screen.getByText('Robotics Engineer')).toBeInTheDocument();
      expect(screen.getByLabelText(/Search Keywords/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Filter by Required Skill/i)).toBeInTheDocument();
    });

    it('searches careers when query input changes', async () => {
      vi.mocked(careersApi.listSkills).mockResolvedValue({ data: mockSkills });
      vi.mocked(careersApi.listCareers).mockResolvedValue({
        data: [mockCareers[0]],
        meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
      });
      vi.mocked(careersApi.getSavedCareers).mockResolvedValue({ data: [] });

      render(
        <AuthContext.Provider value={createMockAuth()}>
          <MemoryRouter>
            <CareerExplorerPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      const searchInput = await screen.findByLabelText(/Search Keywords/i);
      fireEvent.change(searchInput, { target: { value: 'AI' } });

      await waitFor(() => {
        expect(careersApi.listCareers).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'AI' })
        );
      });
    });
  });

  describe('CareerDetailPage', () => {
    it('renders comprehensive educational pathways, required skills, and target dimensions', async () => {
      vi.mocked(careersApi.getCareer).mockResolvedValueOnce({
        data: mockCareerDetail,
      });
      vi.mocked(careersApi.getSavedCareers).mockResolvedValueOnce({ data: [] });

      render(
        <AuthContext.Provider value={createMockAuth()}>
          <MemoryRouter initialEntries={['/careers/ai-research-scientist']}>
            <Routes>
              <Route path="/careers/:idOrSlug" element={<CareerDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(await screen.findByText('AI Research Scientist')).toBeInTheDocument();
      expect(screen.getByText(/Chronological Education Roadmap/i)).toBeInTheDocument();
      expect(screen.getByText('Stage 1: Higher Secondary')).toBeInTheDocument();
      expect(screen.getByText('Class 11-12 with Physics, Chemistry, and Mathematics (PCM)')).toBeInTheDocument();
      expect(screen.getByText('Stage 2: Undergraduate')).toBeInTheDocument();

      // Skills
      expect(screen.getByText('Statistical Modeling')).toBeInTheDocument();
      expect(screen.getByText('Machine Learning')).toBeInTheDocument();

      // Dimensions
      expect(screen.getByText('95% Target')).toBeInTheDocument();
    });
  });

  describe('SavedCareersPage', () => {
    it('renders saved careers list and optimistically removes bookmark on click', async () => {
      const mockSavedList: SavedCareer[] = [
        {
          id: 'c-1',
          slug: 'ai-research-scientist',
          title: 'AI Research Scientist',
          summary: 'Designs novel neural network architectures.',
          savedAt: '2026-11-14T00:00:00Z',
        },
      ];

      vi.mocked(careersApi.getSavedCareers).mockResolvedValueOnce({
        data: mockSavedList,
        meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
      });
      vi.mocked(careersApi.removeSavedCareer).mockResolvedValueOnce({ data: {} });

      render(
        <MemoryRouter>
          <SavedCareersPage />
        </MemoryRouter>
      );

      expect(await screen.findByText('Saved Careers')).toBeInTheDocument();
      expect(screen.getByText('AI Research Scientist')).toBeInTheDocument();

      // Click remove
      const removeBtn = screen.getByRole('button', { name: /Remove AI Research Scientist from saved careers/i });
      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(careersApi.removeSavedCareer).toHaveBeenCalledWith('c-1');
      });

      // Item removed -> empty state appears
      expect(await screen.findByText('No Bookmarked Careers Yet')).toBeInTheDocument();
    });
  });
});
