import type { HealthMetricKey, HealthMetricPoint } from '@/types/healthMetrics';
import type { StepSample } from '@/types/stepsMetrics';

export type StoredHealthDaily = {
  date: string;
  steps: number | null;
  weightKg: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  heartRate: number | null;
  sleepHours: number | null;
  nutritionKcal: number | null;
  hydrationMl: number | null;
  activeMinutes: number | null;
  distanceKm: number | null;
  source: string;
  syncedAt: string;
};

export type StoredStepLog = {
  id: string;
  at: string;
  count: number;
};

export type HealthMetricsSyncPayload = {
  daily: Array<{
    date: string;
    steps?: number;
    weightKg?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    heartRate?: number;
    sleepHours?: number;
    nutritionKcal?: number;
    hydrationMl?: number;
    activeMinutes?: number;
    distanceKm?: number;
  }>;
  stepLogs: Array<{ at: string; count: number }>;
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

function groupByDate(points: HealthMetricPoint[]): Map<string, HealthMetricPoint[]> {
  const map = new Map<string, HealthMetricPoint[]>();
  for (const p of points) {
    const list = map.get(p.date) ?? [];
    list.push(p);
    map.set(p.date, list);
  }
  return map;
}

function latestOnDay(points: HealthMetricPoint[]): HealthMetricPoint | null {
  if (!points.length) return null;
  return points[points.length - 1];
}

function avgOnDay(points: HealthMetricPoint[]): number | null {
  if (!points.length) return null;
  return points.reduce((s, p) => s + p.value, 0) / points.length;
}

function sumOnDay(points: HealthMetricPoint[]): number | null {
  if (!points.length) return null;
  return points.reduce((s, p) => s + p.value, 0);
}

function dayStepTotal(samples: StepSample[], date: string): number {
  const day = samples.filter((s) => ymd(new Date(s.at)) === date);
  const daily = day.find((s) => s.daily);
  if (daily) return daily.count;
  return day.reduce((s, x) => s + x.count, 0);
}

export function buildSyncPayloadFromNative(
  raw: Partial<Record<HealthMetricKey, HealthMetricPoint[]>>,
  stepSamples: StepSample[],
): HealthMetricsSyncPayload {
  const dates = new Set<string>();

  for (const key of Object.keys(raw) as HealthMetricKey[]) {
    for (const p of raw[key] ?? []) dates.add(p.date);
  }
  for (const s of stepSamples) dates.add(ymd(new Date(s.at)));

  const daily: HealthMetricsSyncPayload['daily'] = [];

  for (const date of dates) {
    const row: HealthMetricsSyncPayload['daily'][number] = { date };

    const weight = (raw.weight ?? []).filter((p) => p.date === date);
    const bp = (raw.bloodPressure ?? []).filter((p) => p.date === date);
    const hr = (raw.heartRate ?? []).filter((p) => p.date === date);
    const sleep = (raw.sleep ?? []).filter((p) => p.date === date);
    const nutrition = (raw.nutrition ?? []).filter((p) => p.date === date);
    const hydration = (raw.hydration ?? []).filter((p) => p.date === date);

    const w = latestOnDay(weight);
    if (w) row.weightKg = w.value;

    const b = latestOnDay(bp);
    if (b) {
      row.bloodPressureSystolic = Math.round(b.value);
      if (b.valueSecondary != null) row.bloodPressureDiastolic = Math.round(b.valueSecondary);
    }

    const h = avgOnDay(hr);
    if (h != null) row.heartRate = Math.round(h * 10) / 10;

    const sl = sumOnDay(sleep);
    if (sl != null) row.sleepHours = Math.round(sl * 10) / 10;

    const nu = sumOnDay(nutrition);
    if (nu != null) row.nutritionKcal = Math.round(nu);

    const hy = sumOnDay(hydration);
    if (hy != null) row.hydrationMl = Math.round(hy);

    const stepTotal = dayStepTotal(stepSamples, date);
    if (stepTotal > 0) row.steps = stepTotal;

    if (Object.keys(row).length > 1) daily.push(row);
  }

  return {
    daily,
    stepLogs: stepSamples.filter((s) => !s.daily).map((s) => ({ at: s.at, count: s.count })),
  };
}

export function storedDailyToRaw(daily: StoredHealthDaily[]): Partial<Record<HealthMetricKey, HealthMetricPoint[]>> {
  const raw: Partial<Record<HealthMetricKey, HealthMetricPoint[]>> = {
    weight: [],
    bloodPressure: [],
    heartRate: [],
    sleep: [],
    nutrition: [],
    hydration: [],
  };

  for (const row of daily) {
    if (row.weightKg != null) raw.weight!.push({ date: row.date, value: row.weightKg });
    if (row.bloodPressureSystolic != null) {
      raw.bloodPressure!.push({
        date: row.date,
        value: row.bloodPressureSystolic,
        valueSecondary: row.bloodPressureDiastolic ?? undefined,
      });
    }
    if (row.heartRate != null) raw.heartRate!.push({ date: row.date, value: row.heartRate });
    if (row.sleepHours != null) raw.sleep!.push({ date: row.date, value: row.sleepHours });
    if (row.nutritionKcal != null) raw.nutrition!.push({ date: row.date, value: row.nutritionKcal });
    if (row.hydrationMl != null) raw.hydration!.push({ date: row.date, value: row.hydrationMl });
  }

  return raw;
}

export function storedStepLogsToSamples(logs: StoredStepLog[]): StepSample[] {
  return logs.map((l) => ({ at: l.at, count: l.count }));
}

export function mergeMetricPoints(
  native: Partial<Record<HealthMetricKey, HealthMetricPoint[]>>,
  stored: Partial<Record<HealthMetricKey, HealthMetricPoint[]>>,
): Partial<Record<HealthMetricKey, HealthMetricPoint[]>> {
  const keys: HealthMetricKey[] = ['weight', 'bloodPressure', 'heartRate', 'sleep', 'nutrition', 'hydration'];
  const merged: Partial<Record<HealthMetricKey, HealthMetricPoint[]>> = {};

  for (const key of keys) {
    const combined = [...(stored[key] ?? []), ...(native[key] ?? [])];
    const byDate = groupByDate(combined);
    merged[key] = [...byDate.entries()].flatMap(([, points]) => points);
  }

  return merged;
}

export function mergeStepSamples(native: StepSample[], stored: StepSample[]): StepSample[] {
  const map = new Map<string, StepSample>();
  for (const s of stored) map.set(s.at, s);
  for (const s of native) map.set(s.at, s);
  return [...map.values()].sort((a, b) => b.at.localeCompare(a.at));
}

export function defaultSyncFromDate(): string {
  return daysAgo(90);
}

export function defaultSyncToDate(): string {
  return ymd(new Date());
}

export { ymd, daysAgo };
