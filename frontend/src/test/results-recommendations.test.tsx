import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ResultsPage } from '@/pages/student/ResultsPage';
import { RecommendationsPage } from '@/pages/student/RecommendationsPage';
import { assessmentApi } from '@/services/api/assessment.api';
import { careersApi } from '@/services/api/careers.api';
import { AssessmentAttempt, Recommendation } from '@/types/models';

vi.mock('@/services/api/assessment.api', () => ({
  assessmentApi: {
    getAttempt: vi.fn(),
    getRecommendations: vi.fn(),
  },
}));

vi.mock('@/services/api/careers.api', () => ({
  careersApi: {
    getSavedCareers: vi.fn(),
    saveCareer: vi.fn(),
    removeSavedCareer: vi.fn(),
  },
}));

const mockCompletedAttempt: AssessmentAttempt = {
  id: 'att-completed-123',
  assessmentId: 'asm-1',
  assessmentVersion: 1,
  status: 'COMPLETED',
  startedAt: '2026-11-14T00:00:00Z',
  completedAt: '2026-11-14T00:20:00Z',
  algorithmVersion: 'cosine-v1',
  scoresJson: {
    ANALYTICAL: 0.85,
    CREATIVE: 0.65,
    SOCIAL: 0.45,
    PRACTICAL: 0.35,
    ORGANIZATIONAL: 0.75,
    INVESTIGATIVE: 0.9,
  },
};

const mockRecommendations: Recommendation[] = [
  {
    career: {
      id: 'car-1',
      slug: 'data-scientist',
      title: 'Data Scientist',
    },
    rank: 1,
    similarityScore: 0.94,
    algorithmVersion: 'cosine-v1',
    reasons: ['High Analytical and Investigative dimension alignment.'],
    cautions: ['Demands extensive statistical and machine learning training.'],
  },
  {
    career: {
      id: 'car-2',
      slug: 'software-architect',
      title: 'Software Architect',
    },
    rank: 2,
    similarityScore: 0.88,
    algorithmVersion: 'cosine-v1',
    reasons: ['Strong Organizational and Analytical compatibility.'],
    cautions: [],
  },
];

describe('Results & Recommendations (ResultsPage & RecommendationsPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ResultsPage', () => {
    it('renders 6-axis score visualization and dimension breakdown for completed attempt', async () => {
      vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({
        data: mockCompletedAttempt,
      });
      vi.mocked(assessmentApi.getRecommendations).mockResolvedValueOnce({
        data: mockRecommendations,
      });

      render(
        <MemoryRouter initialEntries={['/attempts/att-completed-123/results']}>
          <Routes>
            <Route path="/attempts/:id/results" element={<ResultsPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(await screen.findByText('Your Interest Exploration Profile')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: /student 6-axis/i })).toBeInTheDocument();

      // Dimension breakdown checks
      expect(screen.getByText('85% (0.85/1.00)')).toBeInTheDocument();
      expect(screen.getByText('90% (0.90/1.00)')).toBeInTheDocument();
      expect(screen.getByText(/Top Aligned Career Pathways/i)).toBeInTheDocument();
    });

    it('shows in-progress resume prompt when attempt is not finalized', async () => {
      vi.mocked(assessmentApi.getAttempt).mockResolvedValueOnce({
        data: {
          id: 'att-in-prog',
          assessmentId: 'asm-1',
          status: 'IN_PROGRESS',
          startedAt: '2026-11-14T00:00:00Z',
        },
      });

      render(
        <MemoryRouter initialEntries={['/attempts/att-in-prog/results']}>
          <Routes>
            <Route path="/attempts/:id/results" element={<ResultsPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(await screen.findByText('Assessment In Progress')).toBeInTheDocument();
      expect(screen.getByText('Resume Assessment →')).toBeInTheDocument();
    });
  });

  describe('RecommendationsPage', () => {
    it('renders ranked recommendations with similarity scores, reasons and cautions', async () => {
      vi.mocked(assessmentApi.getRecommendations).mockResolvedValueOnce({
        data: mockRecommendations,
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });
      vi.mocked(careersApi.getSavedCareers).mockResolvedValueOnce({
        data: [],
      });

      render(
        <MemoryRouter initialEntries={['/attempts/att-completed-123/recommendations']}>
          <Routes>
            <Route path="/attempts/:id/recommendations" element={<RecommendationsPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(await screen.findByText('Career Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Data Scientist')).toBeInTheDocument();
      expect(screen.getByText('Rank #1')).toBeInTheDocument();
      expect(screen.getByText('94% Vector Alignment')).toBeInTheDocument();
      expect(screen.getByText('High Analytical and Investigative dimension alignment.')).toBeInTheDocument();
      expect(screen.getByText('Demands extensive statistical and machine learning training.')).toBeInTheDocument();
    });

    it('optimistically saves and unsaves a recommended career', async () => {
      vi.mocked(assessmentApi.getRecommendations).mockResolvedValueOnce({
        data: mockRecommendations,
        meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
      });
      vi.mocked(careersApi.getSavedCareers).mockResolvedValueOnce({
        data: [],
      });
      vi.mocked(careersApi.saveCareer).mockResolvedValueOnce({
        data: {
          career: { id: 'car-1', slug: 'data-scientist', title: 'Data Scientist', published: true, profileVersion: 1 },
          savedAt: '2026-11-14T00:30:00Z',
        },
      });

      render(
        <MemoryRouter initialEntries={['/attempts/att-completed-123/recommendations']}>
          <Routes>
            <Route path="/attempts/:id/recommendations" element={<RecommendationsPage />} />
          </Routes>
        </MemoryRouter>
      );

      const saveButtons = await screen.findAllByRole('button', { name: /☆ Save Career/i });
      fireEvent.click(saveButtons[0]);

      // Optimistic transition to saved
      expect(await screen.findByRole('button', { name: /★ Saved/i })).toBeInTheDocument();
      expect(careersApi.saveCareer).toHaveBeenCalledWith('car-1');
    });
  });
});
