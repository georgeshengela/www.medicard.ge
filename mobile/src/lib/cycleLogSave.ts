import { syncCycleLogToHealth } from '@/lib/healthSync';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { saveCycleObservation, type CycleView } from '@/lib/cycleOffline';
import { bbtForHealthWrite } from '@/lib/cycleTemperatureImport';
import { cycleLogBodyFromForm, isBleedFlow, parseBbt } from '@/lib/cycleLogForm';

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
  options?: { markStart?: boolean },
): Promise<PersistCycleLogResult> {
  const bbtNum = parseBbt(form.bbt);
  const result = await saveCycleObservation(userId, date, cycleLogBodyFromForm(form), {
    markStart: Boolean(options?.markStart && isBleedFlow(form.flow)),
  });
  try {
    await syncCycleLogToHealth({
      date,
      flow: form.flow,
      bbt: bbtForHealthWrite(bbtNum, form.bbtFromHealth),
      cervicalMucus: form.mucus,
      isPeriodStart: options?.markStart || isBleedFlow(form.flow),
    });
  } catch {
    /* Health is best-effort and must not drop a queued observation */
  }
  // Optional notification refresh must never turn a saved observation into an unhandled rejection.
  void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) => requestEngageRefresh()).catch(() => undefined);
  void import('@/lib/funnel').then(({ trackFirstHealthAction }) => trackFirstHealthAction('cycle')).catch(() => undefined);
  return result;
}
