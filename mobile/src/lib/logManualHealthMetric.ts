import { api, type HealthProfile } from '@/lib/api';
import type { HealthMetricsSyncPayload } from '@/lib/healthMetricsStorage';
import type { HealthMetricKey } from '@/types/healthMetrics';

export type LoggableMetricKey = HealthMetricKey | 'steps';

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildDailyRow(
  key: LoggableMetricKey,
  value: number,
  valueSecondary?: number,
): HealthMetricsSyncPayload['daily'][number] {
  const row: HealthMetricsSyncPayload['daily'][number] = { date: todayYmd() };

  switch (key) {
    case 'steps':
      row.steps = Math.round(value);
      break;
    case 'weight':
      row.weightKg = value;
      break;
    case 'bloodPressure':
      row.bloodPressureSystolic = Math.round(value);
      row.bloodPressureDiastolic = Math.round(valueSecondary ?? 80);
      break;
    case 'heartRate':
      row.heartRate = Math.round(value);
      break;
    case 'sleep':
      row.sleepHours = value;
      break;
    case 'nutrition':
      row.nutritionKcal = Math.round(value);
      break;
    case 'hydration':
      row.hydrationMl = Math.round(value);
      break;
    default:
      break;
  }

  return row;
}

function profilePatchForKey(
  key: LoggableMetricKey,
  value: number,
  valueSecondary: number | undefined,
  profile: HealthProfile | null | undefined,
): Record<string, unknown> {
  const extra = {
    ...((profile?.extraAnswers ?? {}) as Record<string, unknown>),
    firstHealthMetricLogged: true,
  };
  const patch: Record<string, unknown> = { extraAnswers: extra };

  switch (key) {
    case 'weight':
      patch.weightKg = value;
      break;
    case 'bloodPressure':
      patch.bloodPressureSystolic = Math.round(value);
      patch.bloodPressureDiastolic = Math.round(valueSecondary ?? 80);
      break;
    case 'heartRate':
      patch.restingHeartRate = Math.round(value);
      break;
    case 'sleep':
      patch.sleepHours = value;
      break;
    case 'hydration':
      patch.waterIntakeL = value / 1000;
      break;
    default:
      break;
  }

  return patch;
}

export async function logManualHealthMetric(
  key: LoggableMetricKey,
  value: number,
  valueSecondary?: number,
  profile?: HealthProfile | null,
): Promise<void> {
  const daily = buildDailyRow(key, value, valueSecondary);
  const stepLogs =
    key === 'steps'
      ? [{ at: new Date().toISOString(), count: Math.round(value) }]
      : [];

  await api.healthMetrics.sync({ daily: [daily], stepLogs });
  await api.healthProfile.update(profilePatchForKey(key, value, valueSecondary, profile));
}
