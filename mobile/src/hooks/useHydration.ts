import { useCallback, useEffect, useMemo } from 'react';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/store/AuthContext';
import { api } from '@/lib/api';
import { pullStoredHealth, subscribeHealthRefresh } from '@/lib/healthDataSync';
import { defaultSyncFromDate, defaultSyncToDate } from '@/lib/healthMetricsStorage';
import { mergeDayHydrationMl, serverTotalsAfterOwnWrite, weekSoFarAverageMl, weekSoFarSums } from '@/lib/hydrationMerge.js';
import {
  bestDay,
  dayTotalMl,
  loadHydrationGoalMl,
  loadHydrationLogs,
  recordHydrationLog,
  removeHydrationLog,
  saveHydrationGoalMl,
  todayYmd,
  trendPct,
  weekDatesEnding,
  weekMonSun,
} from '@/lib/hydration';
import type { HydrationLog } from '@/types/hydration';

type HydrationData = {
  logs: HydrationLog[];
  goalMl: number;
  serverByDate: Record<string, number>;
  /** When the server read behind `serverByDate` started (own writes sent before it are not in it). */
  serverAt: number;
};
const HYDRATION_KEY = ['health', 'hydration'] as const;

async function fetchHydration(): Promise<HydrationData> {
  const serverAt = Date.now();
  const [localGoal, stored, remoteGoal] = await Promise.all([
    loadHydrationGoalMl(),
    pullStoredHealth(defaultSyncFromDate(), defaultSyncToDate()).catch(() => null),
    // Short: during a server stall the water card must not sit on „…“ for the default 3 minutes.
    api.healthMetrics.hydrationGoalGet({ timeoutMs: 8_000 }).catch(() => null),
  ]);
  const serverByDate: Record<string, number> = {};
  for (const row of stored?.daily ?? []) {
    if (row.hydrationMl == null) continue;
    serverByDate[row.date] = Math.max(0, Math.round(Number(row.hydrationMl) || 0));
  }
  let goalMl = localGoal;
  if (remoteGoal?.goalMl != null && Number(remoteGoal.goalMl) >= 500) {
    goalMl = Math.round(Number(remoteGoal.goalMl));
    if (goalMl !== localGoal) await saveHydrationGoalMl(goalMl);
  }
  // The phone's list is read last (after any save in progress): a glass tapped while the server
  // answered is in it, so this answer never lands without it.
  const logs = await loadHydrationLogs();
  return { logs, goalMl, serverByDate, serverAt };
}

const EMPTY_LOGS: HydrationLog[] = [];
const EMPTY_SERVER: Record<string, number> = {};

/** Water is LIVE: the last total shows at once and re-reads on every visit and health change. */
export function useHydration(opts: { enabled?: boolean } = {}) {
  const { user } = useAuth();
  const enabled = Boolean(user?.id) && (opts.enabled ?? true);
  const query = useAccountQuery<HydrationData>({
    key: [...HYDRATION_KEY],
    fetch: fetchHydration,
    staleTime: FRESH.LIVE,
    enabled,
  });
  const { refetch } = query;
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeHealthRefresh(() => {
      void queryClient.invalidateQueries({ queryKey: accountKey(...HYDRATION_KEY) });
    });
  }, [enabled]);

  const logs = query.data?.logs ?? EMPTY_LOGS;
  const goalMl = query.data?.goalMl ?? 2000;
  const serverByDate = query.data?.serverByDate ?? EMPTY_SERVER;
  const loading = enabled && !query.data && query.fetchStatus !== 'idle';

  const patch = useCallback((next: Partial<HydrationData>) => {
    queryClient.setQueryData<HydrationData>(accountKey(...HYDRATION_KEY), (old) =>
      old ? { ...old, ...next } : { logs: EMPTY_LOGS, goalMl: 2000, serverByDate: EMPTY_SERVER, serverAt: 0, ...next },
    );
  }, []);

  const today = todayYmd();
  const todayMl = mergeDayHydrationMl(dayTotalMl(logs, today), serverByDate[today]);
  const week = weekMonSun(today);
  const weekTotals = week.map((date) => mergeDayHydrationMl(dayTotalMl(logs, date), serverByDate[date]));
  const yesterdayMl = mergeDayHydrationMl(
    dayTotalMl(logs, weekDatesEnding(today)[5]),
    serverByDate[weekDatesEnding(today)[5]],
  );
  const prevWeek = weekMonSun(addDaysSafe(week[0], -1));
  const lastWeekTotals = prevWeek.map((date) => mergeDayHydrationMl(dayTotalMl(logs, date), serverByDate[date]));
  const { current: thisWeekSum, previous: prevWeekSum } = weekSoFarSums(weekTotals, lastWeekTotals, week, today);
  const weekAvgMl = weekSoFarAverageMl(weekTotals, week, today);

  const snapshot = useMemo(
    () => ({
      today,
      todayMl,
      goalMl,
      remainingMl: Math.max(0, goalMl - todayMl),
      progress: goalMl > 0 ? Math.min(1, todayMl / goalMl) : 0,
      logCount: logs.filter((row) => row.date === today).length,
      week,
      weekTotals,
      weekAvgMl,
      /** This week so far against the same days of last week. */
      weekTrend: trendPct(thisWeekSum, prevWeekSum),
      dayTrend: trendPct(todayMl, yesterdayMl),
      allMl: logs.reduce((sum, row) => sum + row.ml, 0),
      best: bestDay(logs),
      logs,
    }),
    [goalMl, logs, prevWeekSum, thisWeekSum, today, todayMl, week, weekAvgMl, weekTotals, yesterdayMl],
  );

  // A tap shows right after the phone's save; the server copy follows without blocking. Cache updates
  // add or remove just this row, so answers arriving out of order never drop a glass.
  const addLog = useCallback(async (input: Omit<HydrationLog, 'id' | 'at'> & { at?: string }) => {
    const startedAt = Date.now();
    const { log, synced } = await recordHydrationLog(input);
    updateCached((old) => ({ ...old, logs: old.logs.some((row) => row.id === log.id) ? old.logs : [log, ...old.logs] }));
    void synced.then((ok) => {
      if (!ok) return;
      updateCached((old) => ({
        ...old,
        serverByDate: serverTotalsAfterOwnWrite(old.serverByDate, old.serverAt, { date: log.date, deltaMl: log.ml, startedAt }),
      }));
    });
    return log;
  }, []);

  const deleteLog = useCallback(async (id: string) => {
    const startedAt = Date.now();
    const { log, synced } = await removeHydrationLog(id);
    updateCached((old) => ({ ...old, logs: old.logs.filter((row) => row.id !== id) }));
    if (!log) return;
    void synced.then((ok) => {
      if (!ok) return;
      updateCached((old) => ({
        ...old,
        serverByDate: serverTotalsAfterOwnWrite(old.serverByDate, old.serverAt, { date: log.date, deltaMl: -log.ml, startedAt }),
      }));
    });
  }, []);

  const setGoal = useCallback(async (ml: number) => {
    await saveHydrationGoalMl(ml);
    patch({ goalMl: ml });
    void import('@/lib/quest/api').then(({ questApi }) => questApi.hydrationGoalPut(ml).catch(() => undefined));
    void import('@/lib/quest/cache').then(({ requestQuestRefresh }) => requestQuestRefresh());
  }, [patch]);

  return { ...snapshot, loading, refresh, addLog, deleteLog, setGoal, lastWeekTotals };
}

/**
 * Changes the cached water data in place. Nothing cached yet (the first read is still on its way or
 * failed): that read, or a new one, picks the saved row up from the phone instead.
 */
function updateCached(change: (old: HydrationData) => HydrationData) {
  const key = accountKey(...HYDRATION_KEY);
  if (!queryClient.getQueryData<HydrationData>(key)) {
    void queryClient.invalidateQueries({ queryKey: key, exact: true }, { cancelRefetch: false });
    return;
  }
  queryClient.setQueryData<HydrationData>(key, (old) => (old ? change(old) : old));
}

function addDaysSafe(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const next = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}
