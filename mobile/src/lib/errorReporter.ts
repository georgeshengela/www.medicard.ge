/**
 * App error reporting to our own server (POST /api/app/client-error), 2026-09-29. Replaces a
 * third-party crash service: no new data recipient, ships by OTA. Catches JS fatals (via the boot
 * guard hook), render errors (root ErrorBoundary) and unhandled promise rejections.
 *
 * Events are scrubbed on the phone (errorReportCore) and again on the server; a looping error is
 * sent once per 5 min; batches go at most every few seconds through the request breaker. Fatal
 * errors are also written to storage first so they arrive on the next launch if the app dies.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_BASE_URL, ApiError, guardRequest } from '@/lib/api';
import { getPreference, getToken, setPreference } from '@/lib/storage';
import { createErrorQueue, toErrorEvent, type ErrorEvent, type ErrorKind } from './errorReportCore';

const PENDING_KEY = 'medicard.errors.pending.v1';
const FLUSH_DELAY_MS = 3_000;

const queue = createErrorQueue();
let currentRoute: string | undefined;
let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;
let installed = false;

export function setErrorRoute(route: string) {
  currentRoute = route;
}

export function reportError(kind: ErrorKind, error: unknown, opts: { fatal?: boolean } = {}) {
  // Development errors stay in Metro; only real installs report.
  if (typeof __DEV__ !== 'undefined' && __DEV__) return;
  try {
    const event = toErrorEvent(kind, error, { fatal: opts.fatal, route: currentRoute });
    if (!queue.add(event)) return;
    if (opts.fatal) void persistPending([event]);
    schedule();
  } catch {
    /* reporting must never throw */
  }
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, FLUSH_DELAY_MS);
}

async function persistPending(events: ErrorEvent[]) {
  try {
    const raw = await getPreference(PENDING_KEY);
    const prev: ErrorEvent[] = raw ? JSON.parse(raw) : [];
    await setPreference(PENDING_KEY, JSON.stringify([...prev, ...events].slice(-10)));
  } catch {
    /* best effort */
  }
}

async function send(events: ErrorEvent[]): Promise<boolean> {
  try {
    guardRequest('POST', '/api/app/client-error');
  } catch {
    return false;
  }
  const token = await getToken().catch(() => null);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${API_BASE_URL}/api/app/client-error`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Medicard-Platform': Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
        'X-Medicard-App-Version': String(Constants.expoConfig?.version || ''),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ events }),
    });
    // 4xx other than 429: the batch itself is unusable, drop it.
    return res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429);
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function flush() {
  if (sending) return;
  sending = true;
  try {
    const batch = queue.take(10);
    if (!batch.length) return;
    const ok = await send(batch);
    if (!ok) queue.putBack(batch);
    else if (batch.some((e) => e.fatal)) await setPreference(PENDING_KEY, '[]').catch(() => undefined);
    if (queue.size()) schedule();
  } finally {
    sending = false;
  }
}

/** Once, early at startup (production): resend fatals from a previous run and hook the handlers. */
export function installErrorReporting() {
  if (installed) return;
  installed = true;
  if (typeof __DEV__ !== 'undefined' && __DEV__) return;

  // The boot guard swallows fatals so the app stays alive; it calls this hook first.
  (globalThis as { __medicardReportError?: (e: unknown, fatal?: boolean) => void }).__medicardReportError = (e, fatal) =>
    reportError('crash', e, { fatal: Boolean(fatal) });

  const hermes = (globalThis as { HermesInternal?: { enablePromiseRejectionTracker?: (o: unknown) => void } }).HermesInternal;
  try {
    hermes?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id: number, rejection: unknown) => {
        // A request that never reached the server (status 0: offline, weak signal) is not an app bug.
        if (rejection instanceof ApiError && rejection.status === 0) return;
        reportError('unhandled_rejection', rejection);
      },
      onHandled: () => undefined,
    });
  } catch {
    /* tracker unavailable on this engine */
  }

  void (async () => {
    try {
      const raw = await getPreference(PENDING_KEY);
      const pending: ErrorEvent[] = raw ? JSON.parse(raw) : [];
      if (pending.length && (await send(pending.slice(0, 10)))) await setPreference(PENDING_KEY, '[]');
    } catch {
      /* next launch tries again */
    }
  })();
}
