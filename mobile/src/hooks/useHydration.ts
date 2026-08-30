import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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

export function useHydration() {
  const [logs, setLogs] = useState<HydrationLog[]>([]);
  const [goalMl, setGoalMl] = useState(2000);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [nextLogs, nextGoal] = await Promise.all([loadHydrationLogs(), loadHydrationGoalMl()]);
    setLogs(nextLogs);
    setGoalMl(nextGoal);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const today = todayYmd();
  const todayMl = dayTotalMl(logs, today);
  const week = weekMonSun(today);
  const weekTotals = week.map((date) => dayTotalMl(logs, date));
  const yesterdayMl = dayTotalMl(logs, weekDatesEnding(today)[5]);
  const prevWeek = weekMonSun(addDaysSafe(week[0], -1));
  const lastWeekTotals = prevWeek.map((date) => dayTotalMl(logs, date));
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
    setLogs(next);
    return next[0];
  }, []);

  const deleteLog = useCallback(async (id: string) => {
    setLogs(await removeHydrationLog(id));
  }, []);

  const setGoal = useCallback(async (ml: number) => {
    await saveHydrationGoalMl(ml);
    setGoalMl(ml);
  }, []);

  return { ...snapshot, loading, refresh, addLog, deleteLog, setGoal, lastWeekTotals };
}

function addDaysSafe(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const next = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}
