import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../services/api';
import { resetEcho } from '../services/echo';
import type { Role, User } from '../types/api';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<User>;
  register: (data: Record<string, string>) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => getToken() !== null);

  const clear = useCallback(() => {
    setToken(null);
    resetEcho();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    try {
      setUser(await api.get<User>('/me'));
    } catch {
      clear();
    } finally {
      setLoading(false);
    }
  }, [clear]);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    void refresh();
  }, [clear, refresh]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      async login(login, password) {
        const res = await api.post<{ user: User; token: string }>('/auth/login', { login, password, device_name: 'web' });
        setToken(res.token);
        setUser(res.user);
        return res.user;
      },
      async register(data) {
        const res = await api.post<{ user: User; token: string }>('/auth/register', data);
        setToken(res.token);
        setUser(res.user);
        return res.user;
      },
      async logout() {
        await api.post('/auth/logout').catch(() => {});
        clear();
      },
      refresh,
      hasRole: (...roles) => !!user && roles.includes(user.role),
    }),
    [user, loading, clear, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
