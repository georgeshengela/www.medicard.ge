import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MOVEMENT_LAST_KNOWN_FORBIDDEN, shouldSendMovementSample } from './movementLocationPolicy.js';
import { shouldUseLastKnown } from './exploreLocationPolicy.ts';

describe('Movement location policy', () => {
  it('forbids last-known location for verification', () => {
    assert.equal(MOVEMENT_LAST_KNOWN_FORBIDDEN, true);
    assert.equal(shouldUseLastKnown(0), true);
  });

  it('drops duplicate and too-soon samples client-side', () => {
    const now = Date.now();
    const a = { latitude: 37.422, longitude: -122.084, accuracy: 12, timestamp: now - 8_000, mocked: false, speedMps: 1, approximate: false };
    const soon = { ...a, timestamp: now - 6_000 };
    const later = { ...a, timestamp: now };
    assert.equal(shouldSendMovementSample(a, soon), false);
    assert.equal(shouldSendMovementSample(a, later), true);
    assert.equal(shouldSendMovementSample(a, { ...later, timestamp: now - 20_000 }), false);
    assert.equal(shouldSendMovementSample(a, { ...later, accuracy: 80, approximate: true }), true);
  });
});
