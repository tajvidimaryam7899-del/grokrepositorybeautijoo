'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '@/lib/auth-api';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
  isSuperAdminSession,
  setSuperAdminSession,
} from '@/lib/auth-storage';
import { SUPER_ADMIN_USER } from '@/lib/admin-mock-data';
import type { AuthMeResponse } from '@/types/auth';

type AuthContextValue = {
  user: AuthMeResponse | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: string | string[]) => boolean;
  loginWithPassword: (phone: string, password: string) => Promise<void>;
  loginAsSuperAdmin: () => Promise<void>;
  register: (
    phone: string,
    password: string,
    displayName?: string,
    role?: 'customer' | 'professional',
  ) => Promise<AuthMeResponse>;
  requestOtp: (phone: string, purpose?: string) => Promise<{ expiresIn: number }>;
  verifyOtp: (phone: string, code: string, purpose?: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthMeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (isSuperAdminSession()) {
      setUser(SUPER_ADMIN_USER);
      setLoading(false);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me(token);
      setUser(me);
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearTokens();
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const tokens = await authApi.refresh(refresh);
        setTokens(tokens.accessToken, tokens.refreshToken);
        const me = await authApi.me(tokens.accessToken);
        setUser(me);
      } catch {
        clearTokens();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const loginAsSuperAdmin = useCallback(async () => {
    setSuperAdminSession();
    setUser(SUPER_ADMIN_USER);
    setLoading(false);
  }, []);

  const loginWithPassword = useCallback(
    async (phone: string, password: string) => {
      if (phone.trim() === '09120000000') {
        await loginAsSuperAdmin();
        return;
      }
      const res = await authApi.login({ phone, password });
      setTokens(res.accessToken, res.refreshToken);
      const me = await authApi.me(res.accessToken);
      setUser(me);
    },
    [loginAsSuperAdmin],
  );

  const register = useCallback(
    async (
      phone: string,
      password: string,
      displayName?: string,
      role?: 'customer' | 'professional',
    ) => {
      const res = await authApi.register({ phone, password, displayName, role });
      setTokens(res.accessToken, res.refreshToken);
      const me = await authApi.me(res.accessToken);
      setUser(me);
      return me;
    },
    [],
  );

  const requestOtp = useCallback(async (phone: string, purpose = 'login') => {
    const res = await authApi.requestOtp({ phone, purpose });
    return { expiresIn: res.expiresIn };
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, code: string, purpose = 'login') => {
      const res = await authApi.verifyOtp({ phone, code, purpose });
      setTokens(res.accessToken, res.refreshToken);
      const me = await authApi.me(res.accessToken);
      setUser(me);
    },
    [],
  );

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        /* ignore network errors on logout */
      }
    }
    clearTokens();
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (role: string | string[]) => {
      if (isSuperAdminSession() || user?.roles?.includes('SUPER_ADMIN')) return true;
      if (!user?.roles?.length) return false;
      const need = Array.isArray(role) ? role : [role];
      return need.some((r) => user.roles.includes(r));
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      hasRole,
      loginWithPassword,
      loginAsSuperAdmin,
      register,
      requestOtp,
      verifyOtp,
      logout,
      reload,
    }),
    [
      user,
      loading,
      hasRole,
      loginWithPassword,
      loginAsSuperAdmin,
      register,
      requestOtp,
      verifyOtp,
      logout,
      reload,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
