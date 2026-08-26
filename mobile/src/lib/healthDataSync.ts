import { api } from '@/lib/api';
import {
  buildSyncPayloadFromNative,
  defaultSyncFromDate,
  defaultSyncToDate,
  type HealthMetricsSyncPayload,
} from '@/lib/healthMetricsStorage';
import { getToken } from '@/lib/storage';

export async function pullStoredHealth(from?: string, to?: string) {
  const token = await getToken();
  if (!token) return { daily: [] as import('@/lib/healthMetricsStorage').StoredHealthDaily[], stepLogs: [] as import('@/lib/healthMetricsStorage').StoredStepLog[] };

  try {
    return await api.healthMetrics.get({
      from: from ?? defaultSyncFromDate(),
      to: to ?? defaultSyncToDate(),
    });
  } catch {
    return { daily: [], stepLogs: [] };
  }
}

export async function pushHealthToServer(payload: HealthMetricsSyncPayload): Promise<void> {
  const token = await getToken();
  if (!token) return;
  if (!payload.daily.length && !payload.stepLogs.length) return;

  try {
    await api.healthMetrics.sync(payload);
  } catch {
    // Best-effort — device read should still work offline.
  }
}

export async function syncNativeHealthToServer(
  raw: Partial<Record<import('@/types/healthMetrics').HealthMetricKey, import('@/types/healthMetrics').HealthMetricPoint[]>>,
  stepSamples: import('@/types/stepsMetrics').StepSample[],
): Promise<void> {
  const payload = buildSyncPayloadFromNative(raw, stepSamples);
  await pushHealthToServer(payload);
}
