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

/** Side effects that must not run in the same tick as session state updates (socket, push, sync). */
export function runPostLoginSideEffects(user, healthProfile) {
  if (!user?.id) return;
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
  schedulePostLoginWork('account', () =>
    import('@/lib/accountSync').then(({ pullAccountState }) => pullAccountState().catch(() => undefined)),
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
