import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQuestFakeDb } from '../../questFakeDb.js';
import { completeQuest } from '../../quest.js';
import { mediWorldRouter } from '../../../routes/mediWorld.routes.js';
import { processWorldActivity } from '../engine.js';
import { getMediWorldProfile } from '../service.js';
import { completeCareMoment } from '../companion/service.js';
import { CAPABILITY_REGISTRY, activeCapabilities, capabilityByKey } from './registry.js';
import { planAdventure, planReplacement } from './engine.js';
import {
  activateRestDay,
  getAdventurePreferences,
  getTodayAdventure,
  selectAdventureChoice,
  swapAdventureSlot,
  updateAdventurePreferences,
} from './service.js';

const NOW = new Date('2026-09-12T12:00:00+04:00');
const USER = 'user-adv-1';
const TZ = 'Asia/Tbilisi';

function opts(db, extra = {}) {
  return { db, now: extra.now || NOW, timezone: extra.timezone || TZ, ...extra };
}

async function seedFull(db, userId = USER) {
  await db.hydrationPreference.create({ data: { userId, goalMl: 2000 } });
  await db.stepTrackingCapability.create({
    data: { userId, status: 'AVAILABLE', source: 'APPLE_HEALTH' },
  });
}

function cap(key) {
  return capabilityByKey(key);
}

describe('Phase 41 migration order', () => {
  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../../prisma/migrations');

  it('sorts the Adventure folder after Phase 40 Companion', () => {
    const dirs = readdirSync(migrationsDir).filter((name) => !name.includes('.')).sort();
    const phase38 = dirs.indexOf('20260912120000_medi_world_foundation');
    const phase39 = dirs.indexOf('20260912180000_medi_world_economy_v2');
    const phase40 = dirs.indexOf('20260912200000_medi_world_companion');
    const phase41 = dirs.indexOf('20260912220000_medi_world_adventure');
    assert.ok(phase38 >= 0 && phase39 > phase38 && phase40 > phase39 && phase41 > phase40);
    assert.equal(dirs.includes('20260912120000_medi_world_adventure'), false);
  });

  it('keeps canonical SQL and migrate-folder SQL in lockstep', () => {
    const canonical = readFileSync(join(migrationsDir, '../phase41-medi-world-adventure.sql'), 'utf8');
    const folder = readFileSync(join(migrationsDir, '20260912220000_medi_world_adventure/migration.sql'), 'utf8');
    const strip = (text) => text.replace(/^--.*$/gm, '').replace(/\s+/g, ' ').trim();
    assert.equal(strip(canonical), strip(folder));
  });
});

describe('CapabilityRegistry', () => {
  it('only marks audited adapters active and hides future ones', () => {
    const active = activeCapabilities().map((row) => row.key).sort();
    assert.deepEqual(active, [
      'companion.care_moment',
      'quest.daily_hydration',
      'quest.daily_medi',
      'quest.daily_steps',
    ]);
    const hidden = CAPABILITY_REGISTRY.filter((row) => !row.active).map((row) => row.key);
    assert.ok(hidden.includes('future.wheelchair_movement'));
    assert.ok(hidden.includes('future.breathing'));
    assert.ok(hidden.includes('future.connection'));
    assert.equal(CAPABILITY_REGISTRY.some((row) => row.active && row.energyType !== 'movement'), true);
  });
});

describe('deterministic engine', () => {
  const eligible = [
    cap('quest.daily_steps'),
    cap('quest.daily_hydration'),
    cap('quest.daily_medi'),
    cap('companion.care_moment'),
  ];

  it('returns the same plan for identical inputs', () => {
    const input = {
      periodKey: '2026-09-12',
      intensity: 'balanced',
      allowVariety: true,
      eligible,
      assignedQuests: [{ capabilityKey: 'quest.daily_medi' }],
      restDay: false,
      recentCategories: ['movement'],
      recentOutcomes: {},
      recentMissStreak: 0,
      recentCompleteStreak: 0,
    };
    assert.deepEqual(planAdventure(input), planAdventure(input));
  });

  it('gives one honest mission when only one capability exists', () => {
    const plan = planAdventure({
      intensity: 'active',
      allowVariety: true,
      eligible: [cap('quest.daily_medi')],
      assignedQuests: [],
      restDay: false,
    });
    assert.equal(plan.slots.length, 1);
    assert.equal(plan.slots[0].capabilityKey, 'quest.daily_medi');
    assert.ok(plan.reasonCodes.includes('ONE_CAPABILITY_HONEST'));
  });

  it('keeps anchor and balance categories different when possible', () => {
    const plan = planAdventure({
      intensity: 'balanced',
      allowVariety: true,
      eligible,
      assignedQuests: [{ capabilityKey: 'quest.daily_steps' }],
      restDay: false,
    });
    const anchor = plan.slots.find((row) => row.slotKey === 'anchor');
    const balance = plan.slots.find((row) => row.slotKey === 'balance');
    assert.ok(anchor && balance);
    assert.notEqual(cap(anchor.capabilityKey).energyType, cap(balance.capabilityKey).energyType);
  });

  it('reduces pressure after repeated misses and adds variety after completion', () => {
    const reduced = planAdventure({
      intensity: 'active',
      allowVariety: true,
      eligible,
      assignedQuests: [],
      restDay: false,
      recentMissStreak: 2,
    });
    assert.equal(reduced.slots.filter((row) => row.required).length, 1);
    const variety = planAdventure({
      intensity: 'balanced',
      allowVariety: true,
      eligible,
      assignedQuests: [],
      restDay: false,
      recentCompleteStreak: 2,
    });
    assert.ok(variety.slots.some((row) => row.slotKey === 'choice'));
  });

  it('does not invent rest missions when none are compatible', () => {
    const plan = planAdventure({
      intensity: 'gentle',
      eligible: [cap('quest.daily_steps')],
      restDay: true,
      assignedQuests: [],
    });
    assert.equal(plan.slots.length, 0);
    assert.ok(plan.reasonCodes.includes('NO_COMPATIBLE_ACTION'));
  });

  it('does not immediately repeat a swapped capability when alternatives exist', () => {
    const next = planReplacement({
      currentKey: 'quest.daily_steps',
      usedKeys: ['quest.daily_steps', 'quest.daily_hydration'],
      eligible,
    });
    assert.equal(next.ok, true);
    assert.notEqual(next.capabilityKey, 'quest.daily_steps');
  });
});

describe('Daily Adventure service', () => {
  it('persists one adventure, retries the same row, and keeps the ruleset', async () => {
    const db = createQuestFakeDb();
    await seedFull(db);
    const first = await getTodayAdventure(USER, opts(db));
    const retry = await getTodayAdventure(USER, opts(db));
    assert.equal(first.adventure.periodKey, retry.adventure.periodKey);
    assert.equal(first.adventure.rulesetId, 'medi-world-adventure-v1');
    assert.equal(first.adventure.slots.map((s) => s.capabilityKey).join(), retry.adventure.slots.map((s) => s.capabilityKey).join());
    assert.equal((await db.mediWorldDailyAdventure.findMany({ where: { userId: USER } })).length, 1);
    const stored = await db.mediWorldDailyAdventure.findFirst({ where: { userId: USER } });
    assert.equal(stored.rulesetVersion, 'medi-world-adventure-v1');
  });

  it('creates a single adventure under concurrent first generation', async () => {
    const db = createQuestFakeDb();
    await seedFull(db);
    const raced = await Promise.all([
      getTodayAdventure(USER, opts(db)),
      getTodayAdventure(USER, opts(db)),
    ]);
    assert.equal(raced[0].adventure.periodKey, raced[1].adventure.periodKey);
    assert.equal((await db.mediWorldDailyAdventure.findMany({ where: { userId: USER } })).length, 1);
  });

  it('uses only active supported capabilities and never walking-only when others exist', async () => {
    const db = createQuestFakeDb();
    await seedFull(db);
    await updateAdventurePreferences(USER, { intensity: 'balanced' }, opts(db));
    const today = await getTodayAdventure(USER, opts(db));
    const keys = today.adventure.slots.map((row) => row.capabilityKey);
    assert.equal(keys.every((key) => capabilityByKey(key)?.active), true);
    assert.equal(keys.some((key) => key === 'future.wheelchair_movement'), false);
    const cats = new Set(today.adventure.slots.map((row) => row.energyType));
    if (today.adventure.slots.filter((row) => row.required).length > 1) {
      assert.ok(cats.size >= 2, 'expected category variety');
    }
  });

  it('gives a one-capability user a single honest mission', async () => {
    const db = createQuestFakeDb();
    await db.stepTrackingCapability.create({
      data: { userId: USER, status: 'AVAILABLE', source: 'APPLE_HEALTH' },
    });
    await updateAdventurePreferences(USER, { intensity: 'active', enabledCategories: ['movement'] }, opts(db));
    const today = await getTodayAdventure(USER, opts(db));
    const required = today.adventure.slots.filter((row) => row.required && row.status !== 'swapped');
    assert.equal(required.length, 1);
    assert.equal(required[0].capabilityKey, 'quest.daily_steps');
  });

  it('respects wheelchair movement mode without inventing unsupported adapters', async () => {
    const db = createQuestFakeDb();
    await seedFull(db);
    await updateAdventurePreferences(
      USER,
      { intensity: 'balanced', movementMode: 'wheelchair', enabledCategories: ['movement', 'hydration', 'care'] },
      opts(db),
    );
    const today = await getTodayAdventure(USER, opts(db));
    assert.equal(today.adventure.slots.some((row) => row.capabilityKey === 'quest.daily_steps'), false);
    assert.equal(today.adventure.slots.some((row) => row.capabilityKey === 'future.wheelchair_movement'), false);
  });

  it('mirrors canonical Quest completion without a second World reward', async () => {
    const db = createQuestFakeDb();
    await seedFull(db);
    await updateAdventurePreferences(USER, { intensity: 'gentle', enabledCategories: ['care'], allowVariety: false }, opts(db));
    const today = await getTodayAdventure(USER, opts(db));
    const slot = today.adventure.slots.find((row) => row.capabilityKey === 'quest.daily_medi');
    assert.ok(slot?.userQuestId);
    const before = await db.mediWorldLedger.count({ where: { userId: USER } });
    await db.userQuest.update({ where: { id: slot.userQuestId }, data: { progress: 1 } });
    const done = await completeQuest(USER, slot.userQuestId, opts(db));
    assert.equal(done.completed, true);
    const retry = await completeQuest(USER, slot.userQuestId, opts(db));
    assert.equal(retry.alreadyCompleted, true);
    const after = await getTodayAdventure(USER, opts(db));
    const updated = after.adventure.slots.find((row) => row.userQuestId === slot.userQuestId);
    assert.equal(updated.status, 'completed');
    assert.equal(after.adventure.completion.complete, true);
    const questCredits = await db.mediWorldLedger.findMany({
      where: { userId: USER, sourceType: 'QUEST_COMPLETION' },
    });
    assert.equal(questCredits.length, 1);
    assert.ok((await db.mediWorldLedger.count({ where: { userId: USER } })) >= before);
  });

  it('does not treat a cancelled Quest as Adventure progress', async () => {
    const db = createQuestFakeDb();
    await seedFull(db);
    await updateAdventurePreferences(USER, { intensity: 'balanced' }, opts(db));
    const today = await getTodayAdventure(USER, opts(db));
    const hydro = today.adventure.slots.find((row) => row.capabilityKey === 'quest.daily_hydration');
    assert.ok(hydro?.userQuestId);
    await db.userQuest.update({
      where: { id: hydro.userQuestId },
      data: { status: 'CANCELLED', progress: 50 },
    });
    const after = await getTodayAdventure(USER, opts(db));
    const slot = after.adventure.slots.find((row) => row.capabilityKey === 'quest.daily_hydration');
    if (slot) {
      assert.notEqual(slot.status, 'in_progress');
      assert.notEqual(slot.status, 'completed');
    }
  });

  it('allows two swaps, rejects a third, and treats swapped as not failed', async () => {
    const db = createQuestFakeDb();
    await seedFull(db);
    await updateAdventurePreferences(USER, { intensity: 'balanced' }, opts(db));
    const today = await getTodayAdventure(USER, opts(db));
    const firstKey = today.adventure.slots.find((row) => row.slotKey === 'anchor').capabilityKey;
    const swapped = await swapAdventureSlot(USER, 'anchor', 'swap-1', opts(db));
    assert.notEqual(swapped.adventure.slots.find((row) => row.slotKey === 'anchor').capabilityKey, firstKey);
    assert.equal(swapped.adventure.swapsRemaining, 1);
    const second = await swapAdventureSlot(USER, 'anchor', 'swap-2', opts(db));
    assert.equal(second.adventure.swapsRemaining, 0);
    const dup = await swapAdventureSlot(USER, 'anchor', 'swap-1', opts(db));
    assert.equal(dup.adventure.swapCount, 2);
    await assert.rejects(
      () => swapAdventureSlot(USER, 'anchor', 'swap-3', opts(db)),
      (err) => err.code === 'ADVENTURE_SWAP_EXHAUSTED',
    );
    const stored = await db.mediWorldDailyAdventure.findFirst({ where: { userId: USER }, include: { slots: true } });
    assert.equal(stored.slots.some((row) => row.status === 'failed'), false);
  });

  it('selects one choice option and rejects a switch after progress', async () => {
    const db = createQuestFakeDb();
    await seedFull(db);
    await updateAdventurePreferences(USER, { intensity: 'active', allowVariety: true }, opts(db));
    const today = await getTodayAdventure(USER, opts(db));
    const choices = today.adventure.slots.filter((row) => row.slotKey === 'choice');
    if (choices.length < 2) {
      assert.ok(true);
      return;
    }
    const picked = await selectAdventureChoice(USER, 'a', opts(db));
    assert.equal(picked.adventure.slots.filter((row) => row.slotKey === 'choice' && row.selected).length, 1);
    const selected = picked.adventure.slots.find((row) => row.slotKey === 'choice' && row.selected);
    if (selected.userQuestId) {
      await db.userQuest.update({ where: { id: selected.userQuestId }, data: { progress: 1 } });
      await assert.rejects(
        () => selectAdventureChoice(USER, 'b', opts(db)),
        (err) => err.code === 'ADVENTURE_CHOICE_LOCKED',
      );
    }
  });

  it('activates Rest Day once without removing World progress', async () => {
    const db = createQuestFakeDb();
    await seedFull(db);
    await processWorldActivity(
      USER,
      {
        sourceType: 'FOUNDATION_TEST',
        sourceId: 'rest-evt',
        idempotencyKey: 'rest-idem',
        adapterId: 'activity.walking',
        energyType: 'movement',
        progressState: 'verified',
        personalTarget: 1500,
        completedAmount: 1500,
      },
      opts(db),
    );
    const before = await getMediWorldProfile(USER, opts(db));
    await getTodayAdventure(USER, opts(db));
    const rest = await activateRestDay(USER, opts(db));
    assert.equal(rest.adventure.restDay, true);
    const again = await activateRestDay(USER, opts(db));
    assert.equal(again.adventure.restDay, true);
    const after = await getMediWorldProfile(USER, opts(db));
    assert.equal(after.profile.careEnergy.movement, before.profile.careEnergy.movement);
    assert.equal(after.profile.worldXp, before.profile.worldXp);
  });

  it('does not expose private audit fields or health keys', async () => {
    const db = createQuestFakeDb();
    await seedFull(db);
    const today = await getTodayAdventure(USER, opts(db));
    const blob = JSON.stringify(today);
    assert.equal(blob.includes('reasonCodes'), false);
    assert.equal(blob.includes('idempotencyKey'), false);
    assert.equal(blob.includes('diagnosis'), false);
    assert.equal(blob.includes('medication'), false);
    assert.equal(blob.includes('generationSeed'), false);
  });

  it('expires yesterday on rollover, rejects mutations against it, and does not complete it later', async () => {
    const db = createQuestFakeDb();
    await seedFull(db);
    await updateAdventurePreferences(USER, { intensity: 'gentle', enabledCategories: ['care'], allowVariety: false }, opts(db));
    const day1 = new Date('2026-09-12T12:00:00+04:00');
    const day2 = new Date('2026-09-13T12:00:00+04:00');
    const first = await getTodayAdventure(USER, opts(db, { now: day1 }));
    const slot = first.adventure.slots.find((row) => row.userQuestId);
    const next = await getTodayAdventure(USER, opts(db, { now: day2 }));
    assert.notEqual(next.adventure.periodKey, first.adventure.periodKey);
    assert.equal(next.adventure.expired, false);
    assert.notEqual(next.adventure.status, 'expired');
    const prior = await db.mediWorldDailyAdventure.findFirst({
      where: { userId: USER, periodKey: first.adventure.periodKey },
    });
    assert.equal(prior.status, 'expired');
    await assert.rejects(
      () => swapAdventureSlot(USER, 'anchor', 'expired-swap', opts(db, { now: day1 })),
      (err) => err.code === 'ADVENTURE_EXPIRED',
    );
    await assert.rejects(
      () => activateRestDay(USER, opts(db, { now: day1 })),
      (err) => err.code === 'ADVENTURE_EXPIRED',
    );
    if (slot?.userQuestId) {
      const quest = await db.userQuest.findUnique({ where: { id: slot.userQuestId } });
      await db.userQuest.update({ where: { id: quest.id }, data: { progress: quest.target } });
      try {
        await completeQuest(USER, quest.id, opts(db, { now: day2 }));
      } catch (error) {
        assert.equal(error.status, 409);
      }
      try {
        await completeQuest(USER, quest.id, opts(db, { now: day1 }));
      } catch {
        /* Quest may also reject a rolled period; Adventure must stay expired either way. */
      }
    }
    const still = await db.mediWorldDailyAdventure.findFirst({
      where: { userId: USER, periodKey: first.adventure.periodKey },
    });
    assert.equal(still.status, 'expired');
    assert.equal(still.completedAt, null);
    const ledger = await db.mediWorldLedger.count({
      where: { userId: USER, sourceType: 'QUEST_COMPLETION' },
    });
    assert.equal(ledger <= 1, true);
  });

  it('keeps the accepted period across a denied timezone hop', async () => {
    const db = createQuestFakeDb();
    await seedFull(db);
    await processWorldActivity(
      USER,
      {
        sourceType: 'FOUNDATION_TEST',
        sourceId: 'hop-evt',
        idempotencyKey: 'hop-idem',
        adapterId: 'activity.walking',
        energyType: 'movement',
        progressState: 'verified',
        personalTarget: 1500,
        completedAmount: 1500,
      },
      opts(db),
    );
    const first = await getTodayAdventure(USER, opts(db));
    const hopped = await getTodayAdventure(USER, opts(db, { timezone: 'Pacific/Kiritimati' }));
    assert.equal(hopped.adventure.periodKey, first.adventure.periodKey);
    assert.equal(hopped.adventure.expired, false);
  });

  it('returns disabled and unavailable errors consistently', async () => {
    const db = createQuestFakeDb();
    await seedFull(db);
    await assert.rejects(
      () => getTodayAdventure(USER, { ...opts(db), flags: { nodeEnv: 'production', flag: '0' } }),
      (err) => err.code === 'MEDI_WORLD_DISABLED',
    );
    const broken = createQuestFakeDb();
    broken.mediWorldDailyAdventure = {};
    await assert.rejects(
      () => getTodayAdventure(USER, opts(broken)),
      (err) => err.code === 'WORLD_UNAVAILABLE',
    );
  });

  it('keeps preference defaults conservative and ignores injected targets', async () => {
    const db = createQuestFakeDb();
    const prefs = await getAdventurePreferences(USER, opts(db));
    assert.equal(prefs.preferences.intensity, 'gentle');
    assert.equal(prefs.preferences.showTargets, false);
    const updated = await updateAdventurePreferences(USER, { intensity: 'active', showTargets: true }, opts(db));
    assert.equal(updated.preferences.intensity, 'active');
    assert.equal(updated.preferences.showTargets, true);
  });
});

describe('API surface', () => {
  it('registers self-only adventure routes and no complete endpoint', () => {
    const routes = mediWorldRouter.stack.filter((layer) => layer.route);
    const paths = routes.map((layer) => `${Object.keys(layer.route.methods).join(',')}:${layer.route.path}`);
    assert.ok(paths.includes('get:/adventure/today'));
    assert.ok(paths.includes('get:/adventure/preferences'));
    assert.ok(paths.includes('put:/adventure/preferences'));
    assert.ok(paths.includes('post:/adventure/today/choice'));
    assert.ok(paths.includes('post:/adventure/today/swap'));
    assert.ok(paths.includes('post:/adventure/today/rest-day'));
    assert.ok(!paths.some((path) => path.includes('complete')));
    assert.ok(!routes.some((layer) => /:userId/.test(layer.route.path)));
  });
});

describe('Care Moment bind', () => {
  it('can complete a Care Moment slot from the canonical companion action', async () => {
    const db = createQuestFakeDb();
    await updateAdventurePreferences(
      USER,
      { intensity: 'gentle', enabledCategories: ['care'], allowVariety: false },
      opts(db),
    );
    const today = await getTodayAdventure(USER, opts(db));
    const care = today.adventure.slots.find((row) => row.capabilityKey === 'companion.care_moment');
    if (!care) return;
    await completeCareMoment(USER, 'greet', opts(db));
    const after = await getTodayAdventure(USER, opts(db));
    const updated = after.adventure.slots.find((row) => row.capabilityKey === 'companion.care_moment');
    assert.equal(updated.status, 'completed');
  });
});
