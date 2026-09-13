'use strict';

const PULL_TTL_MS = 12_000;
const HEALTH_PULL_CANCELLED = 'HEALTH_PULL_CANCELLED';

function makeHealthPullKey(identity, from, to) {
  const who = identity && String(identity).length > 0 ? String(identity) : 'none';
  return `${who}:${from}:${to}`;
}

function isUntrustedHealthPullKey(key) {
  const text = String(key || '');
  return text.startsWith('none:') || text.startsWith('pending:');
}

function canReuseHealthPull(cache, key, now, force, ttl = PULL_TTL_MS) {
  if (force || !cache || !key) return false;
  if (cache.key !== key) return false;
  if (isUntrustedHealthPullKey(key)) return false;
  return Number(now) - Number(cache.at) < ttl;
}

function shouldJoinHealthPull(inflight, key, from, to, generation) {
  if (!inflight || !inflight.key || !key) return false;
  if (generation != null && inflight.generation != null && inflight.generation !== generation) return false;
  if (isUntrustedHealthPullKey(inflight.key) || isUntrustedHealthPullKey(key)) return false;
  if (from != null && to != null) {
    const suffix = `:${from}:${to}`;
    if (!String(inflight.key).endsWith(suffix) || !String(key).endsWith(suffix)) return false;
  }
  return inflight.key === key;
}

function shouldInvalidateHealthPullOnTokenReplace(previous, next) {
  if (typeof previous !== 'string' || previous.length === 0) return false;
  if (typeof next !== 'string' || next.length === 0) return false;
  return previous !== next;
}

function shouldCommitHealthPull({
  startedGeneration,
  currentGeneration,
  startedKey,
  currentKey,
} = {}) {
  if (startedGeneration !== currentGeneration) return false;
  if (!currentKey || isUntrustedHealthPullKey(currentKey)) return false;
  if (!startedKey || isUntrustedHealthPullKey(startedKey) || startedKey !== currentKey) return false;
  return true;
}

function cancelledHealthPull() {
  const error = new Error('cancelled');
  error.code = HEALTH_PULL_CANCELLED;
  return error;
}

function isHealthPullCancelled(error) {
  return Boolean(error && error.code === HEALTH_PULL_CANCELLED);
}

module.exports = {
  PULL_TTL_MS,
  HEALTH_PULL_CANCELLED,
  makeHealthPullKey,
  isUntrustedHealthPullKey,
  canReuseHealthPull,
  shouldJoinHealthPull,
  shouldInvalidateHealthPullOnTokenReplace,
  shouldCommitHealthPull,
  cancelledHealthPull,
  isHealthPullCancelled,
};
