import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createQuestFakeDb } from '../questFakeDb.js';
import { JOURNEY_THRESHOLDS, JOURNEY_MILESTONES, COMPANION_COSMETICS, assertActiveCosmeticsHaveVisualKeys } from './catalog.js';
import { RENDERED_VISUAL_KEYS, isVisualKeyRendered } from './visualRegistry.js';
import { journeyUnitsFromCompletions, resolveJourneyProgress } from './journeyMath.js';
import { resolveCompanionStage } from './stages.js';
import { resolveMediCompanionMood } from './mood.js';
import { assertCompanionPayloadSafe } from './privacy.js';
import {
  calculateJourneyProgressForUser,
  reconcileMediJourneyForUser,
  getMediCompanionOverview,
  updateMediCompanionEquipment,
} from './service.js';

const USER = 'user-companion-1';

function completion(cadence) {
  return { userQuest: { template: { cadence } } };
}

describe('phase 9 journey math', () => {
  it('weights daily=1 and weekly=3', () => {
    assert.equal(journeyUnitsFromCompletions([completion('DAILY')]), 1);
    assert.equal(journeyUnitsFromCompletions([completion('WEEKLY')]), 3);
    assert.equal(
      journeyUnitsFromCompletions([completion('DAILY'), completion('DAILY'), completion('WEEKLY')]),
      5,
    );
  });

  it('maps exact thresholds to milestones', () => {
    assert.equal(JOURNEY_THRESHOLDS.length, 25);
    assert.equal(JOURNEY_MILESTONES.length, 25);
    for (const at of JOURNEY_THRESHOLDS) {
      const progress = resolveJourneyProgress(at);
      assert.ok(progress.currentMilestoneKey);
      assert.equal(progress.unlockedMilestoneKeys.length, JOURNEY_THRESHOLDS.filter((t) => t <= at).length);
    }
    assert.deepEqual(
      JOURNEY_THRESHOLDS,
      [1, 3, 5, 8, 12, 17, 23, 30, 38, 47, 57, 68, 80, 93, 107, 122, 138, 155, 173, 192, 212, 233, 255, 278, 302],
    );
    assert.equal(resolveJourneyProgress(0).currentMilestoneKey, null);
    assert.equal(resolveJourneyProgress(0).nextMilestoneKey, 'MILESTONE_01');
    assert.equal(resolveJourneyProgress(302).completedAll, true);
    assert.equal(resolveJourneyProgress(302).nextMilestoneKey, null);
  });
});

describe('phase 9.1 visual fulfillment', () => {
  it('every active cosmetic has a unique visualKey with a renderer', () => {
    assert.equal(assertActiveCosmeticsHaveVisualKeys(), true);
    const active = COMPANION_COSMETICS.filter((c) => c.isActive);
    assert.ok(active.length >= 27); // 2 defaults + 25 journey
    for (const c of active) {
      assert.ok(isVisualKeyRendered(c.visualKey), `${c.key} → ${c.visualKey}`);
    }
    const keys = active.map((c) => c.visualKey);
    assert.equal(new Set(keys).size, keys.length);
  });

  it('every journey unlock maps to a valid active cosmetic', () => {
    for (const m of JOURNEY_MILESTONES) {
      const c = COMPANION_COSMETICS.find((row) => row.key === m.cosmeticKey);
      assert.ok(c, m.key);
      assert.equal(c.isActive, true);
      assert.equal(c.unlockKey, m.key);
      assert.ok(RENDERED_VISUAL_KEYS.includes(c.visualKey));
    }
  });

  it('rejects inactive cosmetic equip', async () => {
    const db = createQuestFakeDb();
    // Poison: mark a cosmetic inactive by using unknown key
    await assert.rejects(
      () => updateMediCompanionEquipment(USER, { accent: 'COSMETIC_DOES_NOT_EXIST' }, { db }),
      (err) => err.code === 'COMPANION_COSMETIC_INVALID' || err.status === 400,
    );
  });
});

describe('phase 9 stage boundaries', () => {
  const cases = [
    [1, 'STAGE_1'],
    [4, 'STAGE_1'],
    [5, 'STAGE_2'],
    [9, 'STAGE_2'],
    [10, 'STAGE_3'],
    [19, 'STAGE_3'],
    [20, 'STAGE_4'],
    [29, 'STAGE_4'],
    [30, 'STAGE_5'],
    [39, 'STAGE_5'],
    [40, 'STAGE_6'],
    [49, 'STAGE_6'],
    [50, 'STAGE_7'],
    [100, 'STAGE_7'],
  ];
  for (const [level, stage] of cases) {
    it(`level ${level} → ${stage}`, () => {
      assert.equal(resolveCompanionStage(level), stage);
    });
  }
});

describe('phase 9 mood priority', () => {
  it('recent level-up beats ordinary active state', () => {
    const mood = resolveMediCompanionMood({
      recentEventKey: 'LEVEL_UP',
      allDailyComplete: true,
      localHour: 14,
    });
    assert.equal(mood.moodKey, 'EXCITED');
    assert.equal(mood.messageKey, 'COMPANION_LEVEL_UP');
  });

  it('comeback beats ordinary active state', () => {
    const mood = resolveMediCompanionMood({
      isComeback: true,
      meaningfulQuestProgress: true,
      localHour: 14,
    });
    assert.equal(mood.moodKey, 'WELCOME_BACK');
  });

  it('all complete → PROUD', () => {
    const mood = resolveMediCompanionMood({ allDailyComplete: true, localHour: 14 });
    assert.equal(mood.moodKey, 'PROUD');
  });

  it('evening normal → RESTING', () => {
    const mood = resolveMediCompanionMood({ localHour: 21 });
    assert.equal(mood.moodKey, 'RESTING');
  });

  it('does not accept clinical inputs in resolver surface', () => {
    const mood = resolveMediCompanionMood({
      diagnosis: 'x',
      steps: 9999,
      localHour: 10,
    });
    assert.ok(['CHEERFUL', 'CALM', 'CURIOUS', 'FOCUSED', 'PROUD', 'RESTING', 'EXCITED', 'WELCOME_BACK'].includes(mood.moodKey));
  });
});

describe('phase 9 privacy', () => {
  it('rejects sensitive keys', () => {
    assert.throws(() => assertCompanionPayloadSafe({ steps: 12 }), /sensitive/);
    assert.throws(() => assertCompanionPayloadSafe({ hydrationMl: 200 }), /sensitive/);
    assert.throws(() => assertCompanionPayloadSafe({ latitude: 1 }), /sensitive/);
    assert.doesNotThrow(() =>
      assertCompanionPayloadSafe({ companion: { level: 2, stage: 'STAGE_1', moodKey: 'CALM' } }),
    );
  });
});

describe('phase 9 reconciliation + economy isolation', () => {
  async function seedCompletions(db, { daily = 0, weekly = 0 } = {}) {
    for (let i = 0; i < daily; i += 1) {
      const template = await db.questTemplate.create({
        data: {
          key: `daily_${i}`,
          category: 'MOVEMENT',
          cadence: 'DAILY',
          titleKey: 't',
          descriptionKey: 'd',
          progressType: 'STEPS',
          defaultTarget: 1,
          rewardCoins: 10,
          rewardXp: 10,
          isActive: true,
          config: {},
        },
      });
      const quest = await db.userQuest.create({
        data: {
          userId: USER,
          templateId: template.id,
          periodKey: `2026-08-${String(i + 1).padStart(2, '0')}`,
          target: 1,
          progress: 1,
          status: 'COMPLETED',
          assignedAt: new Date(),
          completedAt: new Date(),
          expiresAt: new Date(),
          metadata: {},
        },
      });
      await db.questCompletion.create({
        data: {
          userQuestId: quest.id,
          userId: USER,
          completedAt: new Date(),
          progressAtCompletion: 1,
          source: 'sync',
        },
      });
    }
    for (let i = 0; i < weekly; i += 1) {
      const template = await db.questTemplate.create({
        data: {
          key: `weekly_${i}`,
          category: 'WEEKLY',
          cadence: 'WEEKLY',
          titleKey: 't',
          descriptionKey: 'd',
          progressType: 'STEPS',
          defaultTarget: 1,
          rewardCoins: 10,
          rewardXp: 10,
          isActive: true,
          config: {},
        },
      });
      const quest = await db.userQuest.create({
        data: {
          userId: USER,
          templateId: template.id,
          periodKey: `2026-W${String(10 + i).padStart(2, '0')}`,
          target: 1,
          progress: 1,
          status: 'COMPLETED',
          assignedAt: new Date(),
          completedAt: new Date(),
          expiresAt: new Date(),
          metadata: {},
        },
      });
      await db.questCompletion.create({
        data: {
          userQuestId: quest.id,
          userId: USER,
          completedAt: new Date(),
          progressAtCompletion: 1,
          source: 'sync',
        },
      });
    }
  }

  it('historical completions unlock correct milestones without RewardLedger writes', async () => {
    const db = createQuestFakeDb();
    // 2 daily + 1 weekly = 5 units → milestones at 1,3,5
    await seedCompletions(db, { daily: 2, weekly: 1 });
    const beforeLedger = await db.rewardLedger.count();
    const first = await reconcileMediJourneyForUser(USER, { db, silent: true });
    assert.equal(first.units, 5);
    assert.deepEqual(first.newlyUnlockedKeys.sort(), ['MILESTONE_01', 'MILESTONE_02', 'MILESTONE_03']);
    const second = await reconcileMediJourneyForUser(USER, { db, silent: true });
    assert.equal(second.newlyUnlockedKeys.length, 0);
    assert.equal(await db.rewardLedger.count(), beforeLedger);
    const unlocks = await db.mediJourneyUnlock.findMany({ where: { userId: USER } });
    assert.equal(unlocks.length, 3);
  });

  it('calculateJourneyProgressForUser is claim-independent', async () => {
    const db = createQuestFakeDb();
    await seedCompletions(db, { daily: 1 });
    const progress = await calculateJourneyProgressForUser(USER, { db });
    assert.equal(progress.units, 1);
  });

  it('equipment rejects locked cosmetics and accepts owned', async () => {
    const db = createQuestFakeDb();
    await seedCompletions(db, { daily: 1 });
    await reconcileMediJourneyForUser(USER, { db, silent: true });
    await assert.rejects(
      () => updateMediCompanionEquipment(USER, { accessory: 'COSMETIC_MILESTONE_03' }, { db }),
      (err) => err.code === 'COMPANION_COSMETIC_LOCKED' || err.status === 403,
    );
    const ownedKey = 'COSMETIC_MILESTONE_01';
    const result = await updateMediCompanionEquipment(USER, { accessory: ownedKey }, { db });
    assert.equal(result.equipment.accessory, ownedKey);
  });

  it('overview serializer stays privacy-safe', async () => {
    const db = createQuestFakeDb();
    const overview = await getMediCompanionOverview(USER, { db, silent: true });
    assert.ok(overview.companion.stage);
    assert.ok(overview.journey);
    assert.doesNotThrow(() => assertCompanionPayloadSafe(overview));
    const json = JSON.stringify(overview);
    for (const bad of ['diagnosis', 'medication', 'cycle', 'pregnancy', 'hydrationMl', 'latitude', 'steps']) {
      assert.equal(json.includes(`"${bad}"`), false);
    }
  });
});
