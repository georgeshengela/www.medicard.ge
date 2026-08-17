import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, api, type Gender, type Usage, type User } from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/storage';

type Stats = { records: number; chats: number; activeMedications: number };

export type SignUpInput = {
  fullName: string;
  email: string;
  password: string;
  gender: Gender;
  /** `YYYY-MM-DD` */
  birthDate: string;
};

type AuthState = {
  ready: boolean;
  user: User | null;
  usage: Usage | null;
  stats: Stats | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signInWithPhone: (phone: string, code: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (input: { fullName?: string; gender?: Gender; birthDate?: string }) => Promise<void>;
  /** Called by feature screens with the fresh quota returned alongside every AI response. */
  applyUsage: (usage: Usage) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const hydrate = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setUsage(null);
      setStats(null);
      return;
    }

    try {
      const me = await api.auth.me();
      setUser(me.user);
      setUsage(me.usage);
      setStats(me.stats);
      void import('@/lib/notifications').then(({ registerPushTokenWithServer }) =>
        registerPushTokenWithServer(),
      );
    } catch (error) {
      // A rejected token is unrecoverable; anything else (offline) keeps the session.
      if (error instanceof ApiError && error.isUnauthorized) {
        await clearToken();
        setUser(null);
        setUsage(null);
        setStats(null);
      }
    }
  }, []);

  useEffect(() => {
    hydrate().finally(() => setReady(true));
  }, [hydrate]);

  const adopt = useCallback(async (result: { token: string; user: User; usage: Usage }) => {
    await setToken(result.token);
    setUser(result.user);
    setUsage(result.usage);
    setStats(null);
    void import('@/lib/notifications').then(({ registerPushTokenWithServer }) =>
      registerPushTokenWithServer(),
    );
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      usage,
      stats,
      signIn: async (email, password) => adopt(await api.auth.login({ email, password })),
      signUp: async (input) => adopt(await api.auth.register(input)),
      signInWithPhone: async (phone, code, fullName) => adopt(await api.auth.phoneVerify({ phone, code, fullName })),
      signOut: async () => {
        await clearToken();
        setUser(null);
        setUsage(null);
        setStats(null);
      },
      refresh: hydrate,
      updateProfile: async (input) => {
        const result = await api.auth.updateProfile(input);
        setUser(result.user);
      },
      applyUsage: setUsage,
    }),
    [ready, user, usage, stats, adopt, hydrate],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
