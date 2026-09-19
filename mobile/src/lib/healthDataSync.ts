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
import {
  canReuseHealthPull,
  cancelledHealthPull,
  isHealthPullCancelled,
  makeHealthPullKey,
  shouldCommitHealthPull,
  shouldJoinHealthPull,
} from '@/lib/healthPullCache.js';
import { jwtSubject } from '@/lib/jwtSubject';
import { getScopedPreference, localAccountId, setLocalAccountId, setScopedPreference } from '@/lib/localAccount';
import { subscribeProtectedTokenChange } from '@/lib/protectedTokenChange.js';
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
  if (snapshot?.user?.id) {
    setLocalAccountId(snapshot.user.id);
    return;
  }
  const token = await getToken();
  const id = jwtSubject(token);
  if (id) setLocalAccountId(id);
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

let pullGeneration = 0;
let pullInflight: { key: string; promise: Promise<StoredHealthBundle>; generation: number } | null = null;
let pullCache: { key: string; at: number; data: StoredHealthBundle } | null = null;
let lastHealthPullMeta: { kind: 'none' | 'memory' | 'api' | 'cache' | 'empty'; at: number } = {
  kind: 'none',
  at: 0,
};
const healthRefreshListeners = new Set<() => void>();

export function getLastHealthPullMeta() {
  return lastHealthPullMeta;
}

function setHealthPullMeta(kind: typeof lastHealthPullMeta.kind) {
  lastHealthPullMeta = { kind, at: Date.now() };
}

function pullIdentity(token: string | null) {
  return localAccountId() || jwtSubject(token) || '';
}

export function resetHealthPullCache() {
  pullGeneration += 1;
  pullInflight = null;
  pullCache = null;
  lastHealthPullMeta = { kind: 'none', at: 0 };
}

subscribeProtectedTokenChange(() => {
  resetHealthPullCache();
});

export function subscribeHealthRefresh(listener: () => void) {
  healthRefreshListeners.add(listener);
  return () => {
    healthRefreshListeners.delete(listener);
  };
}

export function requestHealthRefresh() {
  pullCache = null;
  healthRefreshListeners.forEach((listener) => listener());
}

export async function pullStoredHealth(
  from?: string,
  to?: string,
  opts?: { force?: boolean },
): Promise<StoredHealthBundle> {
  const fromKey = from ?? defaultSyncFromDate();
  const toKey = to ?? defaultSyncToDate();
  const startedGeneration = pullGeneration;
  const token = await getToken();
  if (startedGeneration !== pullGeneration) {
    throw cancelledHealthPull();
  }
  if (!token) {
    throw cancelledHealthPull();
  }

  const identity = pullIdentity(token);
  if (!identity) {
    throw cancelledHealthPull();
  }

  const key = makeHealthPullKey(identity, fromKey, toKey);
  if (shouldJoinHealthPull(pullInflight, key, fromKey, toKey, startedGeneration)) {
    return pullInflight!.promise;
  }

  const now = Date.now();
  if (canReuseHealthPull(pullCache, key, now, Boolean(opts?.force))) {
    setHealthPullMeta('memory');
    return pullCache!.data;
  }

  const promise = (async () => {
    try {
      const data = await api.healthMetrics.get({ from: fromKey, to: toKey });
      const currentKey = makeHealthPullKey(pullIdentity(await getToken()), fromKey, toKey);
      if (!shouldCommitHealthPull({
        startedGeneration,
        currentGeneration: pullGeneration,
        startedKey: key,
        currentKey,
      })) {
        throw cancelledHealthPull();
      }
      await saveHealthCache(data);
      pullCache = { key, at: Date.now(), data };
      setHealthPullMeta('api');
      return data;
    } catch (err) {
      if (isHealthPullCancelled(err)) {
        throw err;
      }
      if (!shouldCommitHealthPull({
        startedGeneration,
        currentGeneration: pullGeneration,
        startedKey: key,
        currentKey: makeHealthPullKey(pullIdentity(await getToken()), fromKey, toKey),
      })) {
        throw cancelledHealthPull();
      }
      const cached = await loadHealthCache();
      setHealthPullMeta(cached ? 'cache' : 'empty');
      return cached ?? { daily: [], stepLogs: [] };
    } finally {
      if (pullInflight?.generation === startedGeneration && pullInflight?.key === key) {
        pullInflight = null;
      }
    }
  })();
  pullInflight = { key, promise, generation: startedGeneration };
  return promise;
}

export async function pushHealthToServer(payload: HealthMetricsSyncPayload): Promise<void> {
  const token = await getToken();
  if (!token) return;
  if (!payload.daily.length && !payload.stepLogs.length && !payload.hydrationEvents?.length) return;

  try {
    await api.healthMetrics.sync(payload);
    await cacheLocalHealthSync(payload);
    void import('@/lib/quest/cache').then(({ requestQuestRefresh }) => requestQuestRefresh());
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
