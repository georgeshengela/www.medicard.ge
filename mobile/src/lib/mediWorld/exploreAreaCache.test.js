'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  EXPLORE_AREA_CACHE_MAX_MS,
  EXPLORE_AREA_CACHE_MAX_RATIONALE,
  SPAWN_WINDOW_MS,
  applyExpiredSparks,
  applyKnownSparkExpiry,
  delayUntilSparkExpiry,
  emptyExploreArea,
  fromPersistedExploreArea,
  isSparkExpired,
  nextKnownSparkExpiryMs,
  resolveExploreAreaCacheUse,
  selectPlaceAfterRefresh,
  shouldCommitExploreArea,
  spawnWindow,
  toPersistedExploreArea,
} = require('./exploreAreaCache.js');

const NOW = Date.parse('2026-09-13T10:00:00.000Z');
const OWNER_A = 'owner-a';
const OWNER_B = 'owner-b';
const CELL_A = 'g37.40_-122.10';
const CELL_B = 'g41.70_44.80';

function place(id, sparkExpiresAt, extra = {}) {
  return {
    id,
    nameKa: id,
    nameEn: id,
    placeType: 'public_garden',
    publicLat: 37.422,
    publicLng: -122.084,
    coarseAreaKey: CELL_A,
    accessibility: 'unknown',
    developmentFixture: true,
    spark: sparkExpiresAt
      ? {
          spawnId: `spawn:${id}`,
          category: 'hydration',
          locKey: 'spark.hydration',
          expiresAt: sparkExpiresAt,
          collected: false,
        }
      : null,
    ...extra,
  };
}

function record(overrides = {}) {
  return {
    ownerId: OWNER_A,
    fetchedAt: NOW,
    enabled: true,
    rulesetId: 'medi-world-explore-v1',
    coarseAreaKey: CELL_A,
    places: [place('place.qa.garden.alpha', new Date(NOW + 60_000).toISOString())],
    ...overrides,
  };
}

describe('Explore area cache policy', () => {
  it('documents elapsed cache max age separately from the UTC Spark spawn window', () => {
    assert.equal(EXPLORE_AREA_CACHE_MAX_MS, 6 * 60 * 60 * 1000);
    assert.equal(SPAWN_WINDOW_MS, 6 * 60 * 60 * 1000);
    assert.match(EXPLORE_AREA_CACHE_MAX_RATIONALE, /elapsed/);
    assert.equal(EXPLORE_AREA_CACHE_MAX_RATIONALE.includes('equals'), false);
    assert.match(EXPLORE_AREA_CACHE_MAX_RATIONALE, /not the UTC Spark spawn window/);
  });

  it('replaces the selected place on refresh, including when the live set is empty', () => {
    const prev = place('place.qa.garden.alpha', new Date(NOW + 60_000).toISOString());
    assert.equal(selectPlaceAfterRefresh(prev, []), null);
    const still = place('place.qa.garden.alpha', new Date(NOW + 120_000).toISOString());
    assert.equal(selectPlaceAfterRefresh(prev, [still]).id, 'place.qa.garden.alpha');
    assert.equal(selectPlaceAfterRefresh(prev, [place('place.qa.park.beta', new Date(NOW + 60_000).toISOString())]), null);
  });

  it('drops deactivated places from the selected details after an authoritative list', () => {
    const prev = place('place.qa.cap.one', new Date(NOW + 60_000).toISOString());
    const live = [place('place.qa.garden.alpha', new Date(NOW + 60_000).toISOString())];
    assert.equal(selectPlaceAfterRefresh(prev, live), null);
  });

  it('strips expired spawn windows so they cannot stay collectible in the client set', () => {
    const active = place('place.qa.garden.alpha', new Date(NOW + 1).toISOString());
    const expired = place('place.qa.park.beta', new Date(NOW).toISOString());
    const next = applyExpiredSparks([active, expired], NOW);
    assert.equal(next[0].spark.spawnId, 'spawn:place.qa.garden.alpha');
    assert.equal(next[1].spark, null);
    assert.equal(isSparkExpired(expired.spark, NOW), true);
  });

  it('rejects late responses from another generation, owner, or cell', () => {
    assert.equal(
      shouldCommitExploreArea({
        startedGeneration: 1,
        currentGeneration: 2,
        startedOwner: OWNER_A,
        currentOwner: OWNER_A,
        startedCell: CELL_A,
        currentCell: CELL_A,
      }),
      false,
    );
    assert.equal(
      shouldCommitExploreArea({
        startedGeneration: 3,
        currentGeneration: 3,
        startedOwner: OWNER_A,
        currentOwner: OWNER_B,
        startedCell: CELL_A,
        currentCell: CELL_A,
      }),
      false,
    );
    assert.equal(
      shouldCommitExploreArea({
        startedGeneration: 4,
        currentGeneration: 4,
        startedOwner: OWNER_A,
        currentOwner: OWNER_A,
        startedCell: CELL_A,
        currentCell: CELL_B,
      }),
      false,
    );
    assert.equal(
      shouldCommitExploreArea({
        startedGeneration: 5,
        currentGeneration: 5,
        startedOwner: OWNER_A,
        currentOwner: OWNER_A,
        startedCell: CELL_A,
        currentCell: CELL_A,
      }),
      true,
    );
  });

  it('never presents another cell or another account as current nearby', () => {
    const cached = record();
    const mismatch = resolveExploreAreaCacheUse(cached, {
      ownerId: OWNER_A,
      liveCell: CELL_B,
      nowMs: NOW,
    });
    assert.equal(mismatch.use, false);
    assert.equal(mismatch.reason, 'cell-mismatch');

    const otherOwner = resolveExploreAreaCacheUse(cached, {
      ownerId: OWNER_B,
      liveCell: CELL_A,
      nowMs: NOW,
    });
    assert.equal(otherOwner.use, false);
    assert.equal(otherOwner.reason, 'owner');
  });

  it('labels retained snapshots as previously loaded, never as current nearby', () => {
    const cached = record();
    const same = resolveExploreAreaCacheUse(cached, {
      ownerId: OWNER_A,
      liveCell: CELL_A,
      nowMs: NOW,
    });
    assert.equal(same.use, true);
    assert.equal(same.asCurrent, false);
    assert.equal(same.snapshotOnly, true);
    assert.equal(same.area.snapshotOnly, true);
    assert.equal(same.area.stale, true);

    const denied = resolveExploreAreaCacheUse(cached, {
      ownerId: OWNER_A,
      liveCell: null,
      nowMs: NOW,
      denied: true,
    });
    assert.equal(denied.use, true);
    assert.equal(denied.asCurrent, false);
    assert.equal(denied.reason, 'denied-snapshot');
  });

  it('drops snapshots older than the elapsed cache max age, not because a spawn window ended', () => {
    const stale = record({ fetchedAt: NOW - EXPLORE_AREA_CACHE_MAX_MS - 1 });
    const resolved = resolveExploreAreaCacheUse(stale, {
      ownerId: OWNER_A,
      liveCell: CELL_A,
      nowMs: NOW,
      denied: true,
    });
    assert.equal(resolved.use, false);
    assert.equal(resolved.reason, 'freshness');
  });

  it('ignores legacy unscoped cache records that have no owner or fetchedAt', () => {
    assert.equal(fromPersistedExploreArea({ coarseAreaKey: CELL_A, places: [place('place.qa.cap.one')] }), null);
    assert.equal(fromPersistedExploreArea({ ownerId: OWNER_A, coarseAreaKey: CELL_A, places: [] }), null);
  });

  it('persists empty successful refreshes and never stores a user position', () => {
    const persisted = toPersistedExploreArea({
      ownerId: OWNER_A,
      fetchedAt: NOW,
      area: emptyExploreArea(CELL_B),
    });
    assert.equal(persisted.places.length, 0);
    assert.equal(persisted.coarseAreaKey, CELL_B);
    assert.equal(JSON.stringify(persisted).includes('latitude'), false);
    assert.equal(JSON.stringify(persisted).includes('longitude'), false);
    const roundTrip = fromPersistedExploreArea(persisted);
    assert.equal(roundTrip.ownerId, OWNER_A);
    assert.equal(roundTrip.places.length, 0);
  });

  it('keeps a snapshot browsable across a UTC spawn-window boundary while stripping expired Sparks', () => {
    const window = spawnWindow(NOW);
    const fetchedAt = window.expiresAt - 1;
    const sparkExpires = new Date(window.expiresAt).toISOString();
    const cached = record({
      fetchedAt,
      places: [place('place.qa.garden.alpha', sparkExpires)],
    });
    const afterBoundary = window.expiresAt;
    assert.equal(afterBoundary - fetchedAt, 1);
    const resolved = resolveExploreAreaCacheUse(cached, {
      ownerId: OWNER_A,
      liveCell: CELL_A,
      nowMs: afterBoundary,
    });
    assert.equal(resolved.use, true);
    assert.equal(resolved.snapshotOnly, true);
    assert.equal(resolved.reason === 'freshness', false);
    const next = applyExpiredSparks(resolved.area.places, afterBoundary);
    assert.equal(next[0].id, 'place.qa.garden.alpha');
    assert.equal(next[0].spark, null);
  });

  it('disables a selected Spark when its known expiresAt is reached, including on a foreground recheck', () => {
    const expiresAt = new Date(NOW + 15_000).toISOString();
    const selected = place('place.qa.garden.alpha', expiresAt);
    const area = { places: [selected, place('place.qa.park.beta', new Date(NOW + 60_000).toISOString())] };
    const before = applyKnownSparkExpiry(area, selected, NOW + 14_999);
    assert.equal(before.changed, false);
    assert.equal(before.selected.spark.spawnId, 'spawn:place.qa.garden.alpha');
    assert.equal(nextKnownSparkExpiryMs(area.places, NOW), NOW + 15_000);
    assert.equal(delayUntilSparkExpiry(NOW + 15_000, NOW), 15_000);

    const onTimer = applyKnownSparkExpiry(area, selected, NOW + 15_000);
    assert.equal(onTimer.changed, true);
    assert.equal(onTimer.selectedExpired, true);
    assert.equal(onTimer.selected.spark, null);
    assert.equal(onTimer.area.places[0].spark, null);
    assert.equal(onTimer.area.places[0].id, 'place.qa.garden.alpha');
    assert.equal(onTimer.area.places[1].spark.spawnId, 'spawn:place.qa.park.beta');

    const foreground = applyKnownSparkExpiry(area, selected, NOW + 15_001);
    assert.equal(foreground.changed, true);
    assert.equal(foreground.selected.spark, null);
  });

  it('closes selected details when a normal refresh omits a deactivated place or returns empty', () => {
    const prev = place('place.qa.cap.1789294904653.3', new Date(NOW + 60_000).toISOString());
    assert.equal(selectPlaceAfterRefresh(prev, []), null);
    assert.equal(
      selectPlaceAfterRefresh(prev, [place('place.qa.garden.alpha', new Date(NOW + 60_000).toISOString())]),
      null,
    );
    const persisted = toPersistedExploreArea({
      ownerId: OWNER_A,
      fetchedAt: NOW,
      area: emptyExploreArea(CELL_A),
    });
    assert.equal(persisted.places.length, 0);
  });
});
