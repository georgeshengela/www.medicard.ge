import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { ka } from '@/i18n/ka';
import { ApiError, api, type AiEngineId, type CheckInState, type Gender, type HealthProfile, type Usage, type User } from '@/lib/api';
import { setLocalAccountId, wipeLegacyUnscopedHealthCaches } from '@/lib/localAccount';
import { needsHealthAssessment as needsHealthAssessmentFromLib, needsProfileSetup } from '@/lib/onboarding';
import { clearSessionSnapshot, loadSessionSnapshot, saveSessionSnapshot } from '@/lib/sessionSnapshot';
import { clearToken, getToken, setToken } from '@/lib/storage';
import { jwtSubject } from '@/lib/jwtSubject';
import {
  isQuestDevEnabled,
  isQuestVisualSession,
  questVisualAuthSnapshot,
  setQuestVisualSession,
  subscribeQuestVisualSession,
} from '@/lib/quest/devFixture';

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
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshHealthProfile: () => Promise<HealthProfile | null>;
  setUser: (user: User) => void;
  setHealthProfile: (profile: HealthProfile | null) => void;
  updateProfile: (input: {
    fullName?: string;
    gender?: Gender;
    birthDate?: string;
    aiEngine?: AiEngineId;
  }) => Promise<void>;
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

  const resetSession = useCallback(() => {
    setLocalAccountId(null);
    setUser(null);
    setUsage(null);
    setStats(null);
    setHealthProfile(null);
    setPendingDailyBonus(null);
    void import('@/lib/accountSync').then(({ resetAccountSync }) => resetAccountSync());
  }, []);

  const applyVisualSession = useCallback(() => {
    const snap = questVisualAuthSnapshot();
    setLocalAccountId(snap.user.id);
    setUser(snap.user as unknown as User);
    setUsage(snap.usage);
    setStats(snap.stats);
    setHealthProfile(snap.healthProfile as unknown as HealthProfile);
    setPendingDailyBonus(null);
  }, []);

  const hydrate = useCallback(async () => {
    if (isQuestVisualSession()) {
      applyVisualSession();
      return;
    }

    const token = await getToken();
    if (!token) {
      await clearSessionSnapshot();
      resetSession();
      return;
    }

    const snapshot = await loadSessionSnapshot();
    const tokenUserId = jwtSubject(token);
    if (snapshot?.user?.id && tokenUserId && snapshot.user.id !== tokenUserId) {
      await clearSessionSnapshot();
    } else if (snapshot && tokenUserId && snapshot.user.id === tokenUserId) {
      setLocalAccountId(snapshot.user.id);
      setUser(snapshot.user);
      setUsage(snapshot.usage);
      setStats(snapshot.stats);
      setHealthProfile(snapshot.healthProfile);
    }

    try {
      const me = await api.auth.me();
      setLocalAccountId(me.user.id);
      await wipeLegacyUnscopedHealthCaches();
      setUser(me.user);
      setUsage(me.usage);
      setStats(me.stats);
      setHealthProfile(me.healthProfile ?? null);
      if (me.checkInAwarded && me.checkIn) setPendingDailyBonus(me.checkIn);
      await saveSessionSnapshot({
        user: me.user,
        usage: me.usage,
        stats: me.stats,
        healthProfile: me.healthProfile ?? null,
      });
      void import('@/lib/cycleOffline').then(({ flushCycleQueue }) =>
        flushCycleQueue(me.user.id).catch(() => undefined),
      );
      void import('@/lib/notifications').then(({ syncPushRegistration }) =>
        syncPushRegistration(),
      );
      void import('@/lib/pushCopy').then(({ loadPushTemplates }) => loadPushTemplates());
      void import('@/lib/mediNotificationBrain').then(({ runMediNotificationBrain }) =>
        runMediNotificationBrain(me.user, me.healthProfile ?? null),
      );
      void import('@/lib/accountSync').then(({ pullAccountState }) =>
        pullAccountState().catch(() => undefined),
      );
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) {
        await clearToken();
        await clearSessionSnapshot();
        resetSession();
      }
    }
  }, [applyVisualSession, resetSession]);

  useEffect(() => {
    hydrate().finally(() => setReady(true));
  }, [hydrate]);

  useEffect(() => {
    if (!isQuestDevEnabled()) return undefined;
    const off = subscribeQuestVisualSession((on: boolean) => {
      if (on) applyVisualSession();
    });
    return () => {
      off();
    };
  }, [applyVisualSession]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      void import('@/lib/notifications').then(({ syncPushRegistration }) =>
        syncPushRegistration(),
      );
      void import('@/lib/pushCopy').then(({ loadPushTemplates }) => loadPushTemplates());
      void import('@/lib/mediNotificationBrain').then(({ runMediNotificationBrain }) =>
        runMediNotificationBrain(user, healthProfile),
      );
    });
    return () => sub.remove();
  }, [user, healthProfile]);

  const adopt = useCallback(
    async (result: { token: string; user: User; usage: Usage }) => {
      setQuestVisualSession(false);
      if (!result?.token || !result.user?.id) {
        throw new ApiError(ka.auth.registerNotConfirmed, 0);
      }

      await clearSessionSnapshot();
      setLocalAccountId(result.user.id);
      await wipeLegacyUnscopedHealthCaches();
      await setToken(result.token);

      const emptyStats = { records: 0, chats: 0, activeMedications: 0 };
      const settle = async (user: User, usage: Usage, stats: Stats, healthProfile: HealthProfile | null) => {
        setLocalAccountId(user.id);
        setUser(user);
        setUsage(usage);
        setStats(stats);
        setHealthProfile(healthProfile);
        await saveSessionSnapshot({ user, usage, stats, healthProfile });
        void import('@/lib/cycleOffline').then(({ flushCycleQueue }) =>
          flushCycleQueue(user.id).catch(() => undefined),
        );
        void import('@/lib/notifications').then(({ syncPushRegistration }) =>
          syncPushRegistration(),
        );
        void import('@/lib/pushCopy').then(({ loadPushTemplates }) => loadPushTemplates());
        void import('@/lib/mediNotificationBrain').then(({ runMediNotificationBrain }) =>
          runMediNotificationBrain(user, healthProfile),
        );
        void import('@/lib/accountSync').then(({ pullAccountState }) =>
          pullAccountState().catch(() => undefined),
        );
      };

      await settle(result.user, result.usage, emptyStats, null);

      const readMe = async () => {
        const me = await api.auth.me(result.token);
        if (!me.user?.id || me.user.id !== result.user.id) {
          throw new ApiError(ka.auth.registerNotConfirmed, 401);
        }
        return me;
      };

      try {
        let me: Awaited<ReturnType<typeof readMe>>;
        try {
          me = await readMe();
        } catch (error) {
          // Server already confirmed the row before issuing the JWT. Retry once for Neon lag.
          if (!(error instanceof ApiError) || !error.isUnauthorized) throw error;
          await new Promise((resolve) => setTimeout(resolve, 150));
          me = await readMe();
        }
        await settle(me.user, me.usage, me.stats, me.healthProfile ?? null);
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthorized) {
          await clearToken();
          await clearSessionSnapshot();
          resetSession();
          throw error;
        }
        // 429 / timeout / network — account exists. Stay signed in on the register payload.
      }
    },
    [resetSession],
  );

  const refreshHealthProfile = useCallback(async () => {
    if (isQuestVisualSession()) return healthProfile;
    try {
      const { profile } = await api.healthProfile.get();
      setHealthProfile(profile);
      const snapshot = await loadSessionSnapshot();
      if (snapshot) {
        await saveSessionSnapshot({ ...snapshot, healthProfile: profile });
      }
      return profile;
    } catch {
      return null;
    }
  }, [healthProfile]);

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
      signUp: async (input) => {
        try {
          await adopt(await api.auth.register(input));
        } catch (error) {
          if (
            error instanceof ApiError &&
            (error.isUnauthorized || error.code === 'REGISTER_UNCONFIRMED')
          ) {
            throw new ApiError(ka.auth.registerNotConfirmed, error.status || 401, {
              code: 'REGISTER_UNCONFIRMED',
            });
          }
          throw error;
        }
      },
      signInWithPhone: async (phone, code, fullName) => adopt(await api.auth.phoneVerify({ phone, code, fullName })),
      signOut: async () => {
        setQuestVisualSession(false);
        await clearToken();
        await clearSessionSnapshot();
        resetSession();
      },
      deleteAccount: async () => {
        const userId = user?.id;
        try {
          const { cancelAllReminders, unregisterPushFromServer } = await import('@/lib/notifications');
          await unregisterPushFromServer();
          await cancelAllReminders();
        } catch {
          /* local cleanup still continues */
        }
        await api.auth.deleteAccount();
        if (userId) {
          void import('@/lib/pregnancyCareCalendar').then(({ wipePregnancyCareCalendarOwnership }) =>
            wipePregnancyCareCalendarOwnership(userId).catch(() => undefined),
          );
          void import('@/lib/cycleOffline').then(({ destroyCycleOfflineAccount }) =>
            destroyCycleOfflineAccount(userId).catch(() => undefined),
          );
        }
        await clearToken();
        await clearSessionSnapshot();
        resetSession();
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
      resetSession,
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
