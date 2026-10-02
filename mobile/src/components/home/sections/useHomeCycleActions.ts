import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ka } from '@/i18n/ka';
import { queueApplyPeriod, type CycleView } from '@/lib/cycleOffline';
import { putCycleView } from '@/lib/cycleViewCache';
import { getCycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { syncCycleReminders } from '@/lib/cycleReminders';
import { localAccountId } from '@/lib/localAccount';

/**
 * Home's one-tap cycle actions — the same library calls as the cycle screen
 * (`app/cycle/index.tsx` startPeriodNow / undoPeriodStart / endPeriod, without the sex one-tap):
 * offline-safe `queueApplyPeriod`, the returned view goes into the shared cache, an 8 s toast offers
 * „გამონადენი“ and „გაუქმება“. Reminders are rescheduled once the saved view is synced (the cycle
 * screen does that in its view effect; Home only after its own writes).
 */

// ---------- toast bridge (the toast sits outside Home's ScrollView, above the tab bar) ----------

export type HomeCycleToast = { date: string; onAddFlow: () => void; onUndo: () => void };

let toastEntry: HomeCycleToast | null = null;
let hostCount = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function setToastEntry(next: HomeCycleToast | null) {
  if (toastEntry === next) return;
  toastEntry = next;
  emit();
}

/** The current period-start toast (read by `HomeCycleToastHost`). */
export function useHomeCycleToastEntry(): HomeCycleToast | null {
  return useSyncExternalStore(subscribe, () => toastEntry, () => toastEntry);
}

/** Whether a toast host is mounted; without one the hero shows the toast inside its own section. */
export function useHomeCycleToastHosted(): boolean {
  return useSyncExternalStore(subscribe, () => hostCount > 0, () => hostCount > 0);
}

/** Called by the host on mount; returns its cleanup. */
export function registerHomeCycleToastHost(): () => void {
  hostCount += 1;
  emit();
  return () => {
    hostCount = Math.max(0, hostCount - 1);
    emit();
  };
}

// ---------- actions ----------

export type HomeCycleSheet = { visible: boolean; date: string; periodStart: boolean };

export type HomeCycleActions = {
  busy: boolean;
  error: string | null;
  /** Date of the period start the toast is about (null = no toast). */
  toastDate: string | null;
  sheet: HomeCycleSheet;
  startPeriod: () => void;
  endPeriod: () => void;
  undoStart: (date: string) => void;
  addFlow: (date: string) => void;
  openLog: (date?: string, periodStart?: boolean) => void;
  closeSheet: () => void;
  onSheetSaved: (view?: CycleView | null) => void;
  openFullLog: () => void;
};

const TOAST_MS = 8000;
const ERROR_MS = 6000;

export function useHomeCycleActions({
  userId,
  today,
  view,
  retry,
}: {
  userId: string | null | undefined;
  /** `cycleToday(bundle, todayKey())` — the server's day, never behind the device. */
  today: string;
  /** The root's cached view (null while locked / loading). */
  view: CycleView | null;
  /** The root's re-read of the cycle view. */
  retry: () => void;
}): HomeCycleActions {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastDate, setToastDate] = useState<string | null>(null);
  const [sheet, setSheet] = useState<HomeCycleSheet>({ visible: false, date: today, periodStart: false });
  const busyRef = useRef(false);
  const remindersDirty = useRef(false);
  // The root may pass a fresh `retry` every render; keep callbacks (and the published toast) stable.
  const retryRef = useRef(retry);
  retryRef.current = retry;
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const fail = useCallback((err: unknown) => {
    if (alive.current) setError(err instanceof Error && err.message ? err.message : ka.common.error);
  }, []);

  /** Reminders follow a synced view only (the cycle screen's rule: never schedule from an optimistic one). */
  const syncReminders = useCallback(
    async (next: CycleView) => {
      if (!userId || localAccountId() !== userId) return;
      if (next.stale || next.pendingCount > 0) {
        remindersDirty.current = true;
        return;
      }
      remindersDirty.current = false;
      try {
        await syncCycleReminders(next.canonical, await getCycleReminderPrefs());
      } catch {
        /* A reminder failure must not undo a saved day. */
      }
    },
    [userId],
  );

  // The queue flushes and the root re-reads the view; once it is synced, reschedule (Home writes only).
  useEffect(() => {
    if (remindersDirty.current && view && !view.stale && view.pendingCount === 0) void syncReminders(view);
  }, [view, syncReminders]);

  /** After a save from Home: the view goes into the shared cache (every cycle reader updates). */
  const showView = useCallback(
    (next: CycleView | null | undefined) => {
      if (!userId) return;
      if (!next) {
        remindersDirty.current = true;
        retryRef.current();
        return;
      }
      putCycleView(userId, next);
      void syncReminders(next);
    },
    [userId, syncReminders],
  );

  const startPeriod = useCallback(() => {
    if (!userId || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const result = await queueApplyPeriod(userId, { action: 'start', date: today });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        showView(result.view);
        if (alive.current) setToastDate(today);
      } catch (err) {
        fail(err);
      } finally {
        busyRef.current = false;
        if (alive.current) setBusy(false);
      }
    })();
  }, [userId, today, showView, fail]);

  const undoStart = useCallback(
    (date: string) => {
      if (!userId) return;
      setToastDate(null);
      void (async () => {
        try {
          // "end" on the first day clears that one-day period again (server planEndPeriod).
          const result = await queueApplyPeriod(userId, { action: 'end', date });
          showView(result.view);
        } catch (err) {
          fail(err);
        }
      })();
    },
    [userId, showView, fail],
  );

  const endPeriod = useCallback(() => {
    Alert.alert(ka.cycle.periodEndCta, ka.cycle.periodEndHint, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.cycle.periodEndCta,
        onPress: () => {
          if (!userId) return;
          void (async () => {
            try {
              const result = await queueApplyPeriod(userId, { action: 'end', date: today });
              showView(result.view);
            } catch (err) {
              fail(err);
            }
          })();
        },
      },
    ]);
  }, [userId, today, showView, fail]);

  const openLog = useCallback(
    (date?: string, periodStart = false) => {
      setSheet({ visible: true, date: date ?? today, periodStart });
    },
    [today],
  );

  const addFlow = useCallback(
    (date: string) => {
      setToastDate(null);
      openLog(date);
    },
    [openLog],
  );

  const closeSheet = useCallback(() => setSheet((prev) => ({ ...prev, visible: false, periodStart: false })), []);

  const openFullLog = useCallback(() => {
    const date = sheet.date;
    setSheet((prev) => ({ ...prev, visible: false, periodStart: false }));
    router.push({ pathname: '/cycle/log', params: { date } } as never);
  }, [router, sheet.date]);

  // Toast and error fade on their own (same 8 s as the cycle screen).
  useEffect(() => {
    if (!toastDate) return;
    const t = setTimeout(() => setToastDate(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toastDate]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), ERROR_MS);
    return () => clearTimeout(t);
  }, [error]);

  // Publish the toast for the host outside the ScrollView; withdraw it when it ends or Home unmounts.
  const handlers = useRef({ addFlow, undoStart });
  handlers.current = { addFlow, undoStart };
  useEffect(() => {
    if (!toastDate) {
      setToastEntry(null);
      return;
    }
    const entry: HomeCycleToast = {
      date: toastDate,
      onAddFlow: () => handlers.current.addFlow(toastDate),
      onUndo: () => handlers.current.undoStart(toastDate),
    };
    setToastEntry(entry);
    return () => {
      if (toastEntry === entry) setToastEntry(null);
    };
  }, [toastDate]);

  return {
    busy,
    error,
    toastDate,
    sheet,
    startPeriod,
    endPeriod,
    undoStart,
    addFlow,
    openLog,
    closeSheet,
    onSheetSaved: showView,
    openFullLog,
  };
}
