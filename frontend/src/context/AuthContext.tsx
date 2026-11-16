import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthUser, UserProfile } from '@/types/models';
import { authApi, LoginPayload } from '@/services/api/auth.api';
import { userApi, UpdateProfilePayload } from '@/services/api/user.api';
import { addAuthFailureListener, getAuthToken, setAuthToken } from '@/services/api/client';

export interface AuthContextType {
  user: UserProfile | null;
  authUser: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionError: string | null;
  login: (payload: LoginPayload) => Promise<UserProfile>;
  logout: (allDevices?: boolean) => Promise<void>;
  refreshSession: () => Promise<boolean>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<UserProfile>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface RestoredSessionData {
  token: string | null;
  user: UserProfile | null;
  authUser: AuthUser | null;
  error?: unknown;
}

let activeRestorationPromise: Promise<RestoredSessionData> | null = null;

async function performSessionRestoration(): Promise<RestoredSessionData> {
  try {
    // Attempt silent rotation using HttpOnly refresh cookie (notifyOnFailure = false so guests don't get "session expired" errors)
    const refreshRes = await authApi.refresh({ notifyOnFailure: false });
    const newToken = refreshRes.data?.accessToken;
    if (newToken) {
      setAuthToken(newToken);
      try {
        const profileRes = await userApi.getProfile();
        if (profileRes.data) {
          return {
            token: newToken,
            user: profileRes.data,
            authUser: {
              id: profileRes.data.id,
              email: profileRes.data.email,
              role: profileRes.data.role,
              displayName: profileRes.data.displayName,
            },
          };
        }
      } catch (profileErr) {
        console.error('Failed to hydrate user profile:', profileErr);
        // Fallback to getMe if profile hydration deferred
        try {
          const meRes = await authApi.getMe();
          if (meRes.data?.user) {
            return {
              token: newToken,
              user: null,
              authUser: meRes.data.user,
            };
          }
        } catch {
          // ignore fallback error
        }
      }
      return {
        token: newToken,
        user: null,
        authUser: null,
      };
    }
    return { token: null, user: null, authUser: null };
  } catch (err) {
    return { token: null, user: null, authUser: null, error: err };
  } finally {
    activeRestorationPromise = null;
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Sync token state and client memory
  const applyToken = useCallback((newToken: string | null) => {
    setAuthToken(newToken);
    setTokenState(newToken);
  }, []);

  // Hydrate full user profile after obtaining access token
  const hydrateProfile = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const profileRes = await userApi.getProfile();
      if (profileRes.data) {
        setUser(profileRes.data);
        setAuthUser({
          id: profileRes.data.id,
          email: profileRes.data.email,
          role: profileRes.data.role,
          displayName: profileRes.data.displayName,
        });
        return profileRes.data;
      }
    } catch (err) {
      console.error('Failed to hydrate user profile:', err);
    }
    return null;
  }, []);

  // Listen for definitive auth failures emitted by apiClient 401 handler
  useEffect(() => {
    const unsubscribe = addAuthFailureListener(() => {
      applyToken(null);
      setUser(null);
      setAuthUser(null);
      setSessionError('Your session has expired. Please sign in again.');
    });
    return unsubscribe;
  }, [applyToken]);

  // Session restoration on initial application startup
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      setIsLoading(true);
      setSessionError(null);

      if (!activeRestorationPromise) {
        activeRestorationPromise = performSessionRestoration();
      }

      const result = await activeRestorationPromise;

      if (!isMounted) {
        return;
      }

      if (result.token) {
        applyToken(result.token);
        if (result.user) {
          setUser(result.user);
        }
        if (result.authUser) {
          setAuthUser(result.authUser);
        }
        setSessionError(null);
      } else {
        applyToken(null);
        setUser(null);
        setAuthUser(null);

        const status = (result.error as { status?: number })?.status;
        const code = (result.error as { code?: string })?.code;
        if (code === 'NETWORK_ERROR' || (status && status >= 500)) {
          setSessionError('Unable to connect to CareerCompass services. Please check your connection.');
        } else if (status === 429) {
          setSessionError('Too many authentication attempts. Please wait a moment before trying again.');
        } else {
          // Normal unauthenticated guest state
          setSessionError(null);
        }
      }

      setIsLoading(false);
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [applyToken]);

  const login = async (payload: LoginPayload): Promise<UserProfile> => {
    activeRestorationPromise = null;
    setIsLoading(true);
    setSessionError(null);
    try {
      const response = await authApi.login(payload);
      const newAccessToken = response.data.accessToken;
      applyToken(newAccessToken);
      setAuthUser(response.data.user);

      // Hydrate full profile immediately
      const profile = await hydrateProfile();
      if (!profile) {
        // Construct fallback user profile from authUser if profile hydration deferred
        const fallback: UserProfile = {
          id: response.data.user.id,
          email: response.data.user.email,
          displayName: response.data.user.displayName || response.data.user.email.split('@')[0],
          role: response.data.user.role,
          status: 'ACTIVE',
          profile: null,
          createdAt: new Date().toISOString(),
        };
        setUser(fallback);
        return fallback;
      }
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (allDevices = false): Promise<void> => {
    activeRestorationPromise = null;
    setIsLoading(true);
    try {
      await authApi.logout({ allDevices });
    } finally {
      applyToken(null);
      setUser(null);
      setAuthUser(null);
      setIsLoading(false);
      setSessionError(null);
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    try {
      const res = await authApi.refresh({ notifyOnFailure: false });
      if (res.data?.accessToken) {
        applyToken(res.data.accessToken);
        await hydrateProfile();
        return true;
      }
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        applyToken(null);
        setUser(null);
        setAuthUser(null);
      }
    }
    return false;
  };

  const updateProfile = async (payload: UpdateProfilePayload): Promise<UserProfile> => {
    const response = await userApi.updateProfile(payload);
    setUser(response.data);
    if (response.data.displayName && authUser) {
      setAuthUser({ ...authUser, displayName: response.data.displayName });
    }
    return response.data;
  };

  const isAuthenticated = Boolean(token && (user || authUser));

  return (
    <AuthContext.Provider
      value={{
        user,
        authUser,
        token,
        isLoading,
        isAuthenticated,
        sessionError,
        login,
        logout,
        refreshSession,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
