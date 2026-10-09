/**
 * Which funnel events a cycle-day save produces (brief §9 wave 1 item 7). Pure: node tests load it.
 *
 * Only WHERE it happened leaves the device (an enum); what was logged — flow, symptoms, sex, tests —
 * is read here on the device to decide whether a period started, and never sent.
 */
import type { CycleLogSource, CyclePeriodStartSource } from './funnelQueue';

const BLEED = new Set(['light', 'medium', 'heavy']);
const bleeds = (flow: string | null | undefined) => BLEED.has(String(flow ?? ''));

/** The civil day before `date` (YYYY-MM-DD), or null for anything else. */
export function previousDay(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - 1));
  return d.toISOString().slice(0, 10);
}

/**
 * The period-start source for one successful save, or null.
 * - „დღეს დაიწყო“ (`markStart`) in the quick log: Home → `home`, day sheet → `day_sheet`, the cycle
 *   screen's sheet → `hero` (its start intent comes from the hero).
 * - The day sheet without the button: bleeding saved on a day that had none, after a day without
 *   bleeding (a past period start marked from the calendar) → `day_sheet`.
 * The full log never reports a start (its flow row is an edit, not the „მენსტრუაცია დაიწყო“ action).
 */
export function periodStartFromSave(opts: {
  source: CycleLogSource;
  markStart?: boolean;
  date: string;
  prevFlow: string | null | undefined;
  nextFlow: string | null | undefined;
  logs: ReadonlyArray<{ date: string; flow?: string | null }>;
}): CyclePeriodStartSource | null {
  const { source, markStart, date, prevFlow, nextFlow, logs } = opts;
  if (source === 'full') return null;
  if (markStart) return source === 'home' ? 'home' : source === 'day_sheet' ? 'day_sheet' : 'hero';
  if (source !== 'day_sheet') return null;
  if (bleeds(prevFlow) || !bleeds(nextFlow)) return null;
  const before = previousDay(date);
  if (!before) return null;
  return logs.some((log) => log.date === before && bleeds(log.flow)) ? null : 'day_sheet';
}
