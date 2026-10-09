import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { useCycleDayForm } from '@/components/cycle/useCycleDayForm';
import { ka } from '@/i18n/ka';
import type { CycleLog } from '@/lib/api';
import { cycleToday } from '@/lib/cycleCanonical';
import { sameLogForm } from '@/lib/cycleDayFacts';
import { expectationsFromBundle, type CycleExpectation } from '@/lib/cycleExpectations';
import { cyclePresentationModeKnown } from '@/lib/cycleHistoryCopy';
import { isBleedFlow, persistCycleLog } from '@/lib/cycleLogSave';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { periodStartFromSave } from '@/lib/cycleFunnelEvents';
import { trackCycleLogSaved, trackCyclePeriodStarted } from '@/lib/funnel';
import type { CycleLogSource } from '@/lib/funnelQueue';
import type { CycleView } from '@/lib/cycleOffline';
import { useAnalysisTask } from '@/lib/useAnalysisTask';

export type CycleQuickLogCaps = ReturnType<typeof cycleModeCapabilities>;

export type CycleQuickLogState = {
  form: CycleLogForm;
  patch: (patch: Partial<CycleLogForm>) => void;
  /** The form as it was hydrated from the stored log — `dirty` compares against it. */
  dirty: boolean;
  hydrated: boolean;
  saving: boolean;
  saveError: string | null;
  mode: string | null;
  caps: CycleQuickLogCaps | null;
  logs: CycleLog[];
  expected: CycleExpectation[];
  /** The cycle's civil today (the server's day, never behind the device). */
  today: string;
  retry: () => void;
  /** Persist the day; `markStart` turns a non-bleeding flow into „medium“ (the „დღეს დაიწყო“ button). Resolves true when saved. */
  save: (markStart?: boolean) => Promise<boolean>;
  /** Drop unsaved edits and go back to the stored day. */
  reset: () => void;
};

/**
 * One hydrate/save path for every quick-log surface (the quick-log sheet and the day sheet share it):
 * reads the shared cached cycle view for `date` (`useCycleDayForm`: no download behind a spinner on
 * every open or day swipe — CYC-09), builds the form, knows the mode, the recent logs (for
 * „ბოლოს აღნიშნული“) and the local expectations, and saves through `persistCycleLog` (offline queue,
 * Health write-back, cache put). The result's view is handed to `onSaved` so the screen can show it
 * without a reload.
 */
export function useCycleQuickLog({
  active,
  date,
  userId,
  onSaved,
  funnelSource,
}: {
  active: boolean;
  date: string;
  userId: string | undefined;
  onSaved: (view?: CycleView | null) => void;
  /** Where the save happened, for the funnel (an enum only — never what was logged). */
  funnelSource: Exclude<CycleLogSource, 'full'>;
}): CycleQuickLogState {
  const { form, setForm, base, setBase, hydrated, view, loadError, retry } = useCycleDayForm({ active, date, userId });
  const [saving, setSaving] = useState(false);
  const [saveFailure, setSaveError] = useState<string | null>(null);
  const saveTask = useAnalysisTask(`cycle-quick:${userId}:${date}:${active}`);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    if (!active || !userId) return;
    setSaveError(null);
    setSaving(false);
  }, [active, date, userId]);

  const bundle = view?.display ?? null;
  const mode = bundle?.profile.mode ?? null;
  const logs = useMemo<CycleLog[]>(() => bundle?.logs ?? [], [bundle]);
  const expected = useMemo(() => expectationsFromBundle(bundle, date), [bundle, date]);
  const today = cycleToday(bundle, todayKey());
  const saveError = saveFailure ?? loadError;

  const caps = useMemo(() => (cyclePresentationModeKnown(mode) ? cycleModeCapabilities(mode) : null), [mode]);
  const dirty = hydrated && !sameLogForm(form, base);

  const patch = useCallback((p: Partial<CycleLogForm>) => setForm((prev) => ({ ...prev, ...p })), [setForm]);
  const reset = useCallback(() => setForm(base), [base, setForm]);

  const save = useCallback(
    async (markStart?: boolean): Promise<boolean> => {
      if (!active || !hydrated || saving || !userId) return false;
      const ticket = saveTask.begin();
      if (!ticket) return false;
      setSaving(true);
      setSaveError(null);
      try {
        const next = { ...form, flow: markStart && !isBleedFlow(form.flow) ? 'medium' : form.flow };
        const result = await persistCycleLog(userId, date, next, { markStart, base });
        if (!ticket.current()) return false;
        if (!result.view && !result.synced && !result.persistedLocally && !result.sessionOnly) {
          setSaveError(ka.cycle.saveNotPersisted);
          return false;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        trackCycleLogSaved(funnelSource);
        const started = periodStartFromSave({ source: funnelSource, markStart, date, prevFlow: base.flow, nextFlow: next.flow, logs });
        if (started) trackCyclePeriodStarted(started);
        setBase(next);
        setForm(next);
        onSavedRef.current(result.view);
        return true;
      } catch (err) {
        if (ticket.current()) setSaveError(err instanceof Error ? err.message : ka.cycle.saveNotPersisted);
        return false;
      } finally {
        if (ticket.current()) setSaving(false);
        ticket.finish();
      }
    },
    [active, hydrated, saving, userId, form, base, logs, date, saveTask, funnelSource, setBase, setForm],
  );

  return { form, patch, dirty, hydrated, saving, saveError, mode, caps, logs, expected, today, retry, save, reset };
}
