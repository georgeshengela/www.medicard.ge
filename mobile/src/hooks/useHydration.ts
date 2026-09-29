import { useCallback, useEffect, useMemo } from 'react';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/store/AuthContext';
import { api } from '@/lib/api';
import { pullStoredHealth, subscribeHealthRefresh } from '@/lib/healthDataSync';
import { defaultSyncFromDate, defaultSyncToDate } from '@/lib/healthMetricsStorage';
import { mergeDayHydrationMl } from '@/lib/hydrationMerge.js';
import {
  addHydrationLog,
  bestDay,
  dayTotalMl,
  loadHydrationGoalMl,
  loadHydrationLogs,
  removeHydrationLog,
  saveHydrationGoalMl,
  todayYmd,
  trendPct,
  weekDatesEnding,
  weekMonSun,
} from '@/lib/hydration';
import type { HydrationLog } from '@/types/hydration';

type HydrationData = { logs: HydrationLog[]; goalMl: number; serverByDate: Record<string, number> };
const HYDRATION_KEY = ['health', 'hydration'] as const;

async function fetchHydration(): Promise<HydrationData> {
  const [logs, localGoal, stored, remoteGoal] = await Promise.all([
    loadHydrationLogs(),
    loadHydrationGoalMl(),
    pullStoredHealth(defaultSyncFromDate(), defaultSyncToDate()).catch(() => null),
    api.healthMetrics.hydrationGoalGet().catch(() => null),
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
  return { logs, goalMl, serverByDate };
}

const EMPTY_LOGS: HydrationLog[] = [];
const EMPTY_SERVER: Record<string, number> = {};

/** Water is LIVE: the last total shows at once and re-reads on every visit and health change. */
export function useHydration() {
  const { user } = useAuth();
  const query = useAccountQuery<HydrationData>({
    key: [...HYDRATION_KEY],
    fetch: fetchHydration,
    staleTime: FRESH.LIVE,
    enabled: Boolean(user?.id),
  });
  const { refetch } = query;
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => subscribeHealthRefresh(() => {
    void queryClient.invalidateQueries({ queryKey: accountKey(...HYDRATION_KEY) });
  }), []);

  const logs = query.data?.logs ?? EMPTY_LOGS;
  const goalMl = query.data?.goalMl ?? 2000;
  const serverByDate = query.data?.serverByDate ?? EMPTY_SERVER;
  const loading = Boolean(user?.id) && !query.data && query.fetchStatus !== 'idle';

  const patch = useCallback((next: Partial<HydrationData>) => {
    queryClient.setQueryData<HydrationData>(accountKey(...HYDRATION_KEY), (old) =>
      old ? { ...old, ...next } : { logs: EMPTY_LOGS, goalMl: 2000, serverByDate: EMPTY_SERVER, ...next },
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
  const prevWeekSum = lastWeekTotals.reduce((a, b) => a + b, 0);
  const thisWeekSum = weekTotals.reduce((a, b) => a + b, 0);

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
      weekTrend: trendPct(thisWeekSum, prevWeekSum),
      dayTrend: trendPct(todayMl, yesterdayMl),
      allMl: logs.reduce((sum, row) => sum + row.ml, 0),
      best: bestDay(logs),
      logs,
    }),
    [goalMl, logs, prevWeekSum, thisWeekSum, today, todayMl, week, weekTotals, yesterdayMl],
  );

  const addLog = useCallback(async (input: Omit<HydrationLog, 'id' | 'at'> & { at?: string }) => {
    const next = await addHydrationLog(input);
    patch({ logs: next });
    return next[0];
  }, [patch]);

  const deleteLog = useCallback(async (id: string) => {
    patch({ logs: await removeHydrationLog(id) });
  }, [patch]);

  const setGoal = useCallback(async (ml: number) => {
    await saveHydrationGoalMl(ml);
    patch({ goalMl: ml });
    void import('@/lib/quest/api').then(({ questApi }) => questApi.hydrationGoalPut(ml).catch(() => undefined));
    void import('@/lib/quest/cache').then(({ requestQuestRefresh }) => requestQuestRefresh());
  }, [patch]);

  return { ...snapshot, loading, refresh, addLog, deleteLog, setGoal, lastWeekTotals };
}

function addDaysSafe(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const next = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}
