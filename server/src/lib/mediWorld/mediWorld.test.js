import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createQuestFakeDb } from '../questFakeDb.js';
import {
  assignDailyQuests,
  completeQuest,
  getUserQuestDashboard,
} from '../quest.js';
import { QUEST_TIMEZONE } from '../questTime.js';
import {
  CARE_ENERGY_TYPES,
  PHASE38_UNLOCKS,
  PROGRESS_STATES,
  WORLD_FORBIDDEN_META_KEYS,
} from './contract.js';
import {
  completionRatioBps,
  energyForRatioBps,
  foundationXpForRatioBps,
  foundationProgressFromXp,
  nextNonNegativeBalance,
  MEDI_WORLD_FOUNDATION,
  WORLD_TRANSACTION_CREDIT,
  WORLD_TRANSACTION_DEBIT,
} from './economy.js';
import { isMediWorldEnabled, isMediWorldExploreEnabled, isMediWorldFoundationTestPathEnabled, isMediWorldMovementEnabled, isMediWorldGardenEnabled } from './flags.js';
import { processWorldActivity, ensureMediWorldProfile, publicWorldProfile } from './engine.js';
import { getMediWorldLedger, getMediWorldProfile, processFoundationTestActivity } from './service.js';
import { sanitizeWorldMetadata } from './privacy.js';
import { worldAdapterFromQuest } from './questAdapter.js';

const NOW = new Date('2026-09-12T12:00:00+04:00');
const TODAY = '2026-09-12';
const USER = 'user-world-1';
const ATHLETE = 'user-world-athlete';
const REHAB = 'user-world-rehab';

function verifiedEvent(overrides = {}) {
  return {
    sourceType: 'FOUNDATION_TEST',
    sourceId: overrides.sourceId || 'evt-1',
    idempotencyKey: overrides.idempotencyKey || 'idem-1',
    adapterId: overrides.adapterId || 'activity.walking',
    energyType: overrides.energyType || 'movement',
    progressState: overrides.progressState || 'verified',
    personalTarget: overrides.personalTarget ?? 1500,
    completedAmount: overrides.completedAmount ?? 1500,
    metadata: overrides.metadata,
  };
}

async function seedQuestUser(db, userId = USER) {
  await db.hydrationPreference.create({ data: { userId, goalMl: 2000 } });
  await db.stepTrackingCapability.create({
    data: { userId, status: 'AVAILABLE', source: 'APPLE_HEALTH' },
  });
}

function questByKey(rows, key) {
  return rows.find((row) => (row.template?.key || row.key) === key);
}

describe('Medi World flags', () => {
  it('is on unless explicitly disabled', () => {
    assert.equal(isMediWorldEnabled({ nodeEnv: 'production', flag: '' }), true);
    assert.equal(isMediWorldEnabled({ nodeEnv: 'production', flag: '1' }), true);
    assert.equal(isMediWorldEnabled({ nodeEnv: 'development', flag: '' }), true);
    assert.equal(isMediWorldEnabled({ nodeEnv: 'test', flag: '0' }), false);
    assert.equal(isMediWorldExploreEnabled({ nodeEnv: 'production', flag: '1', exploreFlag: '' }), true);
    assert.equal(isMediWorldExploreEnabled({ nodeEnv: 'production', flag: '1', exploreFlag: '1' }), true);
    assert.equal(isMediWorldExploreEnabled({ nodeEnv: 'development', flag: '1', exploreFlag: '' }), true);
    assert.equal(isMediWorldExploreEnabled({ nodeEnv: 'test', flag: '1', exploreFlag: '0' }), false);
    assert.equal(isMediWorldMovementEnabled({ nodeEnv: 'production', flag: '1', movementFlag: '' }), true);
    assert.equal(isMediWorldMovementEnabled({ nodeEnv: 'production', flag: '1', movementFlag: '1' }), true);
    assert.equal(isMediWorldMovementEnabled({ nodeEnv: 'development', flag: '1', movementFlag: '' }), true);
    assert.equal(isMediWorldMovementEnabled({ nodeEnv: 'test', flag: '1', movementFlag: '0' }), false);
    assert.equal(isMediWorldGardenEnabled({ nodeEnv: 'production', flag: '1', gardenFlag: '' }), true);
    assert.equal(isMediWorldGardenEnabled({ nodeEnv: 'production', flag: '1', gardenFlag: '1' }), true);
    assert.equal(isMediWorldGardenEnabled({ nodeEnv: 'development', flag: '1', gardenFlag: '' }), true);
    assert.equal(isMediWorldGardenEnabled({ nodeEnv: 'test', flag: '1', gardenFlag: '0' }), false);
  });

  it('never enables the internal foundation-test path in production', () => {
    assert.equal(isMediWorldFoundationTestPathEnabled({ nodeEnv: 'production', flag: '1' }), false);
    assert.equal(isMediWorldFoundationTestPathEnabled({ nodeEnv: 'test', flag: '' }), true);
  });
});

describe('normalized personal-goal fairness', () => {
  it('gives the same ratio for equivalent personal completion', () => {
    assert.equal(completionRatioBps(1500, 1500), 10_000);
    assert.equal(completionRatioBps(10_000, 10_000), 10_000);
    assert.equal(energyForRatioBps(10_000), energyForRatioBps(10_000));
    assert.equal(energyForRatioBps(completionRatioBps(1500, 1500)), 10);
    assert.equal(energyForRatioBps(completionRatioBps(10_000, 10_000)), 10);
    assert.equal(foundationXpForRatioBps(10_000), 12);
  });

  it('caps rewards at 100% of the personal target', () => {
    assert.equal(completionRatioBps(20_000, 10_000), 10_000);
    assert.equal(energyForRatioBps(completionRatioBps(12_000, 1500)), MEDI_WORLD_FOUNDATION.maxEnergyPerEvent);
  });

  it('pays zero for zero progress', () => {
    assert.equal(completionRatioBps(0, 1500), 0);
    assert.equal(energyForRatioBps(0), 0);
    assert.equal(foundationXpForRatioBps(0), 0);
  });

  it('rejects invalid targets and negative progress', () => {
    assert.throws(() => completionRatioBps(10, 0), { code: 'WORLD_INVALID_PROGRESS' });
    assert.throws(() => completionRatioBps(-1, 1500), { code: 'WORLD_INVALID_PROGRESS' });
    assert.throws(() => completionRatioBps(1.5, 1500), { code: 'WORLD_INVALID_PROGRESS' });
  });

  it('keeps world level integer and non-negative', () => {
    assert.equal(foundationProgressFromXp(0).level, 1);
    assert.equal(foundationProgressFromXp(99).level, 1);
    assert.equal(foundationProgressFromXp(100).level, 2);
    assert.equal(foundationProgressFromXp(99).progressPercent, 99);
  });
});

describe('lazy world profile', () => {
  it('creates one profile per user on first ensure', async () => {
    const db = createQuestFakeDb();
    const first = await ensureMediWorldProfile(USER, { db });
    const second = await ensureMediWorldProfile(USER, { db });
    const rows = await db.mediWorldProfile.findMany({ where: { userId: USER } });
    assert.equal(rows.length, 1);
    assert.equal(first.userId, USER);
    assert.equal(second.userId, USER);
    assert.equal(first.energyMovement, 0);
    assert.equal(publicWorldProfile(first).unlocks.liveMap, false);
    assert.equal(PHASE38_UNLOCKS.healthTree, false);
  });

  it('does not invent a second profile for the same user', async () => {
    const db = createQuestFakeDb();
    await getMediWorldProfile(USER, { db });
    await getMediWorldProfile(USER, { db });
    assert.equal((await db.mediWorldProfile.findMany({})).length, 1);
  });
});

describe('progression engine', () => {
  it('awards the same Care Energy for equivalent verified personal goals', async () => {
    const db = createQuestFakeDb();
    const rehab = await processWorldActivity(
      REHAB,
      verifiedEvent({
        sourceId: 'rehab-1',
        idempotencyKey: 'rehab-1',
        personalTarget: 1500,
        completedAmount: 1500,
      }),
      { db, now: NOW },
    );
    const athlete = await processWorldActivity(
      ATHLETE,
      verifiedEvent({
        adapterId: 'activity.wheelchair',
        sourceId: 'ath-1',
        idempotencyKey: 'ath-1',
        personalTarget: 10_000,
        completedAmount: 10_000,
      }),
      { db, now: NOW },
    );
    assert.equal(rehab.reward.energyAmount, athlete.reward.energyAmount);
    assert.equal(rehab.profile.careEnergy.movement, 10);
    assert.equal(athlete.profile.careEnergy.movement, 10);
    assert.equal(rehab.profile.foundation.level, athlete.profile.foundation.level);
  });

  it('does not award user-reported, estimated, pending, or rejected progress', async () => {
    const db = createQuestFakeDb();
    for (const [i, progressState] of PROGRESS_STATES.filter((s) => s !== 'verified').entries()) {
      const result = await processWorldActivity(
        USER,
        verifiedEvent({
          sourceId: `state-${progressState}`,
          idempotencyKey: `state-${progressState}`,
          progressState,
          completedAmount: 1500,
        }),
        { db, now: new Date(NOW.getTime() + i) },
      );
      assert.equal(result.applied, true);
      assert.equal(result.reward.energyAmount, 0);
      assert.equal(result.reward.foundationXp, 0);
    }
    const profile = await ensureMediWorldProfile(USER, { db });
    assert.equal(profile.energyMovement, 0);
    assert.equal(profile.foundationXp, 0);
  });

  it('rejects unsupported activity sources', async () => {
    const db = createQuestFakeDb();
    await assert.rejects(
      () =>
        processWorldActivity(
          USER,
          { ...verifiedEvent(), sourceType: 'LLM' },
          { db, now: NOW },
        ),
      (err) => err.code === 'WORLD_UNSUPPORTED_SOURCE',
    );
  });

  it('returns the original ledger on duplicate submission', async () => {
    const db = createQuestFakeDb();
    const first = await processWorldActivity(USER, verifiedEvent(), { db, now: NOW });
    const second = await processWorldActivity(USER, verifiedEvent(), { db, now: NOW });
    assert.equal(first.applied, true);
    assert.equal(second.duplicate, true);
    assert.equal(second.ledger.id, first.ledger.id);
    const profile = await ensureMediWorldProfile(USER, { db });
    assert.equal(profile.energyMovement, 10);
    assert.equal((await db.mediWorldLedger.findMany({ where: { userId: USER } })).length, 1);
    assert.equal(first.ledger.transactionType, WORLD_TRANSACTION_CREDIT);
  });

  it('only writes one ledger row when two requests race', async () => {
    const db = createQuestFakeDb();
    const event = verifiedEvent({ idempotencyKey: 'race-1', sourceId: 'race-1' });
    const [a, b] = await Promise.all([
      processWorldActivity(USER, event, { db, now: NOW }),
      processWorldActivity(USER, event, { db, now: NOW }),
    ]);
    const rows = await db.mediWorldLedger.findMany({ where: { userId: USER } });
    assert.equal(rows.length, 1);
    assert.equal([a, b].filter((row) => row.applied).length, 1);
    assert.equal([a, b].filter((row) => row.duplicate).length, 1);
    const profile = await ensureMediWorldProfile(USER, { db });
    assert.equal(profile.energyMovement, 10);
  });

  it('rolls the transaction back when a later write fails', async () => {
    const db = createQuestFakeDb();
    await assert.rejects(
      () =>
        processWorldActivity(USER, verifiedEvent({ idempotencyKey: 'boom' }), {
          db,
          now: NOW,
          beforeWrite: async () => {
            throw Object.assign(new Error('boom'), { status: 500 });
          },
        }),
    );
    assert.equal((await db.mediWorldLedger.findMany({ where: { userId: USER } })).length, 0);
    const profiles = await db.mediWorldProfile.findMany({ where: { userId: USER } });
    assert.equal(profiles.length, 0);
  });

  it('never stores a negative balance or reward', async () => {
    const db = createQuestFakeDb();
    const result = await processWorldActivity(USER, verifiedEvent({ completedAmount: 0 }), { db, now: NOW });
    assert.equal(result.reward.energyAmount, 0);
    assert.ok(result.profile.careEnergy.movement >= 0);
    CARE_ENERGY_TYPES.forEach((type) => {
      assert.ok(result.profile.careEnergy[type] >= 0);
    });
  });

  it('keeps stored ledger amounts non-negative and distinguishes CREDIT from DEBIT', () => {
    assert.equal(nextNonNegativeBalance(10, WORLD_TRANSACTION_CREDIT, 5), 15);
    assert.equal(nextNonNegativeBalance(10, WORLD_TRANSACTION_DEBIT, 10), 0);
    assert.throws(() => nextNonNegativeBalance(10, WORLD_TRANSACTION_DEBIT, 11), { code: 'WORLD_NEGATIVE_BALANCE' });
    assert.throws(() => nextNonNegativeBalance(0, WORLD_TRANSACTION_DEBIT, 1), { code: 'WORLD_NEGATIVE_BALANCE' });
  });

  it('writes Phase 38 rewards as CREDIT without a spend path', async () => {
    const db = createQuestFakeDb();
    const result = await processWorldActivity(USER, verifiedEvent(), { db, now: NOW });
    assert.equal(result.applied, true);
    assert.equal(result.ledger.transactionType, WORLD_TRANSACTION_CREDIT);
    assert.equal(result.ledger.energyAmount, 10);
    const rows = await db.mediWorldLedger.findMany({ where: { userId: USER } });
    assert.equal(rows[0].transactionType, 'CREDIT');
    assert.ok(rows[0].energyAmount >= 0);
  });

  it('stamps the foundation ruleset version on profile and ledger', async () => {
    const db = createQuestFakeDb();
    const result = await processWorldActivity(USER, verifiedEvent(), { db, now: NOW });
    assert.equal(result.profile.rulesetVersion, 2);
    assert.equal(result.ledger.rulesetVersion, 2);
    assert.equal(result.profile.currentRulesetVersion, 2);
  });

  it('strips sensitive metadata from the ledger', async () => {
    const cleaned = sanitizeWorldMetadata({
      templateKey: 'daily_steps',
      periodKey: TODAY,
      steps: 15000,
      diagnosis: 'secret',
      latitude: 41.7,
    });
    assert.equal(cleaned.templateKey, 'daily_steps');
    assert.equal(cleaned.steps, undefined);
    assert.equal(cleaned.diagnosis, undefined);
    assert.equal(cleaned.latitude, undefined);
    WORLD_FORBIDDEN_META_KEYS.forEach((key) => assert.ok(key));
  });
});

describe('Quest completion adapter', () => {
  it('maps known templates and skips unknown ones', () => {
    assert.equal(worldAdapterFromQuest({ template: { key: 'daily_steps' } }).adapterId, 'quest.daily_steps');
    assert.equal(worldAdapterFromQuest({ template: { key: 'daily_hydration' } }).energyType, 'hydration');
    assert.equal(worldAdapterFromQuest({ template: { key: 'daily_medi' } }).energyType, 'care');
    assert.equal(worldAdapterFromQuest({ template: { key: 'unknown_quest' } }), null);
  });

  it('awards Care Energy once when a quest newly completes', async () => {
    const db = createQuestFakeDb();
    await seedQuestUser(db);
    const options = { db, now: NOW, timezone: QUEST_TIMEZONE };
    await assignDailyQuests(USER, TODAY, options);
    const steps = questByKey(await db.userQuest.findMany({ include: { template: true } }), 'daily_steps');
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: steps.target } });
    const first = await completeQuest(USER, steps.id, { ...options, source: 'sync' });
    const second = await completeQuest(USER, steps.id, { ...options, source: 'sync' });
    assert.equal(first.completed, true);
    assert.equal(second.alreadyCompleted, true);
    const ledger = await db.mediWorldLedger.findMany({ where: { userId: USER } });
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].adapterId, 'quest.daily_steps');
    assert.equal(ledger[0].progressState, 'verified');
    assert.equal(ledger[0].energyAmount, 10);
    const profile = await ensureMediWorldProfile(USER, { db });
    assert.equal(profile.energyMovement, 10);
    assert.equal(ledger[0].transactionType, 'CREDIT');
    assert.equal(Object.prototype.hasOwnProperty.call(ledger[0].metadata || {}, 'steps'), false);
    assert.equal(ledger[0].metadata?.templateKey, 'daily_steps');
  });

  it('keeps Quest completion when World tables are missing and does not report a reward', async () => {
    const db = createQuestFakeDb();
    await seedQuestUser(db);
    const options = { db, now: NOW, timezone: QUEST_TIMEZONE };
    await assignDailyQuests(USER, TODAY, options);
    const steps = questByKey(await db.userQuest.findMany({ include: { template: true } }), 'daily_steps');
    await db.userQuest.update({ where: { id: steps.id }, data: { progress: steps.target } });
    db.mediWorldLedger.create = async () => {
      throw Object.assign(new Error('The table public.MediWorldLedger does not exist in the current database.'), {
        code: 'P2021',
      });
    };
    const warns = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));
    try {
      const first = await completeQuest(USER, steps.id, { ...options, source: 'sync' });
      assert.equal(first.completed, true);
      assert.equal(first.alreadyCompleted, false);
    } finally {
      console.warn = originalWarn;
    }
    assert.equal((await db.mediWorldLedger.findMany({ where: { userId: USER } })).length, 0);
    assert.ok(warns.some((line) => line.includes('WORLD_SCHEMA_MISSING')));
    assert.ok(!warns.some((line) => /notes|diagnosis|medication|latitude/i.test(line)));
  });

  it('does not backfill historical completions', async () => {
    const db = createQuestFakeDb();
    await seedQuestUser(db);
    const options = { db, now: NOW, timezone: QUEST_TIMEZONE };
    await assignDailyQuests(USER, TODAY, options);
    const hydro = questByKey(await db.userQuest.findMany({ include: { template: true } }), 'daily_hydration');
    await db.userQuest.update({
      where: { id: hydro.id },
      data: { status: 'COMPLETED', progress: hydro.target, completedAt: NOW },
    });
    await db.questCompletion.create({
      data: {
        userQuestId: hydro.id,
        userId: USER,
        completedAt: NOW,
        progressAtCompletion: hydro.target,
        source: 'system',
      },
    });
    const profile = await getMediWorldProfile(USER, { db });
    assert.equal(profile.profile.careEnergy.hydration, 0);
    assert.equal((await db.mediWorldLedger.findMany({ where: { userId: USER } })).length, 0);
    const dash = await getUserQuestDashboard(USER, options);
    const listed = dash.daily.quests.find((row) => row.key === 'daily_hydration');
    assert.equal(listed.status, 'COMPLETED');
    const still = await ensureMediWorldProfile(USER, { db });
    assert.equal(still.energyHydration, 0);
  });
});

describe('authorization and ledger paging', () => {
  it('registers requireAuth on Medi World routes', async () => {
    const { mediWorldRouter } = await import('../../routes/mediWorld.routes.js');
    const names = mediWorldRouter.stack.map((layer) => layer.handle?.name);
    assert.ok(names.includes('requireAuth'));
    const routes = mediWorldRouter.stack.filter((layer) => layer.route);
    assert.ok(routes.some((layer) => layer.route.path === '/' && layer.route.methods.get));
    assert.ok(routes.some((layer) => layer.route.path === '/ledger' && layer.route.methods.get));
    assert.ok(routes.some((layer) => layer.route.path === '/companion' && layer.route.methods.get));
    assert.ok(routes.some((layer) => layer.route.path === '/companion/cosmetics/:catalogKey/unlock' && layer.route.methods.post));
    assert.ok(routes.some((layer) => layer.route.path === '/adventure/today' && layer.route.methods.get));
    assert.ok(routes.some((layer) => layer.route.path === '/adventure/today/swap' && layer.route.methods.post));
    assert.ok(!routes.some((layer) => layer.route.path === '/adventure/today/complete'));
    assert.ok(!routes.some((layer) => layer.route.path === '/foundation-activity'));
    assert.ok(!routes.some((layer) => layer.route.path === '/spend'));
    assert.ok(!routes.some((layer) => /:userId/.test(layer.route.path)));
    assert.ok(!routes.some((layer) => /spend/i.test(layer.route.path)));
  });

  it('blocks the internal foundation-test helper in production', async () => {
    const db = createQuestFakeDb();
    await assert.rejects(
      () =>
        processFoundationTestActivity(USER, verifiedEvent(), {
          db,
          flags: { nodeEnv: 'production', flag: '1' },
        }),
      (err) => err.status === 404,
    );
  });

  it('returns 503 when World tables are missing instead of a fake zero profile', async () => {
    const db = createQuestFakeDb();
    db.mediWorldProfile = {};
    const warns = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));
    try {
      await assert.rejects(
        () => getMediWorldProfile(USER, { db }),
        (err) => err.status === 503 && err.code === 'WORLD_UNAVAILABLE',
      );
    } finally {
      console.warn = originalWarn;
    }
    assert.ok(warns.some((line) => line.includes('WORLD_SCHEMA_MISSING')));
  });

  it('isolates profiles per user', async () => {
    const db = createQuestFakeDb();
    await processWorldActivity(USER, verifiedEvent(), { db, now: NOW });
    const other = await getMediWorldProfile('user-world-2', { db });
    assert.equal(other.profile.careEnergy.movement, 0);
    const mine = await getMediWorldProfile(USER, { db });
    assert.equal(mine.profile.careEnergy.movement, 10);
  });

  it('returns 404 when Medi World is disabled', async () => {
    const db = createQuestFakeDb();
    await assert.rejects(
      () => getMediWorldProfile(USER, { db, flags: { nodeEnv: 'production', flag: '0' } }),
      (err) => err.status === 404,
    );
  });

  it('pages the personal ledger with a createdAt cursor', async () => {
    const db = createQuestFakeDb();
    for (let i = 0; i < 3; i += 1) {
      await processWorldActivity(
        USER,
        verifiedEvent({
          sourceId: `page-${i}`,
          idempotencyKey: `page-${i}`,
          completedAmount: 1500,
        }),
        { db, now: new Date(NOW.getTime() + i * 1000) },
      );
    }
    const first = await getMediWorldLedger(USER, { db, take: 2 });
    assert.equal(first.items.length, 2);
    assert.ok(first.nextCursor);
    assert.ok(!JSON.stringify(first.items[0]).includes('idempotencyKey'));
    assert.ok(!Object.prototype.hasOwnProperty.call(first.items[0], 'metadata'));
    const second = await getMediWorldLedger(USER, { db, take: 2, cursor: first.nextCursor });
    assert.equal(second.items.length, 1);
    assert.equal(second.nextCursor, null);
  });
});

describe('contract surface', () => {
  it('keeps five Care Energy categories and four non-boolean progress states', () => {
    assert.deepEqual(CARE_ENERGY_TYPES, ['movement', 'hydration', 'calm', 'care', 'connection']);
    assert.ok(PROGRESS_STATES.includes('verified'));
    assert.ok(PROGRESS_STATES.includes('user_reported'));
    assert.ok(PROGRESS_STATES.includes('estimated'));
    assert.ok(PROGRESS_STATES.includes('pending'));
    assert.ok(PROGRESS_STATES.includes('rejected'));
  });
});
