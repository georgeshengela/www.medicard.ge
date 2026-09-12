/**
 * TTC read-model query lifecycle.
 * Presentation-only: does not change forecast math or auth/token storage.
 */

import { supportsCycleCapability } from './cycleModeCapabilityMatrix.js';

export const TTC_FETCH_IDLE = 'idle';
export const TTC_FETCH_LOADING = 'loading';
export const TTC_FETCH_READY = 'ready';
export const TTC_FETCH_ERROR = 'error';

export function emptyTtcQueryState(userId = null) {
  return {
    status: TTC_FETCH_IDLE,
    data: null,
    errorKind: null,
    userId: userId || null,
  };
}

/**
 * Gate for GET /api/cycle/ttc.
 * Auth readiness must be known before any request. Mode comes from the loaded
 * Cycle profile — never from a guessed client flag.
 */
export function shouldFetchCycleTtc({
  authReady = false,
  authenticated = false,
  mode = null,
  reachable = true,
} = {}) {
  return (
    authReady === true &&
    authenticated === true &&
    supportsCycleCapability(mode, 'showTtcOverview') &&
    reachable !== false
  );
}

export function ttcQueryPending(status) {
  return status === TTC_FETCH_IDLE || status === TTC_FETCH_LOADING;
}

export function ttcEmptyCopyAllowed(status) {
  return status === TTC_FETCH_READY;
}

export function classifyTtcFetchError(error) {
  const status = Number(error?.status);
  if (status === 401) return 'auth';
  if (status === 0 || status === 408) return 'network';
  return 'fail';
}

export function beginTtcFetch(prev, { generation, currentGeneration, userId } = {}) {
  if (generation != null && currentGeneration != null && generation !== currentGeneration) {
    return prev;
  }
  const keepData = prev?.userId === userId ? prev.data : null;
  return {
    status: TTC_FETCH_LOADING,
    data: keepData,
    errorKind: null,
    userId: userId || prev?.userId || null,
  };
}

export function applyTtcSuccess(prev, { generation, currentGeneration, payload, userId } = {}) {
  if (generation != null && currentGeneration != null && generation !== currentGeneration) {
    return prev;
  }
  return {
    status: TTC_FETCH_READY,
    data: payload ?? null,
    errorKind: null,
    userId: userId || prev?.userId || null,
  };
}

/**
 * Failures are never coerced into a legitimate empty payload.
 * Previous successful data stays visible (soft fail).
 */
export function applyTtcFailure(prev, { generation, currentGeneration, error, userId } = {}) {
  if (generation != null && currentGeneration != null && generation !== currentGeneration) {
    return prev;
  }
  return {
    status: TTC_FETCH_ERROR,
    data: prev?.userId === userId ? prev.data : null,
    errorKind: classifyTtcFetchError(error),
    userId: userId || prev?.userId || null,
  };
}

export function scopeTtcQueryToUser(prev, userId) {
  const nextId = userId || null;
  if (prev?.userId === nextId) return prev || emptyTtcQueryState(nextId);
  return emptyTtcQueryState(nextId);
}

export function stopTtcQuery(prev) {
  return emptyTtcQueryState(prev?.userId || null);
}

/** DEV-only trace hook. No production console noise. */
export function ttcQueryTrace(event, extra) {
  if (typeof globalThis === 'undefined') return;
  const sink = globalThis.__CYCLE_TTC_TRACE;
  if (typeof sink !== 'function') return;
  if (typeof __DEV__ !== 'undefined' && __DEV__ === false) return;
  sink(event, extra || {});
}
