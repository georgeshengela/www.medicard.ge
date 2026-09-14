import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isFreshLocationTimestamp, MAX_LOCATION_FIX_AGE_MS } from './locationFix.ts';

describe('isFreshLocationTimestamp', () => {
  it('keeps a live GPS stamp and rejects a Tbilisi-age last-known cache', () => {
    const now = Date.parse('2026-09-14T12:00:00.000Z');
    assert.equal(isFreshLocationTimestamp(now - 8_000, now), true);
    assert.equal(isFreshLocationTimestamp(now - MAX_LOCATION_FIX_AGE_MS - 1, now), false);
    assert.equal(isFreshLocationTimestamp(undefined, now), true);
  });
});
