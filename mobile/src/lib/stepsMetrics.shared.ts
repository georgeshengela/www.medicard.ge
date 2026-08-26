import { ka } from '@/i18n/ka';
import { DEFAULT_STEPS_GOAL } from '@/constants/figmaStepsLayout';
import type {
  StepChartPeriod,
  StepLogEntry,
  StepSample,
  StepsChartBar,
  StepsDayGroup,
  StepsInsights,
  StepsMetricsBundle,
} from '@/types/stepsMetrics';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return ymd(a) === ymd(b);
}

function formatTimeKa(iso: string): string {
  return new Date(iso).toLocaleTimeString('ka-GE', { hour: 'numeric', minute: '2-digit' });
}

function formatDateKa(iso: string): string {
  return new Date(iso).toLocaleDateString('ka-GE', { month: 'long', day: 'numeric' });
}

function formatDayTitle(d: Date, today: Date): string {
  if (isSameDay(d, today)) return ka.steps.today;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, yesterday)) return ka.steps.yesterday;
  return d.toLocaleDateString('ka-GE', { weekday: 'long', month: 'long', day: 'numeric' });
}

function sumSamples(samples: StepSample[]): number {
  return samples.reduce((sum, s) => sum + s.count, 0);
}

function dailyTotals(samples: StepSample[]): Map<string, number> {
  const byDay = new Map<string, StepSample[]>();
  for (const s of samples) {
    const day = ymd(new Date(s.at));
    const list = byDay.get(day) ?? [];
    list.push(s);
    byDay.set(day, list);
  }

  const map = new Map<string, number>();
  byDay.forEach((list, day) => {
    const daily = list.find((s) => s.daily);
    map.set(day, daily ? daily.count : sumSamples(list));
  });
  return map;
}

function todayStepTotal(samples: StepSample[], today: Date): number {
  const key = ymd(today);
  const daySamples = samples.filter((s) => ymd(new Date(s.at)) === key);
  const daily = daySamples.find((s) => s.daily);
  if (daily) return daily.count;
  return sumSamples(daySamples);
}

function buildHourlyBars(samples: StepSample[], day: Date): StepsChartBar[] {
  const buckets = Array.from({ length: 12 }, () => 0);
  for (const s of samples) {
    if (s.daily) continue;
    const at = new Date(s.at);
    if (!isSameDay(at, day)) continue;
    const bucket = Math.min(11, Math.floor(at.getHours() / 2));
    buckets[bucket] += s.count;
  }
  return buckets.map((value, i) => ({
    label: String(i + 1),
    value,
  }));
}

function buildDailyBars(samples: StepSample[], days: number): StepsChartBar[] {
  const totals = dailyTotals(samples);
  const today = startOfDay(new Date());
  const bars: StepsChartBar[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = ymd(d);
    bars.push({
      label: d.toLocaleDateString('ka-GE', { weekday: 'narrow' }),
      value: totals.get(key) ?? 0,
    });
  }
  return bars;
}

function buildMonthlyBars(samples: StepSample[]): StepsChartBar[] {
  const totals = dailyTotals(samples);
  const today = startOfDay(new Date());
  const bars: StepsChartBar[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    bars.push({
      label: String(d.getDate()),
      value: totals.get(ymd(d)) ?? 0,
    });
  }
  return bars;
}

function buildYearlyBars(samples: StepSample[]): StepsChartBar[] {
  const totals = dailyTotals(samples);
  const monthTotals = Array.from({ length: 12 }, () => 0);
  totals.forEach((count, day) => {
    monthTotals[new Date(`${day}T12:00:00`).getMonth()] += count;
  });
  return monthTotals.map((value, i) => ({
    label: new Date(2024, i, 1).toLocaleDateString('ka-GE', { month: 'narrow' }),
    value,
  }));
}

function buildChartBars(samples: StepSample[], period: StepChartPeriod): StepsChartBar[] {
  const today = new Date();
  switch (period) {
    case '1d':
      return buildHourlyBars(samples, today);
    case '1w':
      return buildDailyBars(samples, 7);
    case '1m':
      return buildMonthlyBars(samples);
    case '1y':
      return buildYearlyBars(samples);
    case 'all':
      return buildDailyBars(
        samples,
        Math.min(30, new Set(samples.map((s) => ymd(new Date(s.at)))).size || 7),
      );
    default:
      return buildHourlyBars(samples, today);
  }
}

function buildLogs(samples: StepSample[]): StepLogEntry[] {
  return [...samples]
    .filter((s) => !s.daily)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((s, idx) => ({
      id: `${s.at}-${idx}`,
      at: s.at,
      count: s.count,
    }));
}

function buildHistoryByDay(logs: StepLogEntry[]): StepsDayGroup[] {
  const today = new Date();
  const groups = new Map<string, StepLogEntry[]>();
  for (const log of logs) {
    const key = ymd(new Date(log.at));
    const list = groups.get(key) ?? [];
    list.push(log);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, dayLogs]) => ({
      ymd: key,
      title: formatDayTitle(new Date(`${key}T12:00:00`), today),
      logs: dayLogs,
    }));
}

function computeInsights(samples: StepSample[], goal: number): StepsInsights {
  const today = new Date();
  const todaySamples = samples.filter((s) => isSameDay(new Date(s.at), today) && !s.daily);
  const todayTotal = todayStepTotal(samples, today);

  const hourly = Array.from({ length: 24 }, () => 0);
  for (const s of todaySamples) {
    hourly[new Date(s.at).getHours()] += s.count;
  }
  const peakHour = hourly.reduce((best, v, i) => (v > hourly[best] ? i : best), 0);

  const totals = dailyTotals(samples);
  let streak = 0;
  const cursor = startOfDay(today);
  while (true) {
    const total = totals.get(ymd(cursor)) ?? 0;
    if (total < goal * 0.5) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    activeMinutes: Math.round(todayTotal / 100),
    mostActiveTime: `${String(peakHour).padStart(2, '0')}:00`,
    streakDays: streak,
    distanceKm: Math.round(todayTotal * 0.000762 * 10) / 10,
  };
}

function stepsStatusKa(todayTotal: number, goal: number): string {
  const ratio = todayTotal / goal;
  if (ratio >= 1) return ka.steps.statusAboveGoal;
  if (ratio >= 0.75) return ka.steps.statusNearGoal;
  if (ratio >= 0.4) return ka.steps.statusActive;
  return ka.steps.statusLow;
}

export function buildStepsBundle(
  samples: StepSample[],
  connected: boolean,
  period: StepChartPeriod = '1d',
  goal = DEFAULT_STEPS_GOAL,
): StepsMetricsBundle {
  const today = new Date();
  const todayTotal = todayStepTotal(samples, today);
  const remaining = Math.max(0, goal - todayTotal);
  const logs = buildLogs(samples);
  const hourly = buildHourlyBars(samples, today);
  const peakHourly = hourly.reduce((max, b) => Math.max(max, b.value), 0);

  return {
    connected,
    todayTotal,
    goal,
    statusKa: stepsStatusKa(todayTotal, goal),
    remaining,
    peakHourly,
    logCount: logs.length,
    chartBars: buildChartBars(samples, period),
    chartPeriod: period,
    insights: computeInsights(samples, goal),
    historyPreview: logs.slice(0, 5),
    historyByDay: buildHistoryByDay(logs),
    fetchedAt: new Date().toISOString(),
  };
}

export function formatStepsCount(value: number): string {
  return Math.round(value).toLocaleString('ka-GE');
}

export function formatStepLogTime(iso: string): string {
  return formatTimeKa(iso);
}

export function formatStepLogDate(iso: string): string {
  return formatDateKa(iso);
}

export function filterHistoryByMonth(groups: StepsDayGroup[], year: number, month: number): StepsDayGroup[] {
  return groups.filter((g) => {
    const d = new Date(`${g.ymd}T12:00:00`);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function monthLabelKa(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('ka-GE', { month: 'long', year: 'numeric' });
}

export function samplesLookbackDays(period: StepChartPeriod): number {
  switch (period) {
    case '1d':
      return 1;
    case '1w':
      return 7;
    case '1m':
      return 31;
    case '1y':
      return 366;
    default:
      return 90;
  }
}

export function sinceDateForPeriod(period: StepChartPeriod): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - samplesLookbackDays(period) + 1);
  return d;
}
