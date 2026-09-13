import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAuthoritativeCollectOutcome,
  applyExploreCollectResult,
  isExploreCollectLocked,
  isExploreCollectSuccess,
  shouldOfferExploreCollect,
  shouldRetryExpiredCollect,
} from './exploreCollectUi.js';

const spark = { spawnId: 'cs:garden', category: 'hydration', collected: false };

describe('Explore collect sheet refresh', () => {
  it('marks the selected Spark collected from the authoritative success response', () => {
    const place = { id: 'place.qa.garden.alpha', spark: { ...spark } };
    const next = applyExploreCollectResult(place, { outcome: 'SPARK_COLLECTED', discoveryCount: 1 });
    assert.equal(next.spark.collected, true);
    assert.equal(isExploreCollectLocked({ spark: next.spark, outcome: 'SPARK_COLLECTED' }), true);
  });

  it('locks Collect on already-collected without waiting for a second request', () => {
    assert.equal(isExploreCollectSuccess('SPARK_ALREADY_COLLECTED'), true);
    assert.equal(
      isExploreCollectLocked({ spark: { ...spark, collected: false }, outcome: 'SPARK_ALREADY_COLLECTED' }),
      true,
    );
  });

  it('does not mark collected on too-far and stays tappable after a failed request', () => {
    const place = { id: 'place.qa.park.beta', spark: { ...spark } };
    const next = applyExploreCollectResult(place, { outcome: 'SPARK_TOO_FAR' });
    assert.equal(next.spark.collected, false);
    assert.equal(isExploreCollectLocked({ spark: next.spark, outcome: 'SPARK_TOO_FAR' }), false);
  });

  it('blocks overlapping taps while verifying and restores after a thrown failure', () => {
    assert.equal(isExploreCollectLocked({ spark, verifying: true }), true);
    assert.equal(isExploreCollectLocked({ spark, verifying: false, outcome: 'SPARK_LOCATION_UNAVAILABLE' }), false);
  });

  it('locks Collect when the Spark window has expired or the area is only a previous snapshot', () => {
    const expired = { ...spark, expiresAt: '2026-09-13T09:00:00.000Z' };
    assert.equal(isExploreCollectLocked({ spark: expired, nowMs: Date.parse('2026-09-13T10:00:00.000Z') }), true);
    assert.equal(isExploreCollectLocked({ spark, snapshotOnly: true }), true);
    assert.equal(isExploreCollectLocked({ spark, noLivePosition: true }), true);
  });

  it('strips collectible state on SPARK_EXPIRED and does not offer a collect retry', () => {
    const place = { id: 'place.qa.garden.alpha', spark: { ...spark, expiresAt: '2026-09-13T18:00:00.000Z' } };
    const next = applyAuthoritativeCollectOutcome(place, { outcome: 'SPARK_EXPIRED' });
    assert.equal(next.spark, null);
    assert.equal(next.id, 'place.qa.garden.alpha');
    assert.equal(isExploreCollectLocked({ spark: next.spark, outcome: 'SPARK_EXPIRED' }), true);
    assert.equal(shouldOfferExploreCollect({ spark: next.spark, outcome: 'SPARK_EXPIRED' }), false);
    assert.equal(shouldRetryExpiredCollect('SPARK_EXPIRED'), false);
    assert.equal(shouldRetryExpiredCollect('SPARK_TOO_FAR'), true);
    const unavailable = applyAuthoritativeCollectOutcome(place, { outcome: 'SPARK_PLACE_UNAVAILABLE' });
    assert.equal(unavailable.spark, null);
    assert.equal(shouldOfferExploreCollect({ spark: unavailable.spark, outcome: 'SPARK_PLACE_UNAVAILABLE' }), false);
  });
});
