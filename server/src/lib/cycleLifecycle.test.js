import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DELETE_CYCLE_CONFIRM,
  buildCycleExportPayload,
  wipeCycleHealthData,
} from './cycleLifecycle.js';
import { interpretContraception } from './cycleContraception.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { privateCacheHeaders } from './cycleShare.js';

function mockPrisma() {
  return {
    cyclePartnerShare: {
      updateMany: async () => ({ count: 1 }),
      deleteMany: async () => ({ count: 2 }),
    },
    cycleProfile: {
      updateMany: async () => ({ count: 1 }),
      deleteMany: async () => ({ count: 1 }),
    },
    cycleLog: { deleteMany: async () => ({ count: 7 }) },
    cycleCustomTag: { deleteMany: async () => ({ count: 3 }) },
    pregnancyLog: { deleteMany: async () => ({ count: 1 }) },
    $transaction: async (ops) => Promise.all(ops),
  };
}

describe('cycle export', () => {
  it('includes journal and tags as user-logged data and omits partner secrets', () => {
    const payload = buildCycleExportPayload({
      profile: {
        mode: 'TRACK_PERIOD',
        lastPeriodStart: '2026-08-01',
        partnerShareCode: 'should-not-appear',
        aiInsights: { headline: 'no' },
      },
      logs: [
        {
          date: '2026-08-10',
          flow: 'medium',
          notes: 'private journal',
          customTagIds: ['tag-1'],
          painEntries: [{ type: 'cramps', severity: 'mild' }],
        },
      ],
      customTags: [{ id: 'tag-1', name: 'Night shift' }],
      inferred: { periodStarts: ['2026-08-01'], periodRanges: [] },
      contraception: { method: 'COMBINED_PILL', startedAt: '2026-07-01' },
    });
    assert.equal(payload.format, 'medicard.cycle.export.v1');
    assert.equal(payload.includesJournal, true);
    assert.equal(payload.logs[0].notes, 'private journal');
    assert.equal(payload.customTags[0].name, 'Night shift');
    assert.equal(payload.contraception.label, 'self_reported');
    assert.equal(JSON.stringify(payload).includes('should-not-appear'), false);
    assert.equal(JSON.stringify(payload).includes('aiInsights'), false);
    assert.equal(Object.hasOwn(payload, 'analytics'), false);
  });
});

describe('cycle wipe', () => {
  it('requires the exact confirmation token', () => {
    assert.equal(DELETE_CYCLE_CONFIRM, 'DELETE_CYCLE_DATA');
  });

  it('deletes logs, tags, pregnancy, shares, and profile', async () => {
    const deleted = await wipeCycleHealthData(mockPrisma(), 'user-1');
    assert.equal(deleted.logs, 7);
    assert.equal(deleted.tags, 3);
    assert.equal(deleted.pregnancyLogs, 1);
    assert.equal(deleted.shares, 2);
    assert.equal(deleted.profiles, 1);
  });
});

describe('legacy profile still builds conservative analytics', () => {
  it('does not crash on a pre-Phase-7 profile fixture', async () => {
    const { buildHistoricalAnalytics } = await import('./cycleHistoryAnalytics.js');
    const analytics = buildHistoricalAnalytics({
      logs: [{ date: '2026-08-01', flow: 'medium', symptoms: [], moods: [] }],
      inferred: { periodStarts: ['2026-08-01'], periodRanges: [] },
    });
    assert.equal(analytics.insightDataQuality, 'LOW');
    assert.equal(analytics.completedCycleCount, 0);
    assert.equal(analytics.contraceptionContext.doNotRetroactivelyApply, true);
  });
});

describe('LIMITED presentation stays on for fertility consumers', () => {
  it('hides fertility markers for combined pill', () => {
    const ctx = interpretContraception({ contraceptionMethod: 'COMBINED_PILL' });
    assert.equal(ctx.presentation.showFertilityMarkers, false);
    assert.equal(ctx.presentation.showOvulationDate, false);
  });
});

describe('partner payload still excludes lifecycle/export objects', () => {
  it('does not leak export or wipe keys', () => {
    const payload = buildPartnerPayload({
      today: '2026-08-10',
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { lastPeriodStart: '2026-08-01', avgCycleLength: 28, avgPeriodLength: 5, mode: 'TRACK_PERIOD' },
      logs: [{ date: '2026-08-01', flow: 'medium' }],
    });
    const text = JSON.stringify(payload);
    for (const key of ['includesJournal', 'DELETE_CYCLE_DATA', 'wipe', 'export']) {
      assert.doesNotMatch(text, new RegExp(`"${key}"`));
    }
    assert.equal(partnerPayloadHasLeak(payload), false);
  });
});

describe('private cache headers', () => {
  it('mark Cycle responses no-store', () => {
    const headers = privateCacheHeaders();
    assert.match(headers['Cache-Control'], /no-store/);
    assert.equal(headers.Pragma, 'no-cache');
  });
});
