/**
 * Period auto-end on the hero (MEDICARD Cycle brief §9 wave 2 item 3, [კ-22]).
 *
 * The server derives `bundle.periodStatus` at read time (`server/src/lib/cyclePeriodStatus.js`): the
 * latest bleeding run is `active` through the usual length, `askStill` the day after it, then `ended`.
 * This file only decides what the hero does with it — pure, no React Native, so node tests load it:
 *   - bleeding logged today → on the period (as before);
 *   - `active` with nothing logged yet → still on the period (Flo: „მენსტრუაციის დღე 3“), never
 *     „მენსტრუაცია დაიწყო“ in the middle of one;
 *   - `askStill` → one quiet line „ჯერ კიდევ გაქვს?“ [კი · დასრულდა];
 *   - anything logged today that is not bleeding („none“ / „spotting“) or `ended` → the normal hero.
 * A status computed for another day (an offline cache across midnight) is ignored: no question, no
 * assumption — the hero falls back to today's log only. Outside the classic overview (pregnancy,
 * postpartum, perimenopause, a gated forecast, hormonal bleeding) nothing changes either.
 */
import type { CyclePeriodStatus } from '@/lib/api';
import type { CycleHeroActionId } from '@/lib/home/homeCycle';

export type PeriodBleedFlow = 'light' | 'medium' | 'heavy';

const BLEED = new Set(['light', 'medium', 'heavy']);
const isBleed = (flow: string | null | undefined): flow is PeriodBleedFlow => Boolean(flow && BLEED.has(flow));

export type HeroPeriodState = {
  /** Treat today as a period day (centre number, colour, „დასრულება“ leads). */
  onPeriod: boolean;
  /** Bleeding is logged for today (the only case that may say „აღრიცხული“). */
  loggedToday: boolean;
  /** Show „ჯერ კიდევ გაქვს?“ [კი · დასრულდა]. */
  askStill: boolean;
};

export function heroPeriodState({
  status,
  statusToday,
  today,
  todayFlow,
  enabled,
}: {
  status: CyclePeriodStatus | null | undefined;
  /** `bundle.meta.today` — the day the server derived the status for. */
  statusToday: string | null | undefined;
  today: string;
  todayFlow: string | null | undefined;
  /** Classic overview on, forecast not gated, not hormonal bleeding (the caller's gates). */
  enabled: boolean;
}): HeroPeriodState {
  const loggedToday = isBleed(todayFlow);
  if (loggedToday) return { onPeriod: true, loggedToday, askStill: false };
  // Anything she logged today that is not bleeding answers the question already.
  if (!enabled || !status || statusToday !== today || todayFlow) return { onPeriod: false, loggedToday, askStill: false };
  if (status.state === 'active') return { onPeriod: true, loggedToday, askStill: false };
  return { onPeriod: false, loggedToday, askStill: status.state === 'askStill' };
}

/**
 * The level „კი“ logs for today: the last bleeding level she logged before today, else „მსუბუქი“.
 * Only dates and flows are read.
 */
export function stillBleedingFlow(logs: ReadonlyArray<{ date: string; flow?: string | null }> | null | undefined, today: string): PeriodBleedFlow {
  let best: { date: string; flow: PeriodBleedFlow } | null = null;
  for (const log of logs ?? []) {
    if (!log || typeof log.date !== 'string' || log.date >= today || !isBleed(log.flow)) continue;
    if (!best || log.date > best.date) best = { date: log.date, flow: log.flow };
  }
  return best?.flow ?? 'light';
}

/**
 * Undo of a one-tap „დასრულდა“: put today's flow back exactly as it was — a bleeding level, an empty
 * flow on a day that had other notes, or no log at all (the end wrote a „none“ day the server created).
 */
export type PeriodEndUndo =
  | { kind: 'restoreFlow'; flow: PeriodBleedFlow }
  | { kind: 'clearFlow' }
  | { kind: 'removeLog' }
  | { kind: 'keep' };

export function periodEndUndo(before: { flow?: string | null } | null | undefined): PeriodEndUndo {
  if (before && isBleed(before.flow)) return { kind: 'restoreFlow', flow: before.flow };
  // „none“ / „spotting“ was already there — the end changed nothing on that day.
  if (before && (before.flow === 'none' || before.flow === 'spotting')) return { kind: 'keep' };
  return before ? { kind: 'clearFlow' } : { kind: 'removeLog' };
}

/**
 * On the question day „მენსტრუაცია დაიწყო“ would only repeat „კი“ in the middle of a period: it steps
 * aside (a leading start becomes today's log, a secondary start disappears). Every other day: unchanged.
 */
export function heroPlanWhileAsking(
  plan: { primary: CycleHeroActionId; secondary: CycleHeroActionId | null },
  askStill: boolean,
): { primary: CycleHeroActionId; secondary: CycleHeroActionId | null } {
  if (!askStill) return plan;
  if (plan.primary === 'start') return { primary: 'log', secondary: null };
  return { primary: plan.primary, secondary: plan.secondary === 'start' ? null : plan.secondary };
}
