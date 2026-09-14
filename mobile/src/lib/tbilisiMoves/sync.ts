import { ApiError, api } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { competitionInterval, datesToCollect, tbilisiYmd } from '@/lib/tbilisiMoves/civilTime.js';
import { readCompetitionSteps } from '@/lib/tbilisiMoves/sensor';
import {
  getOrCreateInstallationId,
  loadLastSyncOk,
  loadQueue,
  nextClientSequence,
  saveLastSyncOk,
  saveQueue,
  saveSourceConflict,
} from '@/lib/tbilisiMoves/storage';
import {
  MAX_TRANSIENT_RETRIES,
  SYNC_THROTTLE_MS,
  backoffMs,
  classifySyncError,
  shouldSubmitForUser,
} from '@/lib/tbilisiMoves/syncPolicy.js';
import type { SensorReading, TbilisiMovesObservationBody, TbilisiMovesStatus } from '@/lib/tbilisiMoves/types';

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

async function readingToBody(
  reading: SensorReading,
  installId: string,
  queued: QueuedObservation | null,
): Promise<TbilisiMovesObservationBody | null> {
  if (reading.kind !== 'ok' && reading.kind !== 'zero') return null;
  if (reading.steps == null || !reading.provider) return null;
  const draft: Omit<TbilisiMovesObservationBody, 'clientObservationId' | 'clientSequence'> = {
    provider: reading.provider,
    sourceInstallationId: installId,
    tbilisiDate: reading.tbilisiDate,
    intervalStart: reading.intervalStart,
    intervalEnd: reading.intervalEnd,
    cumulativeSteps: reading.steps,
    recordedAt: reading.recordedAt,
  };
  if (
    queued &&
    queued.tbilisiDate === draft.tbilisiDate &&
    queued.provider === draft.provider &&
    queued.sourceInstallationId === draft.sourceInstallationId &&
    queued.cumulativeSteps === draft.cumulativeSteps &&
    queued.intervalStart === draft.intervalStart &&
    queued.intervalEnd === draft.intervalEnd
  ) {
    return queued;
  }
  return {
    ...draft,
    clientObservationId: globalThis.crypto.randomUUID(),
    clientSequence: await nextClientSequence(),
  };
}

async function syncOneDate(userId: string, ymd: string, installId: string, gen: number) {
  const collectedAt = new Date();
  const reading = await readCompetitionSteps(ymd, collectedAt);
  if (tbilisiYmd(new Date()) !== tbilisiYmd(collectedAt)) {
    return { reading: await readCompetitionSteps(ymd, new Date()) };
  }
  if (reading.kind === 'unsupported') return { reading };
  if (reading.kind === 'permission' || reading.kind === 'unavailable') return { reading };
  if (reading.kind === 'empty' || reading.kind === 'manual_only' || reading.kind === 'error') return { reading };

  const queued = (await loadQueue()) as QueuedObservation | null;
  const queuedForUser = queued && queued.userId === userId ? queued : null;
  const body = await readingToBody(reading, installId, queuedForUser);
  if (!body) return { reading };

  const result = await putWithRetry(userId, body, gen);
  return { reading, ...result };
}

async function runLocked(userId: string, reason: string, force: boolean) {
  const gen = generation;
  if (!shouldSubmitForUser(userId, localAccountId())) return;

  if (!force && reason !== 'enroll' && reason !== 'refresh' && Date.now() - lastTriggerAt < SYNC_THROTTLE_MS) {
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
  if (status.ingestionPaused || !status.ingestEligible) {
    setState({ phase: 'paused', lastOkAt, message: 'ingestion_paused' });
    return;
  }

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

  if (!me.membership.enrolled || !me.sync?.ingestEligible) {
    setState({ phase: me.membership.enrolled ? 'paused' : 'idle', lastOkAt });
    return;
  }

  const serverDate = me.clock?.date || me.date || status.date;
  const grace = me.overview.round.rules.lateSyncGraceHours ?? status.lateSyncGraceHours ?? 8;
  const dates = datesToCollect({ serverDate, graceHours: grace, now: new Date() });
  const installId = await getOrCreateInstallationId();
  if (!installId) {
    setState({ phase: 'error', message: 'missing_install_id', lastOkAt });
    return;
  }

  const queued = (await loadQueue()) as QueuedObservation | null;
  if (queued && queued.userId === userId) {
    try {
      await putWithRetry(userId, queued, gen);
    } catch (error) {
      const classified = classifySyncError(error);
      if (classified.kind === 'source_conflict') {
        setState({ phase: 'conflict', lastOkAt, message: error instanceof Error ? error.message : undefined });
        return;
      }
      if (!classified.retry) await saveQueue(null);
    }
  } else if (queued && queued.userId !== userId) {
    await saveQueue(null);
  }

  let lastReading: SensorReading | null = null;
  let accepted = false;
  let credited: number | null = null;
  for (const ymd of dates) {
    if (generation !== gen) return;
    try {
      const outcome = await syncOneDate(userId, ymd, installId, gen);
      lastReading = outcome.reading;
      if ('result' in outcome && outcome.result?.accepted) {
        accepted = true;
        credited = outcome.result.credit?.eligibleSteps ?? credited;
      }
      if (outcome.reading.kind === 'unsupported') {
        setState({ phase: 'unsupported', lastOkAt, message: outcome.reading.note });
        return;
      }
      if (outcome.reading.kind === 'permission') {
        setState({ phase: 'permission', lastOkAt, message: outcome.reading.note });
        return;
      }
    } catch (error) {
      const classified = classifySyncError(error);
      if (classified.kind === 'source_conflict') {
        setState({ phase: 'conflict', lastOkAt, message: error instanceof Error ? error.message : undefined });
        return;
      }
      if (classified.kind === 'unauthorized') {
        setState({ phase: 'error', lastOkAt, message: 'unauthorized' });
        return;
      }
      if (error instanceof ApiError && (error.code === 'INGESTION_PAUSED' || error.code === 'INGESTION_HOLD_OVERLAP')) {
        setState({ phase: 'paused', lastOkAt, message: error.code });
        return;
      }
      if (!classified.retry) {
        setState({ phase: 'error', lastOkAt, message: error instanceof Error ? error.message : undefined });
        return;
      }
      setState({ phase: 'pending', lastOkAt, message: error instanceof Error ? error.message : undefined });
      return;
    }
  }

  if (lastReading?.kind === 'empty') {
    setState({ phase: 'empty', lastOkAt, message: lastReading.note });
    return;
  }
  if (lastReading?.kind === 'manual_only') {
    setState({ phase: 'manual_only', lastOkAt, message: lastReading.note });
    return;
  }
  if (lastReading?.kind === 'unavailable') {
    setState({ phase: 'unsupported', lastOkAt, message: lastReading.note });
    return;
  }

  const okAt = new Date().toISOString();
  if (accepted) await saveLastSyncOk(okAt);
  setState({
    phase: accepted ? 'ok' : lastReading?.kind === 'zero' ? 'ok' : 'ok',
    lastOkAt: accepted ? okAt : lastOkAt,
    accepted,
    credited,
  });
}

export async function runCompetitionSync(input: {
  userId: string;
  reason: 'enroll' | 'focus' | 'foreground' | 'refresh';
  force?: boolean;
}) {
  return withUserLock(input.userId, () => runLocked(input.userId, input.reason, Boolean(input.force)));
}

export function competitionIntervalForDate(ymd: string, now = new Date()) {
  return competitionInterval(ymd, now);
}
