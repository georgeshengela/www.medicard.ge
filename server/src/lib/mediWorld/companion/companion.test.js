import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createQuestFakeDb } from '../../questFakeDb.js';
import { canAssignNewDailyPeriod, dailyPeriodKey, startOfLocalDay } from '../../questTime.js';
import { processWorldActivity, setWorldXpForTests } from '../engine.js';
import { getMediWorldProfile } from '../service.js';
import { reconcileMediJourneyForUser } from '../../mediCompanion/service.js';
import {
  bondPointsRequiredForNextLevel,
  bondProgressFromPoints,
  cumulativeBondToReachLevel,
} from './bond.js';
import { COSMETIC_CATALOG } from './catalog.js';
import { eligibleEvolutionStages, highestEligibleStageKey } from './evolution.js';
import { sanitizeCompanionDisplayName } from './names.js';
import {
  completeCareMoment,
  equipCosmetic,
  getCompanionWorldState,
  renameCompanion,
  selectEvolutionStage,
  unlockCosmetic,
} from './service.js';
import { mediWorldRouter } from '../../../routes/mediWorld.routes.js';

const NOW = new Date('2026-09-12T12:00:00+04:00');
const USER = 'user-comp-1';
const TZ = 'Asia/Tbilisi';

function opts(db, extra = {}) {
  return { db, now: extra.now || NOW, timezone: extra.timezone || TZ, ...extra };
}

function walkEvent(overrides = {}) {
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

async function grantEnergy(db, type, adapterId, amountNeeded, userId = USER) {
  let granted = 0;
  let i = 0;
  let day = 0;
  while (granted < amountNeeded) {
    const now = new Date(NOW.getTime() + day * 86_400_000 + i * 1000);
    const result = await processWorldActivity(
      userId,
      walkEvent({
        sourceId: `${type}-${i}-${day}`,
        idempotencyKey: `en-${type}-${i}-${day}`,
        adapterId,
        energyType: type,
      }),
      opts(db, { now }),
    );
    granted += result.reward.energyAmount;
    i += 1;
    if (i % 2 === 0) day += 1;
    if (i > 40) break;
  }
  return granted;
}

describe('canonical companion identity', () => {
  it('does not introduce a MediWorldCompanion model', () => {
    const schema = readFileSync(new URL('../../../../prisma/schema.prisma', import.meta.url), 'utf8');
    assert.equal(/model\s+MediWorldCompanion\b/.test(schema), false);
    assert.match(schema, /model MediCompanionProfile/);
    assert.match(schema, /worldStageKey/);
  });

  it('creates one companion per user and preserves an existing profile', async () => {
    const db = createQuestFakeDb();
    await db.mediCompanionProfile.create({
      data: { userId: USER, selectedCosmetics: { accent: 'COSMETIC_DEFAULT_ACCENT' }, selectedEnvironmentKey: 'env.day' },
    });
    const first = await getCompanionWorldState(USER, opts(db));
    const again = await getCompanionWorldState(USER, opts(db));
    assert.equal(first.companion.id, again.companion.id);
    assert.equal((await db.mediCompanionProfile.findMany({ where: { userId: USER } })).length, 1);
    const stored = await db.mediCompanionProfile.findUnique({ where: { userId: USER } });
    assert.equal(stored.selectedCosmetics.accent, 'COSMETIC_DEFAULT_ACCENT');
  });

  it('lazy-creates under concurrent first opens', async () => {
    const db = createQuestFakeDb();
    const raced = await Promise.all([
      getCompanionWorldState(USER, opts(db)),
      getCompanionWorldState(USER, opts(db)),
    ]);
    assert.equal(raced[0].companion.id, raced[1].companion.id);
    assert.equal((await db.mediCompanionProfile.findMany({ where: { userId: USER } })).length, 1);
  });

  it('normalizes Unicode and Georgian names without resetting progression', async () => {
    const db = createQuestFakeDb();
    await getCompanionWorldState(USER, opts(db));
    await setWorldXpForTests(USER, 225, opts(db));
    await renameCompanion(USER, '  მედი\u0007  ', opts(db));
    const state = await renameCompanion(USER, 'ნათება', opts(db));
    assert.equal(state.companion.displayName, 'ნათება');
    assert.ok(state.companion.bond.bondPoints >= 5);
    const empty = sanitizeCompanionDisplayName('   ');
    assert.equal(empty.name, 'Medi');
    assert.throws(() => sanitizeCompanionDisplayName('admin'), (err) => err.code === 'COMPANION_NAME_INVALID');
  });
});

describe('evolution stages', () => {
  it('unlocks at 1, 5, 10, 20, 35, 50 and rejects the boundary below each', async () => {
    const cases = [
      [1, 'spark', 1],
      [4, 'spark', 1],
      [5, 'glow', 2],
      [9, 'glow', 2],
      [10, 'bloom', 3],
      [19, 'bloom', 3],
      [20, 'pulse', 4],
      [34, 'pulse', 4],
      [35, 'guardian', 5],
      [49, 'guardian', 5],
      [50, 'radiant', 6],
    ];
    for (const [level, highest, count] of cases) {
      assert.equal(highestEligibleStageKey(level), highest);
      assert.equal(eligibleEvolutionStages(level).length, count);
    }
    const db = createQuestFakeDb();
    await setWorldXpForTests(USER, 0, opts(db));
    const spark = await getCompanionWorldState(USER, opts(db));
    assert.equal(spark.evolution.stages.filter((row) => row.unlocked).length, 1);
    await setWorldXpForTests(USER, 550, opts(db));
    const glow = await getCompanionWorldState(USER, opts(db));
    assert.ok(glow.evolution.stages.find((row) => row.key === 'glow').unlocked);
    await selectEvolutionStage(USER, 'spark', opts(db));
    const selected = await getCompanionWorldState(USER, opts(db));
    assert.equal(selected.companion.worldStageKey, 'spark');
    await assert.rejects(() => selectEvolutionStage(USER, 'radiant', opts(db)), (err) => err.code === 'COMPANION_STAGE_LOCKED');
    const unlocks = await db.mediCompanionWorldStageUnlock.findMany({ where: { userId: USER } });
    await getCompanionWorldState(USER, opts(db));
    assert.equal((await db.mediCompanionWorldStageUnlock.findMany({ where: { userId: USER } })).length, unlocks.length);
  });

  it('does not multiply World rewards from evolution', async () => {
    const db = createQuestFakeDb();
    await setWorldXpForTests(USER, 34_300, opts(db));
    await getCompanionWorldState(USER, opts(db));
    const before = await getMediWorldProfile(USER, opts(db));
    await processWorldActivity(USER, walkEvent({ sourceId: 'evo-pay', idempotencyKey: 'evo-pay' }), opts(db));
    const after = await getMediWorldProfile(USER, opts(db));
    assert.equal(after.profile.careEnergy.movement - before.profile.careEnergy.movement, 10);
  });
});

describe('Bond', () => {
  it('uses bondPointsRequiredForNextLevel(L) = 20 + 10*(L-1)', () => {
    assert.equal(bondPointsRequiredForNextLevel(1), 20);
    assert.equal(bondPointsRequiredForNextLevel(2), 30);
    assert.equal(bondPointsRequiredForNextLevel(19), 200);
    assert.equal(bondPointsRequiredForNextLevel(20), 0);
    assert.equal(cumulativeBondToReachLevel(1), 0);
    assert.equal(cumulativeBondToReachLevel(2), 20);
    assert.equal(bondProgressFromPoints(0).bondLevel, 1);
    assert.equal(bondProgressFromPoints(19).bondLevel, 1);
    assert.equal(bondProgressFromPoints(20).bondLevel, 2);
    assert.equal(bondProgressFromPoints(9999).bondLevel, 20);
    assert.equal(bondProgressFromPoints(9999).bondPoints, 9999);
  });

  it('awards first visit, verified 100% goal, Care Moment, and stage unlocks once', async () => {
    const db = createQuestFakeDb();
    const first = await getCompanionWorldState(USER, opts(db));
    assert.equal(first.companion.bond.bondPoints, 6);
    const second = await getCompanionWorldState(USER, opts(db));
    assert.equal(second.companion.bond.bondPoints, 6);
    await processWorldActivity(USER, walkEvent({ sourceId: 'g1', idempotencyKey: 'g1', logicalEventId: 'g1' }), opts(db));
    await processWorldActivity(USER, walkEvent({ sourceId: 'g1', idempotencyKey: 'g1', logicalEventId: 'g1' }), opts(db));
    const afterGoal = await getCompanionWorldState(USER, opts(db));
    assert.equal(afterGoal.companion.bond.bondPoints, 8);
    const care = await completeCareMoment(USER, 'greet', opts(db));
    assert.equal(care.companion.bond.bondPoints, 9);
    assert.equal(care.companion.careMoment.canComplete, false);
    await completeCareMoment(USER, 'breathe', opts(db));
    const again = await getCompanionWorldState(USER, opts(db));
    assert.equal(again.companion.bond.bondPoints, 9);
    const world = await getMediWorldProfile(USER, opts(db));
    assert.equal(afterGoal.world.worldXp, world.profile.worldXp);
  });

  it('caps repeatable Bond at 5 and ignores timezone hops / DST', async () => {
    const db = createQuestFakeDb();
    await getCompanionWorldState(USER, opts(db));
    for (let i = 0; i < 4; i += 1) {
      await processWorldActivity(
        USER,
        walkEvent({
          sourceId: `cap-${i}`,
          idempotencyKey: `cap-${i}`,
          logicalEventId: `cap-${i}`,
          adapterId: 'activity.hydration',
          energyType: 'hydration',
        }),
        opts(db),
      );
    }
    const capped = await getCompanionWorldState(USER, opts(db));
    const visitAndGoals = (await db.mediCompanionBondEvent.findMany({ where: { userId: USER } }))
      .filter((row) => row.reasonCode !== 'BOND_STAGE_UNLOCK')
      .reduce((sum, row) => sum + row.points, 0);
    assert.equal(visitAndGoals, 5);
    const hopped = dailyPeriodKey(NOW, 'Pacific/Honolulu');
    assert.equal(
      canAssignNewDailyPeriod(
        { lastDailyAssignPeriodKey: '2026-09-12', lastDailyAssignAt: NOW },
        hopped,
        NOW,
        'Pacific/Honolulu',
      ),
      false,
    );
    await completeCareMoment(USER, 'quiet', opts(db, { timezone: 'Pacific/Honolulu' }));
    const afterHop = await getCompanionWorldState(USER, opts(db, { timezone: 'Pacific/Honolulu' }));
    const repeatable = (await db.mediCompanionBondEvent.findMany({ where: { userId: USER } }))
      .filter((row) => row.reasonCode !== 'BOND_STAGE_UNLOCK')
      .reduce((sum, row) => sum + row.points, 0);
    assert.equal(repeatable, 5);
    const tz = 'America/New_York';
    const before = new Date('2026-03-08T06:30:00Z');
    const after = new Date('2026-03-08T07:30:00Z');
    assert.equal(dailyPeriodKey(before, tz), dailyPeriodKey(after, tz));
    assert.ok(startOfLocalDay('2026-03-08', tz).getTime() < after.getTime());
    assert.ok(capped.companion.bond.bondPoints >= 0);
    assert.ok(afterHop.companion.bond.bondPoints >= 0);
  });

  it('does not inherit Quest journey backfill into Bond or World', async () => {
    const db = createQuestFakeDb();
    await db.questCompletion.create({
      data: {
        userId: USER,
        userQuestId: 'uq-old',
        progressAtCompletion: 2000,
        source: 'system',
      },
    });
    await reconcileMediJourneyForUser(USER, { db, now: NOW });
    assert.equal((await db.mediWorldLedger.findMany({ where: { userId: USER } })).length, 0);
    assert.equal((await db.mediCompanionBondEvent.findMany({ where: { userId: USER } })).length, 0);
  });
});

describe('cosmetics', () => {
  it('owns the default aura and unlocks with server-owned price', async () => {
    const db = createQuestFakeDb();
    await setWorldXpForTests(USER, 225, opts(db));
    await grantEnergy(db, 'hydration', 'activity.hydration', 30);
    const before = await getCompanionWorldState(USER, opts(db));
    assert.ok(before.catalog.find((row) => row.key === 'aura_teal_origin').owned);
    const hydration = before.world.careEnergy.hydration;
    const unlocked = await unlockCosmetic(USER, 'aura_hydration_wave', 'unlock-h', opts(db));
    assert.equal(unlocked.unlock.charged, true);
    assert.equal(unlocked.world.careEnergy.hydration, hydration - 30);
    const retry = await unlockCosmetic(USER, 'aura_hydration_wave', 'unlock-h', opts(db));
    assert.equal(retry.unlock.alreadyOwned || retry.unlock.charged === false, true);
    assert.equal(retry.world.careEnergy.hydration, hydration - 30);
    await equipCosmetic(USER, 'aura', 'aura_hydration_wave', opts(db));
    const equipped = await getCompanionWorldState(USER, opts(db));
    assert.equal(equipped.companion.equipment.aura, 'aura_hydration_wave');
    await equipCosmetic(USER, 'aura', null, opts(db));
    const reset = await getCompanionWorldState(USER, opts(db));
    assert.equal(reset.companion.equipment.aura, 'aura_teal_origin');
  });

  it('rejects insufficient energy, disabled items, unowned equip, and client price', async () => {
    const db = createQuestFakeDb();
    await setWorldXpForTests(USER, 225, opts(db));
    await grantEnergy(db, 'hydration', 'activity.hydration', 10);
    await assert.rejects(
      () => unlockCosmetic(USER, 'aura_hydration_wave', 'need-more', opts(db)),
      (err) => err.code === 'INSUFFICIENT_CARE_ENERGY',
    );
    assert.equal((await db.mediCompanionCosmeticOwn.findMany({ where: { userId: USER, catalogKey: 'aura_hydration_wave' } })).length, 0);
    assert.equal((await db.mediWorldLedger.findMany({ where: { userId: USER, transactionType: 'DEBIT' } })).length, 0);
    await assert.rejects(
      () => unlockCosmetic(USER, 'aura_disabled_archive', 'nope', opts(db)),
      (err) => err.code === 'COMPANION_CATALOG',
    );
    await assert.rejects(
      () => equipCosmetic(USER, 'trail', 'trail_movement_pulse', opts(db)),
      (err) => err.code === 'COMPANION_NOT_OWNED',
    );
    await assert.rejects(
      () => unlockCosmetic(USER, 'aura_hydration_wave', 'priced', { ...opts(db), client: { price: 1, category: 'movement' } }),
      (err) => err.code === 'COMPANION_UNLOCK_CLIENT_PRICE',
    );
  });

  it('rolls unlock+debit back together', async () => {
    const db = createQuestFakeDb();
    await setWorldXpForTests(USER, 225, opts(db));
    await grantEnergy(db, 'hydration', 'activity.hydration', 30);
    const before = await getCompanionWorldState(USER, opts(db));
    await assert.rejects(() =>
      unlockCosmetic(USER, 'aura_hydration_wave', 'rb-unlock', {
        ...opts(db),
        beforeCommit: async () => {
          throw new Error('forced-unlock-rollback');
        },
      }),
    );
    const after = await getCompanionWorldState(USER, opts(db));
    assert.equal(after.world.careEnergy.hydration, before.world.careEnergy.hydration);
    assert.equal(after.catalog.find((row) => row.key === 'aura_hydration_wave').owned, false);
  });

  it('does not let another user equip or unlock this inventory', async () => {
    const db = createQuestFakeDb();
    await setWorldXpForTests(USER, 225, opts(db));
    await grantEnergy(db, 'hydration', 'activity.hydration', 30);
    await unlockCosmetic(USER, 'aura_hydration_wave', 'owner-unlock', opts(db));
    const other = await getCompanionWorldState('other-user', opts(db));
    assert.equal(other.catalog.find((row) => row.key === 'aura_hydration_wave').owned, false);
    await assert.rejects(
      () => equipCosmetic('other-user', 'aura', 'aura_hydration_wave', opts(db)),
      (err) => err.code === 'COMPANION_NOT_OWNED',
    );
  });
});

describe('privacy and API', () => {
  it('sanitizes companion payloads and keeps POST limited to companion paths', async () => {
    const db = createQuestFakeDb();
    const state = await getCompanionWorldState(USER, opts(db));
    const blob = JSON.stringify(state);
    assert.equal(blob.includes('idempotencyKey'), false);
    assert.equal(blob.includes('diagnosis'), false);
    assert.equal(blob.includes('intentFingerprint'), false);
    const routes = mediWorldRouter.stack.filter((layer) => layer.route);
    assert.ok(routes.some((layer) => layer.route.path === '/companion/cosmetics/:catalogKey/unlock'));
    assert.ok(!routes.some((layer) => layer.route.path === '/spend'));
  });

  it('returns 404 when Medi World is disabled', async () => {
    const db = createQuestFakeDb();
    await assert.rejects(
      () => getCompanionWorldState(USER, { ...opts(db), flags: { nodeEnv: 'production', flag: '0' } }),
      (err) => err.code === 'MEDI_WORLD_DISABLED',
    );
  });

  it('returns unavailable when companion tables are missing', async () => {
    const db = createQuestFakeDb();
    db.mediCompanionWorldStageUnlock = {};
    await assert.rejects(
      () => getCompanionWorldState(USER, opts(db)),
      (err) => err.code === 'WORLD_UNAVAILABLE',
    );
  });
});

describe('catalog contract', () => {
  it('ships the Phase 40 shop list', () => {
    const keys = COSMETIC_CATALOG.filter((row) => row.active).map((row) => row.key);
    assert.deepEqual(keys, [
      'aura_teal_origin',
      'aura_hydration_wave',
      'aura_calm_glow',
      'trail_movement_pulse',
      'charm_care_heart',
      'accent_connection_orbit',
    ]);
  });
});
