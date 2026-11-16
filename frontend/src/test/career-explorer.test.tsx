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
  { id: 'sk-python', name: 'Python' },
  { id: 'sk-unmatched', name: 'Unmatched Skill' },
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

    it('debounces rapid search input so only the final keyword generates an API call', async () => {
      vi.mocked(careersApi.listSkills).mockResolvedValue({ data: mockSkills });
      vi.mocked(careersApi.listCareers).mockResolvedValue({
        data: mockCareers,
        meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
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
      // Simulate rapid keystrokes: 'D', 'Data', 'Data Scientist'
      fireEvent.change(searchInput, { target: { value: 'D' } });
      fireEvent.change(searchInput, { target: { value: 'Data' } });
      fireEvent.change(searchInput, { target: { value: 'Data Scientist' } });

      // After debounce settles, only final search query is dispatched
      await waitFor(() => {
        expect(careersApi.listCareers).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'Data Scientist' })
        );
      });

      // Confirm intermediate queries were NOT sent to the backend
      const calledQueries = vi.mocked(careersApi.listCareers).mock.calls.map(
        (call) => call[0]?.q
      );
      expect(calledQueries).not.toContain('D');
      expect(calledQueries).not.toContain('Data');
    });

    it('attaches an AbortSignal to requests and cancels in-flight fetch when query changes', async () => {
      vi.mocked(careersApi.listSkills).mockResolvedValue({ data: mockSkills });
      let capturedSignal: AbortSignal | undefined;
      vi.mocked(careersApi.listCareers).mockImplementation(async (params = {}) => {
        if (!params.q) {
          capturedSignal = params.signal;
        }
        return {
          data: mockCareers,
          meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
        };
      });
      vi.mocked(careersApi.getSavedCareers).mockResolvedValue({ data: [] });

      render(
        <AuthContext.Provider value={createMockAuth()}>
          <MemoryRouter>
            <CareerExplorerPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      await screen.findByText('AI Research Scientist');
      expect(capturedSignal).toBeDefined();
      expect(capturedSignal?.aborted).toBe(false);

      // Typing new search should trigger cleanup and abort previous signal
      const searchInput = screen.getByLabelText(/Search Keywords/i);
      fireEvent.change(searchInput, { target: { value: 'Robotics' } });

      await waitFor(() => {
        expect(capturedSignal?.aborted).toBe(true);
      });
    });

    it('displays rate-limit error banner and successfully recovers when clicking Retry on page 1', async () => {
      vi.mocked(careersApi.listSkills).mockResolvedValue({ data: mockSkills });
      // First call fails with 429 RATE_LIMIT_EXCEEDED
      vi.mocked(careersApi.listCareers).mockRejectedValueOnce(
        new Error('Too many requests, please try again later.')
      );
      vi.mocked(careersApi.getSavedCareers).mockResolvedValue({ data: [] });

      render(
        <AuthContext.Provider value={createMockAuth()}>
          <MemoryRouter>
            <CareerExplorerPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      // Verify rate-limit error banner and Retry button appear
      const errorBanner = await screen.findByRole('alert');
      expect(errorBanner).toHaveTextContent(/Too many requests, please try again later/i);
      const retryBtn = screen.getByRole('button', { name: /Retry/i });
      expect(retryBtn).toBeInTheDocument();

      // Now mock successful resolution on retry
      vi.mocked(careersApi.listCareers).mockResolvedValueOnce({
        data: mockCareers,
        meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
      });

      // Clicking Retry while on page 1 must re-execute API fetch
      fireEvent.click(retryBtn);

      // Verify error is cleared and catalogue recovers
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByText('AI Research Scientist')).toBeInTheDocument();
      });
    });

    it('filters careers by skill selection and displays all matching transversal careers', async () => {
      vi.mocked(careersApi.listSkills).mockResolvedValue({ data: mockSkills });
      const pythonCareers: Career[] = [
        { id: 'c-1', slug: 'data-scientist', title: 'Data Scientist', summary: 'Machine learning', published: true, profileVersion: 1 },
        { id: 'c-2', slug: 'software-architect', title: 'Software Architect', summary: 'Distributed systems', published: true, profileVersion: 1 },
        { id: 'c-3', slug: 'cybersecurity-engineer', title: 'Cybersecurity Operations Engineer', summary: 'Network security', published: true, profileVersion: 1 },
      ];

      vi.mocked(careersApi.listCareers).mockImplementation(async (params = {}) => {
        if (params.skillId === 'sk-python') {
          return { data: pythonCareers, meta: { page: 1, limit: 12, total: 3, totalPages: 1 } };
        }
        return { data: mockCareers, meta: { page: 1, limit: 12, total: 2, totalPages: 1 } };
      });
      vi.mocked(careersApi.getSavedCareers).mockResolvedValue({ data: [] });

      render(
        <AuthContext.Provider value={createMockAuth()}>
          <MemoryRouter>
            <CareerExplorerPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      await screen.findByText('AI Research Scientist');

      const skillSelect = screen.getByLabelText(/Filter by Required Skill/i);
      fireEvent.change(skillSelect, { target: { value: 'sk-python' } });

      await waitFor(() => {
        expect(careersApi.listCareers).toHaveBeenCalledWith(
          expect.objectContaining({ skillId: 'sk-python' })
        );
      });

      // All 3 matching careers should be rendered in UI
      expect(await screen.findByText('Data Scientist')).toBeInTheDocument();
      expect(screen.getByText('Software Architect')).toBeInTheDocument();
      expect(screen.getByText('Cybersecurity Operations Engineer')).toBeInTheDocument();
    });

    it('combines keyword search with skill filter and sends both to the API', async () => {
      vi.mocked(careersApi.listSkills).mockResolvedValue({ data: mockSkills });
      vi.mocked(careersApi.listCareers).mockResolvedValue({
        data: [
          { id: 'c-2', slug: 'software-architect', title: 'Software Architect', summary: 'Distributed systems', published: true, profileVersion: 1 },
        ],
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

      const skillSelect = await screen.findByLabelText(/Filter by Required Skill/i);
      fireEvent.change(skillSelect, { target: { value: 'sk-python' } });

      const searchInput = screen.getByLabelText(/Search Keywords/i);
      fireEvent.change(searchInput, { target: { value: 'Architect' } });

      await waitFor(() => {
        expect(careersApi.listCareers).toHaveBeenCalledWith(
          expect.objectContaining({ skillId: 'sk-python', q: 'Architect' })
        );
      });

      expect(await screen.findByText('Software Architect')).toBeInTheDocument();
    });

    it('resets filters and restores all careers via Reset Filters button', async () => {
      vi.mocked(careersApi.listSkills).mockResolvedValue({ data: mockSkills });
      vi.mocked(careersApi.listCareers).mockResolvedValue({
        data: mockCareers,
        meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
      });
      vi.mocked(careersApi.getSavedCareers).mockResolvedValue({ data: [] });

      render(
        <AuthContext.Provider value={createMockAuth()}>
          <MemoryRouter>
            <CareerExplorerPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      await screen.findByText('AI Research Scientist');

      // Set skill filter
      const skillSelect = screen.getByLabelText(/Filter by Required Skill/i);
      fireEvent.change(skillSelect, { target: { value: 'sk-python' } });

      // Reset button should now be visible
      const resetBtn = await screen.findByRole('button', { name: /Reset Filters/i });
      expect(resetBtn).toBeInTheDocument();

      // Click Reset Filters
      fireEvent.click(resetBtn);

      await waitFor(() => {
        expect(careersApi.listCareers).toHaveBeenCalledWith(
          expect.objectContaining({ skillId: undefined, q: undefined })
        );
      });
    });

    it('renders empty state when skill filter returns no careers and clears filter on action click', async () => {
      vi.mocked(careersApi.listSkills).mockResolvedValue({ data: mockSkills });
      vi.mocked(careersApi.listCareers).mockImplementation(async (params = {}) => {
        if (params.skillId === 'sk-unmatched') {
          return { data: [], meta: { page: 1, limit: 12, total: 0, totalPages: 0 } };
        }
        return { data: mockCareers, meta: { page: 1, limit: 12, total: 2, totalPages: 1 } };
      });
      vi.mocked(careersApi.getSavedCareers).mockResolvedValue({ data: [] });

      render(
        <AuthContext.Provider value={createMockAuth()}>
          <MemoryRouter>
            <CareerExplorerPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      await screen.findByText('AI Research Scientist');

      const skillSelect = screen.getByLabelText(/Filter by Required Skill/i);
      fireEvent.change(skillSelect, { target: { value: 'sk-unmatched' } });

      // Empty state should be visible
      expect(await screen.findByText('No Career Pathways Found')).toBeInTheDocument();

      // Click "Clear All Filters"
      const clearBtn = screen.getByRole('button', { name: /Clear All Filters/i });
      fireEvent.click(clearBtn);

      await waitFor(() => {
        expect(careersApi.listCareers).toHaveBeenCalledWith(
          expect.objectContaining({ skillId: undefined })
        );
      });
    });

    it('supports sorting and pagination with skill filter applied', async () => {
      vi.mocked(careersApi.listSkills).mockResolvedValue({ data: mockSkills });
      vi.mocked(careersApi.listCareers).mockImplementation(async (params = {}) => {
        return {
          data: mockCareers,
          meta: {
            page: Number(params.page || 1),
            limit: 12,
            total: 25,
            totalPages: 3,
          },
        };
      });
      vi.mocked(careersApi.getSavedCareers).mockResolvedValue({ data: [] });

      render(
        <AuthContext.Provider value={createMockAuth()}>
          <MemoryRouter>
            <CareerExplorerPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      await screen.findByText('AI Research Scientist');

      // Select skill
      const skillSelect = screen.getByLabelText(/Filter by Required Skill/i);
      fireEvent.change(skillSelect, { target: { value: 'sk-python' } });

      // Change sort order
      const sortSelect = screen.getByLabelText(/Sort Directory/i);
      fireEvent.change(sortSelect, { target: { value: 'title-desc' } });

      await waitFor(() => {
        expect(careersApi.listCareers).toHaveBeenCalledWith(
          expect.objectContaining({ skillId: 'sk-python', sort: 'title', order: 'desc' })
        );
      });

      // Click Next Page button
      const nextBtn = await screen.findByRole('button', { name: /Next Page →/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(careersApi.listCareers).toHaveBeenCalledWith(
          expect.objectContaining({ skillId: 'sk-python', page: 2 })
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
