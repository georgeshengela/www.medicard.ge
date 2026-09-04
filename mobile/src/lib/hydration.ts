import { api } from '@/lib/api';
import { getScopedPreference, setScopedPreference } from '@/lib/localAccount';
import {
  DEFAULT_HYDRATION_GOAL_ML,
  HYDRATION_CONTAINERS,
  type HydrationContainer,
  type HydrationLevel,
  type HydrationLog,
} from '@/types/hydration';

const LOGS_KEY = 'medicard.hydration.logs';
const GOAL_KEY = 'medicard.hydration.goalMl';

export function todayYmd(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return todayYmd(next);
}

function parseLogs(raw: string | null): HydrationLog[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as HydrationLog[];
    return Array.isArray(parsed) ? parsed.filter((row) => row?.id && row.ml > 0) : [];
  } catch {
    return [];
  }
}

export async function loadHydrationLogs(): Promise<HydrationLog[]> {
  return parseLogs(await getScopedPreference(LOGS_KEY));
}

export async function saveHydrationLogs(logs: HydrationLog[]): Promise<void> {
  await setScopedPreference(LOGS_KEY, JSON.stringify(logs));
}

export async function loadHydrationGoalMl(): Promise<number> {
  const raw = await getScopedPreference(GOAL_KEY);
  const n = raw ? Number(raw) : DEFAULT_HYDRATION_GOAL_ML;
  return Number.isFinite(n) && n >= 500 ? Math.round(n) : DEFAULT_HYDRATION_GOAL_ML;
}

export async function saveHydrationGoalMl(ml: number): Promise<void> {
  await setScopedPreference(GOAL_KEY, String(Math.max(500, Math.round(ml))));
}

export function containerMl(container: HydrationContainer): number {
  return HYDRATION_CONTAINERS.find((item) => item.key === container)?.ml ?? 250;
}

export function dayTotalMl(logs: HydrationLog[], date: string): number {
  return logs.filter((row) => row.date === date).reduce((sum, row) => sum + row.ml, 0);
}

export function hydrationLevel(ml: number, goalMl: number): HydrationLevel {
  const ratio = goalMl > 0 ? ml / goalMl : 0;
  if (ratio >= 1) return 5;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

export function weekDatesEnding(endYmd: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(endYmd, i - 6));
}

export function mondayOf(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  return todayYmd(new Date(y, m - 1, d + (day === 0 ? -6 : 1 - day)));
}

export function weekMonSun(ymd: string): string[] {
  const monday = mondayOf(ymd);
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(monday, i));
}

export function monthGrid(year: number, monthIndex: number): { ymd: string; inMonth: boolean }[] {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: { ymd: string; inMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i += 1) {
    const date = new Date(year, monthIndex, i - startPad + 1);
    cells.push({ ymd: todayYmd(date), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ ymd: todayYmd(new Date(year, monthIndex, day)), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].ymd;
    cells.push({ ymd: addDaysYmd(last, 1), inMonth: false });
  }
  return cells;
}

export function formatMl(ml: number): string {
  return `${Math.round(ml).toLocaleString('en-US')} ml`;
}

/** Figma 9017:196580 — `2,000ml` with no space. */
export function formatMlTight(ml: number): string {
  return `${Math.round(ml).toLocaleString('en-US')}ml`;
}

export function formatLiters(ml: number): string {
  return `${(ml / 1000).toFixed(1)}L`;
}

export async function addHydrationLog(input: Omit<HydrationLog, 'id' | 'at'> & { at?: string }): Promise<HydrationLog[]> {
  const logs = await loadHydrationLogs();
  const next: HydrationLog = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: input.at ?? new Date().toISOString(),
  };
  const updated = [next, ...logs];
  await saveHydrationLogs(updated);
  await syncHydrationDelta(next.date, next.ml);
  return updated;
}

export async function removeHydrationLog(id: string): Promise<HydrationLog[]> {
  const logs = await loadHydrationLogs();
  const found = logs.find((row) => row.id === id);
  const updated = logs.filter((row) => row.id !== id);
  await saveHydrationLogs(updated);
  if (found) await syncHydrationDelta(found.date, -found.ml);
  return updated;
}

/** Server merge is additive — send the change, not the day total. */
async function syncHydrationDelta(date: string, deltaMl: number): Promise<void> {
  if (!deltaMl) return;
  try {
    await api.healthMetrics.sync({
      daily: [{ date, hydrationMl: deltaMl }],
      stepLogs: [],
    });
  } catch {
    /* local log still stands */
  }
}

export function trendPct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function bestDay(logs: HydrationLog[]): { date: string; ml: number } | null {
  const byDay = new Map<string, number>();
  for (const row of logs) {
    byDay.set(row.date, (byDay.get(row.date) ?? 0) + row.ml);
  }
  let best: { date: string; ml: number } | null = null;
  for (const [date, ml] of byDay) {
    if (!best || ml > best.ml) best = { date, ml };
  }
  return best;
}

export function peakHourLabel(logs: HydrationLog[]): string | null {
  if (!logs.length) return null;
  const hours = new Array(24).fill(0);
  for (const row of logs) {
    hours[new Date(row.at).getHours()] += row.ml;
  }
  const hour = hours.indexOf(Math.max(...hours));
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(h12).padStart(2, '0')}:00 ${suffix}`;
}
