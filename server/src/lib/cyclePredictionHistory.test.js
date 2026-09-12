import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inferCycleStats } from './cycle.js';
import {
  AGGREGATE_MIN_COMPLETED,
  CYCLE_PREDICTION_ENGINE_VERSION,
  SNAPSHOT_TYPE_NEXT_PERIOD_START,
  absErrorDays,
  buildPredictionHistory,
  errorDays,
  exportPredictionSnapshots,
  isSameSnapshotIdentity,
  medianAbsError,
  observeNextPeriodPrediction,
  publicSnapshotFields,
  shouldObservePrediction,
  snapshotHasSensitiveFields,
  snapshotIdentity,
} from './cyclePredictionHistory.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { buildCycleAiUserPrompt } from './cycle.js';
import { wipeCycleHealthData } from './cycleLifecycle.js';

function snap(overrides = {}) {
  return {
    type: SNAPSHOT_TYPE_NEXT_PERIOD_START,
    predictedDate: '2026-09-29',
    snapshotDate: '2026-09-01',
    snapshotAt: new Date('2026-09-01T08:00:00.000Z'),
    cycleAnchorDate: '2026-09-01',
    confidence: 'medium',
    engineVersion: 1,
    validGapCount: 3,
    isIrregular: false,
    source: 'inferred',
    ...overrides,
  };
}

function memoryPrisma(seed = []) {
  const rows = [...seed];
  let failNextCreate = false;
  return {
    rows,
    failNextCreateOnce() {
      failNextCreate = true;
    },
    cyclePredictionSnapshot: {
      findFirst: async ({ where }) =>
        rows.find((row) =>
          Object.entries(where).every(([k, v]) => row[k] === v),
        ) ?? null,
      create: async ({ data }) => {
        if (failNextCreate) {
          failNextCreate = false;
          const err = new Error('Unique constraint');
          err.code = 'P2002';
          throw err;
        }
        const exists = rows.find((row) =>
          row.userId === data.userId &&
          row.type === data.type &&
          row.cycleAnchorDate === data.cycleAnchorDate &&
          row.predictedDate === data.predictedDate &&
          row.confidence === data.confidence &&
          row.engineVersion === data.engineVersion,
        );
        if (exists) {
          const err = new Error('Unique constraint');
          err.code = 'P2002';
          throw err;
        }
        const row = { id: `snap-${rows.length + 1}`, ...data };
        rows.push(row);
        return row;
      },
    },
  };
}

describe('Phase 8 observation eligibility', () => {
  it('A first valid prediction is eligible', () => {
    assert.equal(shouldObservePrediction({
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      mode: 'TRACK_PERIOD',
    }), true);
  });

  it('does not observe pregnancy mode', () => {
    assert.equal(shouldObservePrediction({
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      mode: 'PREGNANCY',
    }), false);
  });

  it('does not observe missing dates', () => {
    assert.equal(shouldObservePrediction({
      predictedDate: null,
      cycleAnchorDate: '2026-09-01',
    }), false);
  });

  it('does not observe while postpartum-return forecast is gated', () => {
    assert.equal(shouldObservePrediction({
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      mode: 'TRACK_PERIOD',
      forecastAllowed: false,
    }), false);
  });
});

describe('snapshot creation + dedup', () => {
  it('A first valid prediction creates a snapshot', async () => {
    const db = memoryPrisma();
    const res = await observeNextPeriodPrediction(db, {
      userId: 'u1',
      today: '2026-09-01',
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      confidence: 'medium',
      validGapCount: 3,
      source: 'inferred',
    });
    assert.equal(res.created, true);
    assert.equal(res.snapshot.predictedDate, '2026-09-29');
    assert.equal(res.snapshot.engineVersion, CYCLE_PREDICTION_ENGINE_VERSION);
    assert.equal(db.rows.length, 1);
  });

  it('B same bundle reload does not duplicate', async () => {
    const db = memoryPrisma();
    const input = {
      userId: 'u1',
      today: '2026-09-01',
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      confidence: 'medium',
    };
    await observeNextPeriodPrediction(db, input);
    const again = await observeNextPeriodPrediction(db, input);
    assert.equal(again.created, false);
    assert.equal(again.reason, 'deduplicated');
    assert.equal(db.rows.length, 1);
  });

  it('C prediction date change creates a revision', async () => {
    const db = memoryPrisma();
    await observeNextPeriodPrediction(db, {
      userId: 'u1',
      today: '2026-09-01',
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      confidence: 'medium',
    });
    const next = await observeNextPeriodPrediction(db, {
      userId: 'u1',
      today: '2026-09-15',
      predictedDate: '2026-09-30',
      cycleAnchorDate: '2026-09-01',
      confidence: 'medium',
    });
    assert.equal(next.created, true);
    assert.equal(db.rows.length, 2);
    assert.equal(db.rows[0].predictedDate, '2026-09-29');
  });

  it('D confidence change creates a new snapshot', async () => {
    const db = memoryPrisma();
    await observeNextPeriodPrediction(db, {
      userId: 'u1',
      today: '2026-09-01',
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      confidence: 'low',
    });
    const next = await observeNextPeriodPrediction(db, {
      userId: 'u1',
      today: '2026-09-10',
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      confidence: 'medium',
    });
    assert.equal(next.created, true);
    assert.equal(db.rows.length, 2);
  });

  it('E new LMP starts a new target series', async () => {
    const db = memoryPrisma();
    await observeNextPeriodPrediction(db, {
      userId: 'u1',
      today: '2026-09-01',
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      confidence: 'medium',
    });
    const next = await observeNextPeriodPrediction(db, {
      userId: 'u1',
      today: '2026-09-30',
      predictedDate: '2026-10-28',
      cycleAnchorDate: '2026-09-30',
      confidence: 'medium',
    });
    assert.equal(next.created, true);
    assert.notEqual(db.rows[0].cycleAnchorDate, db.rows[1].cycleAnchorDate);
  });

  it('F engine version change creates a snapshot', async () => {
    const db = memoryPrisma();
    await observeNextPeriodPrediction(db, {
      userId: 'u1',
      today: '2026-09-01',
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      confidence: 'medium',
      engineVersion: 1,
    });
    const next = await observeNextPeriodPrediction(db, {
      userId: 'u1',
      today: '2026-09-02',
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      confidence: 'medium',
      engineVersion: 2,
    });
    assert.equal(next.created, true);
    assert.equal(db.rows.length, 2);
  });

  it('validGapCount-only is not a meaningful change', () => {
    const a = snapshotIdentity({
      userId: 'u1',
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      confidence: 'medium',
    });
    const b = snapshotIdentity({
      userId: 'u1',
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      confidence: 'medium',
    });
    assert.equal(isSameSnapshotIdentity(a, b), true);
  });
});

describe('error days + first vs final', () => {
  it('A exact date → 0', () => {
    assert.equal(errorDays('2026-09-29', '2026-09-29'), 0);
    assert.equal(absErrorDays('2026-09-29', '2026-09-29'), 0);
  });

  it('B actual +1', () => {
    assert.equal(errorDays('2026-09-29', '2026-09-30'), 1);
  });

  it('C actual -2', () => {
    assert.equal(errorDays('2026-09-29', '2026-09-27'), -2);
    assert.equal(absErrorDays('2026-09-29', '2026-09-27'), 2);
  });

  it('D/57 multiple revisions: first +2, final 0', () => {
    const history = buildPredictionHistory([
      snap({ predictedDate: '2026-09-29', snapshotDate: '2026-09-01', snapshotAt: new Date('2026-09-01T08:00:00Z') }),
      snap({ predictedDate: '2026-09-30', snapshotDate: '2026-09-15', snapshotAt: new Date('2026-09-15T08:00:00Z') }),
      snap({ predictedDate: '2026-10-01', snapshotDate: '2026-09-25', snapshotAt: new Date('2026-09-25T08:00:00Z') }),
    ], { periodStarts: ['2026-09-01', '2026-10-01'] });
    const ep = history.episodes[0];
    assert.equal(ep.status, 'completed');
    assert.equal(ep.firstErrorDays, 2);
    assert.equal(ep.lastErrorDays, 0);
    assert.equal(ep.snapshotCount, 3);
  });
});

describe('actual outcome + segmentation reuse', () => {
  it('F spotting only → no outcome', () => {
    const inferred = inferCycleStats([
      { date: '2026-09-01', flow: 'medium' },
      { date: '2026-09-28', flow: 'spotting' },
    ]);
    const history = buildPredictionHistory([
      snap({ cycleAnchorDate: '2026-09-01', predictedDate: '2026-09-29' }),
    ], { periodStarts: inferred.periodStarts });
    assert.equal(history.episodes[0].status, 'open');
    assert.equal(history.episodes[0].actualStart, null);
  });

  it('G one-day logging gap stays one episode', () => {
    const inferred = inferCycleStats([
      { date: '2026-09-01', flow: 'medium' },
      { date: '2026-09-29', flow: 'medium' },
      { date: '2026-10-01', flow: 'medium' },
    ]);
    assert.equal(inferred.periodStarts.includes('2026-09-29'), true);
    assert.equal(inferred.periodStarts.includes('2026-10-01'), false);
  });

  it('H explicit none splits episodes', () => {
    const inferred = inferCycleStats([
      { date: '2026-09-01', flow: 'medium' },
      { date: '2026-09-29', flow: 'medium' },
      { date: '2026-09-30', flow: 'none' },
      { date: '2026-10-02', flow: 'medium' },
    ]);
    assert.deepEqual(inferred.periodStarts.slice(-2), ['2026-09-29', '2026-10-02']);
  });

  it('I long consecutive bleed is one start', () => {
    const logs = [];
    for (let d = 1; d <= 18; d += 1) {
      logs.push({ date: `2026-09-${String(d).padStart(2, '0')}`, flow: 'heavy' });
    }
    const inferred = inferCycleStats(logs);
    assert.equal(inferred.periodStarts.length, 1);
    assert.equal(inferred.periodStarts[0], '2026-09-01');
  });

  it('J pregnancy-sized gap is excluded', () => {
    const history = buildPredictionHistory([
      snap({
        cycleAnchorDate: '2026-01-01',
        predictedDate: '2026-01-29',
        snapshotDate: '2026-01-02',
      }),
    ], { periodStarts: ['2026-01-01', '2026-10-01'] });
    assert.equal(history.episodes[0].status, 'excluded');
    assert.equal(history.episodes[0].exclusionReason, 'INVALID_CYCLE_GAP');
  });
});

describe('historical correction + same-day cutoff', () => {
  it('E correction recomputes outcome and keeps snapshots', () => {
    const snapshots = [
      snap({ predictedDate: '2026-09-29', snapshotDate: '2026-09-01' }),
    ];
    const first = buildPredictionHistory(snapshots, { periodStarts: ['2026-09-01', '2026-09-30'] });
    const corrected = buildPredictionHistory(snapshots, { periodStarts: ['2026-09-01', '2026-09-28'] });
    assert.equal(first.episodes[0].lastErrorDays, 1);
    assert.equal(corrected.episodes[0].lastErrorDays, -1);
    assert.equal(snapshots[0].predictedDate, '2026-09-29');
  });

  it('same-day post-outcome snapshot is not the final prediction', () => {
    const history = buildPredictionHistory([
      snap({
        predictedDate: '2026-09-29',
        snapshotDate: '2026-09-01',
        snapshotAt: new Date('2026-09-01T08:00:00Z'),
      }),
      snap({
        predictedDate: '2026-10-01',
        snapshotDate: '2026-10-01',
        snapshotAt: new Date('2026-10-01T18:00:00Z'),
      }),
    ], {
      periodStarts: ['2026-09-01', '2026-10-01'],
      loggedAtByDate: { '2026-10-01': '2026-10-01T09:00:00.000Z' },
    });
    assert.equal(history.episodes[0].lastPredictedStart, '2026-09-29');
    assert.equal(history.episodes[0].prePeriodSnapshotCount, 1);
  });

  it('same-day snapshot before the log stays pre-period', () => {
    const history = buildPredictionHistory([
      snap({
        predictedDate: '2026-10-01',
        snapshotDate: '2026-10-01',
        snapshotAt: new Date('2026-10-01T07:00:00Z'),
      }),
    ], {
      periodStarts: ['2026-09-01', '2026-10-01'],
      loggedAtByDate: { '2026-10-01': '2026-10-01T09:00:00.000Z' },
    });
    assert.equal(history.episodes[0].status, 'completed');
    assert.equal(history.episodes[0].lastPredictedStart, '2026-10-01');
  });
});

describe('no retrospective invention', () => {
  it('existing historical cycles without snapshots invent nothing', () => {
    const history = buildPredictionHistory([], {
      periodStarts: ['2026-05-01', '2026-05-29', '2026-06-26', '2026-07-24'],
    });
    assert.equal(history.snapshotCount, 0);
    assert.equal(history.episodes.length, 0);
    assert.equal(history.emptyReason, 'NO_SNAPSHOTS');
    assert.equal(history.completedCount, 0);
    assert.equal(history.aggregate, null);
  });
});

describe('aggregates + low history', () => {
  it('0–2 completed episodes stay without aggregate', () => {
    const one = buildPredictionHistory([
      snap({ cycleAnchorDate: '2026-07-01', predictedDate: '2026-07-29', snapshotDate: '2026-07-02' }),
    ], { periodStarts: ['2026-07-01', '2026-07-30'] });
    assert.equal(one.completedCount, 1);
    assert.equal(one.aggregateEligible, false);

    const twoSnaps = [
      snap({ cycleAnchorDate: '2026-07-01', predictedDate: '2026-07-29', snapshotDate: '2026-07-02' }),
      snap({ cycleAnchorDate: '2026-08-01', predictedDate: '2026-08-29', snapshotDate: '2026-08-02' }),
    ];
    const two = buildPredictionHistory(twoSnaps, {
      periodStarts: ['2026-07-01', '2026-08-01', '2026-08-30'],
    });
    assert.equal(two.completedCount, 2);
    assert.equal(two.aggregateEligible, false);
    assert.equal(AGGREGATE_MIN_COMPLETED, 3);
  });

  it('3+ uses median absolute error, not forecast mean', () => {
    const snapshots = [
      snap({ cycleAnchorDate: '2026-05-01', predictedDate: '2026-05-29', snapshotDate: '2026-05-02' }),
      snap({ cycleAnchorDate: '2026-06-01', predictedDate: '2026-06-29', snapshotDate: '2026-06-02' }),
      snap({ cycleAnchorDate: '2026-07-01', predictedDate: '2026-07-29', snapshotDate: '2026-07-02' }),
    ];
    const history = buildPredictionHistory(snapshots, {
      periodStarts: ['2026-05-01', '2026-06-01', '2026-07-01', '2026-07-30'],
    });
    assert.equal(history.aggregateEligible, true);
    assert.equal(history.aggregate.basis, 'median_absolute_error');
    assert.equal(
      history.aggregate.typicalAbsErrorDays,
      medianAbsError(history.episodes.filter((e) => e.status === 'completed').map((e) => e.lastAbsErrorDays)),
    );
  });
});

describe('idempotency + concurrency', () => {
  it('repeated observe + history fetch stays stable', async () => {
    const db = memoryPrisma();
    const input = {
      userId: 'u1',
      today: '2026-09-01',
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      confidence: 'medium',
    };
    await observeNextPeriodPrediction(db, input);
    await observeNextPeriodPrediction(db, input);
    await observeNextPeriodPrediction(db, input);
    const history = buildPredictionHistory(db.rows, { periodStarts: ['2026-09-01'] });
    assert.equal(db.rows.length, 1);
    assert.equal(history.snapshotCount, 1);
    const again = buildPredictionHistory(db.rows, { periodStarts: ['2026-09-01'] });
    assert.deepEqual(again.episodes, history.episodes);
  });

  it('two simultaneous creates collapse to one row', async () => {
    const db = memoryPrisma();
    const input = {
      userId: 'u1',
      today: '2026-09-01',
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      confidence: 'medium',
    };
    const [a, b] = await Promise.all([
      observeNextPeriodPrediction(db, input),
      observeNextPeriodPrediction(db, input),
    ]);
    assert.equal([a, b].filter((r) => r.created).length, 1);
    assert.equal([a, b].some((r) => r.reason === 'deduplicated'), true);
    assert.equal(db.rows.length, 1);
  });

  it('validGapCount-only does not create a revision', async () => {
    const db = memoryPrisma();
    const base = {
      userId: 'u1',
      today: '2026-09-01',
      predictedDate: '2026-09-29',
      cycleAnchorDate: '2026-09-01',
      confidence: 'medium',
      validGapCount: 2,
    };
    await observeNextPeriodPrediction(db, base);
    const again = await observeNextPeriodPrediction(db, { ...base, validGapCount: 5 });
    assert.equal(again.created, false);
    assert.equal(db.rows.length, 1);
  });
});

describe('privacy + deletion + partner/AI isolation', () => {
  it('public snapshot fields exclude sensitive keys', () => {
    const pub = publicSnapshotFields(snap());
    assert.equal(snapshotHasSensitiveFields(pub), false);
    for (const key of ['notes', 'sexualActivity', 'symptoms', 'pain', 'mood', 'customTagIds']) {
      assert.equal(Object.hasOwn(pub, key), false);
    }
    const exported = exportPredictionSnapshots([snap()]);
    assert.equal(snapshotHasSensitiveFields(exported[0]), false);
  });

  it('wipe deletes prediction snapshots', async () => {
    let snapCount = 0;
    const prisma = {
      cyclePartnerShare: {
        updateMany: async () => ({ count: 0 }),
        deleteMany: async () => ({ count: 0 }),
      },
      cycleProfile: {
        updateMany: async () => ({ count: 0 }),
        deleteMany: async () => ({ count: 1 }),
      },
      cycleLog: { deleteMany: async () => ({ count: 0 }) },
      cycleCustomTag: { deleteMany: async () => ({ count: 0 }) },
      pregnancyLog: { deleteMany: async () => ({ count: 0 }) },
      cyclePredictionSnapshot: { deleteMany: async () => ({ count: 4 }) },
      cyclePregnancyEpisode: { deleteMany: async () => ({ count: 0 }) },
      $transaction: async (ops) => {
        const out = await Promise.all(ops);
        snapCount = out[4].count;
        return out;
      },
    };
    const deleted = await wipeCycleHealthData(prisma, 'user-1');
    assert.equal(deleted.predictionSnapshots, 4);
    assert.equal(snapCount, 4);
  });

  it('partner payload is unchanged and has no snapshot keys', () => {
    const payload = buildPartnerPayload({
      today: '2026-09-10',
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { lastPeriodStart: '2026-09-01', avgCycleLength: 28, avgPeriodLength: 5, mode: 'TRACK_PERIOD' },
      logs: [{ date: '2026-09-01', flow: 'medium' }],
    });
    const text = JSON.stringify(payload);
    assert.doesNotMatch(text, /predictionSnapshot|predictionHistory|firstErrorDays/);
    assert.equal(partnerPayloadHasLeak(payload), false);
  });

  it('AI prompt builder does not receive snapshot rows', () => {
    const prompt = buildCycleAiUserPrompt({
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-09-01' },
      logs: [{ date: '2026-09-01', flow: 'medium', notes: 'secret' }],
      predictions: { nextPeriodStart: '2026-09-29', confidence: 'medium' },
    });
    assert.doesNotMatch(String(prompt), /CyclePredictionSnapshot|firstErrorDays|predictionHistory/);
  });
});

describe('engine isolation', () => {
  it('does not change forecast mean helpers', async () => {
    const { DEFAULT_CYCLE_LENGTH, resolveForecastAverages } = await import('./cycle.js');
    const avg = resolveForecastAverages(
      { avgCycleLength: 28, avgPeriodLength: 5 },
      { cycleCount: 0, inferredCycleLength: null, inferredPeriodLength: null },
    );
    assert.equal(DEFAULT_CYCLE_LENGTH, 28);
    assert.equal(avg.usedCycleLength, 28);
    assert.equal(avg.source, 'default');
  });
});
