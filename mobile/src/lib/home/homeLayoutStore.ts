/**
 * The person's Home layout choice for this session, its device copy and its server write.
 *
 * Source of truth is `HealthProfile.extraAnswers.homeLayout` (arrives with /auth/me before the
 * first Home frame). A choice made on this device wins for the rest of the session, so a slower
 * /auth/me or profile save can never flip Home back. Writes come only from a person's tap:
 * one debounced PUT (1.2 s, one in flight per account), flushed when the app goes to the
 * background and retried (bounded) while unsent. Never written from a read or a socket event.
 *
 * The device copy remembers which server value the choice was made against (`base`): an unsent
 * choice is restored on the next launch only while the server still holds that value, so an old
 * phone can never overwrite a newer choice made on another device.
 */
import { AppState } from 'react-native';
import { useSyncExternalStore } from 'react';
import { api, type HealthProfile } from '@/lib/api';
import { onReturnToForeground } from '@/lib/appForeground';
import { getScopedPreference, localAccountId, onLocalAccountChange, setScopedPreference } from '@/lib/localAccount';
import { deletePreference, getPreference } from '@/lib/storage';
import { hydrateFeatureFlags } from '@/lib/featureFlags';
import { isCyclePrivacyLockEnabled } from '@/lib/cycleReminderPrefs';
import { parseHomeLayout, storedHomeLayout, type HomeLayoutId } from '@/lib/home/homeLayout';

const LOCAL_KEY = 'medicard.home.layout.v1';
/** Retired „აპის გახსნა: ციკლი“ setting (device-global); read once to move those women to the women's Home. */
const LEGACY_LANDING_KEY = 'medicard.home.landing';
const LEGACY_PROMPT_KEY = 'medicard.home.cyclePromptSeen';
const SEND_DELAY_MS = 1200;
const MAX_RETRIES = 3;
const PRIME_BUDGET_MS = 300;

export type HomeLayoutPending = { account: string; layout: HomeLayoutId | null; offerDone: boolean };
type Patch = { homeLayout?: HomeLayoutId; homeLayoutOfferDone?: boolean };
type ProfilePatcher = (patch: Patch) => void;
type LocalCopy = { layout: HomeLayoutId | null; offerDone: boolean; dirty: boolean; base: HomeLayoutId | null };

let pending: HomeLayoutPending | null = null;
let dirty = false;
/** Server value seen at the last session read, per account — the `base` of the next choice. */
let serverSeen: { account: string; layout: HomeLayoutId | null } | null = null;
let base: HomeLayoutId | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: { account: string; promise: Promise<void> } | null = null;
let retries = 0;
let patchProfile: ProfilePatcher | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

onLocalAccountChange(() => {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
  dirty = false;
  base = null;
  retries = 0;
  emit();
});

/** AuthProvider hands in a merge into its in-memory profile, so full-profile screens see the choice. */
export function registerHomeLayoutProfilePatch(fn: ProfilePatcher | null) {
  patchProfile = fn;
}

export function homeLayoutPending(): HomeLayoutPending | null {
  return pending;
}

export function useHomeLayoutPending(): HomeLayoutPending | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    homeLayoutPending,
    homeLayoutPending,
  );
}

function writeLocal(account: string) {
  if (!pending || pending.account !== account || localAccountId() !== account) return;
  const copy: LocalCopy = { layout: pending.layout, offerDone: pending.offerDone, dirty, base };
  void setScopedPreference(LOCAL_KEY, JSON.stringify(copy)).catch(() => undefined);
}

async function send(): Promise<void> {
  const account = localAccountId();
  const snapshot = pending;
  if (!snapshot || !dirty || !account || snapshot.account !== account) return;
  if (inFlight?.account === account) return inFlight.promise;
  const patch: Patch = {};
  if (snapshot.layout) patch.homeLayout = snapshot.layout;
  if (snapshot.offerDone) patch.homeLayoutOfferDone = true;
  if (!Object.keys(patch).length) return;
  const flight: { account: string; promise: Promise<void> } = { account, promise: Promise.resolve() };
  inFlight = flight;
  flight.promise = (async () => {
    try {
      await api.healthProfile.update({ extraAnswers: patch });
      if (localAccountId() !== account) return;
      patchProfile?.(patch);
      if (pending === snapshot) {
        dirty = false;
        retries = 0;
        writeLocal(account);
      }
    } catch {
      retries += 1;
    } finally {
      if (inFlight === flight) inFlight = null;
      // A newer tap landed meanwhile, or this one failed: one more try (bounded), never a loop.
      if (localAccountId() === account && dirty && !timer && retries < MAX_RETRIES) {
        schedule(pending === snapshot ? SEND_DELAY_MS * (retries + 1) : 0);
      }
    }
  })();
  return flight.promise;
}

function schedule(delay = SEND_DELAY_MS) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void send();
  }, delay);
}

AppState.addEventListener('change', (next) => {
  if (next !== 'background' || !timer) return;
  clearTimeout(timer);
  timer = null;
  void send();
});

onReturnToForeground(() => {
  if (!dirty || timer) return;
  retries = 0;
  void send();
});

/**
 * A person's choice (picker, offer card, onboarding). Applies in the same frame; the server
 * write follows. `offerDone` marks the one-time offer as answered.
 */
export function chooseHomeLayout(layout: HomeLayoutId | null, opts: { offerDone?: boolean; immediate?: boolean } = {}) {
  const account = localAccountId();
  if (!account) return;
  const current = pending?.account === account ? pending : null;
  const next: HomeLayoutPending = {
    account,
    layout: layout ?? current?.layout ?? null,
    offerDone: Boolean(opts.offerDone || current?.offerDone),
  };
  if (current && current.layout === next.layout && current.offerDone === next.offerDone) return;
  if (!dirty) base = serverSeen?.account === account ? serverSeen.layout : null;
  pending = next;
  dirty = true;
  retries = 0;
  emit();
  writeLocal(account);
  schedule(opts.immediate ? 0 : SEND_DELAY_MS);
}

function timeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

function readLocal(raw: string | null): LocalCopy | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      layout: parseHomeLayout(value.layout),
      offerDone: value.offerDone === true,
      dirty: value.dirty === true,
      base: parseHomeLayout(value.base),
    };
  } catch {
    return null;
  }
}

/**
 * Runs inside sign-in / session restore, before Home can render: restores an unsent choice from the
 * device (only while the server still holds the value it was made against), moves women who had
 * „აპის გახსნა: ციკლი“ to the women's Home, and warms the flags and the cycle lock so the first Home
 * frame is final. Never throws and never waits more than ~300 ms; work that is slower still applies
 * (rarely, a moment after Home appeared).
 */
export async function primeHomeLayout(
  userId: string,
  profile: Pick<HealthProfile, 'extraAnswers' | 'completedAt'> | null,
  gender: string | null | undefined,
): Promise<void> {
  try {
    const server = storedHomeLayout(profile?.extraAnswers);
    serverSeen = { account: userId, layout: server.layout };
    await timeout(
      (async () => {
        await Promise.all([hydrateFeatureFlags().catch(() => undefined), isCyclePrivacyLockEnabled().catch(() => false)]);
        if (localAccountId() !== userId) return;
        if (!pending || pending.account !== userId) {
          const local = readLocal(await getScopedPreference(LOCAL_KEY).catch(() => null));
          if (localAccountId() !== userId || (pending && pending.account === userId)) return;
          if (local?.dirty && local.base === server.layout && local.layout !== server.layout) {
            pending = { account: userId, layout: local.layout, offerDone: local.offerDone };
            base = local.base;
            dirty = true;
            emit();
            schedule(0);
          } else if (local?.dirty) {
            // The server moved on (another device) or already has it: forget the old unsent copy.
            void setScopedPreference(LOCAL_KEY, JSON.stringify({ ...local, dirty: false })).catch(() => undefined);
          }
        }
        // One-time move from the retired landing — only for finished accounts (a new account
        // chooses in onboarding step 8, whatever an earlier account on this phone had set).
        if (gender !== 'FEMALE' || !profile?.completedAt || server.layout) return;
        if (pending?.account === userId && pending.layout) return;
        const landing = await getPreference(LEGACY_LANDING_KEY).catch(() => null);
        if (landing === null || localAccountId() !== userId) return;
        await Promise.all([deletePreference(LEGACY_LANDING_KEY), deletePreference(LEGACY_PROMPT_KEY)]).catch(() => undefined);
        if (landing === 'cycle' && localAccountId() === userId) chooseHomeLayout('women', { offerDone: true });
      })(),
      PRIME_BUDGET_MS,
      undefined,
    );
  } catch {
    /* Home falls back to the server value / standard — never block sign-in on this */
  }
}
