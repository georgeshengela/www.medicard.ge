'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  applyAuthoritativeWorldFromFinish,
  getCompanionWorldSnapshot,
  getGardenSnapshot,
  getWorldProfileSnapshot,
  rememberCompanionWorld,
  rememberGarden,
  rememberWorldProfile,
  resetWorldEconomyCache,
} = require('./worldEconomyCache.js');

function oldWorld() {
  return {
    enabled: true,
    profile: {
      worldLevel: 1,
      worldXp: 24,
      careEnergy: { movement: 0, hydration: 0, calm: 0, care: 0, connection: 0 },
      foundation: { level: 1, xp: 24, progressPercent: 24, atCap: false },
    },
    today: {
      category: { movement: { used: 0, cap: 20, remaining: 20 } },
      worldXp: { used: 24, cap: 60, remaining: 36 },
    },
    latestReward: { reasonCode: 'PERSONAL_GOAL_COMPLETE', energyType: 'care', energyAmount: 4, worldXp: 4 },
  };
}

function finishWorld() {
  return {
    enabled: true,
    profile: {
      worldLevel: 1,
      worldXp: 36,
      careEnergy: { movement: 10, hydration: 0, calm: 0, care: 0, connection: 0 },
      foundation: { level: 1, xp: 36, progressPercent: 36, atCap: false },
    },
    today: {
      category: { movement: { used: 10, cap: 20, remaining: 10 } },
      worldXp: { used: 36, cap: 60, remaining: 24 },
    },
    latestReward: {
      reasonCode: 'PERSONAL_GOAL_COMPLETE',
      energyType: 'movement',
      energyAmount: 10,
      worldXp: 12,
      sourceType: 'MOVEMENT_SESSION',
    },
  };
}

describe('World economy cache after movement finish', () => {
  beforeEach(() => resetWorldEconomyCache());

  it('starts from a stale cached profile and then receives the authoritative finish snapshot', () => {
    rememberWorldProfile(oldWorld());
    rememberCompanionWorld({
      companion: { id: 'c1', bond: { bondPoints: 2 } },
      world: { worldLevel: 1, worldXp: 24, careEnergy: { movement: 0, hydration: 4, calm: 0, care: 0, connection: 0 } },
    });
    assert.equal(getWorldProfileSnapshot().profile.careEnergy.movement, 0);
    assert.equal(getWorldProfileSnapshot().today.worldXp.used, 24);
    assert.equal(getCompanionWorldSnapshot().world.careEnergy.movement, 0);

    const ok = applyAuthoritativeWorldFromFinish(finishWorld(), { bondChanged: true });
    assert.equal(ok, true);
    const next = getWorldProfileSnapshot();
    assert.equal(next.profile.careEnergy.movement, 10);
    assert.equal(next.today.worldXp.used, 36);
    assert.equal(next.profile.worldXp, 36);
    assert.equal(next.latestReward.sourceType, 'MOVEMENT_SESSION');
    assert.equal(getCompanionWorldSnapshot().world.careEnergy.movement, 10);
    assert.equal(getCompanionWorldSnapshot().world.worldXp, 36);
  });

  it('does not mutate cached balances on a failed finish or missing world payload', () => {
    rememberWorldProfile(oldWorld());
    assert.equal(applyAuthoritativeWorldFromFinish(null), false);
    assert.equal(applyAuthoritativeWorldFromFinish({ enabled: true }), false);
    assert.equal(getWorldProfileSnapshot().profile.careEnergy.movement, 0);
    assert.equal(getWorldProfileSnapshot().today.worldXp.used, 24);
  });

  it('does not invent a reward from an offline completion attempt', () => {
    rememberWorldProfile(oldWorld());
    const invented = {
      ...finishWorld(),
      latestReward: { reasonCode: 'OFFLINE_INVENTED', energyType: 'movement', energyAmount: 10, worldXp: 12 },
    };
    assert.equal(applyAuthoritativeWorldFromFinish(null), false);
    assert.notEqual(getWorldProfileSnapshot().latestReward.reasonCode, invented.latestReward.reasonCode);
    assert.equal(getWorldProfileSnapshot().profile.careEnergy.movement, 0);
  });

  it('keeps duplicate-finish snapshots identical instead of incrementing', () => {
    rememberWorldProfile(oldWorld());
    applyAuthoritativeWorldFromFinish(finishWorld());
    applyAuthoritativeWorldFromFinish(finishWorld());
    const next = getWorldProfileSnapshot();
    assert.equal(next.profile.careEnergy.movement, 10);
    assert.equal(next.today.worldXp.used, 36);
    assert.equal(next.profile.worldXp, 36);
  });

  it('reconnect refresh replaces the cache with the exact server/database snapshot', () => {
    rememberWorldProfile(oldWorld());
    const dbState = finishWorld();
    rememberWorldProfile(dbState);
    assert.deepEqual(getWorldProfileSnapshot().profile.careEnergy, dbState.profile.careEnergy);
    assert.deepEqual(getWorldProfileSnapshot().today.worldXp, dbState.today.worldXp);
    assert.equal(getWorldProfileSnapshot().latestReward.worldXp, 12);
  });
});

describe('World economy cache after garden planting', () => {
  beforeEach(() => resetWorldEconomyCache());

  it('applies the authoritative garden world snapshot across hub and garden', () => {
    rememberWorldProfile(oldWorld());
    const planted = {
      enabled: true,
      plots: [{ index: 0, unlocked: true, plant: { id: 'p1', catalogKey: 'pulse_fern', stage: 'seed' } }],
      stored: [],
      world: finishWorld(),
    };
    assert.equal(rememberGarden(planted), true);
    assert.equal(getGardenSnapshot().plots[0].plant.catalogKey, 'pulse_fern');
    assert.equal(getWorldProfileSnapshot().profile.careEnergy.movement, 10);
  });

  it('does not change cached balance when planting is not applied', () => {
    rememberWorldProfile(oldWorld());
    assert.equal(rememberGarden(null), false);
    assert.equal(rememberGarden({ enabled: true }), false);
    assert.equal(getWorldProfileSnapshot().profile.careEnergy.movement, 0);
  });
});
