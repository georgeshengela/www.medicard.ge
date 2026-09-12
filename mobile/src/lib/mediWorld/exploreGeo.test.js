import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { coarseAreaKey } from './exploreGeo.ts';

describe('Explore coarse area key', () => {
  it('matches the server 0.05-degree grid for the Android emulator fixture', () => {
    assert.equal(coarseAreaKey(37.422, -122.084), 'g37.40_-122.10');
  });
});
