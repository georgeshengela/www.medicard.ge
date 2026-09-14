import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TBILISI_MOVES_CAPABILITIES, adminHasCapability } from '../adminCapabilities.js';
import { compareObservationOrder, eligibleFromRaw, observationPayloadHash, validateObservationWindow } from './ingest.js';
import { districtGoalRatio, rankDistricts, rankPeople, ownPeopleRow } from './ranking.js';
import { addDaysYmd, tbilisiMidnight, tbilisiYmd } from './time.js';

describe('tbilisi moves ranking', () => {
  it('ranks by exact ratio, not rounded display percent', () => {
    const ranked = rankDistricts(
      [
        { id: 'a', slug: 'a', sortOrder: 1, target: 100000, eligibleStepsSum: 33340, contributorCount: 5 },
        { id: 'b', slug: 'b', sortOrder: 2, target: 100000, eligibleStepsSum: 33330, contributorCount: 5 },
      ],
      { minParticipantsForRank: 5 },
    );
    assert.equal(ranked[0].id, 'a');
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[1].rank, 2);
    assert.ok(districtGoalRatio(33340, 100000) !== districtGoalRatio(33330, 100000));
    assert.equal(Math.round(ranked[0].goalRatio * 100), Math.round(ranked[1].goalRatio * 100));
  });

  it('uses dense rank for equal ratios and sortOrder only for display', () => {
    const ranked = rankDistricts(
      [
        { id: 'z', slug: 'z', sortOrder: 90, target: 100, eligibleStepsSum: 50, contributorCount: 5 },
        { id: 'a', slug: 'a', sortOrder: 10, target: 100, eligibleStepsSum: 50, contributorCount: 5 },
        { id: 'm', slug: 'm', sortOrder: 20, target: 100, eligibleStepsSum: 40, contributorCount: 5 },
      ],
      { minParticipantsForRank: 1 },
    );
    assert.equal(ranked[0].id, 'a');
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[1].id, 'z');
    assert.equal(ranked[1].rank, 1);
    assert.equal(ranked[2].rank, 2);
  });

  it('marks below-min-participant districts unranked and still lists them', () => {
    const ranked = rankDistricts(
      [
        { id: 'hot', slug: 'hot', sortOrder: 1, target: 100, eligibleStepsSum: 80, contributorCount: 5 },
        { id: 'cold', slug: 'cold', sortOrder: 2, target: 100, eligibleStepsSum: 90, contributorCount: 2 },
      ],
      { minParticipantsForRank: 5 },
    );
    const hot = ranked.find((row) => row.id === 'hot');
    const cold = ranked.find((row) => row.id === 'cold');
    assert.equal(hot.rank, 1);
    assert.equal(cold.rank, null);
    assert.equal(cold.unranked, true);
    assert.equal(cold.eligibleStepsSum, 90);
  });

  it('excludes zero-credit people and keeps own rank off-page', () => {
    const rows = [
      { userId: '1', eligibleSteps: 100, publicHandle: 'Ana' },
      { userId: '2', eligibleSteps: 100, publicHandle: 'Beka' },
      { userId: '3', eligibleSteps: 50, publicHandle: 'Gio' },
      { userId: '4', eligibleSteps: 0, publicHandle: 'Zero' },
    ];
    const ranked = rankPeople(rows);
    assert.equal(ranked.length, 3);
    assert.equal(ranked[0].rank, 1);
    assert.equal(ranked[1].rank, 1);
    assert.equal(ranked[2].rank, 2);
    const packed = ownPeopleRow(ranked, { userId: '3', eligibleSteps: 50, publicHandle: 'Gio' }, { offset: 0, limit: 2 });
    assert.equal(packed.page.length, 2);
    assert.equal(packed.you.rank, 2);
    assert.equal(packed.you.onPage, false);
    const zero = ownPeopleRow(ranked, { userId: '4', eligibleSteps: 0, publicHandle: 'Zero' });
    assert.equal(zero.you.rank, null);
    assert.equal(zero.you.unranked, true);
    assert.equal(zero.you.eligibleSteps, 0);
  });
});

describe('tbilisi moves time', () => {
  it('uses Asia/Tbilisi civil dates, not the device timezone', () => {
    const justBefore = new Date('2026-09-14T19:59:00.000Z');
    const atMidnight = new Date('2026-09-14T20:00:00.000Z');
    assert.equal(tbilisiYmd(justBefore), '2026-09-14');
    assert.equal(tbilisiYmd(atMidnight), '2026-09-15');
    assert.equal(tbilisiMidnight('2026-09-15').toISOString(), '2026-09-14T20:00:00.000Z');
  });

  it('treats 00:00:00 Tbilisi change as next midnight, not immediate', () => {
    const atMidnight = new Date('2026-09-14T20:00:00.000Z');
    const today = tbilisiYmd(atMidnight);
    assert.equal(today, '2026-09-15');
    assert.equal(addDaysYmd(today, 1), '2026-09-16');
  });

  it('keeps 23:50 Tbilisi on the same civil day', () => {
    const late = new Date('2026-09-14T19:50:00.000Z');
    assert.equal(tbilisiYmd(late), '2026-09-14');
    assert.equal(addDaysYmd(tbilisiYmd(late), 1), '2026-09-15');
  });
});

describe('tbilisi moves observation policy', () => {
  it('replaces rather than summing and caps eligible steps', () => {
    assert.equal(eligibleFromRaw(4000, 10000), 4000);
    assert.equal(eligibleFromRaw(6200, 10000), 6200);
    assert.equal(eligibleFromRaw(15000, 10000), 10000);
  });

  it('orders observations by recordedAt then clientSequence', () => {
    const older = { recordedAt: '2026-09-14T08:00:00.000Z', clientSequence: 9, receivedAt: '2026-09-14T12:00:00.000Z' };
    const newer = { recordedAt: '2026-09-14T10:00:00.000Z', clientSequence: 1, receivedAt: '2026-09-14T10:00:01.000Z' };
    assert.ok(compareObservationOrder(newer, older) > 0);
    assert.ok(compareObservationOrder(older, newer) < 0);
  });

  it('hashes identical payloads the same', () => {
    const body = {
      provider: 'APPLE_HEALTH',
      sourceInstallationId: 'phone-1',
      tbilisiDate: '2026-09-14',
      intervalStart: '2026-09-13T20:00:00.000Z',
      intervalEnd: '2026-09-14T10:00:00.000Z',
      cumulativeSteps: 4000,
      recordedAt: '2026-09-14T10:00:00.000Z',
      clientSequence: 1,
    };
    assert.equal(observationPayloadHash(body), observationPayloadHash({ ...body, provider: 'apple_health' }));
  });

  it('rejects manual providers, negatives, and future intervals', () => {
    const now = new Date('2026-09-14T12:00:00.000Z');
    const start = tbilisiMidnight('2026-09-14').toISOString();
    assert.throws(
      () =>
        validateObservationWindow({
          body: {
            provider: 'MANUAL',
            tbilisiDate: '2026-09-14',
            intervalStart: start,
            intervalEnd: now.toISOString(),
            cumulativeSteps: 10,
            recordedAt: now.toISOString(),
          },
          now,
          sanityMaxRawSteps: 80000,
        }),
      (err) => err.code === 'PROVIDER_UNSUPPORTED',
    );
    assert.throws(
      () =>
        validateObservationWindow({
          body: {
            provider: 'APPLE_HEALTH',
            tbilisiDate: '2026-09-14',
            intervalStart: start,
            intervalEnd: now.toISOString(),
            cumulativeSteps: -1,
            recordedAt: now.toISOString(),
          },
          now,
          sanityMaxRawSteps: 80000,
        }),
      (err) => err.code === 'INVALID_STEPS',
    );
  });
});

describe('tbilisi moves capabilities', () => {
  it('requires explicit view/manage and keeps legacy null as full access', () => {
    assert.ok(TBILISI_MOVES_CAPABILITIES.includes('TBILISI_MOVES_VIEW'));
    assert.ok(TBILISI_MOVES_CAPABILITIES.includes('TBILISI_MOVES_REVIEW'));
    assert.ok(TBILISI_MOVES_CAPABILITIES.includes('TBILISI_MOVES_CORRECT'));
    assert.equal(adminHasCapability({ capabilities: null }, 'TBILISI_MOVES_MANAGE'), true);
    assert.equal(adminHasCapability({ capabilities: ['TBILISI_MOVES_VIEW'] }, 'TBILISI_MOVES_MANAGE'), false);
    assert.equal(adminHasCapability({ capabilities: ['TBILISI_MOVES_VIEW'] }, 'TBILISI_MOVES_VIEW'), true);
    assert.equal(adminHasCapability({ capabilities: ['TBILISI_MOVES_VIEW'] }, 'TBILISI_MOVES_REVIEW'), false);
    assert.equal(adminHasCapability({ capabilities: ['TBILISI_MOVES_REVIEW'] }, 'TBILISI_MOVES_CORRECT'), false);
  });
});
