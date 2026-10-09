'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  CYCLE_OFFLINE_SCHEMA_VERSION,
  parseOfflineStore,
  readAccount,
  writeAccount,
  persistStore,
  emptyAccount,
  createCacheRecord,
  isCompleteCycleBundle,
  createMutation,
  compactCycleQueue,
  enqueueMutation,
  classifyCycleFailure,
  backoffMs,
  overlayPendingOnBundle,
  snapshotEqualsDerived,
  replayCycleQueue,
  accountIsolationSafe,
  planQueuedLogMutations,
  CYCLE_TAGS_PER_DAY_MAX,
  capDayTagIds,
  toggleDayTagId,
  discardMutation,
  attentionItems,
  cyclePersistFeedback,
  parseRetryAfterSeconds,
} = require('./cycleOfflineCore.js');
const {
  generateDekBytes,
  aesGcmEncrypt,
  aesGcmDecrypt,
  encryptStore,
  decryptStore,
  migratePlaintextToEncrypted,
} = require('./cycleOfflineCrypto.js');

function sampleBundle(overrides = {}) {
  return {
    meta: { today: '2026-08-29', timezone: 'Asia/Tbilisi' },
    cycleDay: 18,
    phase: 'follicular',
    phaseKa: 'ფოლიკულური',
    periodRanges: [{ start: '2026-08-12', end: '2026-08-16', lengthDays: 5, source: 'logged' }],
    averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default', cycleCount: 1 },
    profile: {
      lastPeriodStart: '2026-08-12',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      aiInsights: { headline: 'cached', cards: [], source: 'ai', generatedAt: '2026-08-29T10:00:00.000Z' },
      aiInsightsAt: '2026-08-29T10:00:00.000Z',
    },
    logs: [
      {
        id: 'log-12',
        userId: 'user-a',
        date: '2026-08-12',
        flow: 'medium',
        symptoms: [],
        moods: [],
        sexualActivity: null,
        libido: null,
        bbt: null,
        cervicalMucus: null,
        ovulationTest: null,
        pregnancyTest: null,
        notes: null,
      },
    ],
    pregnancyLogs: [],
    predictions: {
      nextPeriodStart: '2026-09-09',
      nextPeriodEnd: '2026-09-13',
      ovulationDate: '2026-08-25',
      fertileWindow: { start: '2026-08-23', end: '2026-08-27' },
      calendar: {
        '2026-08-29': { cycleDay: 18, phase: 'follicular', logged: false },
        '2026-08-30': { cycleDay: 19, phase: 'fertile', logged: false },
      },
      confidence: 'medium',
      estimated: true,
    },
    inferred: { avgCycleLength: 28, avgPeriodLength: 5, lastPeriodStart: '2026-08-12' },
    analytics: {
      insightDataQuality: 'MEDIUM',
      completedCycleCount: 4,
      painPatterns: [
        {
          kind: 'pain_before_period',
          painType: 'cramps',
          cyclesWithObservation: 3,
          eligibleCycles: 4,
          daysBeforeMin: 1,
          daysBeforeMax: 4,
        },
      ],
    },
    ...overrides,
  };
}

describe('schema versioning', () => {
  it('returns empty store for incompatible version', () => {
    const store = parseOfflineStore(JSON.stringify({ version: 99, accounts: { x: { queue: [1] } } }));
    assert.equal(store.version, CYCLE_OFFLINE_SCHEMA_VERSION);
    assert.deepEqual(store.accounts, {});
  });

  it('returns empty store for corrupted JSON', () => {
    const store = parseOfflineStore('{not-json');
    assert.deepEqual(store.accounts, {});
  });

  it('keeps version 1 accounts', () => {
    const store = parseOfflineStore(
      JSON.stringify({ version: 1, accounts: { 'user-a': { queue: [], cache: null } } }),
    );
    assert.ok(store.accounts['user-a']);
  });
});

describe('enqueue + persistence + restore', () => {
  it('enqueues a mutation onto an account', () => {
    let account = emptyAccount('user-a');
    account = enqueueMutation(
      account,
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' }),
    );
    assert.equal(account.queue.length, 1);
    assert.equal(account.queue[0].operation, 'UPSERT_LOG');
    assert.equal(account.queue[0].payload.flow, 'heavy');
    assert.ok(account.queue[0].id);
  });

  it('persists and restores after restart', () => {
    let store = persistStore(writeAccount(null, 'user-a', emptyAccount('user-a')));
    let account = readAccount(store, 'user-a');
    account = enqueueMutation(
      account,
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy', notes: 'secret' }),
    );
    account.cache = createCacheRecord('user-a', sampleBundle(), '2026-08-29T18:42:00.000Z');
    store = persistStore(writeAccount(store, 'user-a', account));

    const restored = readAccount(store, 'user-a');
    assert.equal(restored.queue.length, 1);
    assert.equal(restored.queue[0].payload.flow, 'heavy');
    assert.equal(restored.cache.cachedAt, '2026-08-29T18:42:00.000Z');
    assert.equal(restored.cache.bundle.cycleDay, 18);
  });
});

describe('queue compaction', () => {
  it('keeps the latest UPSERT_LOG for the same date', () => {
    const compacted = compactCycleQueue([
      createMutation('u', 'UPSERT_LOG', { date: '2026-08-30', flow: 'light' }),
      createMutation('u', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy', symptoms: ['cramps'] }),
    ]);
    assert.equal(compacted.length, 1);
    assert.equal(compacted[0].payload.flow, 'heavy');
    assert.deepEqual(compacted[0].payload.symptoms, ['cramps']);
  });

  it('does not compact different dates', () => {
    const compacted = compactCycleQueue([
      createMutation('u', 'UPSERT_LOG', { date: '2026-08-28', flow: 'medium' }),
      createMutation('u', 'UPSERT_LOG', { date: '2026-08-29', flow: 'heavy' }),
      createMutation('u', 'UPSERT_LOG', { date: '2026-08-30', flow: 'light' }),
    ]);
    assert.equal(compacted.length, 3);
  });

  it('does not compact START/END/FILL with log upserts', () => {
    const compacted = compactCycleQueue([
      createMutation('u', 'UPSERT_LOG', { date: '2026-08-30', flow: 'medium' }),
      createMutation('u', 'START_PERIOD', { date: '2026-08-30', flow: 'medium' }),
      createMutation('u', 'END_PERIOD', { date: '2026-09-02' }),
      createMutation('u', 'FILL_PERIOD', { start: '2026-08-10', end: '2026-08-12', flow: 'medium' }),
    ]);
    assert.equal(compacted.length, 4);
  });

  // A save of the same day while that day's earlier write is in flight: flushCycleQueue sends a
  // snapshot, then keeps only queue items whose id it did not send. The folded item must carry the
  // newer write's id, or the newer note is dropped as „sent“ once the older request succeeds.
  it('a write folded into an in-flight write of the same day is still sent after the flush', () => {
    const date = '2026-08-30';
    let account = emptyAccount('u');
    account = enqueueMutation(account, createMutation('u', 'UPSERT_LOG', { date, flow: 'light', notes: 'a' }));
    const inFlight = compactCycleQueue(account.queue);
    account = enqueueMutation(account, createMutation('u', 'UPSERT_LOG', { date, flow: 'light', notes: 'b' }));
    // The flush's own bookkeeping (cycleOffline.ts flushCycleQueue) after the in-flight request succeeded.
    const sentIds = new Set(inFlight.map((item) => item.id));
    const newlyEnqueued = account.queue.filter((item) => !sentIds.has(item.id));
    const next = compactCycleQueue([...newlyEnqueued]);
    assert.equal(next.length, 1);
    assert.equal(next[0].payload.notes, 'b');
    // The flow-only fold (one-tap undo) behaves the same way.
    let other = emptyAccount('u');
    other = enqueueMutation(other, createMutation('u', 'UPSERT_LOG', { date, flow: 'medium', symptoms: ['cramps'] }));
    const flying = compactCycleQueue(other.queue);
    other = enqueueMutation(other, createMutation('u', 'UPSERT_LOG', { date, flow: null }));
    const left = other.queue.filter((item) => !new Set(flying.map((i) => i.id)).has(item.id));
    assert.equal(left.length, 1);
    assert.deepEqual(left[0].payload.symptoms, ['cramps']);
    assert.equal(left[0].payload.flow, null);
  });

  it('replaces UPSERT with following REMOVE on the same date', () => {
    const compacted = compactCycleQueue([
      createMutation('u', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' }),
      createMutation('u', 'REMOVE_LOG', { date: '2026-08-30' }),
    ]);
    assert.equal(compacted.length, 1);
    assert.equal(compacted[0].operation, 'REMOVE_LOG');
  });

  // IR-7: offline she taps „მენსტრუაცია დაიწყო“, saves cramps and a note from the quick log while the toast
  // is up, then taps „გაუქმება“. The undo writes only the flow; the day's cramps and note must stay.
  it('a flow-only write (the one-tap start undo) keeps the whole day saved before it', () => {
    const date = '2026-08-29';
    const enqueue = (account, op, payload) => enqueueMutation(account, createMutation('user-a', op, payload));
    let account = { ...emptyAccount('user-a'), cache: createCacheRecord('user-a', sampleBundle()) };
    account = enqueue(account, 'START_PERIOD', { date, flow: 'medium' });
    const [sheet] = planQueuedLogMutations({
      date,
      flow: 'medium',
      symptoms: ['cramps'],
      moods: ['calm'],
      sexualActivity: false,
      notes: 'ტკივილი დილით',
      observations: { energy: 'low' },
      energy: 'low',
    });
    account = enqueue(account, sheet.operation, sheet.payload);
    const [undo] = planQueuedLogMutations({ date, flow: null });
    assert.deepEqual(undo, { operation: 'UPSERT_LOG', payload: { date, flow: null } });
    account = enqueue(account, undo.operation, undo.payload);

    assert.deepEqual(account.queue.map((item) => item.operation), ['START_PERIOD', 'UPSERT_LOG']);
    const kept = account.queue[1].payload;
    assert.equal(kept.flow, null);
    assert.deepEqual(kept.symptoms, ['cramps']);
    assert.deepEqual(kept.moods, ['calm']);
    assert.equal(kept.sexualActivity, false);
    assert.equal(kept.notes, 'ტკივილი დილით');
    assert.deepEqual(kept.observations, { energy: 'low' });

    const { bundle } = overlayPendingOnBundle(account.cache.bundle, account.queue, 'user-a');
    const row = bundle.logs.find((l) => l.date === date);
    assert.equal(row.flow, null);
    assert.deepEqual(row.symptoms, ['cramps']);
    assert.equal(row.notes, 'ტკივილი დილით');

    // The flush-time compaction (remaining + newly queued) applies the same rule.
    const again = compactCycleQueue([
      { ...account.queue[0], attemptCount: 2 },
      createMutation('user-a', 'UPSERT_LOG', sheet.payload),
      createMutation('user-a', 'UPSERT_LOG', { date, flow: 'light' }),
    ]);
    assert.equal(again[1].payload.flow, 'light');
    assert.deepEqual(again[1].payload.symptoms, ['cramps']);
  });

  it('a flow-only write after a REMOVE, or a whole day after a whole day, still replaces', () => {
    const date = '2026-08-30';
    const afterRemove = compactCycleQueue([
      createMutation('u', 'REMOVE_LOG', { date }),
      createMutation('u', 'UPSERT_LOG', { date, flow: 'light' }),
    ]);
    assert.equal(afterRemove.length, 1);
    assert.equal(afterRemove[0].operation, 'UPSERT_LOG');
    assert.deepEqual(afterRemove[0].payload, { date, flow: 'light' });

    const whole = compactCycleQueue([
      createMutation('u', 'UPSERT_LOG', { date, flow: 'medium', symptoms: ['cramps'], notes: 'a' }),
      createMutation('u', 'UPSERT_LOG', { date, flow: 'medium', symptoms: [], notes: null }),
    ]);
    assert.equal(whole.length, 1);
    assert.deepEqual(whole[0].payload.symptoms, []);
    assert.equal(whole[0].payload.notes, null);
  });
});

describe('replay success / retryable / permanent', () => {
  it('drops successful items and keeps a later failure', async () => {
    const q = [
      createMutation('u', 'UPSERT_LOG', { date: '2026-08-28', flow: 'medium' }),
      createMutation('u', 'UPSERT_LOG', { date: '2026-08-29', flow: 'heavy' }),
      createMutation('u', 'UPSERT_LOG', { date: '2026-08-30', flow: 'light' }),
    ];
    let calls = 0;
    const result = await replayCycleQueue(q, async (item) => {
      calls += 1;
      if (item.payload.date === '2026-08-30') {
        const err = new Error('offline');
        err.status = 0;
        throw err;
      }
      return sampleBundle({ cycleDay: 18 });
    });
    assert.equal(result.flushed, 2);
    assert.equal(result.remaining.length, 1);
    assert.equal(result.remaining[0].payload.date, '2026-08-30');
    assert.equal(result.remaining[0].attemptCount, 1);
    assert.equal(result.failureKind, 'retryable');
    assert.equal(calls, 3);
  });

  it('does not retry a permanent 400 forever', async () => {
    const item = createMutation('u', 'FILL_PERIOD', { start: 'nope', end: 'nope', flow: 'medium' });
    const result = await replayCycleQueue([item], async () => {
      const err = new Error('bad');
      err.status = 400;
      throw err;
    });
    assert.equal(result.flushed, 0);
    assert.equal(result.remaining[0].status, 'failed_permanent');
    assert.equal(result.failureKind, 'permanent');
  });

  it('classifies timeout and 5xx as retryable, 401 as auth pause', () => {
    assert.equal(classifyCycleFailure({ status: 0 }), 'retryable');
    assert.equal(classifyCycleFailure({ status: 408 }), 'retryable');
    assert.equal(classifyCycleFailure({ status: 503 }), 'retryable');
    assert.equal(classifyCycleFailure({ status: 429 }), 'retryable');
    assert.equal(classifyCycleFailure({ status: 401 }), 'auth_pause');
    assert.equal(classifyCycleFailure({ status: 403 }), 'permanent');
    assert.equal(classifyCycleFailure({ status: 400 }), 'permanent');
  });

  it('pauses the rest of the queue on 401', async () => {
    const q = [
      createMutation('u', 'UPSERT_LOG', { date: '2026-08-28', flow: 'medium' }),
      createMutation('u', 'UPSERT_LOG', { date: '2026-08-29', flow: 'heavy' }),
    ];
    const result = await replayCycleQueue(q, async () => {
      const err = new Error('auth');
      err.status = 401;
      throw err;
    });
    assert.equal(result.authPaused, true);
    assert.equal(result.remaining.length, 2);
    assert.equal(result.remaining[0].status, 'pending');
  });

  it('uses exponential backoff caps', () => {
    assert.equal(backoffMs(0), 30_000);
    assert.equal(backoffMs(1), 60_000);
    assert.ok(backoffMs(8) <= 300_000);
  });
});

describe('timeout ambiguity (server committed, client timed out)', () => {
  it('retries an UPSERT without duplicating the day log', async () => {
    const db = new Map();
    const play = async (item) => {
      if (item.playCount == null) item.playCount = 0;
      item.playCount += 1;
      db.set(item.payload.date, { flow: item.payload.flow });
      if (item.playCount === 1) {
        const err = new Error('timeout');
        err.status = 408;
        throw err;
      }
      return sampleBundle();
    };
    const item = createMutation('u', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' });
    const first = await replayCycleQueue([item], play);
    assert.equal(first.flushed, 0);
    assert.equal(db.size, 1);
    const second = await replayCycleQueue(first.remaining, play);
    assert.equal(second.flushed, 1);
    assert.equal(db.size, 1);
    assert.equal(db.get('2026-08-30').flow, 'heavy');
  });
});

describe('health mutations overlay (no local engine)', () => {
  it('shows pending heavy flow without changing cycle day or windows', () => {
    const cached = sampleBundle();
    const q = [createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' })];
    const { bundle, pendingDates } = overlayPendingOnBundle(cached, q, 'user-a');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-30').flow, 'heavy');
    assert.equal(bundle.predictions.calendar['2026-08-30'].logged, true);
    assert.equal(bundle.predictions.calendar['2026-08-30'].period, true);
    assert.deepEqual(pendingDates, ['2026-08-30']);
    assert.equal(true, snapshotEqualsDerived(cached, bundle));
    assert.equal(bundle.cycleDay, 18);
    assert.equal(bundle.phase, 'follicular');
    assert.equal(bundle.predictions.nextPeriodStart, '2026-09-09');
    assert.equal(bundle.profile.lastPeriodStart, '2026-08-12');
  });

  it('Start Period overlays bleed only — does not invent a new LMP', () => {
    const cached = sampleBundle();
    const q = [createMutation('user-a', 'START_PERIOD', { date: '2026-08-30', flow: 'medium' })];
    const { bundle } = overlayPendingOnBundle(cached, q, 'user-a');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-30').flow, 'medium');
    assert.equal(bundle.profile.lastPeriodStart, '2026-08-12');
    assert.equal(bundle.cycleDay, 18);
    assert.equal(bundle.predictions.nextPeriodStart, '2026-09-09');
  });

  it('End Period clears bleed on the stop date without synthesizing flow', () => {
    const cached = sampleBundle();
    const q = [createMutation('user-a', 'END_PERIOD', { date: '2026-08-14' })];
    const { bundle } = overlayPendingOnBundle(cached, q, 'user-a');
    // The end day is kept as „none“ (server planEndPeriod markNone) — never as bleeding.
    assert.equal(bundle.logs.length, cached.logs.length + 1);
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-14')?.flow, 'none');
    assert.ok(!bundle.logs.some((l) => l.date === '2026-08-15' && l.flow === 'medium'));
    assert.equal(true, snapshotEqualsDerived(cached, bundle));
  });

  it('End Period on the „still bleeding?“ day (nothing logged) marks that day „none“', () => {
    const cached = sampleBundle({
      meta: { today: '2026-08-18', timezone: 'Asia/Tbilisi' },
      periodRanges: [{ start: '2026-08-12', end: '2026-08-13', lengthDays: 2, source: 'logged' }],
    });
    const q = [createMutation('user-a', 'END_PERIOD', { date: '2026-08-18' })];
    const { bundle } = overlayPendingOnBundle(cached, q, 'user-a');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-18')?.flow, 'none');
    assert.equal(bundle.predictions.calendar['2026-08-18']?.period, false);
  });

  it('End Period on the first day (undo of a start) only touches that day', () => {
    const cached = sampleBundle();
    const q = [createMutation('user-a', 'END_PERIOD', { date: '2026-08-12' })];
    const { bundle } = overlayPendingOnBundle(cached, q, 'user-a');
    assert.equal(bundle.logs.filter((l) => l.date === '2026-08-12').length, 1);
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-12')?.flow, 'none');
  });

  it('End Period overlay clears today so the hub is no longer on period', () => {
    const cached = sampleBundle({
      meta: { today: '2026-08-16', timezone: 'Asia/Tbilisi' },
      periodRanges: [{ start: '2026-08-12', end: '2026-08-16', lengthDays: 5, source: 'logged' }],
      logs: [
        { ...sampleBundle().logs[0], date: '2026-08-12', flow: 'medium' },
        { ...sampleBundle().logs[0], id: 'log-16', date: '2026-08-16', flow: 'light' },
      ],
    });
    const q = [createMutation('user-a', 'END_PERIOD', { date: '2026-08-16' })];
    const { bundle } = overlayPendingOnBundle(cached, q, 'user-a');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-16')?.flow, 'none');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-12')?.flow, 'medium');
    assert.equal(bundle.predictions.calendar['2026-08-16']?.period, false);
    assert.equal(true, snapshotEqualsDerived(cached, bundle));
  });

  it('pending remove bleed survives as overlay', () => {
    const cached = sampleBundle();
    const q = [createMutation('user-a', 'REMOVE_LOG', { date: '2026-08-12' })];
    const { bundle } = overlayPendingOnBundle(cached, q, 'user-a');
    assert.equal(bundle.logs.some((l) => l.date === '2026-08-12'), false);
    assert.equal(bundle.periodRanges[0].start, '2026-08-12');
  });

  it('historical fill overlays missing days once and keeps canonical ranges', () => {
    const cached = sampleBundle();
    const q = [
      createMutation('user-a', 'FILL_PERIOD', {
        start: '2026-08-10',
        end: '2026-08-12',
        flow: 'medium',
      }),
    ];
    const { bundle, pendingDates } = overlayPendingOnBundle(cached, q, 'user-a');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-10').flow, 'medium');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-11').flow, 'medium');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-12').flow, 'medium');
    assert.equal(pendingDates.includes('2026-08-12'), false);
    assert.equal(bundle.periodRanges[0].start, '2026-08-12');
  });

  it('edit medium → heavy keeps only the final intended overlay', () => {
    let account = emptyAccount('user-a');
    account = enqueueMutation(
      account,
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', flow: 'medium' }),
    );
    account = enqueueMutation(
      account,
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' }),
    );
    assert.equal(account.queue.length, 1);
    const { bundle } = overlayPendingOnBundle(sampleBundle(), account.queue, 'user-a');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-30').flow, 'heavy');
  });
});

describe('cycle wipe clears pending queue', () => {
  it('does not replay deleted observations after the local account is emptied', () => {
    let store = persistStore(writeAccount(null, 'user-a', emptyAccount('user-a')));
    let account = readAccount(store, 'user-a');
    account = enqueueMutation(
      account,
      createMutation('user-a', 'UPSERT_LOG', {
        date: '2026-08-30',
        flow: 'none',
        painEntries: [{ type: 'cramps', severity: 'severe' }],
        notes: 'should not come back',
      }),
    );
    store = persistStore(writeAccount(store, 'user-a', account));
    store = persistStore(writeAccount(store, 'user-a', emptyAccount('user-a')));
    const wiped = readAccount(store, 'user-a');
    assert.equal(wiped.queue.length, 0);
    const { bundle } = overlayPendingOnBundle(sampleBundle({ logs: [] }), wiped.queue, 'user-a');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-30'), undefined);
    assert.equal(JSON.stringify(bundle).includes('should not come back'), false);
  });
});

describe('offline analytics stay a server snapshot', () => {
  it('does not recompute pain recurrence from a pending log', () => {
    const cached = sampleBundle();
    const q = [
      createMutation('user-a', 'UPSERT_LOG', {
        date: '2026-08-30',
        flow: 'none',
        painEntries: [{ type: 'cramps', severity: 'severe' }],
      }),
    ];
    const { bundle } = overlayPendingOnBundle(cached, q, 'user-a');
    assert.deepEqual(bundle.analytics, cached.analytics);
    assert.equal(bundle.analytics.painPatterns[0].cyclesWithObservation, 3);
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-30').painEntries[0].severity, 'severe');
  });
});

describe('stale display — do not advance a yesterday snapshot', () => {
  it('leaves cycle day / phase / windows unchanged when overlaying today', () => {
    const yesterday = sampleBundle();
    const q = [createMutation('u', 'UPSERT_LOG', { date: '2026-08-30', flow: 'light', moods: ['calm'] })];
    const { bundle } = overlayPendingOnBundle(yesterday, q, 'u');
    assert.equal(bundle.meta.today, '2026-08-29');
    assert.equal(bundle.cycleDay, 18);
    assert.equal(bundle.phase, 'follicular');
    assert.equal(bundle.predictions.ovulationDate, '2026-08-25');
    assert.equal(bundle.predictions.confidence, 'medium');
    assert.deepEqual(bundle.predictions.fertileWindow, { start: '2026-08-23', end: '2026-08-27' });
    assert.equal(bundle.predictions.calendar['2026-08-30'].cycleDay, 19);
    assert.equal(bundle.predictions.calendar['2026-08-30'].phase, 'fertile');
  });
});

describe('account isolation', () => {
  it('User B never sees User A cache or pending logs', () => {
    let store = persistStore(writeAccount(null, 'user-a', emptyAccount('user-a')));
    let a = readAccount(store, 'user-a');
    a.cache = createCacheRecord('user-a', sampleBundle(), '2026-08-29T18:42:00.000Z');
    a = enqueueMutation(a, createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy', notes: 'A only' }));
    store = persistStore(writeAccount(store, 'user-a', a));
    store = persistStore(writeAccount(store, 'user-b', emptyAccount('user-b')));

    const b = readAccount(store, 'user-b');
    assert.equal(b.cache, null);
    assert.equal(b.queue.length, 0);
    const check = accountIsolationSafe(store, 'user-a', 'user-b');
    assert.equal(check.aHasCache, true);
    assert.equal(check.bHasCache, false);
    assert.equal(check.aQueue, 1);
    assert.equal(check.bQueue, 0);
    assert.equal(check.crossLeak, false);
  });

  it('replaying User B never includes User A mutations', async () => {
    let store = persistStore(writeAccount(null, 'user-a', emptyAccount('user-a')));
    let a = enqueueMutation(
      readAccount(store, 'user-a'),
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' }),
    );
    store = persistStore(writeAccount(store, 'user-a', a));
    const b = readAccount(store, 'user-b');
    const seen = [];
    await replayCycleQueue(b.queue, async (item) => {
      seen.push(item.userScope);
      return sampleBundle();
    });
    assert.deepEqual(seen, []);
    assert.equal(readAccount(store, 'user-a').queue[0].payload.flow, 'heavy');
  });
});

describe('ordering + fill once', () => {
  it('replays fill exactly once', async () => {
    const item = createMutation('u', 'FILL_PERIOD', {
      start: '2026-08-01',
      end: '2026-08-03',
      flow: 'medium',
    });
    let plays = 0;
    const result = await replayCycleQueue([item], async () => {
      plays += 1;
      return sampleBundle();
    });
    assert.equal(plays, 1);
    assert.equal(result.flushed, 1);
    assert.equal(result.remaining.length, 0);
  });
});

describe('AES-256-GCM', () => {
  it('encrypt then decrypt returns the same plaintext', async () => {
    const key = generateDekBytes();
    const { iv, ciphertext } = await aesGcmEncrypt(key, 'secret-health');
    assert.equal(await aesGcmDecrypt(key, iv, ciphertext), 'secret-health');
  });

  it('wrong key fails closed', async () => {
    const { iv, ciphertext } = await aesGcmEncrypt(generateDekBytes(), 'secret-health');
    await assert.rejects(() => aesGcmDecrypt(generateDekBytes(), iv, ciphertext));
  });

  it('modified ciphertext fails', async () => {
    const key = generateDekBytes();
    const { iv, ciphertext } = await aesGcmEncrypt(key, 'secret-health');
    const raw = Buffer.from(ciphertext, 'base64');
    raw[0] = raw[0] ^ 0xff;
    await assert.rejects(() => aesGcmDecrypt(key, iv, raw.toString('base64')));
  });

  it('missing key material cannot decrypt an envelope', async () => {
    const store = writeAccount(null, 'user-a', emptyAccount('user-a'));
    const env = await encryptStore(store, generateDekBytes());
    await assert.rejects(() => decryptStore(env, generateDekBytes()));
  });

  it('corrupted envelope fails', async () => {
    await assert.rejects(() => decryptStore('{"nope":true}', generateDekBytes()));
  });
});

describe('plaintext v1 → encrypted v2 migration', () => {
  it('migrates only after a verified encrypted write', async () => {
    let encrypted = null;
    const v2 = writeAccount(null, 'user-a', enqueueMutation(
      emptyAccount('user-a'),
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' }),
    ));
    let plaintext = JSON.stringify({ version: 1, accounts: v2.accounts });
    const key = generateDekBytes();
    const result = await migratePlaintextToEncrypted(plaintext, key, {
      writeEncrypted: async (env) => {
        encrypted = env;
      },
      readEncrypted: async () => encrypted,
      deletePlaintext: async () => {
        plaintext = null;
      },
    });
    assert.equal(result.migrated, true);
    assert.equal(result.keptPlaintext, false);
    assert.equal(plaintext, null);
    assert.equal(result.store.accounts['user-a'].queue[0].payload.flow, 'heavy');
    const roundTrip = await decryptStore(encrypted, key);
    assert.equal(roundTrip.accounts['user-a'].queue[0].payload.flow, 'heavy');
  });

  it('keeps plaintext if the encrypted write fails', async () => {
    const v2 = writeAccount(null, 'user-a', enqueueMutation(
      emptyAccount('user-a'),
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' }),
    ));
    const original = JSON.stringify({ version: 1, accounts: v2.accounts });
    let plaintext = original;
    const result = await migratePlaintextToEncrypted(plaintext, generateDekBytes(), {
      writeEncrypted: async () => {
        throw new Error('disk full');
      },
      readEncrypted: async () => null,
      deletePlaintext: async () => {
        plaintext = null;
      },
    });
    assert.equal(result.migrated, false);
    assert.equal(result.keptPlaintext, true);
    assert.equal(plaintext, original);
    assert.equal(result.store.accounts['user-a'].queue[0].payload.flow, 'heavy');
  });
});

describe('account destroy + logout recoverability', () => {
  it('destroying User A leaves User B intact and User A empty', () => {
    let store = persistStore(writeAccount(null, 'user-a', emptyAccount('user-a')));
    let a = enqueueMutation(
      readAccount(store, 'user-a'),
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' }),
    );
    store = persistStore(writeAccount(store, 'user-a', a));
    store = persistStore(writeAccount(store, 'user-b', emptyAccount('user-b')));
    const root = JSON.parse(store);
    delete root.accounts['user-a'];
    const after = persistStore(root);
    assert.equal(readAccount(after, 'user-a').queue.length, 0);
    assert.equal(readAccount(after, 'user-b').userScope, 'user-b');
  });

  it('logout-style keep: same account can read its queue later', () => {
    let store = persistStore(writeAccount(null, 'user-a', emptyAccount('user-a')));
    store = persistStore(
      writeAccount(
        store,
        'user-a',
        enqueueMutation(
          readAccount(store, 'user-a'),
          createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', notes: 'keep' }),
        ),
      ),
    );
    assert.equal(readAccount(store, 'user-a').queue[0].payload.notes, 'keep');
    assert.equal(readAccount(store, 'user-b').queue.length, 0);
  });
});

describe('Start Period is a single mutation', () => {
  it('queues only START_PERIOD when the action is flow-only', () => {
    const planned = planQueuedLogMutations({ date: '2026-08-30', flow: 'heavy' }, { markStart: true });
    assert.equal(planned.length, 1);
    assert.equal(planned[0].operation, 'START_PERIOD');
    assert.equal(planned[0].payload.flow, 'heavy');
  });

  it('queues only UPSERT_LOG when Start Period also has extras', () => {
    const planned = planQueuedLogMutations(
      { date: '2026-08-30', flow: 'heavy', symptoms: ['cramps'] },
      { markStart: true },
    );
    assert.equal(planned.length, 1);
    assert.equal(planned[0].operation, 'UPSERT_LOG');
  });

  it('retries START after timeout without a second row', async () => {
    const days = new Set();
    const play = async (item) => {
      days.add(item.payload.date);
      if (!item.retried) {
        item.retried = true;
        const err = new Error('timeout');
        err.status = 408;
        throw err;
      }
      return sampleBundle();
    };
    const item = createMutation('u', 'START_PERIOD', { date: '2026-08-30', flow: 'heavy' });
    const first = await replayCycleQueue([item], play);
    const second = await replayCycleQueue(first.remaining, play);
    assert.equal(second.flushed, 1);
    assert.equal(days.size, 1);
  });
});

describe('FILL_PERIOD idempotency', () => {
  it('replays the same range without duplicating or overwriting existing bleed', async () => {
    const db = new Map([
      ['2026-08-10', { flow: 'heavy' }],
    ]);
    const play = async (item) => {
      const start = item.payload.start;
      const end = item.payload.end;
      for (let d = start; d <= end; ) {
        if (!db.has(d)) db.set(d, { flow: item.payload.flow });
        const [y, m, day] = d.split('-').map(Number);
        const next = new Date(Date.UTC(y, m - 1, day + 1));
        d = next.toISOString().slice(0, 10);
      }
      return sampleBundle();
    };
    const item = createMutation('u', 'FILL_PERIOD', {
      start: '2026-08-10',
      end: '2026-08-12',
      flow: 'medium',
    });
    const first = await replayCycleQueue([item], async (op) => {
      const err = new Error('timeout');
      err.status = 408;
      await play(op);
      throw err;
    });
    await replayCycleQueue(first.remaining, play);
    assert.equal(db.get('2026-08-10').flow, 'heavy');
    assert.equal(db.get('2026-08-11').flow, 'medium');
    assert.equal(db.get('2026-08-12').flow, 'medium');
    assert.equal(db.size, 3);
  });
});

describe('429 classification + Retry-After', () => {
  it('treats rate-limit 429 as retryable and respects Retry-After', async () => {
    assert.equal(classifyCycleFailure({ status: 429 }), 'retryable');
    assert.equal(backoffMs(0, 120), 120_000);
    assert.equal(parseRetryAfterSeconds('45'), 45);
    const item = createMutation('u', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' });
    const result = await replayCycleQueue([item], async () => {
      const err = new Error('slow down');
      err.status = 429;
      err.retryAfterSeconds = 90;
      throw err;
    });
    assert.equal(result.failureKind, 'retryable');
    assert.equal(result.remaining[0].status, 'pending');
    assert.equal(result.remaining[0].retryAfterSeconds, 90);
  });

  it('treats quota 429 as permanent / attention-required', async () => {
    assert.equal(
      classifyCycleFailure({ status: 429, code: 'DAILY_LIMIT_REACHED' }),
      'permanent',
    );
    assert.equal(
      classifyCycleFailure({ status: 429, code: 'MONTHLY_LIMIT_REACHED' }),
      'permanent',
    );
    const item = createMutation('u', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' });
    const result = await replayCycleQueue([item], async () => {
      const err = new Error('quota');
      err.status = 429;
      err.code = 'DAILY_LIMIT_REACHED';
      throw err;
    });
    assert.equal(result.remaining[0].status, 'failed_permanent');
    assert.equal(attentionItems({ queue: result.remaining }).length, 1);
  });
});

describe('storage failure must not claim a durable save', () => {
  it('maps persist failure to fail, not device', () => {
    assert.equal(cyclePersistFeedback({ synced: false, persistedLocally: false }), 'fail');
    assert.equal(cyclePersistFeedback({ synced: false, persistedLocally: true }), 'device');
    assert.equal(cyclePersistFeedback({ synced: false, persistedLocally: false, sessionOnly: true }), 'session');
  });
});

describe('web persist policy', () => {
  it('session-only is not a durable device save', () => {
    assert.notEqual(
      cyclePersistFeedback({ synced: false, persistedLocally: false, sessionOnly: true }),
      'device',
    );
  });
});

describe('TTC fertility observations stay on UPSERT_LOG', () => {
  it('queues OPK as UPSERT_LOG and overlays the user-logged result', () => {
    const planned = planQueuedLogMutations(
      { date: '2026-08-30', ovulationTest: 'positive' },
      {},
    );
    assert.equal(planned[0].operation, 'UPSERT_LOG');
    let account = enqueueMutation(
      emptyAccount('user-a'),
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', ovulationTest: 'positive' }),
    );
    const { bundle } = overlayPendingOnBundle(sampleBundle(), account.queue, 'user-a');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-30').ovulationTest, 'positive');
    assert.equal(bundle.predictions.ovulationDate, '2026-08-25');
  });

  it('restores a negative pregnancy test from the encrypted queue overlay', () => {
    const q = [
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', pregnancyTest: 'negative' }),
    ];
    const { bundle } = overlayPendingOnBundle(sampleBundle(), q, 'user-a');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-30').pregnancyTest, 'negative');
  });

  it('lets a later BBT edit win', () => {
    let account = emptyAccount('user-a');
    account = enqueueMutation(
      account,
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', bbt: 36.4 }),
    );
    account = enqueueMutation(
      account,
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', bbt: 36.8 }),
    );
    assert.equal(account.queue.length, 1);
    const { bundle } = overlayPendingOnBundle(sampleBundle(), account.queue, 'user-a');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-30').bbt, 36.8);
  });

  it('queues cervical mucus as UPSERT_LOG', () => {
    const planned = planQueuedLogMutations({ date: '2026-08-30', cervicalMucus: 'eggwhite' }, {});
    assert.equal(planned[0].operation, 'UPSERT_LOG');
    const account = enqueueMutation(
      emptyAccount('user-a'),
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', cervicalMucus: 'eggwhite' }),
    );
    const { bundle } = overlayPendingOnBundle(sampleBundle(), account.queue, 'user-a');
    assert.equal(bundle.logs.find((l) => l.date === '2026-08-30').cervicalMucus, 'eggwhite');
    assert.equal(bundle.predictions.ovulationDate, '2026-08-25');
  });

  it('does not leak User A TTC observations into User B', () => {
    let a = enqueueMutation(
      emptyAccount('user-a'),
      createMutation('user-a', 'UPSERT_LOG', {
        date: '2026-08-30',
        ovulationTest: 'positive',
        pregnancyTest: 'negative',
        bbt: 36.6,
      }),
    );
    const b = emptyAccount('user-b');
    const overlayA = overlayPendingOnBundle(sampleBundle(), a.queue, 'user-a').bundle;
    const overlayB = overlayPendingOnBundle(sampleBundle(), b.queue, 'user-b').bundle;
    assert.equal(overlayA.logs.find((l) => l.date === '2026-08-30').ovulationTest, 'positive');
    assert.equal(overlayB.logs.find((l) => l.date === '2026-08-30'), undefined);
  });
});

describe('Phase 9 daily observations stay on UPSERT_LOG', () => {
  it('overlays pain, lifestyle, tags, and journal without changing predictions', () => {
    const planned = planQueuedLogMutations(
      {
        date: '2026-08-30',
        painEntries: [{ type: 'pelvic', severity: 'severe' }],
        sleepQuality: 'poor',
        stressLevel: 'high',
        customTagIds: ['11111111-1111-4111-8111-111111111111'],
        notes: 'offline journal',
      },
      {},
    );
    assert.equal(planned[0].operation, 'UPSERT_LOG');
    const q = [
      createMutation('user-a', 'UPSERT_LOG', {
        date: '2026-08-30',
        painEntries: [{ type: 'pelvic', severity: 'severe' }],
        sleepQuality: 'poor',
        stressLevel: 'high',
        customTagIds: ['11111111-1111-4111-8111-111111111111'],
        notes: 'offline journal',
      }),
    ];
    const { bundle } = overlayPendingOnBundle(sampleBundle(), q, 'user-a');
    const log = bundle.logs.find((l) => l.date === '2026-08-30');
    assert.equal(log.painEntries[0].severity, 'severe');
    assert.equal(log.sleepQuality, 'poor');
    assert.equal(log.notes, 'offline journal');
    assert.equal(bundle.predictions.ovulationDate, '2026-08-25');
    assert.equal(bundle.predictions.nextPeriodStart, '2026-09-09');
  });

  it('does not replay User A pain/journal onto User B', () => {
    const a = enqueueMutation(
      emptyAccount('user-a'),
      createMutation('user-a', 'UPSERT_LOG', {
        date: '2026-08-30',
        painEntries: [{ type: 'pelvic', severity: 'severe' }],
        notes: 'A only',
      }),
    );
    const overlayA = overlayPendingOnBundle(sampleBundle(), a.queue, 'user-a').bundle;
    const overlayB = overlayPendingOnBundle(sampleBundle(), emptyAccount('user-b').queue, 'user-b').bundle;
    assert.equal(overlayA.logs.find((l) => l.date === '2026-08-30').notes, 'A only');
    assert.equal(overlayB.logs.find((l) => l.date === '2026-08-30'), undefined);
  });
});

describe('Phase 22 pregnancy observations stay on UPSERT_LOG', () => {
  it('overlays heartburn, swelling, energy, and pain without changing predictions', () => {
    const q = [
      createMutation('user-a', 'UPSERT_LOG', {
        date: '2026-08-30',
        flow: 'spotting',
        symptoms: ['nausea', 'heartburn', 'fatigue', 'swelling'],
        painEntries: [{ type: 'lower_back', severity: 'moderate' }],
        observations: { energy: 'low' },
        energy: 'low',
        sleepQuality: 'poor',
        stressLevel: 'medium',
      }),
    ];
    const { bundle } = overlayPendingOnBundle(sampleBundle(), q, 'user-a');
    const log = bundle.logs.find((l) => l.date === '2026-08-30');
    assert.equal(log.flow, 'spotting');
    assert.ok(log.symptoms.includes('heartburn'));
    assert.equal(log.painEntries[0].type, 'lower_back');
    assert.equal(log.energy, 'low');
    assert.equal(log.sleepQuality, 'poor');
    assert.equal(bundle.predictions.ovulationDate, '2026-08-25');
  });
});

describe('W2-12b pregnancy checklist ticks ride the observations bag', () => {
  it('overlays the ticks, keeps them when a later save names only energy, clears them with null', () => {
    const ticked = [
      createMutation('user-a', 'UPSERT_LOG', {
        date: '2026-08-30',
        symptoms: ['nausea'],
        observations: { energy: 'low', pregnancyChecklist: ['prenatal_vitamin', 'walk'] },
        energy: 'low',
      }),
    ];
    const first = overlayPendingOnBundle(sampleBundle(), ticked, 'user-a').bundle;
    const log = first.logs.find((l) => l.date === '2026-08-30');
    assert.deepEqual(log.observations.pregnancyChecklist, ['prenatal_vitamin', 'walk']);
    assert.equal(first.predictions.ovulationDate, '2026-08-25');

    // The server already holds the ticks; an older build's save sends only energy.
    const energyOnly = [createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', observations: { energy: 'high' }, energy: 'high' })];
    const kept = overlayPendingOnBundle(first, energyOnly, 'user-a').bundle.logs.find((l) => l.date === '2026-08-30');
    assert.deepEqual(kept.observations, { energy: 'high', pregnancyChecklist: ['prenatal_vitamin', 'walk'] });

    const cleared = [createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', observations: { energy: 'high', pregnancyChecklist: null } })];
    const after = overlayPendingOnBundle(first, cleared, 'user-a').bundle.logs.find((l) => l.date === '2026-08-30');
    assert.deepEqual(after.observations, { energy: 'high' });
  });

  it('a payload with ticks counts as content and keeps the key on the queued mutation', () => {
    const account = enqueueMutation(
      emptyAccount('user-a'),
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-31', observations: { pregnancyChecklist: ['rest'] } }),
    );
    assert.equal(account.queue.length, 1);
    assert.deepEqual(account.queue[0].payload.observations, { pregnancyChecklist: ['rest'] });
    const log = overlayPendingOnBundle(sampleBundle(), account.queue, 'user-a').bundle.logs.find((l) => l.date === '2026-08-31');
    assert.deepEqual(log.observations.pregnancyChecklist, ['rest']);
  });
});

describe('Phase 11 structured observations stay on UPSERT_LOG', () => {
  it('overlays energy without changing predictions', () => {
    const q = [
      createMutation('user-a', 'UPSERT_LOG', {
        date: '2026-08-30',
        observations: { energy: 'low' },
        energy: 'low',
        symptoms: ['bloating'],
      }),
    ];
    const { bundle } = overlayPendingOnBundle(sampleBundle(), q, 'user-a');
    const log = bundle.logs.find((l) => l.date === '2026-08-30');
    assert.equal(log.energy, 'low');
    assert.equal(log.observations.energy, 'low');
    assert.equal(bundle.predictions.ovulationDate, '2026-08-25');
  });
});

describe('Phase 28 observation assessments stay on CycleLog UPSERT', () => {
  it('overlays present, absent, and clear-to-unknown without changing predictions', () => {
    const present = [
      createMutation('user-a', 'UPSERT_LOG', {
        date: '2026-08-30',
        symptoms: ['hot_flashes'],
        observationAssessments: {},
      }),
    ];
    const afterPresent = overlayPendingOnBundle(sampleBundle(), present, 'user-a').bundle;
    assert.deepEqual(afterPresent.logs.find((l) => l.date === '2026-08-30').symptoms, ['hot_flashes']);

    const absent = [
      createMutation('user-a', 'UPSERT_LOG', {
        date: '2026-08-30',
        symptoms: [],
        observationAssessments: { hot_flashes: 'ABSENT' },
      }),
    ];
    const afterAbsent = overlayPendingOnBundle(sampleBundle(), absent, 'user-a').bundle;
    assert.equal(
      afterAbsent.logs.find((l) => l.date === '2026-08-30').observationAssessments.hot_flashes,
      'ABSENT',
    );

    const cleared = [
      createMutation('user-a', 'UPSERT_LOG', {
        date: '2026-08-30',
        symptoms: [],
        observationAssessments: {},
      }),
    ];
    const afterClear = overlayPendingOnBundle(afterAbsent, cleared, 'user-a').bundle;
    assert.deepEqual(afterClear.logs.find((l) => l.date === '2026-08-30').observationAssessments, {});
    assert.equal(afterClear.predictions.ovulationDate, '2026-08-25');
  });

  it('ABSENT-only still queues UPSERT_LOG', () => {
    const planned = planQueuedLogMutations(
      { date: '2026-08-30', observationAssessments: { nausea: 'ABSENT' } },
      {},
    );
    assert.equal(planned[0].operation, 'UPSERT_LOG');
  });

  it('does not leak User A assessments into User B', () => {
    const a = enqueueMutation(
      emptyAccount('user-a'),
      createMutation('user-a', 'UPSERT_LOG', {
        date: '2026-08-30',
        observationAssessments: { night_sweats: 'ABSENT' },
      }),
    );
    const overlayA = overlayPendingOnBundle(sampleBundle(), a.queue, 'user-a').bundle;
    const overlayB = overlayPendingOnBundle(sampleBundle(), emptyAccount('user-b').queue, 'user-b').bundle;
    assert.equal(
      overlayA.logs.find((l) => l.date === '2026-08-30').observationAssessments.night_sweats,
      'ABSENT',
    );
    assert.equal(overlayB.logs.find((l) => l.date === '2026-08-30'), undefined);
  });
});

describe('discard recovery', () => {
  it('removes a failed item without touching other users', () => {
    let a = enqueueMutation(
      emptyAccount('user-a'),
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' }),
    );
    a.queue[0].status = 'failed_permanent';
    a = discardMutation(a, a.queue[0].id);
    assert.equal(a.queue.length, 0);
  });
});

describe('partial bundle after a failed reload (CYC-06)', () => {
  it('only a whole bundle counts: logs array, profile and predictions', () => {
    assert.equal(isCompleteCycleBundle(sampleBundle()), true);
    // The old server fallback after a settings write whose reload failed.
    assert.equal(isCompleteCycleBundle({ profile: { lastPeriodStart: '2026-08-12' }, meta: { today: '2026-08-29' } }), false);
    assert.equal(isCompleteCycleBundle(null), false);
    assert.equal(isCompleteCycleBundle(undefined), false);
    assert.equal(isCompleteCycleBundle({ ...sampleBundle(), logs: undefined }), false);
    assert.equal(isCompleteCycleBundle({ ...sampleBundle(), predictions: null }), false);
  });

  it('a partial bundle an older build cached is dropped on read (the queue stays)', () => {
    let account = enqueueMutation(
      emptyAccount('user-a'),
      createMutation('user-a', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' }),
    );
    account.cache = createCacheRecord('user-a', { profile: { lastPeriodStart: '2026-08-12' }, meta: {} }, '2026-08-29T18:42:00.000Z');
    const restored = readAccount(persistStore(writeAccount(null, 'user-a', account)), 'user-a');
    assert.equal(restored.cache, null);
    assert.equal(restored.queue.length, 1);
    assert.equal(restored.queue[0].payload.flow, 'heavy');
  });

  it('a whole cached bundle is kept', () => {
    const account = emptyAccount('user-a');
    account.cache = createCacheRecord('user-a', sampleBundle(), '2026-08-29T18:42:00.000Z');
    const restored = readAccount(persistStore(writeAccount(null, 'user-a', account)), 'user-a');
    assert.equal(restored.cache.bundle.cycleDay, 18);
  });

  it('the cache writers and the shared view refuse a partial bundle', () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const offline = readFileSync(join(__dirname, 'cycleOffline.ts'), 'utf8');
    const view = readFileSync(join(__dirname, 'cycleViewCache.ts'), 'utf8');
    assert.match(offline, /export async function cacheCycleBundle[^{]*\{\n[^\n]*\n\s*if \(!isCompleteCycleBundle\(bundle\)\) return;/);
    assert.match(offline, /if \(isCompleteCycleBundle\(result\.bundle\)\) \{\n\s*latest\.cache = createCacheRecord/);
    assert.match(view, /if \(!isCompleteCycleBundle\(bundle\)\) \{\n\s*void invalidate\('cycle'\);\n\s*return;/);
  });

  it('settings screens read only a whole bundle; privacy mode re-plans masking with the one on screen', () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const dir = join(__dirname, '..', 'components', 'cycle', 'settings');
    const privacy = readFileSync(join(dir, 'CyclePrivacySettings.tsx'), 'utf8');
    const profile = readFileSync(join(dir, 'CycleProfileSettings.tsx'), 'utf8');
    const reminders = readFileSync(join(dir, 'CycleReminderSettings.tsx'), 'utf8');
    assert.match(
      privacy,
      /isCompleteCycleBundle\(data\)\s*\?\s*data\s*:\s*bundle\s*\?\s*\{ \.\.\.bundle, profile: \{ \.\.\.bundle\.profile, privacyEnabled: on \} \}/,
    );
    // The partner page is paused in the return gate too (server ownerPostpartumReturnPending): say so.
    assert.match(privacy, /isPostpartumReturnLearning\(bundle\)/);
    assert.match(profile, /const fresh = isCompleteCycleBundle\(data\) \? data : null;/);
    const save = profile.slice(profile.indexOf('const save = async'), profile.indexOf('const pickMode'));
    assert.doesNotMatch(save, /applyCycleProfile\(data\)|syncCycleReminders\(data,/);
    assert.match(reminders, /source = isCompleteCycleBundle\(data\) \? data : source;/);
  });
});

describe('custom tags on one day (CYC-10)', () => {
  const tag = (i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`;
  const nine = Array.from({ length: 9 }, (_, i) => tag(i));

  it('matches the server limit of 8 tags a day', () => {
    assert.equal(CYCLE_TAGS_PER_DAY_MAX, 8);
  });

  it('the picker refuses a 9th tick and says so; unticking always works', () => {
    const eight = nine.slice(0, 8);
    assert.deepEqual(toggleDayTagId(eight, tag(8)), { ids: eight, limited: true });
    assert.deepEqual(toggleDayTagId(eight, tag(0)), { ids: eight.slice(1), limited: false });
    assert.deepEqual(toggleDayTagId(eight.slice(0, 7), tag(8)), { ids: [...eight.slice(0, 7), tag(8)], limited: false });
    assert.deepEqual(toggleDayTagId([], tag(1)), { ids: [tag(1)], limited: false });
  });

  it('a queued day never carries more than 8 tags, and keeps everything else', () => {
    const [step] = planQueuedLogMutations({
      date: '2026-08-30',
      flow: 'heavy',
      notes: 'kept',
      symptoms: ['fatigue'],
      customTagIds: nine,
    });
    assert.equal(step.operation, 'UPSERT_LOG');
    assert.deepEqual(step.payload.customTagIds, nine.slice(0, 8));
    assert.equal(step.payload.flow, 'heavy');
    assert.equal(step.payload.notes, 'kept');
    assert.deepEqual(step.payload.symptoms, ['fatigue']);
    assert.deepEqual(capDayTagIds([tag(1), tag(1), tag(2)]), [tag(1), tag(2)]);
  });

  it('the picker and a newly created tag go through the same cap', () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const picker = readFileSync(join(__dirname, '..', 'components', 'cycle', 'CycleObservationFields.tsx'), 'utf8');
    const log = readFileSync(join(__dirname, '..', '..', 'app', 'cycle', 'log.tsx'), 'utf8');
    assert.match(picker, /onChange\(toggleDayTagId\(selectedIds, id\)\.ids\)/);
    assert.match(picker, /ka\.cycle\.customTagDayLimit\(CYCLE_TAGS_PER_DAY_MAX\)/);
    assert.doesNotMatch(log, /\[\.\.\.prev\.customTagIds, result\.tag\.id\]/);
    assert.match(log, /toggleDayTagId\(prev\.customTagIds, result\.tag\.id\)\.ids/);
  });
});
