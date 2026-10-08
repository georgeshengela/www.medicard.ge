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

export type PendingDose = MedicationDoseLog & { queuedAt: number };

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
    date: doseDateForNotification(time, notificationTimeMs(deliveredRaw, nowMs)),
    time,
    status: 'taken',
    updatedAt: new Date(nowMs).toISOString(),
  };
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

/** Adds a mark to the queue (replacing an earlier mark of the same dose). */
export function queuePendingDose(queue: readonly unknown[], entry: MedicationDoseLog, nowMs: number): PendingDose[] {
  const kept = queue.filter(isDoseRow).filter((row) => doseKey(row) !== doseKey(entry));
  return [...kept, { ...entry, queuedAt: nowMs }].slice(-PENDING_DOSE_MAX);
}

/** The queued marks still worth applying, as plain dose log rows. */
export function takePendingDoses(queue: readonly unknown[], nowMs: number): MedicationDoseLog[] {
  return queue
    .filter(isDoseRow)
    .filter((row) => typeof row.queuedAt === 'number' && nowMs - row.queuedAt <= PENDING_DOSE_TTL_MS)
    .map(({ medicationId, date, time, status, updatedAt }) => ({ medicationId, date, time, status, updatedAt }));
}
