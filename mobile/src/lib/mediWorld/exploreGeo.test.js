import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { coarseAreaKey, formatExploreDistanceM, geodesicMeters } from './exploreGeo.ts';

describe('Explore coarse area key', () => {
  it('matches the server 0.05-degree grid for the Android emulator practice places', () => {
    assert.equal(coarseAreaKey(37.422, -122.084), 'g37.40_-122.10');
  });

  it('measures garden-to-park as outside the 75 m collect radius', () => {
    const meters = geodesicMeters(
      { latitude: 37.422, longitude: -122.084 },
      { latitude: 37.4238, longitude: -122.0822 },
    );
    assert.equal(meters > 75, true);
    assert.equal(formatExploreDistanceM(meters) > 150, true);
  });
});
