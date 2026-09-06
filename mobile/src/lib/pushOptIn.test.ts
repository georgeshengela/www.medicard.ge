import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePushOptedIn, resolvePushToggleOn } from './pushOptIn.ts';

describe('pushOptIn', () => {
  it('treats an explicit off as off even when OS permission is granted', () => {
    assert.equal(resolvePushOptedIn('0', true), false);
    assert.equal(resolvePushToggleOn(true, false), false);
  });

  it('keeps legacy users on when permission is already granted and no pref exists', () => {
    assert.equal(resolvePushOptedIn(null, true), true);
    assert.equal(resolvePushToggleOn(true, true), true);
  });

  it('does not auto-opt-in before the OS prompt', () => {
    assert.equal(resolvePushOptedIn(null, false), false);
    assert.equal(resolvePushToggleOn(false, false), false);
  });

  it('honors an explicit on only when permission is granted', () => {
    assert.equal(resolvePushOptedIn('1', false), true);
    assert.equal(resolvePushToggleOn(false, true), false);
    assert.equal(resolvePushToggleOn(true, true), true);
  });
});
