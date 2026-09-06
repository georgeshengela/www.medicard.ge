import { api } from '@/lib/api';
import {
  buildSyncPayloadFromNative,
  defaultSyncFromDate,
  defaultSyncToDate,
  mergeHealthDailyRows,
  type HealthMetricsSyncPayload,
  type StoredHealthDaily,
  type StoredStepLog,
} from '@/lib/healthMetricsStorage';
import { getScopedPreference, localAccountId, setLocalAccountId, setScopedPreference } from '@/lib/localAccount';
import { loadSessionSnapshot } from '@/lib/sessionSnapshot';
import { getToken } from '@/lib/storage';

const CACHE_KEY = 'medicard.health.metrics.cache';

export type StoredHealthBundle = {
  daily: StoredHealthDaily[];
  stepLogs: StoredStepLog[];
};

async function ensureAccountScope() {
  if (localAccountId()) return;
  const snapshot = await loadSessionSnapshot();
  if (snapshot?.user?.id) setLocalAccountId(snapshot.user.id);
}

export async function getCachedHealthBundle(): Promise<StoredHealthBundle | null> {
  return loadHealthCache();
}

export async function getCachedTodaySteps(): Promise<number | null> {
  const cached = await loadHealthCache();
  const today = new Date();
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const steps = cached?.daily.find((row) => row.date === ymd)?.steps;
  return steps != null && Number.isFinite(steps) && steps > 0 ? Math.round(steps) : null;
}

async function loadHealthCache(): Promise<StoredHealthBundle | null> {
  await ensureAccountScope();
  const raw = await getScopedPreference(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredHealthBundle;
    if (!Array.isArray(parsed?.daily)) return null;
    return {
      daily: parsed.daily,
      stepLogs: Array.isArray(parsed.stepLogs) ? parsed.stepLogs : [],
    };
  } catch {
    return null;
  }
}

async function saveHealthCache(bundle: StoredHealthBundle): Promise<void> {
  await ensureAccountScope();
  await setScopedPreference(CACHE_KEY, JSON.stringify(bundle));
}

export async function cacheLocalHealthSync(payload: HealthMetricsSyncPayload): Promise<void> {
  const cached = (await loadHealthCache()) ?? { daily: [], stepLogs: [] };
  const nextLogs = [...cached.stepLogs];
  for (const log of payload.stepLogs) {
    if (!nextLogs.some((row) => row.at === log.at && row.count === log.count)) {
      nextLogs.push({ id: `local:${log.at}:${log.count}`, at: log.at, count: log.count });
    }
  }
  await saveHealthCache({
    daily: mergeHealthDailyRows(cached.daily, payload.daily),
    stepLogs: nextLogs,
  });
}

export async function pullStoredHealth(from?: string, to?: string): Promise<StoredHealthBundle> {
  const token = await getToken();
  if (!token) {
    return (await loadHealthCache()) ?? { daily: [], stepLogs: [] };
  }

  try {
    const data = await api.healthMetrics.get({
      from: from ?? defaultSyncFromDate(),
      to: to ?? defaultSyncToDate(),
    });
    await saveHealthCache(data);
    return data;
  } catch {
    return (await loadHealthCache()) ?? { daily: [], stepLogs: [] };
  }
}

export async function pushHealthToServer(payload: HealthMetricsSyncPayload): Promise<void> {
  const token = await getToken();
  if (!token) return;
  if (!payload.daily.length && !payload.stepLogs.length) return;

  try {
    await api.healthMetrics.sync(payload);
    await cacheLocalHealthSync(payload);
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
