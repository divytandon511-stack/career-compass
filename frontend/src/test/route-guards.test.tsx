import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext, AuthContextType } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { UserProfile, AuthUser } from '@/types/models';

const mockStudentUser: UserProfile = {
  id: 'usr_student123',
  email: 'student@example.com',
  displayName: 'Aarav Patel',
  role: 'STUDENT',
  status: 'ACTIVE',
  profile: {
    userId: 'usr_student123',
    schoolGrade: '11',
    consentAccepted: true,
  },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockStudentAuthUser: AuthUser = {
  id: 'usr_student123',
  email: 'student@example.com',
  role: 'STUDENT',
  displayName: 'Aarav Patel',
};

const createMockAuthContext = (overrides: Partial<AuthContextType> = {}): AuthContextType => ({
  user: null,
  authUser: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
  sessionError: null,
  login: async () => mockStudentUser,
  logout: async () => {},
  refreshSession: async () => false,
  updateProfile: async () => mockStudentUser,
  ...overrides,
});

describe('ProtectedRoute Component', () => {
  it('renders loading indicator while session is validating', () => {
    const authValue = createMockAuthContext({ isLoading: true });

    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText(/verifying careercompass credentials/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated user to /login preserving destination query param', () => {
    const authValue = createMockAuthContext({ isAuthenticated: false, isLoading: false });

    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/dashboard?tab=overview']}>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Protected Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page Target</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page Target')).toBeInTheDocument();
  });

  it('renders protected child when user is authenticated', () => {
    const authValue = createMockAuthContext({
      isAuthenticated: true,
      isLoading: false,
      user: mockStudentUser,
      authUser: mockStudentAuthUser,
    });

    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProtectedRoute>
            <div>Welcome Student Dashboard</div>
          </ProtectedRoute>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Welcome Student Dashboard')).toBeInTheDocument();
  });
});

describe('RoleGuard Component', () => {
  it('allows access when user role matches allowed roles', () => {
    const authValue = createMockAuthContext({
      isAuthenticated: true,
      isLoading: false,
      user: mockStudentUser,
      authUser: mockStudentAuthUser,
    });

    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <RoleGuard allowedRoles={['STUDENT']}>
            <div>Student Protected Area</div>
          </RoleGuard>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Student Protected Area')).toBeInTheDocument();
  });

  it('redirects to /403 when user role does not match allowed roles', () => {
    const authValue = createMockAuthContext({
      isAuthenticated: true,
      isLoading: false,
      user: mockStudentUser,
      authUser: mockStudentAuthUser,
    });

    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/admin/users']}>
          <Routes>
            <Route
              path="/admin/users"
              element={
                <RoleGuard allowedRoles={['ADMIN']}>
                  <div>Admin Secret Area</div>
                </RoleGuard>
              }
            />
            <Route path="/403" element={<div>Forbidden Access Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.queryByText('Admin Secret Area')).not.toBeInTheDocument();
    expect(screen.getByText('Forbidden Access Page')).toBeInTheDocument();
  });
});
