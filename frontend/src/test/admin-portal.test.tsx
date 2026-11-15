import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminCareersPage } from '@/pages/admin/AdminCareersPage';
import { adminApi } from '@/services/api/admin.api';
import { careersApi } from '@/services/api/careers.api';
import { UserProfile, Career } from '@/types/models';

vi.mock('@/services/api/admin.api', () => ({
  adminApi: {
    getOverviewAnalytics: vi.fn(),
    getCareerInterestAnalytics: vi.fn(),
    listUsers: vi.fn(),
    updateUserStatus: vi.fn(),
    createCareer: vi.fn(),
    archiveCareer: vi.fn(),
  },
}));

vi.mock('@/services/api/careers.api', () => ({
  careersApi: {
    listCareers: vi.fn(),
  },
}));

const mockOverview = {
  users: 142,
  attempts: 210,
  completedAttempts: 185,
  bookings: 54,
  publishedCareers: 38,
};

const mockInterests = [
  { dimension: 'ANALYTICAL' as const, total: 82 },
  { dimension: 'CREATIVE' as const, total: 45 },
];

const mockUser: UserProfile = {
  id: 'usr-admin-test-1',
  email: 'student.bob@school.edu',
  displayName: 'Bob Kumar',
  role: 'STUDENT',
  status: 'ACTIVE',
  profile: null,
  createdAt: '2026-02-01T00:00:00Z',
};

const mockCareerItem: Career = {
  id: 'car-cyber-1',
  title: 'Cybersecurity Analyst',
  slug: 'cybersecurity-analyst',
  description: 'Protects networks and data infrastructures.',
  published: true,
  dimensions: [{ dimension: 'ANALYTICAL', targetWeight: 0.85 }],
  skills: [],
  pathways: [],
};

describe('Admin Portal Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders admin dashboard metrics and cohort interest distribution', async () => {
    vi.mocked(adminApi.getOverviewAnalytics).mockResolvedValue({
      data: mockOverview,
    });
    vi.mocked(adminApi.getCareerInterestAnalytics).mockResolvedValue({
      data: mockInterests,
    });

    render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('School Administration & Analytics Hub')).toBeInTheDocument();
      expect(screen.getByText('142')).toBeInTheDocument(); // total users
      expect(screen.getByText('185')).toBeInTheDocument(); // completed attempts
      expect(screen.getByText('54')).toBeInTheDocument(); // bookings
      expect(screen.getByText('38')).toBeInTheDocument(); // published careers
      expect(screen.getByText('Analytical')).toBeInTheDocument();
    });
    expect(screen.getByText(/Privacy-Preserving Aggregate Notice/i)).toBeInTheDocument();
  });

  it('lists user accounts and toggles user suspension', async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue({
      data: [mockUser],
    });
    vi.mocked(adminApi.updateUserStatus).mockResolvedValue({
      data: { ...mockUser, status: 'SUSPENDED' },
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('User Account Management')).toBeInTheDocument();
      expect(screen.getByText('Bob Kumar')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Suspend/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Suspend/i }));

    await waitFor(() => {
      expect(adminApi.updateUserStatus).toHaveBeenCalledWith('usr-admin-test-1', 'SUSPENDED');
      expect(screen.getByRole('button', { name: /Reactivate/i })).toBeInTheDocument();
    });
  });

  it('manages career catalogue, creates a career roadmap, and archives it', async () => {
    vi.mocked(careersApi.listCareers).mockResolvedValue({
      data: [mockCareerItem],
    });
    vi.mocked(adminApi.createCareer).mockResolvedValue({
      data: {
        ...mockCareerItem,
        id: 'car-ai-2',
        title: 'AI Research Scientist',
        slug: 'ai-research-scientist',
      },
    });
    vi.mocked(adminApi.archiveCareer).mockResolvedValue({ data: {} });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter>
        <AdminCareersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Career Catalogue Management')).toBeInTheDocument();
      expect(screen.getByText('Cybersecurity Analyst')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Archive/i })).toBeInTheDocument();
    });

    // Open add career modal
    fireEvent.click(screen.getByRole('button', { name: /\+ Add New Career/i }));
    expect(screen.getByText('Add New Career Roadmap')).toBeInTheDocument();

    // Fill title
    const titleInput = screen.getByLabelText(/Career Title/i);
    fireEvent.change(titleInput, { target: { value: 'AI Research Scientist' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Create Career/i }));

    await waitFor(() => {
      expect(adminApi.createCareer).toHaveBeenCalled();
    });

    // Archive existing career
    const archiveBtns = screen.getAllByRole('button', { name: /Archive/i });
    fireEvent.click(archiveBtns[1]);

    await waitFor(() => {
      expect(adminApi.archiveCareer).toHaveBeenCalledWith('car-cyber-1');
    });
  });
});
