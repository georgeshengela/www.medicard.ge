/**
 * The device outbox for dose answers (`POST /api/push/dose-events`, the server's MedicationDoseEvent).
 * A reminder's „მივიღე ✓“ runs while iOS is already suspending the app (expo-notifications reports the
 * action handled before any JS runs), often with the phone locked, when the Keychain token cannot be
 * read: a one-shot POST from there was lost (no answer or 401) and nothing sent it again, so no row
 * ever said `notification`. Every answer is kept here first and leaves only once the server took it.
 * Pure — no React Native, no storage — so the rules are unit-tested (doseEventQueue.test.ts).
 */

export type DoseEventSource = 'app' | 'notification';

export type DoseEvent = {
  medicationId: string;
  date: string;
  time: string;
  status: 'taken' | 'skipped';
  source: DoseEventSource;
  /** When she answered (the dose log's `updatedAt`); the server keeps the newest answer of a dose. */
  occurredAt: string;
};

/** An answer older than this is dropped unsent: nothing reads a dose event that late. */
export const DOSE_EVENT_TTL_MS = 7 * 24 * 60 * 60_000;
/** The server takes at most 40 events per request (`push.routes.js`). */
export const DOSE_EVENT_BATCH = 40;
const DOSE_EVENT_MAX = 200;

const doseKey = (row: Pick<DoseEvent, 'medicationId' | 'date' | 'time'>) => `${row.medicationId}|${row.date}|${row.time}`;
const sameEvent = (a: DoseEvent, b: DoseEvent) =>
  doseKey(a) === doseKey(b) && a.status === b.status && a.source === b.source && a.occurredAt === b.occurredAt;

function isDoseEvent(row: unknown): row is DoseEvent {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.medicationId === 'string' &&
    typeof r.date === 'string' &&
    typeof r.time === 'string' &&
    (r.status === 'taken' || r.status === 'skipped') &&
    (r.source === 'app' || r.source === 'notification') &&
    typeof r.occurredAt === 'string' &&
    Number.isFinite(Date.parse(r.occurredAt))
  );
}

function fresh(row: DoseEvent, nowMs: number): boolean {
  return nowMs - Date.parse(row.occurredAt) <= DOSE_EVENT_TTL_MS;
}

/** The stored outbox as rows (anything unreadable → empty). */
export function parseDoseEvents(raw: string | null): DoseEvent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isDoseEvent) : [];
  } catch {
    return [];
  }
}

/**
 * Adds an answer, one row per dose: a newer answer replaces a queued one (a „მივიღე ✓“ undone in the
 * app goes out as the later „skipped“ only), a late-arriving older one never replaces a newer one.
 */
export function queueDoseEvent(queue: readonly unknown[], event: DoseEvent): DoseEvent[] {
  const rows = queue.filter(isDoseEvent);
  const queued = rows.find((row) => doseKey(row) === doseKey(event));
  const winner = queued && Date.parse(queued.occurredAt) > Date.parse(event.occurredAt) ? queued : event;
  return [...rows.filter((row) => doseKey(row) !== doseKey(event)), winner].slice(-DOSE_EVENT_MAX);
}

/** What to send now: the answers still worth sending, oldest first, one request's worth. */
export function dueDoseEvents(queue: readonly unknown[], nowMs: number): DoseEvent[] {
  return queue
    .filter(isDoseEvent)
    .filter((row) => fresh(row, nowMs))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    .slice(0, DOSE_EVENT_BATCH);
}

/**
 * The outbox after a request was answered: the rows it carried leave (a dose answered again while it
 * was in flight keeps its newer row), and expired or unreadable rows go with them.
 */
export function settleDoseEvents(queue: readonly unknown[], sent: readonly DoseEvent[], nowMs: number): DoseEvent[] {
  return queue
    .filter(isDoseEvent)
    .filter((row) => fresh(row, nowMs))
    .filter((row) => !sent.some((done) => sameEvent(done, row)));
}

/**
 * Whether a failed request is tried again later. No answer (offline, or iOS suspended the app before
 * it came back), no readable session yet (a locked phone → 401), a timeout, throttling and server
 * errors are passing; any other refusal is final and the rows leave, so they never loop.
 */
export function keepAfterFailure(status: number): boolean {
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
}
