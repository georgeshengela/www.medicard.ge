'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const {
  PULL_TTL_MS,
  makeHealthPullKey,
  canReuseHealthPull,
  shouldJoinHealthPull,
  shouldInvalidateHealthPullOnTokenReplace,
  shouldCommitHealthPull,
  cancelledHealthPull,
  isHealthPullCancelled,
} = require('./healthPullCache.js');
const {
  notifyProtectedTokenReplace,
  subscribeProtectedTokenChange,
} = require('./protectedTokenChange.js');

describe('health-metrics pull cache identity', () => {
  it('keeps date-range keys distinct per user', () => {
    const from = '2026-06-15';
    const to = '2026-09-13';
    assert.equal(makeHealthPullKey('user-a', from, to), 'user-a:2026-06-15:2026-09-13');
    assert.notEqual(makeHealthPullKey('user-a', from, to), makeHealthPullKey('user-b', from, to));
  });

  it('does not reuse another account, an expired TTL, a forced refresh, or an unknown identity', () => {
    const keyA = makeHealthPullKey('user-a', '2026-06-15', '2026-09-13');
    const cache = { key: keyA, at: 1_000, data: { daily: [{ owner: 'a' }] } };
    assert.equal(canReuseHealthPull(cache, keyA, 1_000 + 3_000, false), true);
    assert.equal(canReuseHealthPull(cache, makeHealthPullKey('user-b', '2026-06-15', '2026-09-13'), 1_000 + 3_000, false), false);
    assert.equal(canReuseHealthPull(cache, keyA, 1_000 + PULL_TTL_MS + 1, false), false);
    assert.equal(canReuseHealthPull(cache, keyA, 1_000 + 3_000, true), false);
    assert.equal(canReuseHealthPull({ key: makeHealthPullKey('', 'a', 'b'), at: 1_000 }, makeHealthPullKey('', 'a', 'b'), 1_100, false), false);
  });

  it('joins in-flight pulls for the same account and date range', () => {
    const from = '2026-06-15';
    const to = '2026-09-13';
    const keyA = makeHealthPullKey('user-a', from, to);
    const inflight = { key: keyA, promise: Promise.resolve({ daily: ['shared'] }), generation: 4 };
    assert.equal(shouldJoinHealthPull(inflight, keyA, from, to, 4), true);
    assert.equal(inflight.promise === inflight.promise, true);
    assert.equal(shouldJoinHealthPull(inflight, makeHealthPullKey('user-b', from, to), from, to, 4), false);
    assert.equal(shouldJoinHealthPull(inflight, keyA, from, to, 5), false);
    assert.equal(shouldJoinHealthPull(inflight, makeHealthPullKey('user-a', from, '2026-09-01'), from, '2026-09-01', 4), false);
  });

  it('never joins a pending or unknown bucket to an authenticated identity', () => {
    const from = '2026-06-15';
    const to = '2026-09-13';
    const keyA = makeHealthPullKey('user-a', from, to);
    const pending = { key: makeHealthPullKey('pending', from, to), promise: Promise.resolve({ owner: 'unknown' }), generation: 4 };
    const none = { key: makeHealthPullKey('', from, to), promise: pending.promise, generation: 4 };
    assert.equal(shouldJoinHealthPull(pending, keyA, from, to, 4), false);
    assert.equal(shouldJoinHealthPull(pending, makeHealthPullKey('user-b', from, to), from, to, 4), false);
    assert.equal(shouldJoinHealthPull(none, keyA, from, to, 4), false);
    assert.equal(shouldJoinHealthPull({ key: keyA, promise: pending.promise, generation: 4 }, makeHealthPullKey('pending', from, to), from, to, 4), false);
  });
});

describe('health-metrics session generation', () => {
  it('discards a late A response after logout and adopt B', () => {
    const from = '2026-06-15';
    const to = '2026-09-13';
    const startedKey = makeHealthPullKey('user-a', from, to);
    const startedGeneration = 1;
    const afterReset = {
      startedGeneration,
      currentGeneration: 2,
      startedKey,
      currentKey: makeHealthPullKey('user-b', from, to),
    };
    assert.equal(shouldCommitHealthPull(afterReset), false);
    assert.equal(shouldCommitHealthPull({
      startedGeneration: 2,
      currentGeneration: 2,
      startedKey: makeHealthPullKey('user-b', from, to),
      currentKey: makeHealthPullKey('user-b', from, to),
    }), true);
  });

  it('does not commit when identity is unknown or the date range belongs to another pull', () => {
    assert.equal(shouldCommitHealthPull({
      startedGeneration: 3,
      currentGeneration: 3,
      startedKey: makeHealthPullKey('user-a', '2026-01-01', '2026-02-01'),
      currentKey: makeHealthPullKey('user-a', '2026-06-15', '2026-09-13'),
    }), false);
    assert.equal(shouldCommitHealthPull({
      startedGeneration: 3,
      currentGeneration: 3,
      startedKey: makeHealthPullKey('', 'a', 'b'),
      currentKey: makeHealthPullKey('', 'a', 'b'),
    }), false);
  });

  it('treats cancelled pulls as retryable and keys cache by account id, not a raw token', () => {
    const err = cancelledHealthPull();
    assert.equal(isHealthPullCancelled(err), true);
    const key = makeHealthPullKey('b2fdda25-0b36-4898-8ccb-1100de3cc897', '2026-06-15', '2026-09-13');
    assert.equal(key.startsWith('b2fdda25-0b36-4898-8ccb-1100de3cc897:'), true);
    assert.equal(key.includes('eyJ'), false);
    assert.equal(key.split('.').length === 3, false);
  });

  it('discards a late A payload after logout so it cannot fill B’s cache', async () => {
    const from = '2026-06-15';
    const to = '2026-09-13';
    let generation = 1;
    let currentId = 'user-a';
    const cache = new Map();
    let inflight = null;

    function start(id, payload, delayMs) {
      const startedGeneration = generation;
      const startedKey = makeHealthPullKey(id, from, to);
      const hint = startedKey;
      if (shouldJoinHealthPull(inflight, hint, from, to, startedGeneration)) {
        return inflight.promise;
      }
      const promise = new Promise((resolve, reject) => {
        setTimeout(() => {
          const currentKey = makeHealthPullKey(currentId, from, to);
          if (!shouldCommitHealthPull({
            startedGeneration,
            currentGeneration: generation,
            startedKey,
            currentKey,
          })) {
            if (inflight?.generation === startedGeneration && inflight?.key === hint) inflight = null;
            reject(cancelledHealthPull());
            return;
          }
          cache.set(currentKey, payload);
          if (inflight?.generation === startedGeneration && inflight?.key === hint) inflight = null;
          resolve(payload);
        }, delayMs);
      });
      inflight = { key: hint, promise, generation: startedGeneration };
      return promise;
    }

    const lateA = start('user-a', { owner: 'a', weightKg: 61.1 }, 30);
    generation += 1;
    inflight = null;
    currentId = 'user-b';
    cache.clear();
    const b = await start('user-b', { owner: 'b', weightKg: 72.2 }, 5);
    await assert.rejects(lateA, (err) => isHealthPullCancelled(err));
    assert.equal(b.owner, 'b');
    assert.equal(cache.get(makeHealthPullKey('user-b', from, to)).owner, 'b');
    assert.equal(cache.has(makeHealthPullKey('user-a', from, to)), false);
  });

  it('drops a rejected in-flight entry so a later retry is not stuck on the failed promise', async () => {
    const from = '2026-06-15';
    const to = '2026-09-13';
    let inflight = null;
    const key = makeHealthPullKey('user-a', from, to);
    const failed = Promise.reject(new Error('net'));
    inflight = { key, promise: failed, generation: 1 };
    failed.catch(() => {
      inflight = null;
    });
    await assert.rejects(failed);
    assert.equal(inflight, null);
    assert.equal(shouldJoinHealthPull(inflight, key, from, to, 1), false);
    const next = Promise.resolve({ owner: 'retry' });
    inflight = { key, promise: next, generation: 1 };
    assert.equal(shouldJoinHealthPull(inflight, key, from, to, 1), true);
    assert.equal(await inflight.promise, await next);
  });

  it('keeps the same account key when the JWT string changes and never stores the raw token', () => {
    const body = (sub, nonce) => Buffer.from(JSON.stringify({ sub, nonce })).toString('base64url');
    const tokenA = `eyJhbGciOiJub25l.${body('user-stable', 'one')}.sig-one`;
    const tokenB = `eyJhbGciOiJub25l.${body('user-stable', 'two')}.sig-two`;
    const subOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub;
    assert.equal(subOf(tokenA), 'user-stable');
    assert.equal(subOf(tokenB), 'user-stable');
    assert.notEqual(tokenA, tokenB);
    const keyA = makeHealthPullKey(subOf(tokenA), '2026-06-15', '2026-09-13');
    const keyB = makeHealthPullKey(subOf(tokenB), '2026-06-15', '2026-09-13');
    assert.equal(keyA, keyB);
    assert.equal(keyA.includes(tokenA), false);
    assert.equal(keyB.includes(tokenB), false);
  });

  it('same session waiters share one request after identity resolves', async () => {
    const from = '2026-06-15';
    const to = '2026-09-13';
    let identity = '';
    let generation = 1;
    let inflight = null;
    let fetches = 0;
    let release;
    const hold = new Promise((resolve) => {
      release = resolve;
    });

    async function pull() {
      const startedGeneration = generation;
      await hold;
      if (startedGeneration !== generation) throw cancelledHealthPull();
      if (!identity) throw cancelledHealthPull();
      const key = makeHealthPullKey(identity, from, to);
      if (shouldJoinHealthPull(inflight, key, from, to, startedGeneration)) {
        return inflight.promise;
      }
      fetches += 1;
      const promise = Promise.resolve({ owner: identity, fetches });
      inflight = { key, promise, generation: startedGeneration };
      return promise;
    }

    const first = pull();
    const second = pull();
    identity = 'user-a';
    release();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(fetches, 1);
    assert.equal(a.owner, 'user-a');
    assert.equal(b.owner, 'user-a');
    assert.equal(a, b);
  });

  it('pending A waiters do not share a promise or cache with B after logout', async () => {
    const from = '2026-06-15';
    const to = '2026-09-13';
    let identity = '';
    let generation = 1;
    let inflight = null;
    let fetches = 0;
    const cache = new Map();
    let release;
    const hold = new Promise((resolve) => {
      release = resolve;
    });

    async function pull() {
      const startedGeneration = generation;
      await hold;
      if (startedGeneration !== generation) throw cancelledHealthPull();
      if (!identity) throw cancelledHealthPull();
      const key = makeHealthPullKey(identity, from, to);
      if (shouldJoinHealthPull(inflight, key, from, to, startedGeneration)) {
        return inflight.promise;
      }
      fetches += 1;
      const promise = Promise.resolve({ owner: identity });
      inflight = { key, promise, generation: startedGeneration };
      cache.set(key, { owner: identity });
      return promise;
    }

    const pendingA = pull();
    generation += 1;
    inflight = null;
    cache.clear();
    identity = 'user-b';
    const b = pull();
    release();
    await assert.rejects(pendingA, (err) => isHealthPullCancelled(err));
    assert.equal((await b).owner, 'user-b');
    assert.equal(fetches, 1);
    assert.equal(cache.has(makeHealthPullKey('user-a', from, to)), false);
    assert.equal(cache.get(makeHealthPullKey('user-b', from, to)).owner, 'user-b');
  });

  it('invalidates in-flight work through the protected-token replacement path even when the account key is unchanged', () => {
    const from = '2026-06-15';
    const to = '2026-09-13';
    const body = (sub, nonce) => Buffer.from(JSON.stringify({ sub, nonce })).toString('base64url');
    const tokenA = `eyJhbGciOiJub25l.${body('user-stable', 'one')}.sig-one`;
    const tokenB = `eyJhbGciOiJub25l.${body('user-stable', 'two')}.sig-two`;
    const key = makeHealthPullKey('user-stable', from, to);
    let generation = 7;
    let inflight = { key, promise: Promise.resolve({ owner: 'stale' }), generation };
    let cache = { key, at: 1, data: { owner: 'stale' } };
    const off = subscribeProtectedTokenChange(() => {
      generation += 1;
      inflight = null;
      cache = null;
    });
    assert.equal(shouldInvalidateHealthPullOnTokenReplace(null, tokenA), false);
    assert.equal(notifyProtectedTokenReplace(null, tokenA), false);
    assert.equal(generation, 7);
    assert.equal(shouldInvalidateHealthPullOnTokenReplace(tokenA, tokenA), false);
    assert.equal(notifyProtectedTokenReplace(tokenA, tokenA), false);
    assert.equal(shouldInvalidateHealthPullOnTokenReplace(tokenA, tokenB), true);
    assert.equal(notifyProtectedTokenReplace(tokenA, tokenB), true);
    assert.equal(generation, 8);
    assert.equal(inflight, null);
    assert.equal(cache, null);
    assert.equal(shouldCommitHealthPull({
      startedGeneration: 7,
      currentGeneration: generation,
      startedKey: key,
      currentKey: key,
    }), false);
    assert.equal(key.includes(tokenA), false);
    assert.equal(key.includes(tokenB), false);
    off();
  });

  it('wires JWT replacement through setToken notify and health pull reset, not logout/adopt only', () => {
    const here = dirname(__filename);
    const storage = readFileSync(join(here, 'storage.ts'), 'utf8');
    const sync = readFileSync(join(here, 'healthDataSync.ts'), 'utf8');
    assert.match(storage, /notifyProtectedTokenReplace\(previous, token\)/);
    assert.match(sync, /subscribeProtectedTokenChange\(\(\) => \{\s*resetHealthPullCache\(\);/);
    assert.match(sync, /const startedGeneration = pullGeneration;\s*const token = await getToken\(\);/);
    assert.doesNotMatch(storage, /eyJ/);
    assert.doesNotMatch(sync, /eyJ/);
  });
});
