import test from 'node:test';
import assert from 'node:assert/strict';
import { mediCycleAccess } from './mediCycleAccess.ts';

test('device lock, notification masking and removed context each deny cycle sharing', async () => {
  const engageKey = 'medicard.engage.prefs.v1.synthetic-owner';
  for (const key of ['medicard.cycle.privacy.lock', 'medicard.cycle.notifications.masked']) {
    assert.equal(await mediCycleAccess(async k => k === key ? '1' : null, engageKey), false);
  }
  assert.equal(await mediCycleAccess(async () => null, engageKey, true), false);
  assert.equal(await mediCycleAccess(async () => { throw Error('storage unavailable'); }, engageKey), false);
  assert.equal(await mediCycleAccess(async () => null, engageKey), true);
  assert.equal(await mediCycleAccess(async () => '0', engageKey), true);
  assert.equal(await mediCycleAccess(async k => k === engageKey ? '{"discreet":true}' : null, engageKey), false);
  assert.equal(await mediCycleAccess(async k => k === engageKey ? '{broken' : null, engageKey), false);
  assert.equal(await mediCycleAccess(async () => null, null), false);
});
