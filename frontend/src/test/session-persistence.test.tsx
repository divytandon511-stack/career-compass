import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { userApi } from '@/services/api/user.api';
import { setAuthToken, getAuthToken } from '@/services/api/client';
import { UserProfile } from '@/types/models';

vi.mock('@/services/api/user.api', () => ({
  userApi: {
    getProfile: vi.fn(),
  },
}));

const mockStudentProfile: UserProfile = {
  id: 'usr_student_persistence',
  email: 'persistent@example.com',
  displayName: 'Persistent Student',
  role: 'STUDENT',
  status: 'ACTIVE',
  profile: {
    userId: 'usr_student_persistence',
    schoolGrade: '12',
    consentAccepted: true,
  },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('Session Persistence & React StrictMode Deduplication', () => {
  beforeEach(() => {
    setAuthToken(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restores authenticated session under React.StrictMode and renders protected route with only 1 refresh call', async () => {
    let refreshCallCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        // Simulate real network delay
        await new Promise((r) => setTimeout(r, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: { accessToken: 'valid-refreshed-jwt', expiresIn: 900 },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    vi.mocked(userApi.getProfile).mockResolvedValue({
      data: mockStudentProfile,
    });

    render(
      <StrictMode>
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div data-testid="student-dashboard">Welcome to Student Dashboard</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </StrictMode>
    );

    // Initial state: shows loading indicator
    expect(screen.getByText('Verifying CareerCompass credentials...')).toBeInTheDocument();

    // After restoration resolves: protected dashboard is displayed, NOT redirected to login
    await waitFor(() => {
      expect(screen.getByTestId('student-dashboard')).toBeInTheDocument();
    });

    // Verification: Exactly 1 refresh network request was made despite React.StrictMode double-mounting!
    expect(refreshCallCount).toBe(1);
    expect(getAuthToken()).toBe('valid-refreshed-jwt');
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('handles unauthenticated guest on page reload cleanly without session error banner', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: { code: 'UNAUTHORIZED', message: 'Refresh token cookie is required' },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

    render(
      <StrictMode>
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div data-testid="student-dashboard">Dashboard Content</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </StrictMode>
    );

    // ProtectedRoute should redirect guest to login
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    // Guest should NOT see "Your session has expired"
    expect(screen.queryByText(/Your session has expired/i)).not.toBeInTheDocument();
    expect(getAuthToken()).toBeNull();
  });

  it('handles server network outage on session restoration without getting stuck loading', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        throw new Error('Failed to fetch');
      }
      return { ok: false, status: 500 };
    });

    render(
      <StrictMode>
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div data-testid="student-dashboard">Dashboard Content</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </StrictMode>
    );

    // Must redirect to login and NOT be stuck loading
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    expect(screen.queryByText('Verifying CareerCompass credentials...')).not.toBeInTheDocument();
  });
});
