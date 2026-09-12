import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createQuestFakeDb } from '../questFakeDb.js';
import { canAssignNewDailyPeriod, dailyPeriodKey, startOfLocalDay } from '../questTime.js';
import { CARE_ENERGY_TYPES } from './contract.js';
import {
  bandForRatioBps,
  cumulativeXpToReachLevel,
  MEDI_WORLD_ECONOMY_V2,
  MEDI_WORLD_RULESET_ID,
  REASON_CODES,
  worldProgressFromXp,
  xpRequiredForNextLevel,
} from './ruleset.js';
import { completionRatioBps, energyForRatioBps, worldXpForRatioBps } from './economy.js';
import { ensureMediWorldProfile, processWorldActivity, setWorldXpForTests } from './engine.js';
import { debitCareEnergy } from './debit.js';
import { getMediWorldLedger, getMediWorldProfile } from './service.js';

const NOW = new Date('2026-09-12T12:00:00+04:00');
const USER = 'user-econ-1';

function event(overrides = {}) {
  return {
    sourceType: 'FOUNDATION_TEST',
    sourceId: overrides.sourceId || 'evt-1',
    idempotencyKey: overrides.idempotencyKey || 'idem-1',
    adapterId: overrides.adapterId || 'activity.walking',
    energyType: overrides.energyType || 'movement',
    progressState: overrides.progressState || 'verified',
    personalTarget: overrides.personalTarget ?? 1500,
    completedAmount: overrides.completedAmount ?? 1500,
    logicalEventId: overrides.logicalEventId,
  };
}

describe('medi-world-economy-v2 bands', () => {
  it('uses the exact Phase 39 table', () => {
    const cases = [
      [0, 0, 0],
      [4999, 0, 0],
      [5000, 4, 4],
      [7499, 4, 4],
      [7500, 7, 8],
      [9999, 7, 8],
      [10000, 10, 12],
      [12000, 10, 12],
    ];
    for (const [bps, energy, xp] of cases) {
      const band = bandForRatioBps(bps > 10000 ? 10000 : bps);
      if (bps > 10000) {
        assert.equal(energyForRatioBps(10000), 10);
        assert.equal(worldXpForRatioBps(10000), 12);
      } else {
        assert.equal(band.energy, energy, `energy at ${bps}`);
        assert.equal(band.worldXp, xp, `xp at ${bps}`);
        assert.equal(energyForRatioBps(bps), energy);
        assert.equal(worldXpForRatioBps(bps), xp);
      }
    }
  });

  it('rejects invalid non-integer and negative basis points', () => {
    assert.throws(() => bandForRatioBps(1.5), { code: 'WORLD_INVALID_PROGRESS' });
    assert.throws(() => bandForRatioBps(-1), { code: 'WORLD_INVALID_PROGRESS' });
    assert.throws(() => completionRatioBps(-1, 1500), { code: 'WORLD_INVALID_PROGRESS' });
  });
});

describe('normalized fairness', () => {
  it('pays the same for 1500/1500 and 10000/10000', () => {
    assert.equal(completionRatioBps(1500, 1500), completionRatioBps(10_000, 10_000));
    assert.equal(energyForRatioBps(10_000), 10);
    assert.equal(worldXpForRatioBps(10_000), 12);
  });

  it('does not let larger raw activity bypass the 100% band', () => {
    assert.equal(completionRatioBps(20_000, 10_000), 10_000);
    assert.equal(energyForRatioBps(10_000), 10);
  });

  it('treats wheelchair and low-mobility as equal movement adapters', async () => {
    const db = createQuestFakeDb();
    const walk = await processWorldActivity(
      'u-walk',
      event({ sourceId: 'w', idempotencyKey: 'w', adapterId: 'activity.walking' }),
      { db, now: NOW },
    );
    const chair = await processWorldActivity(
      'u-chair',
      event({
        sourceId: 'c',
        idempotencyKey: 'c',
        adapterId: 'activity.wheelchair',
        personalTarget: 800,
        completedAmount: 800,
      }),
      { db, now: NOW },
    );
    const low = await processWorldActivity(
      'u-low',
      event({
        sourceId: 'l',
        idempotencyKey: 'l',
        adapterId: 'activity.low_mobility',
        personalTarget: 400,
        completedAmount: 400,
      }),
      { db, now: NOW },
    );
    assert.equal(walk.reward.energyAmount, chair.reward.energyAmount);
    assert.equal(chair.reward.energyAmount, low.reward.energyAmount);
    assert.equal(walk.reward.worldXp, 12);
  });
});

describe('evidence policy', () => {
  it('awards only verified completions', async () => {
    const db = createQuestFakeDb();
    for (const state of ['user_reported', 'estimated', 'pending', 'rejected']) {
      const result = await processWorldActivity(
        USER,
        event({ sourceId: state, idempotencyKey: state, progressState: state }),
        { db, now: NOW },
      );
      assert.equal(result.reward.energyAmount, 0);
      assert.equal(result.reward.worldXp, 0);
      assert.equal(result.reasonCode, REASON_CODES.UNVERIFIED_ACTIVITY);
    }
  });

  it('finalizes a pending event without double paying', async () => {
    const db = createQuestFakeDb();
    const pending = await processWorldActivity(
      USER,
      event({
        sourceId: 'same-event',
        idempotencyKey: 'eval:same-event:pending',
        logicalEventId: 'same-event',
        progressState: 'pending',
      }),
      { db, now: NOW },
    );
    assert.equal(pending.reward.energyAmount, 0);
    const verified = await processWorldActivity(
      USER,
      event({
        sourceId: 'same-event',
        idempotencyKey: 'award:same-event',
        logicalEventId: 'same-event',
        progressState: 'verified',
      }),
      { db, now: NOW },
    );
    assert.equal(verified.applied, true);
    assert.equal(verified.reward.energyAmount, 10);
    const again = await processWorldActivity(
      USER,
      event({
        sourceId: 'same-event',
        idempotencyKey: 'award:same-event-2',
        logicalEventId: 'same-event',
        progressState: 'verified',
      }),
      { db, now: NOW },
    );
    assert.equal(again.duplicate, true);
    const profile = await getMediWorldProfile(USER, { db, timezone: 'Asia/Tbilisi', now: NOW });
    assert.equal(profile.profile.careEnergy.movement, 10);
  });
});

describe('daily caps', () => {
  it('stops extra Care Energy after 20 in a category and still records activity', async () => {
    const db = createQuestFakeDb();
    const first = await processWorldActivity(USER, event({ sourceId: 'a', idempotencyKey: 'a' }), { db, now: NOW });
    const second = await processWorldActivity(USER, event({ sourceId: 'b', idempotencyKey: 'b' }), { db, now: NOW });
    const third = await processWorldActivity(USER, event({ sourceId: 'c', idempotencyKey: 'c' }), { db, now: NOW });
    assert.equal(first.reward.energyAmount, 10);
    assert.equal(second.reward.energyAmount, 10);
    assert.equal(third.reward.energyAmount, 0);
    assert.equal(third.reasonCode, REASON_CODES.DAILY_CATEGORY_CAP_REACHED);
    assert.equal(third.applied, true);
    const profile = await getMediWorldProfile(USER, { db, timezone: 'Asia/Tbilisi', now: NOW });
    assert.equal(profile.profile.careEnergy.movement, 20);
    assert.equal(profile.today.category.movement.used, 20);
    assert.equal(profile.today.worldXp.used, 36);
  });

  it('stops extra World XP after 60 without extra currency', async () => {
    const db = createQuestFakeDb();
    const types = ['movement', 'hydration', 'calm', 'care', 'connection'];
    const adapters = ['activity.walking', 'activity.hydration', 'activity.breathing', 'activity.care_routine', 'activity.connection'];
    for (let i = 0; i < 5; i += 1) {
      await processWorldActivity(
        USER,
        event({
          sourceId: `xp-${i}`,
          idempotencyKey: `xp-${i}`,
          adapterId: adapters[i],
          energyType: types[i],
        }),
        { db, now: NOW },
      );
    }
    const extra = await processWorldActivity(
      USER,
      event({
        sourceId: 'xp-6',
        idempotencyKey: 'xp-6',
        adapterId: 'activity.rest',
        energyType: 'calm',
      }),
      { db, now: NOW },
    );
    assert.equal(extra.reward.worldXp, 0);
    assert.equal(extra.reasonCode, REASON_CODES.DAILY_XP_CAP_REACHED);
    const profile = await getMediWorldProfile(USER, { db, timezone: 'Asia/Tbilisi', now: NOW });
    assert.equal(profile.today.worldXp.used, 60);
  });

  it('reuses the previous cap day when a timezone hop is denied', async () => {
    const db = createQuestFakeDb();
    await processWorldActivity(USER, event({ sourceId: 't1', idempotencyKey: 't1' }), {
      db,
      now: NOW,
      timezone: 'Asia/Tbilisi',
    });
    const hopped = dailyPeriodKey(NOW, 'Pacific/Honolulu');
    const allowed = canAssignNewDailyPeriod(
      { lastDailyAssignPeriodKey: '2026-09-12', lastDailyAssignAt: NOW },
      hopped,
      NOW,
      'Pacific/Honolulu',
    );
    assert.equal(allowed, false);
    const second = await processWorldActivity(USER, event({ sourceId: 't2', idempotencyKey: 't2' }), {
      db,
      now: NOW,
      timezone: 'Pacific/Honolulu',
    });
    assert.equal(second.explanation.params.periodKey, '2026-09-12');
  });

  it('keeps one local calendar day across a DST spring-forward', async () => {
    const tz = 'America/New_York';
    const before = new Date('2026-03-08T06:30:00Z');
    const after = new Date('2026-03-08T07:30:00Z');
    assert.equal(dailyPeriodKey(before, tz), dailyPeriodKey(after, tz));
    assert.ok(startOfLocalDay('2026-03-08', tz).getTime() < after.getTime());
    const db = createQuestFakeDb();
    const first = await processWorldActivity(USER, event({ sourceId: 'dst1', idempotencyKey: 'dst1' }), {
      db,
      now: before,
      timezone: tz,
    });
    const second = await processWorldActivity(USER, event({ sourceId: 'dst2', idempotencyKey: 'dst2' }), {
      db,
      now: after,
      timezone: tz,
    });
    assert.equal(first.explanation.params.periodKey, second.explanation.params.periodKey);
  });
});

describe('world levels', () => {
  it('uses xpRequiredForNextLevel(L) = 100 + 25*(L-1)', () => {
    assert.equal(xpRequiredForNextLevel(1), 100);
    assert.equal(xpRequiredForNextLevel(2), 125);
    assert.equal(xpRequiredForNextLevel(3), 150);
    assert.equal(xpRequiredForNextLevel(50), 0);
    assert.equal(cumulativeXpToReachLevel(2), 100);
    assert.equal(cumulativeXpToReachLevel(3), 225);
    assert.equal(worldProgressFromXp(0).level, 1);
    assert.equal(worldProgressFromXp(100).level, 2);
    assert.equal(worldProgressFromXp(224).level, 2);
    assert.equal(worldProgressFromXp(225).level, 3);
    assert.equal(worldProgressFromXp(34_300).level, 50);
    assert.equal(worldProgressFromXp(99_999).level, 50);
    assert.equal(worldProgressFromXp(99_999).atCap, true);
  });

  it('does not grant a level-up on lazy profile creation', async () => {
    const db = createQuestFakeDb();
    const profile = await getMediWorldProfile(USER, { db, now: NOW, timezone: 'Asia/Tbilisi' });
    assert.equal(profile.profile.worldLevel, 1);
    assert.equal((await db.mediWorldLedger.findMany({ where: { userId: USER } })).length, 0);
  });

  it('grants connection Care Energy once per newly crossed level and never XP', async () => {
    const db = createQuestFakeDb();
    const result = await setWorldXpForTests(USER, 225, { db, now: NOW });
    assert.equal(result.profile.worldLevel, 3);
    assert.equal(result.profile.careEnergy.connection, 10);
    const rows = await db.mediWorldLedger.findMany({ where: { userId: USER, sourceType: 'LEVEL_UP' } });
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.foundationXp === 0));
    assert.ok(rows.every((row) => row.reasonCode === REASON_CODES.LEVEL_UP_REWARD));
    const again = await setWorldXpForTests(USER, 225, { db, now: NOW });
    assert.equal((await db.mediWorldLedger.findMany({ where: { userId: USER, sourceType: 'LEVEL_UP' } })).length, 2);
    assert.equal(again.profile.careEnergy.connection, 10);
  });

  it('caps at level 50 and keeps recording lifetime XP', async () => {
    const db = createQuestFakeDb();
    const result = await setWorldXpForTests(USER, 50_000, { db, now: NOW });
    assert.equal(result.profile.worldLevel, 50);
    assert.equal(result.profile.worldXp, 50_000);
    assert.equal(result.profile.foundation.atCap, true);
    const levels = await db.mediWorldLedger.findMany({ where: { userId: USER, sourceType: 'LEVEL_UP' } });
    assert.equal(levels.length, 49);
    const stored = await db.mediWorldProfile.findUnique({ where: { userId: USER } });
    assert.equal(stored.foundationLevel, worldProgressFromXp(stored.foundationXp).level);
  });
});

describe('latestReward ordering', () => {
  it('picks createdAt DESC, id DESC when timestamps are identical', async () => {
    const db = createQuestFakeDb();
    await ensureMediWorldProfile(USER, { db, now: NOW });
    await db.mediWorldLedger.create({
      data: {
        id: 'ledger-aaa',
        userId: USER,
        idempotencyKey: 'latest-a',
        sourceType: 'FOUNDATION_TEST',
        sourceId: 'a',
        adapterId: 'activity.walking',
        energyType: 'movement',
        transactionType: 'CREDIT',
        energyAmount: 10,
        foundationXp: 12,
        progressState: 'verified',
        completionRatioBps: 10_000,
        reasonCode: REASON_CODES.PERSONAL_GOAL_COMPLETE,
        createdAt: NOW,
      },
    });
    await db.mediWorldLedger.create({
      data: {
        id: 'ledger-zzz',
        userId: USER,
        idempotencyKey: 'latest-z',
        sourceType: 'FOUNDATION_TEST',
        sourceId: 'z',
        adapterId: 'activity.walking',
        energyType: 'movement',
        transactionType: 'CREDIT',
        energyAmount: 0,
        foundationXp: 0,
        progressState: 'verified',
        completionRatioBps: 10_000,
        reasonCode: REASON_CODES.DAILY_CATEGORY_CAP_REACHED,
        createdAt: NOW,
      },
    });
    const profile = await getMediWorldProfile(USER, { db, now: NOW, timezone: 'Asia/Tbilisi' });
    assert.equal(profile.latestReward.reasonCode, REASON_CODES.DAILY_CATEGORY_CAP_REACHED);
    assert.equal(profile.latestReward.energyAmount, 0);
  });

  it('keeps the later cap row as latestReward after sequential awards with the same clock', async () => {
    const db = createQuestFakeDb();
    await processWorldActivity(USER, event({ sourceId: 'lr-1', idempotencyKey: 'lr-1' }), { db, now: NOW });
    await processWorldActivity(USER, event({ sourceId: 'lr-2', idempotencyKey: 'lr-2' }), { db, now: NOW });
    const third = await processWorldActivity(USER, event({ sourceId: 'lr-3', idempotencyKey: 'lr-3' }), { db, now: NOW });
    assert.equal(third.reasonCode, REASON_CODES.DAILY_CATEGORY_CAP_REACHED);
    const profile = await getMediWorldProfile(USER, { db, now: NOW, timezone: 'Asia/Tbilisi' });
    assert.equal(profile.latestReward.reasonCode, REASON_CODES.DAILY_CATEGORY_CAP_REACHED);
    assert.equal(profile.profile.careEnergy.movement, 20);
    assert.equal(profile.today.worldXp.used, 36);
  });
});

describe('internal debit', () => {
  it('debits, rejects overdraft, and retries idempotently', async () => {
    const db = createQuestFakeDb();
    await processWorldActivity(USER, event(), { db, now: NOW });
    const debit = await debitCareEnergy(
      USER,
      { energyType: 'movement', amount: 4, idempotencyKey: 'deb-1', reasonCode: 'INTERNAL_TEST' },
      { db, now: NOW },
    );
    assert.equal(debit.applied, true);
    assert.equal(debit.ledger.transactionType, 'DEBIT');
    assert.equal(debit.profile.careEnergy.movement, 6);
    const retry = await debitCareEnergy(
      USER,
      { energyType: 'movement', amount: 4, idempotencyKey: 'deb-1', reasonCode: 'INTERNAL_TEST' },
      { db, now: NOW },
    );
    assert.equal(retry.duplicate, true);
    assert.equal(retry.profile.careEnergy.movement, 6);
    await assert.rejects(
      () =>
        debitCareEnergy(
          USER,
          { energyType: 'movement', amount: 99, idempotencyKey: 'deb-2', reasonCode: 'INTERNAL_TEST' },
          { db, now: NOW },
        ),
      (err) => err.code === REASON_CODES.INSUFFICIENT_CARE_ENERGY,
    );
    await debitCareEnergy(
      USER,
      { energyType: 'movement', amount: 6, idempotencyKey: 'deb-3', reasonCode: 'INTERNAL_TEST' },
      { db, now: NOW },
    );
    const profile = await getMediWorldProfile(USER, { db, now: NOW, timezone: 'Asia/Tbilisi' });
    assert.equal(profile.profile.careEnergy.movement, 0);
    await assert.rejects(
      () =>
        debitCareEnergy(
          USER,
          { energyType: 'movement', amount: 1, idempotencyKey: 'deb-1', reasonCode: 'INTERNAL_TEST' },
          { db, now: NOW },
        ),
      (err) => err.code === 'WORLD_IDEMPOTENCY_CONFLICT',
    );
  });

  it('rolls a debit back so balance and ledger stay consistent', async () => {
    const db = createQuestFakeDb();
    await processWorldActivity(USER, event({ sourceId: 'rb', idempotencyKey: 'deb-rb-src' }), { db, now: NOW });
    await assert.rejects(
      () =>
        debitCareEnergy(
          USER,
          { energyType: 'movement', amount: 3, idempotencyKey: 'deb-rb', reasonCode: 'INTERNAL_TEST' },
          {
            db,
            now: NOW,
            beforeCommit: async () => {
              throw new Error('forced-debit-rollback');
            },
          },
        ),
    );
    const profile = await getMediWorldProfile(USER, { db, now: NOW, timezone: 'Asia/Tbilisi' });
    assert.equal(profile.profile.careEnergy.movement, 10);
    assert.equal((await db.mediWorldLedger.findMany({ where: { userId: USER, transactionType: 'DEBIT' } })).length, 0);
  });
});

describe('idempotency conflicts', () => {
  it('rejects the same key with a different category', async () => {
    const db = createQuestFakeDb();
    await processWorldActivity(USER, event(), { db, now: NOW });
    await assert.rejects(
      () =>
        processWorldActivity(
          USER,
          event({
            adapterId: 'activity.hydration',
            energyType: 'hydration',
          }),
          { db, now: NOW },
        ),
      (err) => err.code === 'WORLD_IDEMPOTENCY_CONFLICT',
    );
  });

  it('does not leak another user ledger in a conflict error', async () => {
    const db = createQuestFakeDb();
    await processWorldActivity(USER, event({ idempotencyKey: 'shared-key', sourceId: 'owner' }), { db, now: NOW });
    await assert.rejects(
      () =>
        processWorldActivity(
          'other-user',
          event({
            sourceId: 'intruder',
            idempotencyKey: 'shared-key',
            adapterId: 'activity.hydration',
            energyType: 'hydration',
          }),
          { db, now: NOW },
        ),
      (err) => {
        const blob = JSON.stringify(err, Object.getOwnPropertyNames(err));
        assert.equal(err.code, 'WORLD_IDEMPOTENCY_CONFLICT');
        assert.equal(blob.includes(USER), false);
        assert.equal(blob.includes('owner'), false);
        assert.equal(blob.includes('idempotencyKey'), false);
        return true;
      },
    );
  });
});

describe('API privacy', () => {
  it('does not expose idempotency keys or raw metadata', async () => {
    const db = createQuestFakeDb();
    await processWorldActivity(
      USER,
      { ...event(), metadata: { templateKey: 'daily_steps', steps: 9000, diagnosis: 'nope' } },
      { db, now: NOW },
    );
    const page = await getMediWorldLedger(USER, { db, take: 10 });
    const blob = JSON.stringify(page);
    assert.equal(blob.includes('idempotencyKey'), false);
    assert.equal(blob.includes('diagnosis'), false);
    assert.equal(blob.includes('"steps"'), false);
    assert.equal(page.items[0].reasonCode, REASON_CODES.PERSONAL_GOAL_COMPLETE);
    const profile = await getMediWorldProfile(USER, { db, now: NOW, timezone: 'Asia/Tbilisi' });
    assert.equal(profile.economy.rulesetId, MEDI_WORLD_RULESET_ID);
    CARE_ENERGY_TYPES.forEach((type) => assert.ok(type in profile.today.category));
  });
});
