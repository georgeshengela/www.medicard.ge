'use strict';

const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  applyMovementQaFix,
  armMovementInaccurateOnce,
  isMovementQaAllowed,
  resetMovementQa,
} = require('./movementQa.js');

const native = {
  latitude: 37.422,
  longitude: -122.084,
  accuracy: 8,
  timestamp: Date.now(),
  mocked: false,
  speedMps: 1.2,
  approximate: false,
};

describe('Movement poor-GPS QA arm', () => {
  const previous = global.__DEV__;

  beforeEach(() => {
    global.__DEV__ = true;
    resetMovementQa();
  });

  after(() => {
    global.__DEV__ = previous;
    resetMovementQa();
  });

  it('is development-only and overwrites accuracy after a native sample', () => {
    assert.equal(isMovementQaAllowed(), true);
    assert.equal(armMovementInaccurateOnce(), true);
    const next = applyMovementQaFix(native);
    assert.equal(next.accuracy, 80);
    assert.equal(next.approximate, true);
    assert.equal(next.latitude, native.latitude);
    const recovered = applyMovementQaFix({ ...native, accuracy: 9 });
    assert.equal(recovered.accuracy, 9);
  });

  it('is a no-op when __DEV__ is false', () => {
    global.__DEV__ = false;
    assert.equal(isMovementQaAllowed(), false);
    assert.equal(armMovementInaccurateOnce(), false);
    const next = applyMovementQaFix(native);
    assert.equal(next.accuracy, 8);
  });
});
