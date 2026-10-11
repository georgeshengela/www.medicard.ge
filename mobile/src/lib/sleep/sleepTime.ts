/**
 * MEDISLEEP clock math (pure — node tests load it). Local device time throughout: a plan's „07:00“ is 07:00
 * wherever the phone is. Nights belong to the morning they end (days run 18:00 → 18:00, the Health rule in
 * sleepNights.ts and the server's nightOf).
 */
import { tx } from '../../i18n/locale.js';
import type { SleepPlan } from './sleepTypes';

const MINUTE = 60_000;
const DAY = 86_400_000;

export function pad2(n: number): string {
  return String(Math.trunc(n)).padStart(2, '0');
}

/** Minutes after midnight → „07:05“. */
export function hhmm(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

export function clockOf(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function parseHHMM(value: string | null | undefined): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** „7 სთ 30 წთ“ / „7 h 30 min“; `short` drops a zero part („8 სთ“). */
export function formatDuration(minutes: number | null | undefined, { short = true } = {}): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hs = tx(`${h} სთ`, `${h} h`);
  const ms = tx(`${m} წთ`, `${m} min`);
  if (short && h === 0) return ms;
  if (short && m === 0) return hs;
  return `${hs} ${ms}`;
}

/** Compact „7:30“ for chart labels and widgets. */
export function formatHoursCompact(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}:${pad2(total % 60)}`;
}

export function ymd(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** The night a wake-up belongs to (local 18:00 → 18:00 days). */
export function nightOf(wakeAt: Date): string {
  return ymd(new Date(wakeAt.getTime() + 6 * 60 * MINUTE));
}

export function isWeekendDay(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

/** Wake time (minutes after midnight) that applies on `date`'s morning. */
export function wakeMinutesFor(plan: Pick<SleepPlan, 'wakeTime' | 'weekendWakeTime'>, date: Date): number {
  const weekend = isWeekendDay(date) && plan.weekendWakeTime ? parseHHMM(plan.weekendWakeTime) : null;
  return weekend ?? parseHHMM(plan.wakeTime) ?? 7 * 60;
}

/** Same rule as the server: goal sleep plus ~15 minutes to fall asleep before the wake time. */
export const FALL_ASLEEP_MINUTES = 15;

export function plannedBedtimeMinutes(plan: Pick<SleepPlan, 'goalMinutes' | 'wakeTime' | 'weekendWakeTime'>, morning: Date): number {
  const wake = wakeMinutesFor(plan, morning);
  return (((wake - plan.goalMinutes - FALL_ASLEEP_MINUTES) % 1440) + 1440) % 1440;
}

function atMinutes(day: Date, minutes: number): Date {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  return new Date(d.getTime() + minutes * MINUTE);
}

/** The next wake-up from now (today's if still ahead, otherwise tomorrow's). */
export function nextWake(plan: Pick<SleepPlan, 'wakeTime' | 'weekendWakeTime'>, now: Date): Date {
  const today = atMinutes(now, wakeMinutesFor(plan, now));
  if (today.getTime() > now.getTime()) return today;
  const tomorrow = new Date(now.getTime() + DAY);
  return atMinutes(tomorrow, wakeMinutesFor(plan, tomorrow));
}

/** Tonight's window: the bedtime that leads into the next wake-up. */
export function tonight(plan: SleepPlan, now: Date): { bedtime: Date; wake: Date; windDown: Date } {
  const wake = nextWake(plan, now);
  const bedtime = new Date(wake.getTime() - (plan.goalMinutes + FALL_ASLEEP_MINUTES) * MINUTE);
  const windDown = new Date(bedtime.getTime() - plan.windDownMinutes * MINUTE);
  return { bedtime, wake, windDown };
}

/**
 * Bedtimes for whole 90-minute sleep cycles before a wake-up (the „როდის დავწვე?“ calculator): 6, 5 and 4
 * cycles plus the time to fall asleep. Cycles are an average, not a measurement — the copy says so.
 */
export function cycleBedtimes(wake: Date, cycles: number[] = [6, 5, 4]): { cycles: number; bedtime: Date; sleepMinutes: number }[] {
  return cycles.map((n) => ({
    cycles: n,
    sleepMinutes: n * 90,
    bedtime: new Date(wake.getTime() - (n * 90 + FALL_ASLEEP_MINUTES) * MINUTE),
  }));
}

/** Wake-ups for whole cycles if she goes to bed now. */
export function cycleWakeups(now: Date, cycles: number[] = [4, 5, 6]): { cycles: number; wake: Date; sleepMinutes: number }[] {
  return cycles.map((n) => ({
    cycles: n,
    sleepMinutes: n * 90,
    wake: new Date(now.getTime() + (n * 90 + FALL_ASLEEP_MINUTES) * MINUTE),
  }));
}

export type DayPhase = 'evening' | 'night' | 'morning' | 'day';

/**
 * What the hub leads with: the evening (from 3 h before bedtime) and the night lead with tonight; the morning
 * (until 5 h after the wake-up) leads with last night and the check-in.
 */
export function dayPhase(plan: SleepPlan | null, now: Date): DayPhase {
  const h = now.getHours() + now.getMinutes() / 60;
  if (!plan) return h >= 19 || h < 4 ? 'evening' : h < 11 ? 'morning' : 'day';
  const { bedtime, wake } = tonight(plan, now);
  const lastWake = new Date(wake.getTime() - DAY);
  if (now.getTime() >= bedtime.getTime() && now.getTime() < wake.getTime()) return 'night';
  if (now.getTime() >= bedtime.getTime() - 3 * 60 * MINUTE) return 'evening';
  if (now.getTime() - lastWake.getTime() < 5 * 60 * MINUTE && now.getTime() >= lastWake.getTime()) return 'morning';
  return 'day';
}

/** Minutes until a moment, rounded, never negative. */
export function minutesUntil(target: Date, now: Date): number {
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / MINUTE));
}

/** „23:00-მდე 2 სთ 10 წთ“ style countdown words. */
export function countdownWords(target: Date, now: Date): string {
  return formatDuration(minutesUntil(target, now), { short: true });
}
