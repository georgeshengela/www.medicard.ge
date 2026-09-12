import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQuestFakeDb } from '../../questFakeDb.js';
import { processWorldActivity, setWorldXpForTests } from '../engine.js';
import { mediWorldRouter } from '../../../routes/mediWorld.routes.js';
import { GARDEN_PLANTS } from './catalog.js';
import { GARDEN_GROWTH_DAYS, GARDEN_PLOT_UNLOCK_LEVELS, isPlotUnlocked, nextQualifyingDays, stageFromNurtureDays } from './rules.js';
import {
  getGarden,
  getGardenCatalog,
  getGardenHistory,
  movePlant,
  plantInPlot,
  restorePlant,
  storePlant,
} from './service.js';
import { applyGardenQaStage } from './qa.js';
import { applyGardenNurtureInTx } from './nurture.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOW = new Date('2026-09-14T12:00:00.000Z');
const USER = 'user-garden-1';
const OTHER = 'user-garden-other';
const TZ = 'UTC';

function opts(db, extra = {}) {
  return {
    db,
    now: extra.now || NOW,
    timezone: extra.timezone || TZ,
    flags: { nodeEnv: extra.nodeEnv || 'test', flag: extra.flag ?? '1', gardenFlag: extra.gardenFlag ?? '1' },
    user: extra.user || { timezone: TZ },
    catalogByKey: extra.catalogByKey,
  };
}

function creditEvent(overrides = {}) {
  return {
    sourceType: overrides.sourceType || 'QUEST_COMPLETION',
    sourceId: overrides.sourceId || 'q-1',
    idempotencyKey: overrides.idempotencyKey || 'q-idem-1',
    adapterId: overrides.adapterId || 'quest.daily_steps',
    energyType: overrides.energyType || 'movement',
    progressState: overrides.progressState || 'verified',
    personalTarget: overrides.personalTarget ?? 1500,
    completedAmount: overrides.completedAmount ?? 1500,
  };
}

function grantEvent(overrides = {}) {
  return {
    sourceType: 'FOUNDATION_TEST',
    sourceId: overrides.sourceId || 'g-1',
    idempotencyKey: overrides.idempotencyKey || 'g-idem-1',
    adapterId: overrides.adapterId || 'activity.walking',
    energyType: overrides.energyType || 'movement',
    progressState: 'verified',
    personalTarget: 1500,
    completedAmount: 1500,
  };
}

const ADAPTER = {
  movement: 'activity.walking',
  hydration: 'activity.hydration',
  calm: 'activity.breathing',
  care: 'activity.care_routine',
  connection: 'activity.connection',
};

async function grantEnergy(db, type, amountNeeded, userId = USER, startDay = -8) {
  let granted = 0;
  let i = 0;
  while (granted < amountNeeded) {
    const now = new Date(NOW.getTime() + (startDay + i) * 86_400_000);
    const result = await processWorldActivity(
      userId,
      grantEvent({
        sourceId: `grant-${type}-${i}`,
        idempotencyKey: `grant-${type}-${i}-${userId}`,
        adapterId: ADAPTER[type],
        energyType: type,
      }),
      opts(db, { now }),
    );
    granted += result.reward.energyAmount;
    i += 1;
    if (i > 40) break;
  }
  return granted;
}

async function qualify(db, type, userId, dayOffset, stamp) {
  const adapters = {
    movement: { sourceType: 'QUEST_COMPLETION', adapterId: 'quest.daily_steps' },
    hydration: { sourceType: 'QUEST_COMPLETION', adapterId: 'quest.daily_hydration' },
    care: { sourceType: 'QUEST_COMPLETION', adapterId: 'quest.daily_medi' },
    calm: { sourceType: 'QUEST_COMPLETION', adapterId: 'activity.breathing' },
    connection: { sourceType: 'QUEST_COMPLETION', adapterId: 'activity.connection' },
  };
  const mapped = adapters[type];
  const now = new Date(NOW.getTime() + dayOffset * 86_400_000);
  return processWorldActivity(
    userId,
    creditEvent({
      sourceType: mapped.sourceType,
      sourceId: `qual-${type}-${stamp}-${dayOffset}`,
      idempotencyKey: `qual-${type}-${stamp}-${dayOffset}`,
      adapterId: mapped.adapterId,
      energyType: type,
    }),
    opts(db, { now }),
  );
}

describe('Medi World Phase 44 garden catalog and plots', () => {
  it('owns one garden per user and concurrent lazy create stays unique', async () => {
    const db = createQuestFakeDb();
    const [a, b] = await Promise.all([getGarden(USER, opts(db)), getGarden(USER, opts(db))]);
    assert.equal(a.plots.length, 6);
    assert.equal(b.plots.length, 6);
    assert.equal(await db.careGarden.count({ where: { userId: USER } }), 1);
    assert.equal(a.plots.filter((plot) => plot.unlocked).length, 3);
    assert.equal(a.plots[3].unlockLevel, 5);
    assert.equal(a.plots[4].unlockLevel, 10);
    assert.equal(a.plots[5].unlockLevel, 20);
  });

  it('unlocks plots at world levels 1/5/10/20 and never regresses', async () => {
    const db = createQuestFakeDb();
    await getGarden(USER, opts(db));
    await setWorldXpForTests(USER, 100 + 125 + 150 + 175, opts(db)); // level 5 boundary-ish
    await setWorldXpForTests(USER, 1300, opts(db));
    const mid = await getGarden(USER, opts(db));
    assert.equal(isPlotUnlocked(mid.worldLevel, 3), mid.worldLevel >= 5);
    await setWorldXpForTests(USER, 10_000, opts(db));
    const high = await getGarden(USER, opts(db));
    assert.ok(high.worldLevel >= 20);
    assert.equal(high.plots.filter((plot) => plot.unlocked).length, 6);
    await setWorldXpForTests(USER, 0, opts(db));
    const after = await getGarden(USER, opts(db));
    assert.equal(after.worldLevel, 1);
    assert.equal(after.plots.filter((plot) => plot.unlocked).length, 6);
    const unlocks = await db.careGardenEvent.count({ where: { gardenUserId: USER, type: 'plot_unlocked' } });
    assert.equal(unlocks, 6);
  });

  it('rejects locked, invalid, and occupied plots', async () => {
    const db = createQuestFakeDb();
    await grantEnergy(db, 'movement', 40);
    await assert.rejects(() => plantInPlot(USER, 9, { catalogKey: 'pulse_fern', idempotencyKey: 'idem-inv' }, opts(db)), (e) => e.code === 'GARDEN_PLOT_INVALID');
    await assert.rejects(() => plantInPlot(USER, 3, { catalogKey: 'pulse_fern', idempotencyKey: 'idem-lock' }, opts(db)), (e) => e.code === 'GARDEN_PLOT_LOCKED');
    const planted = await plantInPlot(USER, 0, { catalogKey: 'pulse_fern', idempotencyKey: 'idem-occ-a' }, opts(db));
    assert.equal(planted.plant.catalogKey, 'pulse_fern');
    await assert.rejects(() => plantInPlot(USER, 0, { catalogKey: 'dew_lily', idempotencyKey: 'idem-occ-b' }, opts(db)), (e) => e.code === 'GARDEN_PLOT_OCCUPIED');
  });
});

describe('Medi World Phase 44 planting', () => {
  it('plants each catalog item at the server-owned price and category', async () => {
    const db = createQuestFakeDb();
    for (let i = 0; i < GARDEN_PLANTS.length; i += 1) {
      const item = GARDEN_PLANTS[i];
      await grantEnergy(db, item.category, 20, USER, -20 - i * 3);
      const res = await plantInPlot(USER, i < 3 ? i : i - 3, {
        catalogKey: item.key,
        idempotencyKey: `plant-all-${item.key}`,
      }, opts(db));
      assert.equal(res.plant.category, item.category);
      assert.equal(res.plant.stage, 'seed');
      if (i < 2) {
        await storePlant(USER, res.plant.id, { idempotencyKey: `store-all-${item.key}` }, opts(db));
      }
    }
    assert.equal(await db.careGardenPlant.count({ where: { gardenUserId: USER } }), 5);
  });

  it('plants on exact balance and rejects insufficient energy without creating a plant', async () => {
    const db = createQuestFakeDb();
    await grantEnergy(db, 'hydration', 20);
    const garden = await getGarden(USER, opts(db));
    const before = garden.world.profile.careEnergy.hydration;
    assert.ok(before >= 20);
    const exact = await plantInPlot(USER, 0, { catalogKey: 'dew_lily', idempotencyKey: 'exact-h' }, opts(db));
    assert.equal(exact.world.profile.careEnergy.hydration, before - 20);
    await assert.rejects(
      () => plantInPlot(USER, 1, { catalogKey: 'dew_lily', idempotencyKey: 'short-h' }, opts(db)),
      (e) => e.code === 'INSUFFICIENT_CARE_ENERGY',
    );
    assert.equal(await db.careGardenPlant.count({ where: { gardenUserId: USER } }), 1);
    assert.equal(await db.mediWorldLedger.count({ where: { userId: USER, reasonCode: 'GARDEN_PLANT' } }), 1);
  });

  it('rejects client price/category, inactive plants, and has no generic spend route', async () => {
    const db = createQuestFakeDb();
    await grantEnergy(db, 'calm', 20);
    await assert.rejects(
      () => plantInPlot(USER, 0, { catalogKey: 'moon_moss', idempotencyKey: 'client-price', price: 1, category: 'care' }, opts(db)),
      (e) => e.code === 'GARDEN_CLIENT_PRICE',
    );
    const inactive = {
      ...GARDEN_PLANTS.find((item) => item.key === 'moon_moss'),
      active: false,
    };
    await assert.rejects(
      () => plantInPlot(USER, 0, { catalogKey: 'moon_moss', idempotencyKey: 'inactive-1' }, opts(db, { catalogByKey: { moon_moss: inactive } })),
      (e) => e.code === 'GARDEN_PLANT_INACTIVE',
    );
    const paths = [];
    mediWorldRouter.stack.forEach((layer) => {
      if (layer.route) paths.push(`${Object.keys(layer.route.methods)[0]} ${layer.route.path}`);
    });
    assert.ok(paths.some((row) => row.includes('/garden/plots/:plotIndex/plant')));
    assert.equal(paths.some((row) => row.includes('/spend')), false);
    assert.equal(paths.some((row) => row === 'post /garden/spend'), false);
  });

  it('retries the same idempotency key and conflicts on reuse', async () => {
    const db = createQuestFakeDb();
    await grantEnergy(db, 'care', 40);
    const first = await plantInPlot(USER, 0, { catalogKey: 'heart_bloom', idempotencyKey: 'same-key' }, opts(db));
    const retry = await plantInPlot(USER, 0, { catalogKey: 'heart_bloom', idempotencyKey: 'same-key' }, opts(db));
    assert.equal(retry.duplicate, true);
    assert.equal(retry.plant.id, first.plant.id);
    assert.equal(await db.mediWorldLedger.count({ where: { userId: USER, reasonCode: 'GARDEN_PLANT' } }), 1);
    await assert.rejects(
      () => plantInPlot(USER, 1, { catalogKey: 'orbit_vine', idempotencyKey: 'same-key' }, opts(db)),
      (e) => e.code === 'WORLD_IDEMPOTENCY_CONFLICT',
    );
  });

  it('charges concurrent planting once for the same plot', async () => {
    const db = createQuestFakeDb();
    await grantEnergy(db, 'connection', 40);
    const results = await Promise.allSettled([
      plantInPlot(USER, 0, { catalogKey: 'orbit_vine', idempotencyKey: 'conc-a' }, opts(db)),
      plantInPlot(USER, 0, { catalogKey: 'orbit_vine', idempotencyKey: 'conc-b' }, opts(db)),
    ]);
    const ok = results.filter((row) => row.status === 'fulfilled');
    const fail = results.filter((row) => row.status === 'rejected');
    assert.equal(ok.length, 1);
    assert.equal(fail.length, 1);
    assert.equal(fail[0].reason.code, 'GARDEN_PLOT_OCCUPIED');
    assert.equal(await db.careGardenPlant.count({ where: { gardenUserId: USER } }), 1);
    assert.equal(await db.mediWorldLedger.count({ where: { userId: USER, reasonCode: 'GARDEN_PLANT' } }), 1);
  });

  it('rolls back plant and debit when the garden write fails', async () => {
    const db = createQuestFakeDb();
    await grantEnergy(db, 'movement', 20);
    const before = (await getGarden(USER, opts(db))).world.profile.careEnergy.movement;
    const original = db.careGardenPlant.create.bind(db.careGardenPlant);
    db.careGardenPlant.create = async () => {
      throw new Error('simulated garden write failure');
    };
    await assert.rejects(
      () => plantInPlot(USER, 0, { catalogKey: 'pulse_fern', idempotencyKey: 'rollback-1' }, opts(db)),
      (e) => /simulated garden write failure/.test(e.message),
    );
    db.careGardenPlant.create = original;
    const after = await getGarden(USER, opts(db));
    assert.equal(after.world.profile.careEnergy.movement, before);
    assert.equal(await db.careGardenPlant.count({ where: { gardenUserId: USER } }), 0);
    assert.equal(await db.mediWorldLedger.count({ where: { userId: USER, reasonCode: 'GARDEN_PLANT' } }), 0);
  });
});

describe('Medi World Phase 44 growth', () => {
  it('does not backfill historical credits or planting debits', async () => {
    const db = createQuestFakeDb();
    await qualify(db, 'movement', USER, -2, 'hist');
    await grantEnergy(db, 'movement', 20);
    const planted = await plantInPlot(USER, 0, { catalogKey: 'pulse_fern', idempotencyKey: 'no-backfill' }, opts(db));
    assert.equal(planted.plant.stage, 'seed');
    assert.equal(planted.plant.nurtureDays, 0);
    const again = await getGarden(USER, opts(db));
    assert.equal(again.plots[0].plant.nurtureDays, 0);
  });

  it('advances sprout/bloom/radiant on distinct qualifying days only', async () => {
    const db = createQuestFakeDb();
    await grantEnergy(db, 'hydration', 20);
    const planted = await plantInPlot(USER, 0, { catalogKey: 'dew_lily', idempotencyKey: 'grow-h' }, opts(db));
    assert.equal(stageFromNurtureDays(0), 'seed');
    await qualify(db, 'hydration', USER, 0, 'g1');
    await qualify(db, 'hydration', USER, 0, 'g1b');
    let garden = await getGarden(USER, opts(db));
    assert.equal(garden.plots[0].plant.nurtureDays, 1);
    assert.equal(garden.plots[0].plant.stage, 'sprout');
    await qualify(db, 'hydration', USER, 1, 'g2');
    await qualify(db, 'hydration', USER, 2, 'g3');
    garden = await getGarden(USER, opts(db));
    assert.equal(garden.plots[0].plant.nurtureDays, 3);
    assert.equal(garden.plots[0].plant.stage, 'bloom');
    await qualify(db, 'hydration', USER, 3, 'g4');
    await qualify(db, 'hydration', USER, 4, 'g5');
    await qualify(db, 'hydration', USER, 5, 'g6');
    await qualify(db, 'hydration', USER, 6, 'g7');
    garden = await getGarden(USER, opts(db));
    assert.equal(garden.plots[0].plant.nurtureDays, 7);
    assert.equal(garden.plots[0].plant.stage, 'radiant');
    assert.equal(nextQualifyingDays(7), 0);
    const days = await db.careGardenNurtureEvent.count({ where: { plantId: planted.plant.id } });
    assert.equal(days, 7);
  });

  it('nurtures stored plants, never decays, and ignores level-up/QA credits', async () => {
    const db = createQuestFakeDb();
    await grantEnergy(db, 'care', 20);
    const planted = await plantInPlot(USER, 0, { catalogKey: 'heart_bloom', idempotencyKey: 'store-grow' }, opts(db));
    await storePlant(USER, planted.plant.id, { idempotencyKey: 'store-now' }, opts(db));
    await qualify(db, 'care', USER, 0, 'stored');
    const stored = await getGarden(USER, opts(db));
    assert.equal(stored.stored[0].nurtureDays, 1);
    assert.equal(stored.stored[0].stage, 'sprout');
    await processWorldActivity(USER, grantEvent({
      sourceId: 'qa-skip',
      idempotencyKey: 'qa-skip',
      adapterId: 'activity.care_routine',
      energyType: 'care',
    }), opts(db, { now: new Date(NOW.getTime() + 86_400_000) }));
    const afterQa = await getGarden(USER, opts(db));
    assert.equal(afterQa.stored[0].nurtureDays, 1);
    await setWorldXpForTests(USER, 200, opts(db));
    const afterLevel = await getGarden(USER, opts(db));
    assert.equal(afterLevel.stored[0].nurtureDays, 1);
    assert.equal(afterLevel.stored[0].stage, 'sprout');
  });

  it('does not create an extra nurture day from a timezone hop on the same period', async () => {
    const db = createQuestFakeDb();
    await grantEnergy(db, 'movement', 20);
    const planted = await plantInPlot(USER, 0, { catalogKey: 'pulse_fern', idempotencyKey: 'tz-plant' }, opts(db));
    await applyGardenNurtureInTx(db, USER, {
      energyType: 'movement',
      periodKey: '2026-09-14',
      ledgerId: 'led-1',
      sourceType: 'QUEST_COMPLETION',
      energyAmount: 10,
      progressState: 'verified',
      createdAt: NOW,
    }, opts(db));
    await applyGardenNurtureInTx(db, USER, {
      energyType: 'movement',
      periodKey: '2026-09-14',
      ledgerId: 'led-2',
      sourceType: 'QUEST_COMPLETION',
      energyAmount: 10,
      progressState: 'verified',
      createdAt: NOW,
    }, opts(db, { timezone: 'Pacific/Kiritimati' }));
    const plant = await db.careGardenPlant.findUnique({ where: { id: planted.plant.id } });
    assert.equal(plant.nurtureDays, 1);
  });

  it('does not recurse rewards when garden grows', async () => {
    const db = createQuestFakeDb();
    await grantEnergy(db, 'calm', 20);
    await plantInPlot(USER, 0, { catalogKey: 'moon_moss', idempotencyKey: 'no-recurse' }, opts(db));
    const before = await db.mediWorldLedger.count({ where: { userId: USER, transactionType: 'CREDIT' } });
    await qualify(db, 'calm', USER, 0, 'nr');
    const after = await db.mediWorldLedger.count({ where: { userId: USER, transactionType: 'CREDIT' } });
    assert.equal(after, before + 1);
    const gardenCredits = await db.mediWorldLedger.count({ where: { userId: USER, reasonCode: 'GARDEN_GROWTH' } });
    assert.equal(gardenCredits, 0);
  });
});

describe('Medi World Phase 44 layout, cache payload, and privacy', () => {
  it('moves, stores, restores, and denies another user', async () => {
    const db = createQuestFakeDb();
    await grantEnergy(db, 'connection', 20, USER);
    await grantEnergy(db, 'connection', 20, OTHER, -12);
    const planted = await plantInPlot(USER, 0, { catalogKey: 'orbit_vine', idempotencyKey: 'layout-1' }, opts(db));
    const moved = await movePlant(USER, planted.plant.id, { plotIndex: 1, idempotencyKey: 'move-1' }, opts(db));
    assert.equal(moved.plots[1].plant.id, planted.plant.id);
    await assert.rejects(
      () => movePlant(USER, planted.plant.id, { plotIndex: 4, idempotencyKey: 'move-lock' }, opts(db)),
      (e) => e.code === 'GARDEN_PLOT_LOCKED',
    );
    await plantInPlot(USER, 0, { catalogKey: 'orbit_vine', idempotencyKey: 'cannot' }, opts(db)).catch(() => null);
    const stored = await storePlant(USER, planted.plant.id, { idempotencyKey: 'store-1' }, opts(db));
    assert.equal(stored.stored[0].nurtureDays, planted.plant.nurtureDays);
    const restored = await restorePlant(USER, planted.plant.id, { plotIndex: 2, idempotencyKey: 'restore-1' }, opts(db));
    assert.equal(restored.plots[2].plant.id, planted.plant.id);
    await assert.rejects(
      () => storePlant(OTHER, planted.plant.id, { idempotencyKey: 'idor' }, opts(db)),
      (e) => e.code === 'GARDEN_PLANT_NOT_FOUND',
    );
  });

  it('omits ledger ids and health metadata from garden payloads', async () => {
    const db = createQuestFakeDb();
    await grantEnergy(db, 'movement', 20);
    const planted = await plantInPlot(USER, 0, { catalogKey: 'pulse_fern', idempotencyKey: 'priv-1' }, opts(db));
    const text = JSON.stringify(planted);
    assert.equal(text.includes('debitLedgerId'), false);
    assert.equal(text.includes('creditLedgerId'), false);
    assert.equal(text.includes('continuationToken'), false);
    assert.equal(text.includes('latitude'), false);
    assert.equal(text.includes('diagnosis'), false);
    const history = await getGardenHistory(USER, opts(db));
    assert.ok(history.items.length >= 1);
    assert.equal(JSON.stringify(history).includes('debitLedgerId'), false);
    const catalog = getGardenCatalog(opts(db));
    assert.equal(catalog.items.length, 5);
    assert.equal(catalog.items.every((item) => item.price === 20), true);
  });

  it('disables independently and keeps QA fixtures out of production', async () => {
    const db = createQuestFakeDb();
    await assert.rejects(() => getGarden(USER, opts(db, { gardenFlag: '0' })), (e) => e.code === 'GARDEN_DISABLED');
    await assert.rejects(
      () => applyGardenQaStage(USER, { plantId: '00000000-0000-4000-8000-000000000001', stage: 'radiant' }, opts(db, { nodeEnv: 'production' })),
      (e) => e.code === 'GARDEN_QA_FORBIDDEN',
    );
    const paths = [];
    mediWorldRouter.stack.forEach((layer) => {
      if (layer.route) paths.push(layer.route.path);
    });
    assert.ok(paths.includes('/garden/qa/stage'));
    assert.equal(GARDEN_PLOT_UNLOCK_LEVELS.join(','), '1,1,1,5,10,20');
    assert.equal(GARDEN_GROWTH_DAYS.radiant, 7);
  });

  it('keeps the migration after movement', () => {
    const folder = join(HERE, '../../../../prisma/migrations');
    const names = readdirSync(folder).filter((name) => /^\d{14}_/.test(name));
    assert.ok(names.includes('20260913010000_medi_world_movement'));
    assert.ok(names.includes('20260913020000_medi_world_garden'));
    assert.ok(names.indexOf('20260913020000_medi_world_garden') > names.indexOf('20260913010000_medi_world_movement'));
    const sql = readFileSync(join(HERE, '../../../../prisma/phase44-medi-world-garden.sql'), 'utf8');
    assert.match(sql, /CareGarden/);
    assert.equal(/DROP TABLE/i.test(sql), false);
  });
});
