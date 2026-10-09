import { syncCycleLogToHealth } from '@/lib/healthSync';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { saveCycleObservation, type CycleView } from '@/lib/cycleOffline';
import { cyclePersistFeedback } from '@/lib/cycleOfflineCore';
import { planCycleHealthWrite, previousDayFlow, type CycleHealthDay } from '@/lib/cycleHealthWrite';
import { cycleLogBodyFromForm, isBleedFlow } from '@/lib/cycleLogForm';

export { EMPTY_CYCLE_LOG, formFromCycleLog, isBleedFlow, parseBbt } from '@/lib/cycleLogForm';

export type PersistCycleLogResult = {
  view: CycleView | null;
  synced: boolean;
  persistedLocally: boolean;
  sessionOnly?: boolean;
};

export async function persistCycleLog(
  userId: string,
  date: string,
  form: CycleLogForm,
  options?: {
    markStart?: boolean;
    /** The day as it was stored before this save (the hydrated form): Health gets only what changed. */
    base?: CycleHealthDay | null;
  },
): Promise<PersistCycleLogResult> {
  const result = await saveCycleObservation(userId, date, cycleLogBodyFromForm(form), {
    markStart: Boolean(options?.markStart && isBleedFlow(form.flow)),
  });
  // Apple Health / Health Connect (CYC-03): only what this save changed, a cycle start only for a real
  // new period start, never when nothing was stored. Fire-and-forget: it never fails, blocks or delays
  // the save, and never asks for Health access (syncCycleLogToHealth only writes when sync is on).
  if (cyclePersistFeedback(result) !== 'fail') {
    const health = planCycleHealthWrite({
      date,
      form,
      base: options?.base,
      markStart: options?.markStart,
      prevDayFlow: previousDayFlow(result.view?.display.logs, date),
    });
    if (health) void syncCycleLogToHealth(health).catch(() => undefined);
  }
  // Optional notification refresh must never turn a saved observation into an unhandled rejection.
  void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) => requestEngageRefresh()).catch(() => undefined);
  void import('@/lib/funnel').then(({ trackFirstHealthAction }) => trackFirstHealthAction('cycle')).catch(() => undefined);
  return result;
}
