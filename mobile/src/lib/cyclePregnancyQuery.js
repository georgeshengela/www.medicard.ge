/**
 * Pregnancy read-model query lifecycle.
 * Presentation-only: does not change forecast math or auth/token storage.
 */

import { supportsCycleCapability } from './cycleModeCapabilityMatrix.js';

export const PREGNANCY_FETCH_IDLE = 'idle';
export const PREGNANCY_FETCH_LOADING = 'loading';
export const PREGNANCY_FETCH_READY = 'ready';
export const PREGNANCY_FETCH_ERROR = 'error';

export function emptyPregnancyQueryState(userId = null) {
  return {
    status: PREGNANCY_FETCH_IDLE,
    data: null,
    errorKind: null,
    userId: userId || null,
  };
}

/**
 * Gate for GET /api/cycle/pregnancy.
 * Auth readiness must be known before any request. Mode comes from the loaded
 * Cycle profile — never from a guessed client flag or a pregnancy-test result.
 */
export function shouldFetchCyclePregnancy({
  authReady = false,
  authenticated = false,
  mode = null,
  reachable = true,
} = {}) {
  return (
    authReady === true &&
    authenticated === true &&
    supportsCycleCapability(mode, 'showPregnancyOverview') &&
    reachable !== false
  );
}

export function pregnancyQueryPending(status) {
  return status === PREGNANCY_FETCH_IDLE || status === PREGNANCY_FETCH_LOADING;
}

export function pregnancyEmptyCopyAllowed(status) {
  return status === PREGNANCY_FETCH_READY;
}

export function classifyPregnancyFetchError(error) {
  const status = Number(error?.status);
  if (status === 401) return 'auth';
  if (status === 0 || status === 408) return 'network';
  return 'fail';
}

export function beginPregnancyFetch(prev, { generation, currentGeneration, userId } = {}) {
  if (generation != null && currentGeneration != null && generation !== currentGeneration) {
    return prev;
  }
  const keepData = prev?.userId === userId ? prev.data : null;
  return {
    status: PREGNANCY_FETCH_LOADING,
    data: keepData,
    errorKind: null,
    userId: userId || prev?.userId || null,
  };
}

export function applyPregnancySuccess(prev, { generation, currentGeneration, payload, userId } = {}) {
  if (generation != null && currentGeneration != null && generation !== currentGeneration) {
    return prev;
  }
  return {
    status: PREGNANCY_FETCH_READY,
    data: payload ?? null,
    errorKind: null,
    userId: userId || prev?.userId || null,
  };
}

export function applyPregnancyFailure(prev, { generation, currentGeneration, error, userId } = {}) {
  if (generation != null && currentGeneration != null && generation !== currentGeneration) {
    return prev;
  }
  return {
    status: PREGNANCY_FETCH_ERROR,
    data: prev?.userId === userId ? prev.data : null,
    errorKind: classifyPregnancyFetchError(error),
    userId: userId || prev?.userId || null,
  };
}

export function scopePregnancyQueryToUser(prev, userId) {
  const nextId = userId || null;
  if (prev?.userId === nextId) return prev || emptyPregnancyQueryState(nextId);
  return emptyPregnancyQueryState(nextId);
}

export function stopPregnancyQuery(prev) {
  return emptyPregnancyQueryState(prev?.userId || null);
}
