import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, api, type CheckInState, type Gender, type HealthProfile, type Usage, type User } from '@/lib/api';
import { needsHealthAssessment as needsHealthAssessmentFromLib, needsProfileSetup } from '@/lib/onboarding';
import { clearToken, getToken, setToken } from '@/lib/storage';

type Stats = { records: number; chats: number; activeMedications: number };

export type SignUpInput = {
  fullName: string;
  email: string;
  password: string;
  gender?: Gender;
  /** `YYYY-MM-DD` */
  birthDate?: string;
};

type AuthState = {
  ready: boolean;
  user: User | null;
  usage: Usage | null;
  stats: Stats | null;
  healthProfile: HealthProfile | null;
  /** Set when today's login bonus was just awarded this session. */
  pendingDailyBonus: CheckInState | null;
  consumeDailyBonus: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signInWithPhone: (phone: string, code: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshHealthProfile: () => Promise<HealthProfile | null>;
  setUser: (user: User) => void;
  setHealthProfile: (profile: HealthProfile | null) => void;
  updateProfile: (input: { fullName?: string; gender?: Gender; birthDate?: string }) => Promise<void>;
  applyUsage: (usage: Usage) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const [pendingDailyBonus, setPendingDailyBonus] = useState<CheckInState | null>(null);

  const hydrate = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setUsage(null);
      setStats(null);
      setHealthProfile(null);
      setPendingDailyBonus(null);
      return;
    }

    try {
      const me = await api.auth.me();
      setUser(me.user);
      setUsage(me.usage);
      setStats(me.stats);
      setHealthProfile(me.healthProfile ?? null);
      if (me.checkInAwarded && me.checkIn) setPendingDailyBonus(me.checkIn);
      try {
        const { flushStepsGoalAwards } = await import('@/lib/stepsGoal');
        await flushStepsGoalAwards(setUser);
      } catch {
        /* pending +3 retries on profile focus */
      }
      void import('@/lib/cycleOffline').then(({ flushCycleQueue }) =>
        flushCycleQueue(me.user.id).catch(() => undefined),
      );
      void import('@/lib/notifications').then(({ registerPushTokenWithServer }) =>
        registerPushTokenWithServer(),
      );
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) {
        await clearToken();
        setUser(null);
        setUsage(null);
        setStats(null);
        setHealthProfile(null);
        setPendingDailyBonus(null);
      }
    }
  }, []);

  useEffect(() => {
    hydrate().finally(() => setReady(true));
  }, [hydrate]);

  const adopt = useCallback(
    async (result: { token: string; user: User; usage: Usage }) => {
      await setToken(result.token);
      setUser(result.user);
      setUsage(result.usage);
      setStats(null);
      setHealthProfile(null);
      void import('@/lib/notifications').then(({ registerPushTokenWithServer }) =>
        registerPushTokenWithServer(),
      );
      await hydrate();
    },
    [hydrate],
  );

  const refreshHealthProfile = useCallback(async () => {
    try {
      const { profile } = await api.healthProfile.get();
      setHealthProfile(profile);
      return profile;
    } catch {
      return null;
    }
  }, []);

  const consumeDailyBonus = useCallback(() => setPendingDailyBonus(null), []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      usage,
      stats,
      healthProfile,
      pendingDailyBonus,
      consumeDailyBonus,
      signIn: async (email, password) => adopt(await api.auth.login({ email, password })),
      signUp: async (input) => adopt(await api.auth.register(input)),
      signInWithPhone: async (phone, code, fullName) => adopt(await api.auth.phoneVerify({ phone, code, fullName })),
      signOut: async () => {
        await clearToken();
        setUser(null);
        setUsage(null);
        setStats(null);
        setHealthProfile(null);
        setPendingDailyBonus(null);
      },
      refresh: hydrate,
      refreshHealthProfile,
      setUser,
      setHealthProfile,
      updateProfile: async (input) => {
        const result = await api.auth.updateProfile(input);
        setUser(result.user);
      },
      applyUsage: setUsage,
    }),
    [
      ready,
      user,
      usage,
      stats,
      healthProfile,
      pendingDailyBonus,
      consumeDailyBonus,
      adopt,
      hydrate,
      refreshHealthProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

export function needsHealthAssessment(profile: HealthProfile | null): boolean {
  return needsHealthAssessmentFromLib(profile);
}

export { needsProfileSetup, assessmentPhaseComplete } from '@/lib/onboarding';
