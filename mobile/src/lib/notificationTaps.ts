import type { NotificationResponse } from 'expo-notifications';

/**
 * Process-wide memory of notification taps. It outlives any one root layout instance,
 * so a remounted shell never replays a tap that was already opened.
 */
const handledTaps = new Set<string>();
let pendingSince = 0;
let openedAt = 0;

/** True the first time a tap key is seen in this process. */
export function claimNotificationTap(key: string): boolean {
  if (handledTaps.has(key)) return false;
  handledTaps.add(key);
  return true;
}

/**
 * The buttons registered with `opensAppToForeground: false` (mediNotificationActions): „მივიღე ✓“,
 * „დავლიე 💧“ and „შემახსენე მოგვიანებით“ are answered without opening the app.
 */
export const BACKGROUND_ACTIONS: readonly string[] = ['TAKE', 'DRANK', 'SNOOZE'];

export function isBackgroundAction(actionIdentifier: unknown): boolean {
  return typeof actionIdentifier === 'string' && BACKGROUND_ACTIONS.includes(actionIdentifier);
}

type TaskPayload = {
  actionIdentifier?: unknown;
  notification?: {
    date?: unknown;
    request?: { identifier?: unknown; content?: { data?: unknown; dataString?: unknown } & Record<string, unknown> } & Record<string, unknown>;
  };
};

/**
 * Android's notification task payload as the response AppShell's listener gets. Null for a push that
 * arrived (no button) and for a button that opens the app (its tap reaches the listener). The native
 * side sends a reminder's data as `dataString` (JSON); expo-notifications parses it for the listener,
 * never for the task.
 */
export function taskNotificationResponse(data: unknown): NotificationResponse | null {
  if (!data || typeof data !== 'object' || !('actionIdentifier' in data)) return null;
  const payload = data as TaskPayload;
  if (!isBackgroundAction(payload.actionIdentifier)) return null;
  const request = payload.notification?.request ?? {};
  const content = request.content ?? {};
  let parsed: unknown = content.data;
  if (typeof content.dataString === 'string') {
    try {
      parsed = JSON.parse(content.dataString);
    } catch {
      parsed = null;
    }
  }
  return {
    actionIdentifier: payload.actionIdentifier as string,
    notification: {
      date: payload.notification?.date,
      request: {
        ...request,
        identifier: typeof request.identifier === 'string' ? request.identifier : '',
        content: { ...content, data: parsed && typeof parsed === 'object' ? parsed : {} },
      },
    },
  } as unknown as NotificationResponse;
}

const HANDLED_ACTIONS_KEY = 'medicard.notifications.handledActions';
const HANDLED_ACTIONS_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const HANDLED_ACTIONS_MAX = 60;

/** The ledger after claiming `key` at `nowMs`: `claimed` only the first time a key is seen (3 days, 60 keys). */
export function claimInLedger(raw: string | null, key: string, nowMs: number): { claimed: boolean; next: string } {
  let rows: Array<[string, number]> = [];
  try {
    const parsed: unknown = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) {
      rows = parsed.filter(
        (row): row is [string, number] => Array.isArray(row) && typeof row[0] === 'string' && typeof row[1] === 'number',
      );
    }
  } catch {
    rows = [];
  }
  rows = rows.filter(([, at]) => nowMs - at < HANDLED_ACTIONS_TTL_MS);
  if (rows.some(([seen]) => seen === key)) return { claimed: false, next: JSON.stringify(rows) };
  rows.push([key, nowMs]);
  return { claimed: true, next: JSON.stringify(rows.slice(-HANDLED_ACTIONS_MAX)) };
}

let ledgerQueue: Promise<unknown> = Promise.resolve();

/**
 * A button answered without opening the app can reach JS twice: on Android the killed app's tap runs
 * the notification task in a headless runtime, and expo-notifications keeps the response and hands it
 * to the next runtime of the same process (getLastNotificationResponseAsync). `claimNotificationTap`
 * is per runtime, so these taps are claimed on the device too — a replay must never mark a dose again
 * after she changed it in the app. Unreadable storage claims (a lost mark is worse than a repeat).
 */
export function claimBackgroundAction(key: string): Promise<boolean> {
  const run = ledgerQueue.then(async () => {
    const { getPreference, setPreference } = await import('@/lib/storage');
    const { claimed, next } = claimInLedger(await getPreference(HANDLED_ACTIONS_KEY), key, Date.now());
    if (claimed) await setPreference(HANDLED_ACTIONS_KEY, next);
    return claimed;
  });
  ledgerQueue = run.catch(() => undefined);
  return run.catch(() => true);
}

export function noteNotificationRoutePending(): void {
  pendingSince = Date.now();
}

export function noteNotificationRouteOpened(): void {
  pendingSince = 0;
  openedAt = Date.now();
}

export function clearNotificationRoutePending(): void {
  pendingSince = 0;
}

/** Automatic screens wait while a tapped notification is opening its target. */
export function notificationNavigationBusy(now = Date.now(), settleMs = 4000): boolean {
  return pendingSince > 0 || (openedAt > 0 && now - openedAt < settleMs);
}
