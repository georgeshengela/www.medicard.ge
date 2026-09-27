/**
 * Product funnel emitter (2026-09-28). Queued, batched, offline-tolerant; never blocks the UI and
 * never surfaces errors. Sends event names + small enums only (see funnelQueue.ts) to
 * POST /api/funnel/events. Works before sign-in (install/source); the server links this install's
 * earlier events to the account on the first signed-in batch.
 */
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { API_BASE_URL } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { petCareInstallId } from '@/lib/petCareReminderPrefs';
import { getPreference, getToken, setPreference } from '@/lib/storage';
import {
  createFunnelQueue,
  installSourceFromUrl,
  type FunnelEventName,
  type HealthActionType,
  type SendResult,
} from './funnelQueue';

const QUEUE_KEY = 'medicard.funnel.queue.v1';
const FIRST_OPEN_KEY = 'medicard.funnel.firstOpen.v1';
const onceKey = (account: string, name: string) => `medicard.funnel.once.v1.${account}.${name}`;
const FLUSH_INTERVAL_MS = 60_000;

async function send(events: Array<{ name: FunnelEventName; props?: Record<string, string>; at: string }>): Promise<SendResult> {
  const [installId, token] = await Promise.all([petCareInstallId(), getToken()]);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${API_BASE_URL}/api/funnel/events`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Medicard-Platform': Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
        'X-Medicard-App-Version': String(Constants.expoConfig?.version || ''),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ installId, events }),
    });
    if (response.ok) return 'ok';
    // 429 / 5xx / maintenance: keep for later. Other 4xx: the batch itself is bad, drop it.
    return response.status === 429 || response.status >= 500 ? 'retry' : 'drop';
  } catch {
    return 'retry';
  } finally {
    clearTimeout(timer);
  }
}

const queue = createFunnelQueue({
  load: () => getPreference(QUEUE_KEY),
  save: (raw) => setPreference(QUEUE_KEY, raw),
  send,
  currentAccount: () => localAccountId(),
});

let flushTimer: ReturnType<typeof setTimeout> | null = null;
function flushSoon(ms = 3000) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void queue.flush();
  }, ms);
}

/** Fire-and-forget. Never throws, never awaits the network. */
export function trackFunnel(name: FunnelEventName, props?: Record<string, string>): void {
  void queue.enqueue(name, props).then(() => flushSoon());
}

/** Once per account on this device (the server dedupes across devices too). */
async function trackOncePerAccount(name: FunnelEventName, props?: Record<string, string>): Promise<void> {
  const account = localAccountId();
  if (!account) return;
  const key = onceKey(account, name);
  if (await getPreference(key)) return;
  await setPreference(key, '1');
  trackFunnel(name, props);
}

export function trackSignupCompleted(method: 'email' | 'phone' | 'google' | 'apple'): void {
  void trackOncePerAccount('signup_completed', { method }).catch(() => undefined);
}

export function trackOnboardingCompleted(primaryGoal: unknown): void {
  const goal = ['medications', 'nutrition', 'cycle', 'general'].includes(String(primaryGoal)) ? String(primaryGoal) : 'unknown';
  void trackOncePerAccount('onboarding_completed', { primaryGoal: goal }).catch(() => undefined);
}

/** First medication / meal / cycle log / weight / visit / record / manual check-in of this account. */
export function trackFirstHealthAction(type: HealthActionType): void {
  void trackOncePerAccount('first_health_action', { type }).catch(() => undefined);
}

const viewedSteps = new Set<string>();
export function trackOnboardingStep(kind: 'viewed' | 'completed', stepKey: string | undefined | null): void {
  if (!stepKey) return;
  const memo = `${localAccountId() ?? '-'}:${kind}:${stepKey}`;
  if (viewedSteps.has(memo)) return;
  viewedSteps.add(memo);
  trackFunnel(kind === 'viewed' ? 'onboarding_step_viewed' : 'onboarding_step_completed', { stepKey });
}

/**
 * First open of this install: attribution from the launch URL (invite link, utm_* params, other
 * deep link) is stored once. Installs that already had a session before this build are not counted.
 */
async function recordFirstOpen(): Promise<void> {
  if (await getPreference(FIRST_OPEN_KEY)) return;
  await setPreference(FIRST_OPEN_KEY, new Date().toISOString());
  if (await getToken()) return; // upgrade of an existing install, not a new one
  const url = await Linking.getInitialURL().catch(() => null);
  trackFunnel('app_first_open', installSourceFromUrl(url) as Record<string, string>);
}

let started = false;
/** Call once from the root layout. Flushes on an interval while active and when the app backgrounds. */
export function startFunnel(): void {
  if (started) return;
  started = true;
  void recordFirstOpen().catch(() => undefined);
  setInterval(() => {
    if (AppState.currentState === 'active') void queue.flush();
  }, FLUSH_INTERVAL_MS);
  AppState.addEventListener('change', (next) => {
    if (next === 'background' || next === 'inactive') void queue.flush();
  });
}

