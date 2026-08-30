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

  it('replaces UPSERT with following REMOVE on the same date', () => {
    const compacted = compactCycleQueue([
      createMutation('u', 'UPSERT_LOG', { date: '2026-08-30', flow: 'heavy' }),
      createMutation('u', 'REMOVE_LOG', { date: '2026-08-30' }),
    ]);
    assert.equal(compacted.length, 1);
    assert.equal(compacted[0].operation, 'REMOVE_LOG');
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

  it('End Period does not synthesize flow', () => {
    const cached = sampleBundle();
    const q = [createMutation('user-a', 'END_PERIOD', { date: '2026-08-14' })];
    const { bundle } = overlayPendingOnBundle(cached, q, 'user-a');
    assert.equal(bundle.logs.length, cached.logs.length);
    assert.ok(!bundle.logs.some((l) => l.date === '2026-08-15' && l.flow === 'medium'));
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

