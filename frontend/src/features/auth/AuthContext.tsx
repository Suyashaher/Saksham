import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  apiClient,
  setAccessToken,
  getAccessToken,
  setRefreshToken,
  getRefreshToken,
} from '../../api/client';

export type UserRole = 'INSTITUTION' | 'VERIFYING_OFFICER' | 'APPROVING_AUTHORITY' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  institution_id?: string | null;
  phone?: string | null;
  designation?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginSessionToken: string | null;
  devOtpHive: string | null;
  login: (email: string, password: string) => Promise<{ session_token: string; dev_otp?: string; direct?: boolean }>;
  verifyOtp: (sessionToken: string, otp: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 15-minute inactivity timeout (in ms)
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginSessionToken, setLoginSessionToken] = useState<string | null>(null);
  const [devOtpHive, setDevOtpHive] = useState<string | null>(null);

  const logout = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setLoginSessionToken(null);
    setDevOtpHive(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await apiClient.get<AuthUser>('/auth/me');
      setUser(response.data);
    } catch {
      logout();
    }
  }, [logout]);

  // Initial auth check on mount using refresh token if available
  useEffect(() => {
    const initAuth = async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiClient.post('/auth/refresh', {
          refresh_token: refreshToken,
        });
        const { access_token, refresh_token: newRefresh } = response.data;
        setAccessToken(access_token);
        if (newRefresh) {
          setRefreshToken(newRefresh);
        }

        const meResponse = await apiClient.get<AuthUser>('/auth/me');
        setUser(meResponse.data);
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [logout]);

  // Auto-inactivity timer (15 minutes)
  useEffect(() => {
    if (!user) return;

    let inactivityTimer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [user, logout]);

  const login = async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    // Check if direct token login (when REQUIRE_OTP=false)
    if (response.data.access_token) {
      const { access_token, refresh_token } = response.data;
      setAccessToken(access_token);
      setRefreshToken(refresh_token);
      const meRes = await apiClient.get<AuthUser>('/auth/me');
      setUser(meRes.data);
      return { session_token: '', dev_otp: undefined, direct: true };
    }

    const challengeId = response.data.challenge_id || response.data.session_token;
    const otp = response.data.otp || response.data.dev_otp;
    setLoginSessionToken(challengeId);
    if (otp) {
      setDevOtpHive(otp);
    }
    return { session_token: challengeId, dev_otp: otp };
  };

  const verifyOtp = async (sessionToken: string, otp: string) => {
    const response = await apiClient.post('/auth/verify-otp', {
      challenge_id: sessionToken,
      otp,
    });
    const { access_token, refresh_token } = response.data;
    setAccessToken(access_token);
    setRefreshToken(refresh_token);
    const meRes = await apiClient.get<AuthUser>('/auth/me');
    setUser(meRes.data);
    setLoginSessionToken(null);
    setDevOtpHive(null);
    return meRes.data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && !!getAccessToken(),
        isLoading,
        loginSessionToken,
        devOtpHive,
        login,
        verifyOtp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
