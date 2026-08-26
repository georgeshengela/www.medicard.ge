import type { HealthProfile } from '@/lib/api';
import { ka } from '@/i18n/ka';
import {
  HEALTH_METRIC_ORDER,
  type HealthMetricKey,
  type HealthMetricPoint,
  type HealthMetricSnapshot,
  type HealthMetricsBundle,
} from '@/types/healthMetrics';

export function last7DayLabels(): string[] {
  const labels: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    labels.push(
      d.toLocaleDateString('ka-GE', { weekday: 'short' }).slice(0, 2),
    );
  }
  return labels;
}

export function weekStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 6);
  return d;
}

export function bucketDailyValues(
  points: HealthMetricPoint[],
  reducer: 'latest' | 'sum' | 'avg' = 'latest',
): (number | null)[] {
  const buckets = Array.from({ length: 7 }, () => null as number | null);
  const grouped = Array.from({ length: 7 }, () => [] as number[]);
  const start = weekStart().getTime();

  for (const point of points) {
    const ts = new Date(`${point.date}T12:00:00`).getTime();
    const dayIndex = Math.floor((ts - start) / 86_400_000);
    if (dayIndex < 0 || dayIndex > 6) continue;
    grouped[dayIndex].push(point.value);
  }

  grouped.forEach((values, idx) => {
    if (!values.length) return;
    if (reducer === 'sum') buckets[idx] = values.reduce((a, b) => a + b, 0);
    else if (reducer === 'avg') buckets[idx] = values.reduce((a, b) => a + b, 0) / values.length;
    else buckets[idx] = values[values.length - 1];
  });

  return buckets;
}

export function latestPoint(points: HealthMetricPoint[]): HealthMetricPoint | null {
  if (!points.length) return null;
  return [...points].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function updatedLabelFromDate(date: string | null): string {
  if (!date) return ka.healthMetrics.noData;
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (date === ymd) return ka.healthMetrics.today;
  return new Date(`${date}T12:00:00`).toLocaleDateString('ka-GE', { month: 'short', day: 'numeric' });
}

function weightStatusKg(value: number, heightCm: number | null | undefined): string {
  if (!heightCm || heightCm <= 0) return ka.healthMetrics.weightTracked;
  const bmi = value / (heightCm / 100) ** 2;
  if (bmi >= 18.5 && bmi < 25) return ka.healthMetrics.weightOptimal;
  if (bmi < 18.5) return ka.healthMetrics.weightLow;
  return ka.healthMetrics.weightHigh;
}

function bpStatus(sys: number, dia: number): string {
  if (sys < 120 && dia < 80) return ka.healthMetrics.bpOptimal;
  if (sys < 130 && dia < 85) return ka.healthMetrics.bpElevated;
  return ka.healthMetrics.bpHigh;
}

function hrStatus(value: number): string {
  if (value >= 60 && value <= 100) return ka.healthMetrics.hrNormal;
  if (value < 60) return ka.healthMetrics.hrLow;
  return ka.healthMetrics.hrHigh;
}

function sleepStatus(hours: number): string {
  if (hours >= 7 && hours <= 9) return ka.healthMetrics.sleepGood;
  if (hours >= 5) return ka.healthMetrics.sleepLow;
  return ka.healthMetrics.sleepPoor;
}

function nutritionStatus(kcal: number): string {
  if (kcal >= 1200 && kcal <= 2500) return ka.healthMetrics.nutritionOnTrack;
  if (kcal < 1200) return ka.healthMetrics.nutritionLow;
  return ka.healthMetrics.nutritionHigh;
}

function hydrationStatus(ml: number): string {
  if (ml >= 1800) return ka.healthMetrics.hydrationGood;
  if (ml >= 1000) return ka.healthMetrics.hydrationOk;
  return ka.healthMetrics.hydrationLow;
}

export function buildMetricSnapshot(
  key: HealthMetricKey,
  points: HealthMetricPoint[],
  profile: HealthProfile | null | undefined,
  source: 'device' | 'profile' | 'none',
  reducer: 'latest' | 'sum' | 'avg' = 'latest',
): HealthMetricSnapshot {
  const latest = latestPoint(points);
  const weekValues = bucketDailyValues(points, reducer);

  if (key === 'weight') {
    const value = latest?.value ?? profile?.weightKg ?? null;
    return {
      key,
      value,
      unit: 'kg',
      statusKa: value != null ? weightStatusKg(value, profile?.heightCm) : ka.healthMetrics.noData,
      updatedLabel: updatedLabelFromDate(latest?.date ?? null),
      weekValues: value != null && !latest ? [value, ...weekValues.slice(1)] : weekValues,
      source: latest ? source : profile?.weightKg != null ? 'profile' : 'none',
    };
  }

  if (key === 'bloodPressure') {
    const sys = latest?.value ?? profile?.bloodPressureSystolic ?? null;
    const dia = latest?.valueSecondary ?? profile?.bloodPressureDiastolic ?? null;
    return {
      key,
      value: sys,
      valueSecondary: dia,
      unit: 'mmHg',
      statusKa:
        sys != null && dia != null ? bpStatus(sys, dia) : ka.healthMetrics.noData,
      updatedLabel: updatedLabelFromDate(latest?.date ?? null),
      weekValues,
      source: latest ? source : sys != null ? 'profile' : 'none',
    };
  }

  if (key === 'heartRate') {
    const value = latest?.value ?? profile?.restingHeartRate ?? null;
    return {
      key,
      value,
      unit: 'bpm',
      statusKa: value != null ? hrStatus(value) : ka.healthMetrics.noData,
      updatedLabel: updatedLabelFromDate(latest?.date ?? null),
      weekValues,
      source: latest ? source : value != null ? 'profile' : 'none',
    };
  }

  if (key === 'sleep') {
    const value = latest?.value ?? profile?.sleepHours ?? null;
    return {
      key,
      value,
      unit: ka.healthMetrics.hoursUnit,
      statusKa: value != null ? sleepStatus(value) : ka.healthMetrics.noData,
      updatedLabel: updatedLabelFromDate(latest?.date ?? null),
      weekValues,
      source: latest ? source : value != null ? 'profile' : 'none',
    };
  }

  if (key === 'nutrition') {
    const value = latest?.value ?? null;
    return {
      key,
      value,
      unit: 'kcal',
      statusKa: value != null ? nutritionStatus(value) : ka.healthMetrics.noData,
      updatedLabel: updatedLabelFromDate(latest?.date ?? null),
      weekValues,
      source: latest ? source : 'none',
    };
  }

  const liters = profile?.waterIntakeL ?? null;
  const value = latest?.value ?? (liters != null ? liters * 1000 : null);
  return {
    key,
    value,
    unit: 'ml',
    statusKa: value != null ? hydrationStatus(value) : ka.healthMetrics.noData,
    updatedLabel: updatedLabelFromDate(latest?.date ?? null),
    weekValues,
    source: latest ? source : liters != null ? 'profile' : 'none',
  };
}

export function buildMetricsBundle(
  raw: Partial<Record<HealthMetricKey, HealthMetricPoint[]>>,
  profile: HealthProfile | null | undefined,
  connected: boolean,
  platform: 'apple' | 'google' | null,
): HealthMetricsBundle {
  const reducers: Record<HealthMetricKey, 'latest' | 'sum' | 'avg'> = {
    weight: 'latest',
    bloodPressure: 'latest',
    heartRate: 'avg',
    sleep: 'sum',
    nutrition: 'sum',
    hydration: 'sum',
  };

  const metrics = HEALTH_METRIC_ORDER.map((key) =>
    buildMetricSnapshot(
      key,
      raw[key] ?? [],
      profile,
      connected ? 'device' : 'none',
      reducers[key],
    ),
  );

  return {
    connected,
    platform,
    metrics,
    fetchedAt: new Date().toISOString(),
  };
}

export function formatMetricValue(metric: HealthMetricSnapshot): string {
  if (metric.value == null) return '—';
  if (metric.key === 'bloodPressure' && metric.valueSecondary != null) {
    return `${Math.round(metric.value)}/${Math.round(metric.valueSecondary)}`;
  }
  if (metric.key === 'sleep') return metric.value.toFixed(1);
  if (metric.key === 'weight') return metric.value.toFixed(1);
  if (metric.key === 'heartRate') return metric.value.toFixed(1);
  return Math.round(metric.value).toLocaleString('ka-GE');
}
