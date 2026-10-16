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

/**
 * Local writes run one after another: two quick taps used to read the list before either had saved,
 * and the second save dropped the first glass.
 */
let logsWrite: Promise<unknown> = Promise.resolve();
function serialLogsWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = logsWrite.then(task, task);
  logsWrite = run.catch(() => undefined);
  return run;
}

function readLogs(): Promise<HydrationLog[]> {
  return getScopedPreference(LOGS_KEY).then(parseLogs);
}

/** Waits for a save in progress, so a read never returns the list without the glass just tapped. */
export async function loadHydrationLogs(): Promise<HydrationLog[]> {
  await logsWrite;
  return readLogs();
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

export type HydrationWrite = {
  /** The row added, or the row removed (null when the delete found nothing). */
  log: HydrationLog | null;
  logs: HydrationLog[];
  /** True once the server has the change; never rejects (the phone's copy stands either way). */
  synced: Promise<boolean>;
};

/**
 * Saves the glass on the phone and returns at once; the server copy follows in `synced`. A tap shows
 * right after the local save instead of waiting for POST /sync (seconds during a server stall).
 */
export async function recordHydrationLog(input: Omit<HydrationLog, 'id' | 'at'> & { at?: string }): Promise<HydrationWrite & { log: HydrationLog }> {
  const { log, logs } = await serialLogsWrite(async () => {
    const next: HydrationLog = {
      ...input,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: input.at ?? new Date().toISOString(),
    };
    const updated = [next, ...(await readLogs())];
    await saveHydrationLogs(updated);
    return { log: next, logs: updated };
  });
  const synced = syncHydrationEvent(log.id, log.date, log.ml);
  // After the server has it: MEDIQUEST progress is counted there.
  void synced.then(() => {
    void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) => requestEngageRefresh());
    void import('@/lib/quest/cache').then(({ requestQuestRefresh }) => requestQuestRefresh());
  });
  return { log, logs, synced };
}

/** Background callers (a notification action in a headless task ends when it returns) wait for the server too. */
export async function addHydrationLog(input: Omit<HydrationLog, 'id' | 'at'> & { at?: string }): Promise<HydrationLog[]> {
  const write = await recordHydrationLog(input);
  await write.synced;
  return write.logs;
}

export async function removeHydrationLog(id: string): Promise<HydrationWrite> {
  const { log, logs } = await serialLogsWrite(async () => {
    const current = await readLogs();
    const found = current.find((row) => row.id === id) ?? null;
    const updated = current.filter((row) => row.id !== id);
    await saveHydrationLogs(updated);
    return { log: found, logs: updated };
  });
  const synced = log ? syncHydrationEvent(`del-${log.id}`, log.date, -log.ml) : Promise.resolve(false);
  void synced.then(() => import('@/lib/quest/cache').then(({ requestQuestRefresh }) => requestQuestRefresh()));
  return { log, logs, synced };
}

/** Unique clientEventId makes retries idempotent. Daily total is recomputed server-side. */
async function syncHydrationEvent(clientEventId: string, date: string, deltaMl: number): Promise<boolean> {
  if (!deltaMl) return false;
  const health = await import('@/lib/healthDataSync').catch(() => null);
  try {
    // Our own write: the server's `health:metrics` echo must not re-read every health hook, and a
    // read from before it must not be reused as the new day total.
    health?.markOwnHealthPush();
    health?.forgetHealthPull();
    await api.healthMetrics.sync({
      daily: [],
      stepLogs: [],
      hydrationEvents: [{ clientEventId, date, deltaMl }],
    });
    health?.forgetHealthPull();
    return true;
  } catch {
    /* local log still stands */
    return false;
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
  // 24-hour clock like the rest of the app (was „03:00 PM“ in both languages).
  return `${String(hour).padStart(2, '0')}:00`;
}
