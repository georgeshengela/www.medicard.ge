/**
 * Which dose a notification's „მივიღე ✓“ (TAKE) marks, and the small queue that keeps the mark when
 * the app was launched by the tap before any account could be resolved. Pure — no React Native, no
 * storage — so the rules are unit-tested (notificationDose.test.ts).
 */
import type { MedicationDoseLog } from '@/types/medications';

/** A queued mark older than this is dropped: the dose it belongs to is long past. */
export const PENDING_DOSE_TTL_MS = 24 * 60 * 60_000;
const PENDING_DOSE_MAX = 50;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `owner`: the account whose reminder the mark came from (absent for reminders scheduled by older app JS). */
export type PendingDose = MedicationDoseLog & { queuedAt: number; owner?: string };

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * When the notification was delivered, in ms. expo-notifications reports `notification.date` in
 * seconds on iOS and in milliseconds on Android; anything missing, broken or in the future → now.
 */
export function notificationTimeMs(raw: unknown, nowMs: number): number {
  const value = typeof raw === 'number' ? raw : Number.NaN;
  if (!Number.isFinite(value) || value <= 0) return nowMs;
  const ms = value < 1e12 ? Math.round(value * 1000) : value;
  return ms > nowMs + 60 * 60_000 ? nowMs : ms;
}

/**
 * The local day of the scheduled dose at `time` that a notification delivered at `atMs` belongs to:
 * the same day, unless that day's `time` lies more than 12 h after the delivery — then it was the
 * day before (a 23:30 dose snoozed past midnight, or answered the next morning).
 */
export function doseDateForNotification(time: string, atMs: number): string {
  const at = new Date(atMs);
  if (!TIME_RE.test(time)) return ymd(at);
  const [hour, minute] = time.split(':').map(Number);
  const scheduled = new Date(at.getFullYear(), at.getMonth(), at.getDate(), hour, minute);
  if (scheduled.getTime() - atMs > 12 * 60 * 60_000) scheduled.setDate(scheduled.getDate() - 1);
  return ymd(scheduled);
}

/**
 * The day of the dose a medication reminder is about. A one-off reminder names it (`data.date`);
 * a repeating one is dated by when it was delivered.
 */
function reminderDoseDate(data: Record<string, unknown>, time: string, deliveredRaw: unknown, nowMs: number): string {
  if (typeof data.date === 'string' && YMD_RE.test(data.date)) return data.date;
  return doseDateForNotification(time, notificationTimeMs(deliveredRaw, nowMs));
}

/**
 * The account a medication reminder was scheduled for (`data.owner`). Reminders scheduled by older
 * app JS name none → null.
 */
export function reminderOwner(data: Record<string, unknown>): string | null {
  return typeof data.owner === 'string' && data.owner ? data.owner : null;
}

/** The dose log row for a „მივიღე ✓“ tap, or null when the payload names no medication. */
export function notificationDoseEntry(
  data: Record<string, unknown>,
  deliveredRaw: unknown,
  nowMs: number,
): MedicationDoseLog | null {
  const medicationId = typeof data.medicationId === 'string' ? data.medicationId : '';
  if (!medicationId) return null;
  // Every reminder carries its HH:mm; 08:00 is the historical fallback for a payload without one.
  const time = typeof data.time === 'string' ? data.time : '08:00';
  return {
    medicationId,
    date: reminderDoseDate(data, time, deliveredRaw, nowMs),
    time,
    status: 'taken',
    updatedAt: new Date(nowMs).toISOString(),
  };
}

/**
 * Where tapping a medication reminder opens: the dose screen of the reminded slot and day
 * (`/medications/<id>?time=20:00&date=…`), the same dose „მივიღე ✓“ would mark. Without its own
 * slot the screen fell back to the first dose of the day. Null when the payload names no slot.
 */
export function medicationDoseRoute(data: Record<string, unknown>, deliveredRaw: unknown, nowMs: number): string | null {
  const medicationId = typeof data.medicationId === 'string' ? data.medicationId : '';
  const time = typeof data.time === 'string' && TIME_RE.test(data.time) ? data.time : '';
  if (!medicationId || !time) return null;
  return `/medications/${encodeURIComponent(medicationId)}?time=${time}&date=${reminderDoseDate(data, time, deliveredRaw, nowMs)}`;
}

const doseKey = (row: Pick<MedicationDoseLog, 'medicationId' | 'date' | 'time'>) =>
  `${row.medicationId}|${row.date}|${row.time}`;

/** `extra` marks over `base`, one row per dose; a newer `updatedAt` wins. */
export function mergeDoseLogs(base: readonly MedicationDoseLog[], extra: readonly MedicationDoseLog[]): MedicationDoseLog[] {
  const map = new Map<string, MedicationDoseLog>();
  for (const row of [...base, ...extra]) {
    const prev = map.get(doseKey(row));
    if (!prev || String(row.updatedAt) >= String(prev.updatedAt)) map.set(doseKey(row), row);
  }
  return [...map.values()];
}

function isDoseRow(row: unknown): row is PendingDose {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.medicationId === 'string' &&
    typeof r.date === 'string' &&
    typeof r.time === 'string' &&
    typeof r.status === 'string' &&
    typeof r.updatedAt === 'string'
  );
}

/**
 * Adds a mark to the queue (replacing an earlier mark of the same dose), with the account its
 * reminder belongs to when the reminder names one.
 */
export function queuePendingDose(
  queue: readonly unknown[],
  entry: MedicationDoseLog,
  nowMs: number,
  owner?: string | null,
): PendingDose[] {
  const kept = queue.filter(isDoseRow).filter((row) => doseKey(row) !== doseKey(entry));
  return [...kept, { ...entry, queuedAt: nowMs, ...(owner ? { owner } : {}) }].slice(-PENDING_DOSE_MAX);
}

/**
 * The queued marks still worth applying to `accountId`, as plain dose log rows. A mark whose reminder
 * named another account is never applied here (a shared phone: the next person to sign in must not
 * get it). A mark without an owner (a reminder from older app JS) keeps the old rule; a fresh sign-in
 * keeps only its own account's marks (`ownPendingDoses`), so it only ever reaches the session that
 * was restored.
 */
export function takePendingDoses(queue: readonly unknown[], nowMs: number, accountId: string): MedicationDoseLog[] {
  return queue
    .filter(isDoseRow)
    .filter((row) => typeof row.queuedAt === 'number' && nowMs - row.queuedAt <= PENDING_DOSE_TTL_MS)
    .filter((row) => !(typeof row.owner === 'string' && row.owner) || row.owner === accountId)
    .map(({ medicationId, date, time, status, updatedAt }) => ({ medicationId, date, time, status, updatedAt }));
}

/**
 * What a fresh sign-in of `accountId` keeps of the queue: only the marks whose reminder named that
 * account (her own „მივიღე ✓“ tapped while she was signed out). Marks of other accounts and marks
 * without an owner were made in another session and are dropped.
 */
export function ownPendingDoses(queue: readonly unknown[], accountId: string): PendingDose[] {
  if (!accountId) return [];
  return queue.filter(isDoseRow).filter((row) => typeof row.owner === 'string' && row.owner === accountId);
}

/**
 * Doses that were moved with „გადატანა“ in `before` and are no longer an open moved dose in `after`
 * (answered, or moved back, on another device): their one-off moved reminder must not ring.
 */
export function endedDoseMoves(
  before: readonly MedicationDoseLog[],
  after: readonly MedicationDoseLog[],
): MedicationDoseLog[] {
  const now = new Map(after.map((row) => [doseKey(row), row]));
  return before.filter((row) => {
    if (row.status !== 'pending' || !row.rescheduledTo) return false;
    const next = now.get(doseKey(row));
    return !next || next.status !== 'pending' || !next.rescheduledTo;
  });
}
