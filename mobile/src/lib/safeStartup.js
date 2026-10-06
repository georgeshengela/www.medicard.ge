import { AppState, ErrorUtils, InteractionManager } from 'react-native';

/** Keep native modules (notifications, socket, account sync) off the critical boot path. */
export const POST_LOGIN_DEFER_MS = 1200;

const bootStartedAt = Date.now();
/** Suppress RN fatals only during cold start — avoids TestFlight instant death while UI mounts. */
export const BOOT_FATAL_GUARD_MS = 25_000;

export function schedulePostLoginWork(label, work) {
  if (typeof work !== 'function') return;
  const run = () => {
    void Promise.resolve()
      .then(work)
      .catch((error) => {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn(`[post-login:${label}]`, error);
        }
      });
  };
  InteractionManager.runAfterInteractions(() => {
    const delay =
      AppState.currentState === 'active' ? POST_LOGIN_DEFER_MS : POST_LOGIN_DEFER_MS + 400;
    setTimeout(run, delay);
  });
}

/**
 * Home/Profile focus re-hydrate the session, which used to re-run all of this (~12–15 requests per
 * tab switch). Same account within POST_LOGIN_MIN_GAP_MS → skip; sign-in passes `force`.
 * Foreground work has its own AppState handler in AuthContext.
 */
export const POST_LOGIN_MIN_GAP_MS = 5 * 60_000;
let lastPostLogin = { userId: null, at: 0 };

export function shouldRunPostLogin(userId, { force = false, now = Date.now() } = {}) {
  if (!userId) return false;
  if (!force && lastPostLogin.userId === userId && now - lastPostLogin.at < POST_LOGIN_MIN_GAP_MS) return false;
  lastPostLogin = { userId, at: now };
  return true;
}

export function resetPostLoginGate() {
  lastPostLogin = { userId: null, at: 0 };
}

/** Side effects that must not run in the same tick as session state updates (socket, push, sync). */
export function runPostLoginSideEffects(user, healthProfile, { force = false } = {}) {
  if (!shouldRunPostLogin(user?.id, { force })) return;
  schedulePostLoginWork('retired-preferences', () =>
    import('@/lib/localAccount').then(({ wipeRetiredFeaturePreferences }) => wipeRetiredFeaturePreferences(user.id)),
  );
  schedulePostLoginWork('cycle', () =>
    import('@/lib/cycleOffline').then(({ flushCycleQueue }) =>
      flushCycleQueue(user.id).catch(() => undefined),
    ),
  );
  schedulePostLoginWork('push', () =>
    import('@/lib/notifications').then(({ syncPushRegistration }) => syncPushRegistration()),
  );
  schedulePostLoginWork('push-copy', () =>
    import('@/lib/pushCopy').then(({ loadPushTemplates }) => loadPushTemplates()),
  );
  schedulePostLoginWork('medi-brain', () =>
    import('@/lib/mediNotificationBrain').then(({ runMediNotificationBrain }) =>
      runMediNotificationBrain(user, healthProfile ?? null),
    ),
  );
  schedulePostLoginWork('pets', () =>
    import('@/lib/petCareReminders').then(({ reconcilePetCareReminders, flushPendingPetCareConfirms }) => {
      void flushPendingPetCareConfirms();
      void reconcilePetCareReminders({ reason: 'login' });
    }),
  );
  // Meta install measurement (train 22): only after the privacy acceptance, never health data.
  schedulePostLoginWork('ad-measurement', () =>
    import('@/lib/adMeasurement').then(({ startAdMeasurement }) => startAdMeasurement(healthProfile?.extraAnswers)),
  );
  // Goals restored from the server first, then every reminder family is put back on the device.
  schedulePostLoginWork('account', () =>
    import('@/lib/accountSync')
      .then(({ pullAccountState }) => pullAccountState().catch(() => undefined))
      .then(() => import('@/lib/reminderReconcile'))
      .then(({ reconcileAllLocalReminders }) => reconcileAllLocalReminders({ force: true })),
  );
}

export function installProductionBootGuard() {
  const EU = globalThis.ErrorUtils || ErrorUtils;
  if (typeof EU?.getGlobalHandler !== 'function' || typeof EU?.setGlobalHandler !== 'function') return;
  const previous = EU.getGlobalHandler();
  EU.setGlobalHandler((error, isFatal) => {
    const inDev = typeof __DEV__ !== 'undefined' && __DEV__;
    if (inDev || !isFatal) {
      if (typeof previous === 'function') previous(error, isFatal);
      return;
    }
    if (Date.now() - bootStartedAt < BOOT_FATAL_GUARD_MS) {
      console.error('[Medicard] boot fatal suppressed:', error);
      return;
    }
    if (typeof previous === 'function') previous(error, isFatal);
  });
}
