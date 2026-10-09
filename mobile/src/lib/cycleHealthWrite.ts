/**
 * What one cycle-day save writes to Apple Health / Health Connect (CYC-03). Pure: node tests load it.
 *
 * Health samples are never edited or deleted by Medicard, so every write adds a sample. A save of the
 * whole day (a mood, the ♥ one-tap, re-opening the full log) therefore writes only what this save
 * changed against the day as it was stored (`base`, the hydrated form), and marks a cycle start only
 * for a real new period start: bleeding on a day that had none, after a day without bleeding — or the
 * „დღეს დაიწყო“ button. Nothing changed → null, and the caller makes no Health call at all.
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
 * The flow logged the day before `date`; null = no bleeding logged there; undefined = the logs are
 * not known (then only the explicit start button marks a start).
 */
export function previousDayFlow(
  logs: ReadonlyArray<{ date: string; flow?: string | null }> | null | undefined,
  date: string,
): string | null | undefined {
  if (!logs) return undefined;
  const before = previousDay(date);
  if (!before) return undefined;
  return logs.find((log) => log.date === before)?.flow ?? null;
}

export function planCycleHealthWrite({
  date,
  form,
  base,
  markStart,
  prevDayFlow,
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
  /** `previousDayFlow(logs, date)`. */
  prevDayFlow?: string | null;
}): CycleHealthPayload | null {
  const flow = form.flow ?? null;
  const baseFlow = base?.flow ?? null;
  const newStart =
    isBleedFlow(flow) &&
    !isBleedFlow(baseFlow) &&
    (Boolean(markStart) || (base !== undefined && prevDayFlow !== undefined && !isBleedFlow(prevDayFlow)));
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
