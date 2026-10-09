import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ka } from '@/i18n/ka';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { periodToastTitle } from '@/components/cycle/CyclePeriodToast';
import { formFromCycleLog, persistCycleLog } from '@/lib/cycleLogSave';
import { periodStartTone } from '@/lib/cycleTone';
import { queueApplyPeriod, queueRemoveCycleLog, saveCycleObservation, undoQueuedPeriodStart, type CycleView } from '@/lib/cycleOffline';
import { periodEndUndo, periodStartUndo, stillBleedingFlow, type PeriodEndUndo, type PeriodStartUndo } from '@/lib/cyclePeriodStatus';
import { tx } from '@/i18n/locale';
import { putCycleView } from '@/lib/cycleViewCache';
import { getCycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { syncCycleReminders } from '@/lib/cycleReminders';
import { localAccountId } from '@/lib/localAccount';
import { trackCyclePeriodStarted } from '@/lib/funnel';

/**
 * Home's one-tap cycle actions — the same library calls as the cycle screen
 * (`app/cycle/index.tsx` startPeriodNow / undoPeriodStart / endPeriod / logSexNow / undoSex):
 * offline-safe `queueApplyPeriod`, the returned view goes into the shared cache, an 8 s toast offers
 * „სისხლდენა“ and „გაუქმება“. Ending the period is one tap too (brief §8.2 item 12): today's bleeding
 * is removed at once and the toast's undo puts it back. Sex (owner 2026-10-03, „როგორც ციკლის გვერდზეა“): one tap marks today
 * and keeps the rest of the day's log, the toast offers details (the private sex sheet) and undo; a
 * second tap on a logged day opens the sheet. Reminders are rescheduled once the saved view is synced (the cycle
 * screen does that in its view effect; Home only after its own writes).
 */

// ---------- toast bridge (the toast sits outside Home's ScrollView, above the tab bar) ----------

export type HomeCycleToast = {
  kind: 'period' | 'periodEnd' | 'sex';
  date: string;
  /** Period toast title for the cycle mode (neutral „ახალი ციკლი დაიწყო“ while trying to conceive); undefined = default. */
  title?: string;
  /** Period end: the line under the title (default: today's bleeding was removed). */
  hint?: string;
  /** Period: add today's flow. Period end: log today. Sex: open the details sheet. */
  onAddFlow: () => void;
  onUndo: () => void;
};

/** `undo` puts the day back exactly; `wasBleeding` = today had bleeding logged (else the „still bleeding?“ answer). */
type EndToast = { date: string; undo: PeriodEndUndo; wasBleeding: boolean };

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
  /** The one-tap sex confirmation is showing. */
  sexToast: boolean;
  sexBusy: boolean;
  /** The private sex & sex drive sheet. */
  sexSheet: boolean;
  logSex: () => void;
  openSexSheet: () => void;
  closeSexSheet: () => void;
  sheet: HomeCycleSheet;
  startPeriod: () => void;
  endPeriod: () => void;
  /** „ჯერ კიდევ გაქვს?“ → „კი“: today's flow at her last logged level (else light), normal save path. */
  stillBleeding: () => void;
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
  /** Cycle mode drives the tone of the period-start confirmation (TTC: neutral title, selection haptic). */
  const mode = view?.display.profile.mode;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastDate, setToastDate] = useState<string | null>(null);
  /** Today's row and the last period start before the one-tap start (its undo restores both, CYC-04). */
  const startUndoRef = useRef<{ date: string; undo: PeriodStartUndo } | null>(null);
  /** Today's bleeding before the one-tap "period ended" (kept for undo); null = no end toast. */
  const [endToast, setEndToast] = useState<EndToast | null>(null);
  /** The day's form before the one-tap sex log (kept for undo); null = no sex toast. */
  const [sexBefore, setSexBefore] = useState<CycleLogForm | null>(null);
  const [sexBusy, setSexBusy] = useState(false);
  const [sexSheet, setSexSheet] = useState(false);
  const sexBusyRef = useRef(false);
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
        await syncCycleReminders(next.canonical, await getCycleReminderPrefs({ mode: next.canonical.profile.mode }));
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
    const undo = periodStartUndo(view?.display.logs.find((l) => l.date === today) ?? null, view?.display.profile.lastPeriodStart);
    busyRef.current = true;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const result = await queueApplyPeriod(userId, { action: 'start', date: today });
        trackCyclePeriodStarted('home');
        // TTC: a new cycle is not a success to celebrate — a plain selection tick (brief §9 item 16).
        if (periodStartTone(mode).haptic === 'selection') Haptics.selectionAsync().catch(() => undefined);
        else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        showView(result.view);
        startUndoRef.current = { date: today, undo };
        if (alive.current) {
          setSexBefore(null);
          setEndToast(null);
          setToastDate(today);
        }
      } catch (err) {
        fail(err);
      } finally {
        busyRef.current = false;
        if (alive.current) setBusy(false);
      }
    })();
  }, [userId, view, today, mode, showView, fail]);

  /** Undo of the one-tap start: the day and the last period start come back exactly as they were (never „end“). */
  const undoStart = useCallback(
    (date: string) => {
      if (!userId) return;
      setToastDate(null);
      const entry = startUndoRef.current;
      startUndoRef.current = null;
      if (!entry || entry.date !== date) return;
      // The row as it is now: anything logged since the tap stays (the published toast reads the latest handler).
      const current = view?.display.logs.find((l) => l.date === date) ?? null;
      void (async () => {
        try {
          const result = await undoQueuedPeriodStart(userId, entry.date, entry.undo, current);
          if (result) showView(result.view);
        } catch (err) {
          fail(err);
        }
      })();
    },
    [userId, view, showView, fail],
  );

  /** One tap: the period ends today (the server clears today's logged bleeding); the toast's undo restores it. */
  const endPeriod = useCallback(() => {
    if (!userId || busyRef.current) return;
    const before = view?.display.logs.find((l) => l.date === today) ?? null;
    const undo = periodEndUndo(before ? { flow: before.flow } : null);
    busyRef.current = true;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const result = await queueApplyPeriod(userId, { action: 'end', date: today });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        showView(result.view);
        if (alive.current) {
          setSexBefore(null);
          setToastDate(null);
          setEndToast({ date: today, undo, wasBleeding: undo.kind === 'restoreFlow' });
        }
      } catch (err) {
        fail(err);
      } finally {
        busyRef.current = false;
        if (alive.current) setBusy(false);
      }
    })();
  }, [userId, view, today, showView, fail]);

  /** „ჯერ კიდევ გაქვს?“ → „კი“: the run continues today (a bleeding log; the server's period status follows). */
  const stillBleeding = useCallback(() => {
    if (!userId || !view || busyRef.current) return;
    const flow = stillBleedingFlow(view.display.logs, today);
    busyRef.current = true;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const result = await saveCycleObservation(userId, today, { flow });
        Haptics.selectionAsync().catch(() => undefined);
        showView(result.view);
        if (alive.current) {
          setSexBefore(null);
          setToastDate(null);
          setEndToast(null);
        }
      } catch (err) {
        fail(err);
      } finally {
        busyRef.current = false;
        if (alive.current) setBusy(false);
      }
    })();
  }, [userId, view, today, showView, fail]);

  const undoEnd = useCallback(
    (entry: EndToast) => {
      if (!userId) return;
      setEndToast(null);
      const undo = entry.undo;
      if (undo.kind === 'keep') return;
      void (async () => {
        try {
          const result =
            undo.kind === 'restoreFlow'
              ? await saveCycleObservation(userId, entry.date, { flow: undo.flow })
              : undo.kind === 'clearFlow'
                ? await saveCycleObservation(userId, entry.date, { flow: null })
                : await queueRemoveCycleLog(userId, entry.date);
          showView(result.view);
        } catch (err) {
          fail(err);
        }
      })();
    },
    [userId, showView, fail],
  );

  /** Flo-style one tap: mark sex for today, keeping everything else logged that day. */
  const logSex = useCallback(() => {
    if (!userId || !view || sexBusyRef.current) return;
    const before = formFromCycleLog(view.display.logs.find((l) => l.date === today));
    if (before.sexual === true) {
      setSexBefore(null);
      setSexSheet(true);
      return;
    }
    sexBusyRef.current = true;
    setSexBusy(true);
    setError(null);
    void (async () => {
      try {
        const result = await persistCycleLog(userId, today, { ...before, sexual: true }, { base: before });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        showView(result.view);
        if (alive.current) {
          setToastDate(null);
          setEndToast(null);
          setSexBefore(before);
        }
      } catch (err) {
        fail(err);
      } finally {
        sexBusyRef.current = false;
        if (alive.current) setSexBusy(false);
      }
    })();
  }, [userId, view, today, showView, fail]);

  const undoSex = useCallback(
    (before: CycleLogForm) => {
      if (!userId) return;
      setSexBefore(null);
      void (async () => {
        try {
          const result = await persistCycleLog(userId, today, before, { base: before });
          showView(result.view);
        } catch (err) {
          fail(err);
        }
      })();
    },
    [userId, today, showView, fail],
  );

  const openSexSheet = useCallback(() => {
    setSexBefore(null);
    setSexSheet(true);
  }, []);
  const closeSexSheet = useCallback(() => setSexSheet(false), []);

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
    if (!sexBefore) return;
    const t = setTimeout(() => setSexBefore(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [sexBefore]);
  useEffect(() => {
    if (!endToast) return;
    const t = setTimeout(() => setEndToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [endToast]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), ERROR_MS);
    return () => clearTimeout(t);
  }, [error]);

  // Publish the toast for the host outside the ScrollView; withdraw it when it ends or Home unmounts.
  const handlers = useRef({ addFlow, undoStart, undoSex, undoEnd, openSexSheet, openLog });
  handlers.current = { addFlow, undoStart, undoSex, undoEnd, openSexSheet, openLog };
  useEffect(() => {
    if (!toastDate && !sexBefore && !endToast) {
      setToastEntry(null);
      return;
    }
    const entry: HomeCycleToast = sexBefore
      ? {
          kind: 'sex',
          date: today,
          onAddFlow: () => handlers.current.openSexSheet(),
          onUndo: () => handlers.current.undoSex(sexBefore),
        }
      : endToast
        ? {
            kind: 'periodEnd',
            date: endToast.date,
            hint: endToast.wasBleeding
              ? undefined
              : tx('დღე სისხლდენის გარეშე აღირიცხა — გაუქმება აბრუნებს.', 'Today is logged without bleeding — undo takes it back.'),
            onAddFlow: () => {
              setEndToast(null);
              handlers.current.openLog(endToast.date);
            },
            onUndo: () => handlers.current.undoEnd(endToast),
          }
        : {
            kind: 'period',
            date: toastDate as string,
            title: periodToastTitle(mode),
            onAddFlow: () => handlers.current.addFlow(toastDate as string),
            onUndo: () => handlers.current.undoStart(toastDate as string),
          };
    setToastEntry(entry);
    return () => {
      if (toastEntry === entry) setToastEntry(null);
    };
  }, [toastDate, sexBefore, endToast, today, mode]);

  return {
    busy,
    error,
    toastDate,
    sexToast: sexBefore != null,
    sexBusy,
    sexSheet,
    logSex,
    openSexSheet,
    closeSexSheet,
    sheet,
    startPeriod,
    endPeriod,
    stillBleeding,
    undoStart,
    addFlow,
    openLog,
    closeSheet,
    onSheetSaved: showView,
    openFullLog,
  };
}
