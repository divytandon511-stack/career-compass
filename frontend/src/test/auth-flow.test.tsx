import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { AuthContext, AuthContextType } from '@/context/AuthContext';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/client';
import { UserProfile } from '@/types/models';

vi.mock('@/services/api/auth.api', () => ({
  authApi: {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    getMe: vi.fn(),
  },
}));

const mockStudentUser: UserProfile = {
  id: 'usr_student1',
  email: 'student@example.com',
  displayName: 'Dhavika Bika',
  role: 'STUDENT',
  status: 'ACTIVE',
  profile: {
    userId: 'usr_student1',
    schoolGrade: '11',
    consentAccepted: true,
  },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const createMockAuthContext = (overrides: Partial<AuthContextType> = {}): AuthContextType => ({
  user: null,
  authUser: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
  sessionError: null,
  login: vi.fn().mockResolvedValue(mockStudentUser),
  logout: vi.fn().mockResolvedValue(undefined),
  refreshSession: vi.fn().mockResolvedValue(true),
  updateProfile: vi.fn().mockResolvedValue(mockStudentUser),
  ...overrides,
});

describe('LoginPage Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form and validates required fields before submission', async () => {
    const authContext = createMockAuthContext();

    render(
      <AuthContext.Provider value={authContext}>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Email address is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(authContext.login).not.toHaveBeenCalled();
  });

  it('calls login on valid form submission and redirects', async () => {
    const authContext = createMockAuthContext();

    render(
      <AuthContext.Provider value={authContext}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Dashboard Landed</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'student@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'ValidPassword123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(authContext.login).toHaveBeenCalledWith({
        email: 'student@example.com',
        password: 'ValidPassword123!',
      });
    });

    expect(await screen.findByText('Dashboard Landed')).toBeInTheDocument();
  });

  it('displays user-friendly error message on 401 unauthorized', async () => {
    const authContext = createMockAuthContext({
      login: vi.fn().mockRejectedValue(new ApiError('Unauthorized', 'UNAUTHORIZED', 401)),
    });

    render(
      <AuthContext.Provider value={authContext}>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'student@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'WrongPassword123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText(/invalid email or password\. please verify your credentials and try again\./i)
    ).toBeInTheDocument();
  });

  it('displays rate limit error message on 429 too many requests', async () => {
    const authContext = createMockAuthContext({
      login: vi.fn().mockRejectedValue(new ApiError('Too many attempts', 'RATE_LIMITED', 429)),
    });

    render(
      <AuthContext.Provider value={authContext}>
        <MemoryRouter initialEntries={['/login']}>
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'student@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'Pass123456789!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText(/too many login attempts\. please wait a few moments before trying again\./i)
    ).toBeInTheDocument();
  });

  it('displays registration success banner and prefills email when routed from registration', () => {
    const authContext = createMockAuthContext();

    render(
      <AuthContext.Provider value={authContext}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/login',
              state: { registered: true, email: 'newstudent@example.com' },
            },
          ]}
        >
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(
      screen.getByText(/account created successfully! please sign in with your password to continue\./i)
    ).toBeInTheDocument();
    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    expect(emailInput.value).toBe('newstudent@example.com');
  });
});

describe('RegisterPage Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates password minimum length of 12 and required consent checkbox', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Priya Sharma' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'priya@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'shortpass' }, // less than 12
    });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Password must be at least 12 characters long.')).toBeInTheDocument();
    expect(
      screen.getByText('You must accept the guardian/school policy consent to register.')
    ).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('submits valid registration and routes to login with state', async () => {
    vi.mocked(authApi.register).mockResolvedValueOnce({
      data: {
        user: {
          id: 'usr_new',
          email: 'priya@example.com',
          role: 'STUDENT',
          displayName: 'Priya Sharma',
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<div>Navigated To Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Priya Sharma' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'priya@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'SuperSecretPass123!' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith({
        displayName: 'Priya Sharma',
        email: 'priya@example.com',
        password: 'SuperSecretPass123!',
        schoolGrade: '10',
        consentAccepted: true,
      });
    });

    expect(await screen.findByText('Navigated To Login')).toBeInTheDocument();
  });

  it('displays conflict message when email is already registered (409)', async () => {
    vi.mocked(authApi.register).mockRejectedValueOnce(
      new ApiError('An account with this email already exists.', 'CONFLICT', 409)
    );

    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'Priya Sharma' },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'existing@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'SuperSecretPass123!' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText(/an account with this email address already exists\. please sign in instead\./i)
    ).toBeInTheDocument();
  });
});
