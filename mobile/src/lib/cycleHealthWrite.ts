/**
 * What one cycle-day save writes to Apple Health / Health Connect (CYC-03). Pure: node tests load it.
 *
 * Health samples are never edited or deleted by Medicard, so every write adds a sample. A save of the
 * whole day (a mood, the ♥ one-tap, re-opening the full log) therefore writes only what this save
 * changed against the day as it was stored (`base`, the hydrated form), and marks a cycle start only
 * for a real new period start: bleeding on a day that had none, where the logs show no period running
 * into it (the server's own rule, gap days included) — or the „დღეს დაიწყო“ button. Nothing changed →
 * null, and the caller makes no Health call at all.
 */
import type { CycleHealthPayload } from './healthSync.shared';
import type { CycleLogForm } from '../components/cycle/CycleLogTabs';
import { isBleedFlow, parseBbt } from './cycleLogForm.ts';
import { previousDay } from './cycleFunnelEvents.ts';
import { bbtForHealthWrite } from './cycleTemperatureImport.ts';

/** Flows that map to a Health sample (none is never written). */
const WRITABLE_FLOWS = new Set(['spotting', 'light', 'medium', 'heavy']);

const centi = (value: number) => Math.round(value * 100);

export type CycleHealthDay = Pick<CycleLogForm, 'flow' | 'bbt' | 'mucus'>;

/**
 * Unlogged (or spotting-only) days the server still bridges inside one period — people skip logging
 * (server `cycle.js` PERIOD_MERGE_MAX_INTERIOR_DAYS). An explicit „no bleeding“ day always ends it.
 */
const PERIOD_BRIDGE_DAYS = 2;

/**
 * Whether bleeding on `date` continues a period already logged before it: bleeding on one of the
 * 1 + PERIOD_BRIDGE_DAYS days before, with no explicit „no bleeding“ day in between (as the server
 * groups periods). false = a new period; undefined = the logs are not known (then only the explicit
 * start button marks a start). The server's 10-day span cap is not checked — that only errs toward
 * fewer starts.
 */
export function continuesLoggedPeriod(
  logs: ReadonlyArray<{ date: string; flow?: string | null }> | null | undefined,
  date: string,
): boolean | undefined {
  if (!logs) return undefined;
  let day: string | null = date;
  for (let i = 0; i <= PERIOD_BRIDGE_DAYS; i += 1) {
    day = previousDay(day);
    if (!day) return undefined;
    const flow = logs.find((log) => log.date === day)?.flow ?? null;
    if (isBleedFlow(flow)) return true;
    if (flow === 'none') return false;
  }
  return false;
}

export function planCycleHealthWrite({
  date,
  form,
  base,
  markStart,
  continuesPeriod,
}: {
  date: string;
  /** The day as saved now. */
  form: CycleHealthDay & Pick<CycleLogForm, 'bbtFromHealth'>;
  /**
   * The day as it was stored before this save (the hydrated form); null = nothing was stored.
   * undefined = not known: nothing is deduplicated and only the start button marks a start.
   */
  base?: CycleHealthDay | null;
  /** „დღეს დაიწყო“ in the quick log. */
  markStart?: boolean;
  /** `continuesLoggedPeriod(logs, date)`. */
  continuesPeriod?: boolean;
}): CycleHealthPayload | null {
  const flow = form.flow ?? null;
  const baseFlow = base?.flow ?? null;
  const newStart =
    isBleedFlow(flow) &&
    !isBleedFlow(baseFlow) &&
    (Boolean(markStart) || (base !== undefined && continuesPeriod === false));
  const writeFlow = flow != null && WRITABLE_FLOWS.has(flow) && (newStart || flow !== baseFlow);

  // A BBT that came from Health unchanged is never written back (the temperature import's rule).
  const bbt = bbtForHealthWrite(parseBbt(form.bbt), form.bbtFromHealth);
  const baseBbt = parseBbt(base?.bbt ?? '');
  const writeBbt = bbt != null && Number.isFinite(bbt) && (baseBbt == null || centi(bbt) !== centi(baseBbt));

  const mucus = form.mucus ?? null;
  const writeMucus = mucus != null && mucus !== (base?.mucus ?? null);

  if (!writeFlow && !writeBbt && !writeMucus) return null;
  return {
    date,
    flow: writeFlow ? flow : null,
    bbt: writeBbt ? bbt : null,
    cervicalMucus: writeMucus ? mucus : null,
    isPeriodStart: writeFlow && newStart,
  };
}

/**
 * The one-tap „მენსტრუაცია დაიწყო“ (Home hero, /cycle hero, the widget — IR-6) stores `medium` on the day
 * outside `persistCycleLog`, so its callers write it to Health themselves: that day as a cycle start, or
 * nothing when bleeding was already logged there (the tap changed nothing). Later sheet saves of the day
 * then add only what they change. `before` = the day's row before the tap. Only those two callers use
 * it — never `queueApplyPeriod`, which the month editor also uses to add a day to a past period.
 */
export function periodStartTapHealthWrite(
  date: string,
  before: { flow?: string | null } | null | undefined,
): CycleHealthPayload | null {
  // The server keeps a logged light / heavy as it was (`alreadyLogged`): never a `medium` sample over it.
  if (isBleedFlow(before?.flow ?? null)) return null;
  return planCycleHealthWrite({
    date,
    form: { flow: 'medium', bbt: '', mucus: null, bbtFromHealth: null },
    base: { flow: before?.flow ?? null, bbt: '', mucus: null },
    markStart: true,
  });
}
