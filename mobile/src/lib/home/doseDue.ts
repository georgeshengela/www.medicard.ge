/**
 * The time words on Home's „შემდეგი მიღება“ cards (owner 2026-10-03: the cards showed no time).
 * Pure — no React, no storage.
 */

/** A dose counts as late half an hour after its time (the notification has been sitting there). */
export const LATE_AFTER_MIN = 30;

export function minuteOf(time: string): number {
  const [h, m] = time.split(':').map((n) => Number.parseInt(n, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** How a dose relates to now: late by N, due now, or in N. */
export type DueState = { kind: 'late'; minutes: number } | { kind: 'now' } | { kind: 'soon'; minutes: number };

export function dueState(doseMinute: number, nowMinute: number): DueState {
  const diff = doseMinute - nowMinute;
  if (diff < -LATE_AFTER_MIN) return { kind: 'late', minutes: -diff };
  if (diff <= 5) return { kind: 'now' };
  return { kind: 'soon', minutes: diff };
}

/** „40 წთ“ / „2 სთ“ / „2 სთ 15 წთ“ (Georgian) or „40 min“ / „2 h 15 min“. */
export function spanLabel(minutes: number, en: boolean): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const H = en ? 'h' : 'სთ';
  const M = en ? 'min' : 'წთ';
  if (!h) return `${m} ${M}`;
  if (!m || h >= 3) return `${h} ${H}`;
  return `${h} ${H} ${m} ${M}`;
}
