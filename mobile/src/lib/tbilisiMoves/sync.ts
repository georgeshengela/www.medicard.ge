import { Platform } from 'react-native';
import { ApiError, api } from '@/lib/api';
import { localAccountId, setLocalAccountId } from '@/lib/localAccount';
import { competitionInterval, datesToCollect, tbilisiYmd } from '@/lib/tbilisiMoves/civilTime.js';
import { readCompetitionSteps, isNativeHealthPushRuntime } from '@/lib/tbilisiMoves/sensor';
import {
  getOrCreateInstallationId,
  loadLastSyncOk,
  loadQueue,
  newTbilisiUuid,
  nextClientSequence,
  saveLastSyncOk,
  saveQueue,
  saveSourceConflict,
} from '@/lib/tbilisiMoves/storage';
import {
  ENROLL_SYNC_BUDGET_MS,
  MAX_TRANSIENT_RETRIES,
  SYNC_THROTTLE_MS,
  backoffMs,
  classifySyncError,
  ignoreGraceDateSensorFailure,
  shouldSubmitForUser,
} from '@/lib/tbilisiMoves/syncPolicy.js';
import type { SensorReading, TbilisiMovesObservationBody, TbilisiMovesStatus } from '@/lib/tbilisiMoves/types';

const DAILY_INSTALL_ID = 'medicard-health-metrics';

export type CompetitionSyncSnapshot = {
  kind: SensorReading['kind'];
  steps?: number;
  intervalStart: string;
  intervalEnd: string;
  tbilisiDate: string;
  provider?: SensorReading['provider'];
  note?: string;
};

export type CompetitionSyncState = {
  phase:
    | 'idle'
    | 'syncing'
    | 'pending'
    | 'ok'
    | 'stale'
    | 'conflict'
    | 'paused'
    | 'unavailable'
    | 'unsupported'
    | 'permission'
    | 'empty'
    | 'manual_only'
    | 'offline'
    | 'error';
  message?: string;
  lastOkAt: string | null;
  accepted?: boolean;
  credited?: number | null;
  lastReading?: CompetitionSyncSnapshot | null;
};

type QueuedObservation = TbilisiMovesObservationBody & { userId: string };

let generation = 0;
const chains = new Map<string, Promise<unknown>>();
let lastTriggerAt = 0;
let state: CompetitionSyncState = { phase: 'idle', lastOkAt: null };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeCompetitionSync(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCompetitionSyncState(): CompetitionSyncState {
  return state;
}

function setState(next: Partial<CompetitionSyncState>) {
  state = { ...state, ...next };
  emit();
}

function snapshotReading(reading: SensorReading): CompetitionSyncSnapshot {
  return {
    kind: reading.kind,
    steps: reading.steps,
    intervalStart: reading.intervalStart,
    intervalEnd: reading.intervalEnd,
    tbilisiDate: reading.tbilisiDate,
    provider: reading.provider,
    note: reading.note,
  };
}

async function pushPersonalHealthSteps(intervalStart: string) {
  if (!isNativeHealthPushRuntime()) return;
  try {
    const { Platform } = await import('react-native');
    const { syncNativeHealthToServer } = await import('@/lib/healthDataSync');
    if (Platform.OS === 'android') {
      const { fetchStepsNative } = await import('@/lib/healthSyncPlatform.android');
      await syncNativeHealthToServer({}, await fetchStepsNative(new Date(intervalStart)));
      return;
    }
    if (Platform.OS === 'ios') {
      const { fetchStepsNative } = await import('@/lib/healthSyncPlatform.ios');
      await syncNativeHealthToServer({}, await fetchStepsNative(new Date(intervalStart)));
    }
  } catch {
    // Stored daily / Home total can still be PUT below.
  }
}

function logSensor(reading: SensorReading, extra?: Record<string, unknown>) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.log('[tbilisi-moves] sensor', {
    kind: reading.kind,
    steps: reading.steps ?? null,
    tbilisiDate: reading.tbilisiDate,
    intervalStart: reading.intervalStart,
    intervalEnd: reading.intervalEnd,
    provider: reading.provider ?? null,
    ...extra,
  });
}

export function cancelTbilisiMovesWork() {
  generation += 1;
  setState({ phase: 'idle', message: undefined });
}

function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const previous = chains.get(userId) || Promise.resolve();
  const next = previous.then(fn, fn);
  chains.set(userId, next.then(() => undefined, () => undefined));
  return next;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function putWithRetry(userId: string, body: TbilisiMovesObservationBody, gen: number) {
  let attempt = 0;
  while (true) {
    if (generation !== gen || !shouldSubmitForUser(userId, localAccountId())) {
      return { skipped: true as const };
    }
    try {
      const result = await api.tbilisiMoves.putObservation(body);
      await saveQueue(null);
      return { result };
    } catch (error) {
      const classified = classifySyncError(error);
      if (classified.kind === 'source_conflict' && error instanceof ApiError) {
        await saveSourceConflict({
          at: new Date().toISOString(),
          code: error.code,
          message: error.message,
        });
        throw error;
      }
      if (!classified.retry || attempt >= MAX_TRANSIENT_RETRIES) throw error;
      await saveQueue({ ...body, userId } satisfies QueuedObservation);
      await sleep(backoffMs(attempt));
      attempt += 1;
    }
  }
}

function observationWindow(ymd: string, status: TbilisiMovesStatus, now: Date) {
  const today = status.clock?.date || status.date || tbilisiYmd(now);
  const serverNow = new Date(status.serverNow || status.clock?.serverNow || now);
  if (ymd === today && status.clock?.dayStart) {
    const startMs = new Date(status.clock.dayStart).getTime();
    const dayEndMs = new Date(status.clock.dayEnd || status.clock.nextMidnight || serverNow).getTime();
    const endMs = Math.min(serverNow.getTime(), dayEndMs);
    return {
      intervalStart: status.clock.dayStart,
      intervalEnd: new Date(Math.max(endMs, startMs + 1000)).toISOString(),
      recordedAt: serverNow.toISOString(),
    };
  }
  const interval = competitionInterval(ymd, serverNow);
  return {
    intervalStart: interval.start.toISOString(),
    intervalEnd: interval.end.toISOString(),
    recordedAt: new Date(Math.min(serverNow.getTime(), interval.end.getTime())).toISOString(),
  };
}

function providersToTry(preferred?: SensorReading['provider']): Array<NonNullable<SensorReading['provider']>> {
  const first = preferred || (Platform.OS === 'ios' ? 'APPLE_HEALTH' : 'HEALTH_CONNECT');
  const second = first === 'APPLE_HEALTH' ? 'HEALTH_CONNECT' : 'APPLE_HEALTH';
  return [first, second];
}

async function installIdsToTry(): Promise<string[]> {
  const ids = [DAILY_INSTALL_ID];
  const device = await getOrCreateInstallationId();
  if (device && device !== DAILY_INSTALL_ID) ids.push(device);
  return ids;
}

async function readingToBody(
  reading: SensorReading,
  installId: string,
  window: { intervalStart: string; intervalEnd: string; recordedAt: string },
  provider: NonNullable<SensorReading['provider']>,
): Promise<TbilisiMovesObservationBody | null> {
  if (reading.kind !== 'ok' && reading.kind !== 'zero') return null;
  if (reading.steps == null) return null;
  return {
    provider,
    sourceInstallationId: installId,
    tbilisiDate: reading.tbilisiDate,
    intervalStart: window.intervalStart,
    intervalEnd: window.intervalEnd,
    cumulativeSteps: Math.round(Number(reading.steps) || 0),
    recordedAt: window.recordedAt,
    clientObservationId: newTbilisiUuid(),
    clientSequence: await nextClientSequence(),
  };
}

async function nudgeHealthDaily(ymd: string, steps: number) {
  if (steps <= 0) return;
  try {
    await api.healthMetrics.sync({ daily: [{ date: ymd, steps }] });
  } catch {
    // Steps-only nudge must not touch hydration or fail the hub.
  }
}

async function syncOneDate(userId: string, ymd: string, status: TbilisiMovesStatus, gen: number) {
  const collectedAt = new Date(status.serverNow || Date.now());
  const reading = await readCompetitionSteps(ymd, collectedAt);
  if (reading.kind === 'unsupported') return { reading };
  if (reading.kind === 'permission' || reading.kind === 'unavailable') return { reading };
  if (reading.kind === 'empty' || reading.kind === 'manual_only' || reading.kind === 'error') return { reading };

  await nudgeHealthDaily(ymd, reading.steps || 0);
  try {
    const after = await api.tbilisiMoves.me();
    const raw = after.overview?.you?.rawObservedSteps ?? 0;
    if (raw >= (reading.steps || 0) && raw > 0) {
      return {
        reading,
        result: {
          accepted: true,
          credit: {
            districtId: after.overview?.you?.districtId || '',
            rawObservedSteps: raw,
            eligibleSteps: after.overview?.you?.eligibleSteps ?? raw,
            capSnapshot: after.overview?.you?.capSnapshot || 0,
          },
        },
      };
    }
  } catch {
    // Fall through to PUT.
  }

  const window = observationWindow(ymd, status, collectedAt);
  const aligned: SensorReading = {
    ...reading,
    intervalStart: window.intervalStart,
    intervalEnd: window.intervalEnd,
    recordedAt: window.recordedAt,
  };
  let lastError: unknown = null;

  for (const provider of providersToTry(reading.provider)) {
    for (const installId of await installIdsToTry()) {
      if (generation !== gen) return { reading: aligned };
      const body = await readingToBody(aligned, installId, window, provider);
      if (!body) return { reading: aligned };
      try {
        const outcome = await putWithRetry(userId, body, gen);
        if ('skipped' in outcome && outcome.skipped) return { reading: aligned };
        const result = 'result' in outcome ? outcome.result : undefined;
        if (result?.accepted) {
          return { reading: { ...aligned, provider }, result };
        }
        if (result && 'reason' in result && result.reason === 'SOURCE_CONFLICT') {
          lastError = new ApiError(String((result as { reason?: string }).reason), 409, { code: 'SOURCE_CONFLICT' });
          continue;
        }
        return { reading: { ...aligned, provider }, ...outcome };
      } catch (error) {
        const classified = classifySyncError(error);
        if (classified.kind === 'source_conflict') {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
  }

  if (lastError && typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[tbilisi-moves] put did not accept', lastError instanceof ApiError ? lastError.code : lastError);
  }
  return { reading: aligned };
}

async function runLocked(userId: string, reason: string, force: boolean) {
  const gen = generation;
  if (!shouldSubmitForUser(userId, localAccountId())) return;

  const alreadyCredited = (state.credited ?? 0) > 0;
  if (
    !force &&
    reason !== 'enroll' &&
    reason !== 'refresh' &&
    alreadyCredited &&
    Date.now() - lastTriggerAt < SYNC_THROTTLE_MS
  ) {
    return;
  }
  lastTriggerAt = Date.now();

  const lastOkAt = await loadLastSyncOk();
  setState({ phase: 'syncing', lastOkAt });

  let status: TbilisiMovesStatus;
  try {
    status = await api.tbilisiMoves.status();
  } catch (error) {
    setState({
      phase: classifySyncError(error).kind === 'transient' ? 'offline' : 'error',
      message: error instanceof Error ? error.message : undefined,
      lastOkAt,
    });
    return;
  }

  if (!status.schemaReady || !status.featureEnabled) {
    setState({ phase: 'unavailable', lastOkAt });
    return;
  }
  if (status.ingestionPaused || status.ingestEligible === false) {
    setState({ phase: 'paused', lastOkAt, message: 'ingestion_paused' });
    return;
  }

  const serverDate = status.date || tbilisiYmd(new Date());
  const interval = competitionInterval(serverDate, new Date());
  if (reason !== 'live') await pushPersonalHealthSteps(interval.start.toISOString());
  if (generation !== gen) return;

  let me;
  try {
    me = await api.tbilisiMoves.me();
  } catch (error) {
    if (error instanceof ApiError && (error.code === 'FEATURE_DISABLED' || error.code === 'SCHEMA_NOT_READY')) {
      setState({ phase: 'unavailable', lastOkAt });
      return;
    }
    if (error instanceof ApiError && error.code === 'NOT_ENROLLED') {
      setState({ phase: 'idle', lastOkAt });
      return;
    }
    setState({
      phase: classifySyncError(error).kind === 'transient' ? 'offline' : 'error',
      message: error instanceof Error ? error.message : undefined,
      lastOkAt,
    });
    return;
  }

  if (!me.membership.enrolled) {
    setState({ phase: 'idle', lastOkAt });
    return;
  }
  if (me.sync?.ingestEligible === false || me.sync?.ingestionPaused) {
    setState({ phase: 'paused', lastOkAt });
    return;
  }

  const shouldPut = reason !== 'live' || !(me.overview?.you?.rawObservedSteps);
  let accepted = false;
  let credited: number | null = me.overview?.you?.eligibleSteps ?? me.overview?.you?.rawObservedSteps ?? null;
  let lastReading: SensorReading | null = null;
  let lastAcceptedReading: SensorReading | null = null;

  if (shouldPut) {
    const grace = me.overview?.round?.rules?.lateSyncGraceHours ?? status.lateSyncGraceHours ?? 8;
    const dates = datesToCollect({
      serverDate: me.clock?.date || me.date || serverDate,
      graceHours: grace,
      now: new Date(status.serverNow || Date.now()),
    });

    const queued = (await loadQueue()) as QueuedObservation | null;
    if (queued && queued.userId === userId) {
      try {
        await putWithRetry(userId, queued, gen);
      } catch {
        await saveQueue(null);
      }
    } else if (queued && queued.userId !== userId) {
      await saveQueue(null);
    }

    for (const ymd of dates) {
      if (generation !== gen) return;
      try {
        const outcome = await syncOneDate(userId, ymd, status, gen);
        lastReading = outcome.reading;
        logSensor(outcome.reading, {
          date: ymd,
          accepted: 'result' in outcome ? Boolean(outcome.result?.accepted) : false,
          credited: 'result' in outcome ? outcome.result?.credit?.eligibleSteps ?? null : null,
        });
        if ('result' in outcome && outcome.result?.accepted) {
          accepted = true;
          credited = outcome.result.credit?.eligibleSteps ?? credited;
          lastAcceptedReading = outcome.reading;
        } else if ((outcome.reading.steps || 0) > 0) {
          credited = Math.max(credited || 0, outcome.reading.steps || 0);
        }
        if (outcome.reading.kind === 'unsupported') {
          if (ignoreGraceDateSensorFailure({ dateYmd: ymd, todayYmd: serverDate, todayAccepted: accepted })) {
            continue;
          }
          break;
        }
      } catch (error) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[tbilisi-moves] put failed', error instanceof ApiError ? { code: error.code, status: error.status, message: error.message } : error);
        }
        if (error instanceof ApiError && error.code === 'NO_DISTRICT_FOR_DATE') continue;
        if ((lastReading?.steps || 0) > 0) {
          credited = Math.max(credited || 0, lastReading?.steps || 0);
          continue;
        }
        const classified = classifySyncError(error);
        if (classified.kind === 'unauthorized') {
          setState({ phase: 'error', lastOkAt, message: 'unauthorized' });
          return;
        }
        if (error instanceof ApiError && (error.code === 'INGESTION_PAUSED' || error.code === 'INGESTION_HOLD_OVERLAP')) {
          setState({ phase: 'paused', lastOkAt, message: error.code });
          return;
        }
        continue;
      }
    }

    try {
      me = await api.tbilisiMoves.me();
      credited = me.overview?.you?.eligibleSteps ?? me.overview?.you?.rawObservedSteps ?? credited;
    } catch {
      // Keep the PUT credit if the follow-up GET fails.
    }
  }

  const date = me.clock?.date || me.date || serverDate;
  const raw = Math.max(
    me.overview?.you?.rawObservedSteps ?? 0,
    lastAcceptedReading?.steps ?? 0,
    lastReading?.steps ?? 0,
    credited ?? 0,
  );
  const okAt = new Date().toISOString();
  if (accepted || raw > 0) await saveLastSyncOk(okAt);
  setState({
    phase: 'ok',
    lastOkAt: accepted || raw > 0 ? okAt : lastOkAt,
    accepted: accepted || raw > 0,
    credited: raw > 0 ? raw : credited,
    lastReading: lastAcceptedReading
      ? snapshotReading(lastAcceptedReading)
      : lastReading
        ? snapshotReading(lastReading)
        : snapshotReading({
            kind: raw > 0 ? 'ok' : 'zero',
            steps: raw,
            intervalStart: interval.start.toISOString(),
            intervalEnd: interval.end.toISOString(),
            tbilisiDate: date,
            recordedAt: okAt,
            provider: 'HEALTH_CONNECT',
          }),
  });
}

export { ENROLL_SYNC_BUDGET_MS };

export async function runCompetitionSync(input: {
  userId: string;
  reason: 'enroll' | 'focus' | 'foreground' | 'refresh' | 'live';
  force?: boolean;
}) {
  if (input.userId) setLocalAccountId(input.userId);
  return withUserLock(input.userId, async () => {
    try {
      await runLocked(input.userId, input.reason, Boolean(input.force));
    } catch (error) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[tbilisi-moves] sync crashed', error);
      }
      setState({
        phase: classifySyncError(error).kind === 'transient' ? 'pending' : 'error',
        message: error instanceof Error ? error.message : undefined,
        lastOkAt: state.lastOkAt,
      });
    }
  });
}

export function competitionIntervalForDate(ymd: string, now = new Date()) {
  return competitionInterval(ymd, now);
}
