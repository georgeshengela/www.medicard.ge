/**
 * Postpartum read-model query lifecycle.
 * Presentation-only: does not change forecast math or auth/token storage.
 */

import { supportsCycleCapability } from './cycleModeCapabilityMatrix.js';

export const POSTPARTUM_FETCH_IDLE = 'idle';
export const POSTPARTUM_FETCH_LOADING = 'loading';
export const POSTPARTUM_FETCH_READY = 'ready';
export const POSTPARTUM_FETCH_ERROR = 'error';

export function emptyPostpartumQueryState(userId = null) {
  return {
    status: POSTPARTUM_FETCH_IDLE,
    data: null,
    errorKind: null,
    userId: userId || null,
  };
}

export function shouldFetchCyclePostpartum({
  authReady = false,
  authenticated = false,
  mode = null,
  reachable = true,
} = {}) {
  return (
    authReady === true &&
    authenticated === true &&
    supportsCycleCapability(mode, 'showPostpartumOverview') &&
    reachable !== false
  );
}

export function postpartumQueryPending(status) {
  return status === POSTPARTUM_FETCH_IDLE || status === POSTPARTUM_FETCH_LOADING;
}

export function postpartumEmptyCopyAllowed(status) {
  return status === POSTPARTUM_FETCH_READY;
}

export function classifyPostpartumFetchError(error) {
  const status = Number(error?.status);
  if (status === 401) return 'auth';
  if (status === 0 || status === 408) return 'network';
  return 'fail';
}

export function beginPostpartumFetch(prev, { generation, currentGeneration, userId } = {}) {
  if (generation != null && currentGeneration != null && generation !== currentGeneration) {
    return prev;
  }
  const keepData = prev?.userId === userId ? prev.data : null;
  return {
    status: POSTPARTUM_FETCH_LOADING,
    data: keepData,
    errorKind: null,
    userId: userId || prev?.userId || null,
  };
}

export function applyPostpartumSuccess(prev, { generation, currentGeneration, payload, userId } = {}) {
  if (generation != null && currentGeneration != null && generation !== currentGeneration) {
    return prev;
  }
  return {
    status: POSTPARTUM_FETCH_READY,
    data: payload ?? null,
    errorKind: null,
    userId: userId || prev?.userId || null,
  };
}

export function applyPostpartumFailure(prev, { generation, currentGeneration, error, userId } = {}) {
  if (generation != null && currentGeneration != null && generation !== currentGeneration) {
    return prev;
  }
  return {
    status: POSTPARTUM_FETCH_ERROR,
    data: prev?.userId === userId ? prev.data : null,
    errorKind: classifyPostpartumFetchError(error),
    userId: userId || prev?.userId || null,
  };
}

export function scopePostpartumQueryToUser(prev, userId) {
  const nextId = userId || null;
  if (prev?.userId === nextId) return prev || emptyPostpartumQueryState(nextId);
  return emptyPostpartumQueryState(nextId);
}

export function stopPostpartumQuery(prev) {
  return emptyPostpartumQueryState(prev?.userId || null);
}
