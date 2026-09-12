import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyExploreCollectResult,
  isExploreCollectLocked,
  isExploreCollectSuccess,
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
});
