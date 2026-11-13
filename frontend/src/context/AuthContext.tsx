import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types/models';
import { authApi, LoginPayload } from '@/services/api/auth.api';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session by attempting silent refresh on initial app mount
  useEffect(() => {
    let isMounted = true;
    async function initializeAuth() {
      try {
        const response = await authApi.refresh();
        if (isMounted && response.data) {
          setToken(response.data.accessToken);
          const meResponse = await authApi.getMe();
          if (isMounted && meResponse.data) {
            setUser(meResponse.data.user);
          }
        }
      } catch {
        // No active session or cookie expired
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(payload);
      setToken(response.data.accessToken);
      setUser(response.data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } finally {
      setToken(null);
      setUser(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
