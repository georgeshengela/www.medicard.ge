import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPLORE_LAST_KNOWN_MAX_AGE_MS,
  isCollectSampleAccurate,
  isCollectSampleFresh,
  redactExploreCoordinate,
  shouldUseLastKnown,
} from './exploreLocationPolicy.ts';

describe('Explore location policy', () => {
  it('rejects last-known samples older than the 30s collect window', () => {
    assert.equal(shouldUseLastKnown(0), true);
    assert.equal(shouldUseLastKnown(EXPLORE_LAST_KNOWN_MAX_AGE_MS), true);
    assert.equal(shouldUseLastKnown(180_000), false);
    assert.equal(shouldUseLastKnown(-1), false);
  });

  it('rejects stale, future, and inaccurate collect samples before submit', () => {
    const now = 1_000_000;
    assert.equal(isCollectSampleFresh(now - 1_000, now), true);
    assert.equal(isCollectSampleFresh(now - 31_000, now), false);
    assert.equal(isCollectSampleFresh(now + 20_000, now), false);
    assert.equal(isCollectSampleAccurate(12), true);
    assert.equal(isCollectSampleAccurate(50), true);
    assert.equal(isCollectSampleAccurate(80), false);
    assert.equal(isCollectSampleAccurate(null), false);
  });

  it('redacts coordinates to one decimal for QA display', () => {
    assert.equal(redactExploreCoordinate(37.422), 37.4);
    assert.equal(redactExploreCoordinate(-122.084), -122.1);
  });
});
