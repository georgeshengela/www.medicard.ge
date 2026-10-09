import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { ka } from '@/i18n/ka';
import { cycleDayFormStep, EMPTY_CYCLE_LOG, formFromCycleLog, rebaseCycleForm, type CycleDayFill } from '@/lib/cycleLogForm';
import type { CycleView } from '@/lib/cycleOffline';
import { useCycleView } from '@/lib/cycleViewCache';
import { localAccountId } from '@/lib/localAccount';

export type CycleDayFormState = {
  form: CycleLogForm;
  setForm: React.Dispatch<React.SetStateAction<CycleLogForm>>;
  /** The day as stored when the form was (re)filled — `dirty` and the Health write compare against it. */
  base: CycleLogForm;
  setBase: React.Dispatch<React.SetStateAction<CycleLogForm>>;
  /** The form holds this account's stored day (Save may run). */
  hydrated: boolean;
  /** The cached view the form was filled from (this account only), or null. */
  view: CycleView | null;
  /** Nothing cached and the read failed. */
  loadError: string | null;
  retry: () => void;
};

/**
 * The stored day for a cycle sheet (quick log, day sheet, sex sheet), read through the shared cached
 * cycle view (TanStack, stale-while-revalidate — CYC-09): a cached view fills the form before the first
 * paint and a day swipe needs no network; only an empty cache waits for the read. A background refresh
 * that lands while the sheet is open updates every field she has not touched (`rebaseCycleForm`).
 * Only the signed-in account's view is ever used.
 */
export function useCycleDayForm({
  active,
  date,
  userId,
}: {
  active: boolean;
  date: string;
  userId: string | undefined;
}): CycleDayFormState {
  const owner = Boolean(userId) && localAccountId() === userId;
  const viewQuery = useCycleView(userId, active && owner);
  const view = active && owner ? (viewQuery.data ?? null) : null;
  const stamp = viewQuery.dataUpdatedAt;
  const [form, setForm] = useState<CycleLogForm>(EMPTY_CYCLE_LOG);
  const [base, setBase] = useState<CycleLogForm>(EMPTY_CYCLE_LOG);
  const [filled, setFilled] = useState<CycleDayFill | null>(null);
  const formRef = useRef(form);
  formRef.current = form;
  const baseRef = useRef(base);
  baseRef.current = base;
  const key = `${userId ?? ''}:${date}`;

  // Layout effect: a cached day is in the form before the sheet paints (no spinner frame).
  useLayoutEffect(() => {
    if (!active || !owner) {
      setFilled(null);
      return;
    }
    if (!view) return;
    const step = cycleDayFormStep(filled, key, stamp);
    if (step === 'keep') return;
    const stored = formFromCycleLog(view.display.logs.find((l) => l.date === date));
    setForm(step === 'fill' ? stored : rebaseCycleForm(formRef.current, baseRef.current, stored));
    setBase(stored);
    setFilled({ key, stamp });
  }, [active, owner, view, stamp, key, date, filled]);

  const { refetch } = viewQuery;
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const hydrated = Boolean(view) && filled?.key === key;
  const loadError = !view && active && owner && viewQuery.isError && viewQuery.fetchStatus === 'idle' ? ka.cycle.assessmentLoadError : null;
  return { form, setForm, base, setBase, hydrated, view: hydrated ? view : null, loadError, retry };
}
