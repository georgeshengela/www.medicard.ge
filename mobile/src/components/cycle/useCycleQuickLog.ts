import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { ka } from '@/i18n/ka';
import type { CycleLog } from '@/lib/api';
import { sameLogForm } from '@/lib/cycleDayFacts';
import { expectationsFromBundle, type CycleExpectation } from '@/lib/cycleExpectations';
import { cyclePresentationModeKnown } from '@/lib/cycleHistoryCopy';
import { EMPTY_CYCLE_LOG, formFromCycleLog, isBleedFlow, persistCycleLog } from '@/lib/cycleLogSave';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { loadCycleView, type CycleView } from '@/lib/cycleOffline';
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
  retry: () => void;
  /** Persist the day; `markStart` turns a non-bleeding flow into „medium“ (the „დღეს დაიწყო“ button). Resolves true when saved. */
  save: (markStart?: boolean) => Promise<boolean>;
  /** Drop unsaved edits and go back to the stored day. */
  reset: () => void;
};

/**
 * One hydrate/save path for every quick-log surface (the quick-log sheet and the day sheet share it):
 * reads the cached cycle view for `date`, builds the form, knows the mode, the recent logs (for
 * „ბოლოს აღნიშნული“) and the local expectations, and saves through `persistCycleLog` (offline queue,
 * Health write-back, cache put). The result's view is handed to `onSaved` so the screen can show it
 * without a reload.
 */
export function useCycleQuickLog({
  active,
  date,
  userId,
  onSaved,
}: {
  active: boolean;
  date: string;
  userId: string | undefined;
  onSaved: (view?: CycleView | null) => void;
}): CycleQuickLogState {
  const [form, setForm] = useState<CycleLogForm>(EMPTY_CYCLE_LOG);
  const [base, setBase] = useState<CycleLogForm>(EMPTY_CYCLE_LOG);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const [logs, setLogs] = useState<CycleLog[]>([]);
  const [expected, setExpected] = useState<CycleExpectation[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const saveTask = useAnalysisTask(`cycle-quick:${userId}:${date}:${active}`);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    if (!active || !userId) return;
    let alive = true;
    setSaveError(null);
    setSaving(false);
    setHydrated(false);
    setMode(null);
    void loadCycleView(userId)
      .then((view) => {
        if (!alive) return;
        const next = formFromCycleLog(view.display.logs.find((l) => l.date === date));
        setForm(next);
        setBase(next);
        setMode(view.display.profile.mode);
        setLogs(view.display.logs);
        setExpected(expectationsFromBundle(view.display, date));
        setHydrated(true);
      })
      .catch(() => {
        if (!alive) return;
        setSaveError(ka.cycle.assessmentLoadError);
        setHydrated(false);
      });
    return () => {
      alive = false;
    };
  }, [active, date, userId, loadAttempt]);

  const caps = useMemo(() => (cyclePresentationModeKnown(mode) ? cycleModeCapabilities(mode) : null), [mode]);
  const dirty = hydrated && !sameLogForm(form, base);

  const patch = useCallback((p: Partial<CycleLogForm>) => setForm((prev) => ({ ...prev, ...p })), []);
  const reset = useCallback(() => setForm(base), [base]);
  const retry = useCallback(() => setLoadAttempt((n) => n + 1), []);

  const save = useCallback(
    async (markStart?: boolean): Promise<boolean> => {
      if (!active || !hydrated || saving || !userId) return false;
      const ticket = saveTask.begin();
      if (!ticket) return false;
      setSaving(true);
      setSaveError(null);
      try {
        const next = { ...form, flow: markStart && !isBleedFlow(form.flow) ? 'medium' : form.flow };
        const result = await persistCycleLog(userId, date, next, { markStart });
        if (!ticket.current()) return false;
        if (!result.view && !result.synced && !result.persistedLocally && !result.sessionOnly) {
          setSaveError(ka.cycle.saveNotPersisted);
          return false;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
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
    [active, hydrated, saving, userId, form, date, saveTask],
  );

  return { form, patch, dirty, hydrated, saving, saveError, mode, caps, logs, expected, retry, save, reset };
}
