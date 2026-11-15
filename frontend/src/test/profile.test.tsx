import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfilePage } from '@/pages/student/ProfilePage';
import { userApi } from '@/services/api/user.api';
import { UserProfile } from '@/types/models';

vi.mock('@/services/api/user.api', () => ({
  userApi: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

const mockStudentProfile: UserProfile = {
  id: 'usr_student_1',
  email: 'student@school.edu',
  displayName: 'Priya Sharma',
  role: 'STUDENT',
  status: 'ACTIVE',
  profile: {
    userId: 'usr_student_1',
    schoolGrade: 'Class 10',
    consentAccepted: true,
  },
  createdAt: '2026-01-01T00:00:00Z',
};

describe('Student Profile Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders student profile information correctly', async () => {
    vi.mocked(userApi.getProfile).mockResolvedValue({
      data: mockStudentProfile,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Student Profile')).toBeInTheDocument();
      expect(screen.getByText('student@school.edu')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Priya Sharma')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Class 10 (Secondary Board Year)')).toBeInTheDocument();
    });
  });

  it('updates display name and school grade successfully', async () => {
    vi.mocked(userApi.getProfile).mockResolvedValue({
      data: mockStudentProfile,
    });
    vi.mocked(userApi.updateProfile).mockResolvedValue({
      data: {
        ...mockStudentProfile,
        displayName: 'Priya S.',
        profile: {
          userId: 'usr_student_1',
          schoolGrade: 'Class 11',
          consentAccepted: true,
        },
      },
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Priya Sharma')).toBeInTheDocument();
    });

    // Change display name and grade
    const nameInput = screen.getByLabelText(/Display Name/i);
    fireEvent.change(nameInput, { target: { value: 'Priya S.' } });

    const gradeSelect = screen.getByLabelText(/School Grade \(Class\)/i);
    fireEvent.change(gradeSelect, { target: { value: 'Class 11' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save Profile/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(userApi.updateProfile).toHaveBeenCalledWith({
        displayName: 'Priya S.',
        schoolGrade: 'Class 11',
      });
      expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
    });
  });
});
