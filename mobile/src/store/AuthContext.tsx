import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onReturnToForeground } from '@/lib/appForeground';
import { resetRunMemory } from '@/lib/run/store';
import { ka } from '@/i18n/ka';
import { ApiError, api, type AiEngineId, type Gender, type HealthProfile, type Usage, type User } from '@/lib/api';
import { setLocalAccountId, wipeLegacyUnscopedHealthCaches } from '@/lib/localAccount';
import { primeHomeLayout, registerHomeLayoutProfilePatch } from '@/lib/home/homeLayoutStore';
import { needsHealthAssessment as needsHealthAssessmentFromLib, needsProfileSetup } from '@/lib/onboarding';
import { clearSessionSnapshot, loadSessionSnapshot, saveSessionSnapshot } from '@/lib/sessionSnapshot';
import { clearToken, getToken, renewToken, setToken } from '@/lib/storage';
import { runPostLoginSideEffects } from '@/lib/safeStartup';
import { authErrorMessage } from '@/lib/authErrorMessage';
import {
  isQuestDevEnabled,
  isQuestVisualSession,
  questVisualAuthSnapshot,
  setQuestVisualSession,
  subscribeQuestVisualSession,
} from '@/lib/quest/devFixture';

type Stats = { records: number; chats: number; activeMedications: number };

export type SocialProvider = 'apple' | 'google';
/** `link`: an email/password account already uses this address — prove it once (/(auth)/link-account). */
export type SocialSignInResult =
  | { status: 'signed-in' }
  | { status: 'cancelled' }
  | { status: 'link'; provider: SocialProvider; email: string; linkToken: string };

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
  sessionRestoreError: string | null;
  restoringSession: boolean;
  user: User | null;
  usage: Usage | null;
  stats: Stats | null;
  healthProfile: HealthProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signInWithPhone: (phone: string, code: string, fullName?: string) => Promise<void>;
  signInWithApple: () => Promise<SocialSignInResult>;
  signInWithGoogle: () => Promise<SocialSignInResult>;
  /** Attaches a pending Apple / Google sign-in to the existing account after its password was entered. */
  linkSocialAccount: (linkToken: string, password: string) => Promise<void>;
  /** SMS password reset: sets the new password and signs in. */
  resetPasswordWithSms: (input: { phone: string; code: string; password: string; confirmPassword: string }) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** „I already have an account“ right after sign-up: removes the just-created empty account and signs out. */
  discardNewAccount: () => Promise<void>;
  /** Switches the session to another of the person's accounts (account conflict → switch). */
  switchToAccount: (result: { token: string; user: User; usage: Usage }, previousDeleted: boolean) => Promise<void>;
  /** Adds Apple / Google to the signed-in account. Throws ApiError (with a conflict) when it belongs to another one. */
  linkApple: () => Promise<'linked' | 'cancelled'>;
  linkGoogle: () => Promise<'linked' | 'cancelled'>;
  /** Re-reads the session (/auth/me). `maxAgeMs`: skip when the last answer is younger (screen focus). */
  refresh: (opts?: { maxAgeMs?: number }) => Promise<void>;
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

function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/** Stops this device's push and local reminders for the account that is leaving. Best-effort. */
async function stopDeviceDelivery() {
  try {
    const { cancelAllReminders, unregisterPushFromServer } = await import('@/lib/notifications');
    await unregisterPushFromServer();
    await cancelAllReminders();
  } catch {
    /* local cleanup still continues */
  }
}

/** Device-side data of an account that no longer exists here (deleted, discarded or merged away). */
async function forgetAccountOnDevice(userId: string | undefined) {
  if (!userId) return;
  await import('@/lib/petCareReminders').then(({ onPetCareLogout }) => onPetCareLogout(userId)).catch(() => undefined);
  void import('@/lib/pregnancyCareCalendar').then(({ wipePregnancyCareCalendarOwnership }) =>
    wipePregnancyCareCalendarOwnership(userId).catch(() => undefined),
  );
  void import('@/lib/cycleOffline').then(({ destroyCycleOfflineAccount }) =>
    destroyCycleOfflineAccount(userId).catch(() => undefined),
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [sessionRestoreError, setSessionRestoreError] = useState<string | null>(null);
  const [restoringSession, setRestoringSession] = useState(false);
  const restoreInFlight = useRef<Promise<void> | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [healthProfile, setHealthProfile] = useState<HealthProfile | null>(null);
  const healthProfileRef = useRef<HealthProfile | null>(healthProfile);
  healthProfileRef.current = healthProfile;

  const resetSession = useCallback(() => {
    setSessionRestoreError(null);
    resetRunMemory();
    setLocalAccountId(null);
    setUser(null);
    setUsage(null);
    setStats(null);
    setHealthProfile(null);
    void import('@/lib/accountSync').then(({ resetAccountSync }) => resetAccountSync());
    void import('@/lib/healthDataSync').then(({ resetHealthPullCache }) => {
      resetHealthPullCache();
    });
    void import('@/lib/quest/socket').then(({ disconnectQuestSocket }) => disconnectQuestSocket());
  }, []);

  const applyVisualSession = useCallback(() => {
    const snap = questVisualAuthSnapshot();
    setLocalAccountId(snap.user.id);
    setUser(snap.user as unknown as User);
    setUsage(snap.usage);
    setStats(snap.stats);
    setHealthProfile(snap.healthProfile as unknown as HealthProfile);
  }, []);

  const lastMeAt = useRef(0);
  const hydrate = useCallback(() => {
    if (restoreInFlight.current) return restoreInFlight.current;
    const task = (async () => {
      setRestoringSession(true);
      try {
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

        try {
          const me = await api.auth.me(token);
          if (await getToken() !== token) return;
          lastMeAt.current = Date.now();
          setSessionRestoreError(null);
          setLocalAccountId(me.user.id);
          // Home layout + cycle lock + cached flags before the first Home frame (≤ ~300 ms, never throws).
          await primeHomeLayout(me.user.id, me.healthProfile ?? null, me.user.gender);
          if (await getToken() !== token) return;
          // Keep the same object when nothing changed, so effects keyed on [user] (quest socket,
          // reminders) do not re-run on every Home/Profile focus.
          setUser((prev) => (sameJson(prev, me.user) ? prev : me.user));
          setUsage(me.usage);
          setStats(me.stats);
          setHealthProfile((prev) => (sameJson(prev, me.healthProfile ?? null) ? prev : (me.healthProfile ?? null)));
          // Sliding session: keep the fresh JWT the server sends past half the old one's lifetime.
          // Last, after every `getToken() !== token` guard above; a sign-out in the meantime wins.
          if (typeof me.token === 'string' && me.token) await renewToken(token, me.token).catch(() => false);
          runPostLoginSideEffects(me.user, me.healthProfile ?? null);
        } catch (error) {
          if (await getToken() !== token) return;
          if (error instanceof ApiError && (error.isUnauthorized || error.code === 'ACCOUNT_BLOCKED')) {
            await clearToken();
            await clearSessionSnapshot();
            resetSession();
          } else {
            // A connection failure is not a logout. Keep the token and offer a retry.
            setSessionRestoreError(authErrorMessage(error));
          }
        }
      } catch {
        await clearToken().catch(() => undefined);
        await clearSessionSnapshot().catch(() => undefined);
        resetSession();
      } finally {
        setRestoringSession(false);
      }
    })();
    restoreInFlight.current = task;
    void task.finally(() => { if (restoreInFlight.current === task) restoreInFlight.current = null; });
    return task;
  }, [applyVisualSession, resetSession]);

  const refreshSession = useCallback(
    (opts?: { maxAgeMs?: number }) => {
      if (opts?.maxAgeMs && Date.now() - lastMeAt.current < opts.maxAgeMs) return Promise.resolve();
      return hydrate();
    },
    [hydrate],
  );

  useEffect(() => {
    hydrate().finally(() => setReady(true));
  }, [hydrate]);

  // A saved Home layout choice is merged into the in-memory profile, so screens that re-send the
  // whole profile (onboarding, setup) and every reader see the same value as the server.
  useEffect(() => {
    registerHomeLayoutProfilePatch((patch) =>
      setHealthProfile((prev) =>
        prev ? { ...prev, extraAnswers: { ...((prev.extraAnswers ?? {}) as Record<string, unknown>), ...patch } } : prev,
      ),
    );
    return () => registerHomeLayoutProfilePatch(null);
  }, []);

  useEffect(() => {
    if (!isQuestDevEnabled()) return undefined;
    const off = subscribeQuestVisualSession((on: boolean) => {
      if (on) applyVisualSession();
    });
    return () => {
      off();
    };
  }, [applyVisualSession]);

  // Cold start / sign-in: schedule cycle reminders without waiting for the cycle screen or a foreground.
  useEffect(() => {
    if (!user?.id || user.gender !== 'FEMALE') return;
    void import('@/lib/cycleReminders').then(({ reconcileCycleReminders }) => reconcileCycleReminders(user.id, { force: true }));
  }, [user?.id, user?.gender]);

  useEffect(() => {
    return onReturnToForeground(() => {
      void import('@/lib/notifications').then(({ syncPushRegistration }) =>
        syncPushRegistration(),
      );
      void import('@/lib/pushCopy').then(({ loadPushTemplates }) => loadPushTemplates());
      void import('@/lib/mediNotificationBrain').then(({ runMediNotificationBrain }) =>
        runMediNotificationBrain(user, healthProfile),
      );
      if (user?.id && user.gender === 'FEMALE') {
        void import('@/lib/cycleReminders').then(({ reconcileCycleReminders }) => reconcileCycleReminders(user.id));
      }
      if (user) {
        void import('@/lib/reminderReconcile').then(({ reconcileAllLocalReminders }) => reconcileAllLocalReminders());
        void import('@/lib/petCareReminders').then(({ reconcilePetCareReminders, flushPendingPetCareConfirms }) => {
          void flushPendingPetCareConfirms();
          void reconcilePetCareReminders({ reason: 'foreground' });
        });
      }
    });
  }, [user, healthProfile]);

  const adopt = useCallback(
    async (result: { token: string; user: User; usage: Usage }) => {
      setSessionRestoreError(null);
      setQuestVisualSession(false);
      if (!result?.token || !result.user?.id) {
        throw new ApiError(ka.auth.registerNotConfirmed, 0);
      }

      await clearSessionSnapshot();
      const { resetHealthPullCache } = await import('@/lib/healthDataSync');
      resetHealthPullCache();
      const { disconnectQuestSocket } = await import('@/lib/quest/socket');
      disconnectQuestSocket();
      setLocalAccountId(result.user.id);
      await wipeLegacyUnscopedHealthCaches();
      await setToken(result.token);

      const settle = async (user: User, usage: Usage, stats: Stats, healthProfile: HealthProfile | null) => {
        setLocalAccountId(user.id);
        await primeHomeLayout(user.id, healthProfile, user.gender);
        if (await getToken() !== result.token) return;
        setUser(user);
        setUsage(usage);
        setStats(stats);
        setHealthProfile(healthProfile);
        await saveSessionSnapshot({ user, usage, stats, healthProfile });
        runPostLoginSideEffects(user, healthProfile, { force: true });
      };

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
        if (await getToken() !== result.token) return;
        await settle(me.user, me.usage, me.stats, me.healthProfile ?? null);
      } catch (error) {
        if (await getToken() !== result.token) return;
        if (error instanceof ApiError && (error.isUnauthorized || error.code === 'ACCOUNT_BLOCKED')) {
          await clearToken();
          await clearSessionSnapshot();
          resetSession();
          throw error;
        }
        // Credentials are valid, but the profile is not available yet. Do not
        // publish an empty profile and accidentally send an existing user to onboarding.
        setSessionRestoreError(authErrorMessage(error));
      }
    },
    [resetSession],
  );

  const refreshHealthProfile = useCallback(async () => {
    if (isQuestVisualSession()) return healthProfileRef.current;
    const token = await getToken();
    if (!token) return null;
    try {
      const { profile } = await api.healthProfile.get();
      if (await getToken() !== token) return null;
      setHealthProfile(profile);
      const snapshot = await loadSessionSnapshot();
      if (snapshot && await getToken() === token) {
        await saveSessionSnapshot({ ...snapshot, healthProfile: profile });
      }
      return profile;
    } catch {
      return null;
    }
    // Assessment and AuthGate depend on this function: a received profile must
    // not change its identity and start another loading effect indefinitely.
  }, []);

  const completeSocial = useCallback(
    async (
      provider: SocialProvider,
      call: () => Promise<Parameters<typeof adopt>[0] & { created?: boolean }>,
    ): Promise<SocialSignInResult> => {
      try {
        const result = await call();
        await adopt(result);
        if (result.created) {
          void import('@/lib/funnel').then(({ trackSignupCompleted }) => trackSignupCompleted(provider)).catch(() => undefined);
        }
        return { status: 'signed-in' };
      } catch (error) {
        const details = error instanceof ApiError ? error.details : undefined;
        if (error instanceof ApiError && error.code === 'SOCIAL_LINK_REQUIRED' && typeof details?.linkToken === 'string') {
          return { status: 'link', provider, email: String(details.email ?? ''), linkToken: details.linkToken };
        }
        throw error;
      }
    },
    [adopt],
  );

  const value = useMemo<AuthState>(
    () => ({
      ready,
      sessionRestoreError,
      restoringSession,
      user,
      usage,
      stats,
      healthProfile,
      signIn: async (email, password) => adopt(await api.auth.login({ email, password })),
      resetPasswordWithSms: async (input) => adopt(await api.auth.passwordSmsReset(input)),
      signUp: async (input) => {
        try {
          await adopt(await api.auth.register(input));
          void import('@/lib/funnel').then(({ trackSignupCompleted }) => trackSignupCompleted('email')).catch(() => undefined);
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
      signInWithPhone: async (phone, code, fullName) => {
        const result = await api.auth.phoneVerify({ phone, code, fullName });
        await adopt(result);
        // Phone sign-in also creates accounts: count it as a signup only for a just-created one.
        if (Date.now() - new Date(result.user?.createdAt ?? 0).getTime() < 10 * 60_000) {
          void import('@/lib/funnel').then(({ trackSignupCompleted }) => trackSignupCompleted('phone')).catch(() => undefined);
        }
      },
      signInWithApple: async () => {
        const { requestAppleCredential } = await import('@/lib/socialSignIn');
        const { nonce } = await api.auth.appleNonce();
        const credential = await requestAppleCredential(nonce);
        if (!credential) return { status: 'cancelled' };
        return completeSocial('apple', () => api.auth.apple(credential));
      },
      signInWithGoogle: async () => {
        const { requestGoogleIdToken } = await import('@/lib/socialSignIn');
        const idToken = await requestGoogleIdToken();
        if (!idToken) return { status: 'cancelled' };
        return completeSocial('google', () => api.auth.google({ idToken }));
      },
      linkSocialAccount: async (linkToken, password) => adopt(await api.auth.socialLink({ linkToken, password })),
      signOut: async () => {
        const userId = user?.id;
        setQuestVisualSession(false);
        try {
          const [{ onPetCareLogout }, { cancelAllReminders, unregisterPushFromServer }] = await Promise.all([
            import('@/lib/petCareReminders'),
            import('@/lib/notifications'),
          ]);
          await unregisterPushFromServer();
          await cancelAllReminders();
          await onPetCareLogout(userId);
        } catch {
          /* local reminder cleanup is best-effort */
        }
        await clearToken();
        await clearSessionSnapshot();
        resetSession();
      },
      deleteAccount: async () => {
        const userId = user?.id;
        // Server first: a failed delete (network, 5xx) leaves her signed in with every reminder and
        // push still in place. The server drops the push tokens with the account (cascade).
        await api.auth.deleteAccount();
        await stopDeviceDelivery();
        await forgetAccountOnDevice(userId);
        await clearToken();
        await clearSessionSnapshot();
        resetSession();
      },
      discardNewAccount: async () => {
        const userId = user?.id;
        await api.auth.discardNewAccount();
        await stopDeviceDelivery();
        await forgetAccountOnDevice(userId);
        await clearToken();
        await clearSessionSnapshot();
        resetSession();
      },
      switchToAccount: async (result, previousDeleted) => {
        const userId = user?.id;
        await stopDeviceDelivery();
        if (userId && userId !== result.user?.id) {
          // A deleted account leaves nothing behind; one that stays is only signed out, like signOut.
          if (previousDeleted) await forgetAccountOnDevice(userId);
          else await import('@/lib/petCareReminders').then(({ onPetCareLogout }) => onPetCareLogout(userId)).catch(() => undefined);
        }
        await adopt(result);
      },
      linkApple: async () => {
        const { requestAppleCredential } = await import('@/lib/socialSignIn');
        const { nonce } = await api.auth.appleNonce();
        const credential = await requestAppleCredential(nonce);
        if (!credential) return 'cancelled';
        await api.auth.appleLink(credential);
        return 'linked';
      },
      linkGoogle: async () => {
        const { requestGoogleIdToken } = await import('@/lib/socialSignIn');
        const idToken = await requestGoogleIdToken();
        if (!idToken) return 'cancelled';
        await api.auth.googleLink({ idToken });
        return 'linked';
      },
      refresh: refreshSession,
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
      sessionRestoreError,
      restoringSession,
      user,
      usage,
      stats,
      healthProfile,
      adopt,
      completeSocial,
      hydrate,
      refreshSession,
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
