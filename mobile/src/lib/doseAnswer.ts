/**
 * What a dose log row says about the dose. Pure — no React Native, no storage — so the MEDIPILL
 * schedule, calendar and Home read one rule (tests/medication-dose-answer.test.cjs).
 *
 * Only „taken“ and „skipped“ answer a dose. A „pending“ row is an undone answer (Home's and the web's
 * undo write it) or a dose moved to a later time with „გადატანა“: the dose is still to take.
 */
import type { DoseStatus, MedicationDoseLog } from '@/types/medications';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isDoseAnswered(log: Pick<MedicationDoseLog, 'status'> | null | undefined): boolean {
  return log?.status === 'taken' || log?.status === 'skipped';
}

/** The answered statuses among a day's logs (undone and moved doses left out). */
export function answeredStatuses(logs: readonly Pick<MedicationDoseLog, 'status'>[]): DoseStatus[] {
  return logs.filter(isDoseAnswered).map((log) => log.status);
}

/**
 * The calendar mark for one day from its logs: green only when something was taken and nothing
 * skipped, amber when a dose was skipped, both → mixed. A day with no answered dose has no mark
 * (the calendar then falls back to „planned“).
 */
export function calendarDayStatus(logs: readonly Pick<MedicationDoseLog, 'status'>[]): 'taken' | 'skipped' | 'mixed' | null {
  const statuses = answeredStatuses(logs);
  const taken = statuses.includes('taken');
  const skipped = statuses.includes('skipped');
  if (!taken && !skipped) return null;
  return taken && skipped ? 'mixed' : skipped ? 'skipped' : 'taken';
}

/** The later time a still-open dose was moved to („გადატანა“), or null. */
export function rescheduledTime(log: Pick<MedicationDoseLog, 'status' | 'rescheduledTo'> | null | undefined): string | null {
  if (!log || log.status !== 'pending') return null;
  return typeof log.rescheduledTo === 'string' && TIME_RE.test(log.rescheduledTo) ? log.rescheduledTo : null;
}

/**
 * The row „გადატანა“ writes: the dose stays open ('pending') on its own slot and day and remembers
 * the new time. Never „taken“ — she has not taken it yet. Picking the dose's own time moves it back.
 */
export function rescheduledDoseEntry(
  dose: Pick<MedicationDoseLog, 'medicationId' | 'date' | 'time'>,
  to: string,
  nowIso: string,
): MedicationDoseLog {
  const entry: MedicationDoseLog = { medicationId: dose.medicationId, date: dose.date, time: dose.time, status: 'pending', updatedAt: nowIso };
  return to !== dose.time && TIME_RE.test(to) ? { ...entry, rescheduledTo: to } : entry;
}
