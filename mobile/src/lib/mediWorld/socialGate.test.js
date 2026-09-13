'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isSocialRuntimeAvailable, socialUiFailure, inboxItemPresentation, worldMapRequiresSocialProfile, worldMapRequiresExploreIntro } = require('./socialGate.js');
const { socialCacheKey, wrapSocialDisk, unwrapSocialDisk } = require('./socialSession.js');

describe('Social production-safe client gate', () => {
  it('treats missing or unknown server status as disabled and never lets compile-time override a disabled server', () => {
    assert.equal(isSocialRuntimeAvailable({ worldAvailable: true, clientEnabled: true, serverEnabled: true }), true);
    assert.equal(isSocialRuntimeAvailable({ worldAvailable: true, clientEnabled: true, serverEnabled: false }), false);
    assert.equal(isSocialRuntimeAvailable({ worldAvailable: true, clientEnabled: true, serverEnabled: null }), false);
    assert.equal(isSocialRuntimeAvailable({ worldAvailable: true, clientEnabled: true }), false);
    assert.equal(isSocialRuntimeAvailable({ worldAvailable: true, clientEnabled: false, serverEnabled: true }), false);
    assert.equal(isSocialRuntimeAvailable({ worldAvailable: false, clientEnabled: true, serverEnabled: true }), false);
  });

  it('logout fail-close stays hidden until a later status payload is explicitly true', () => {
    assert.equal(isSocialRuntimeAvailable({ worldAvailable: true, clientEnabled: true, serverEnabled: null }), false);
    assert.equal(isSocialRuntimeAvailable({ worldAvailable: true, clientEnabled: true, serverEnabled: true }), true);
  });
});

describe('Social disk cache isolation', () => {
  it('refuses to unwrap another account’s Social snapshot', () => {
    const rawA = wrapSocialDisk('user-a', { publicId: 'p-a', friendCode: 'AAAAA-BBBBB', displayName: 'Ava' });
    const rawB = wrapSocialDisk('user-b', { publicId: 'p-b', friendCode: 'CCCCC-DDDDD', displayName: 'Bea' });
    assert.equal(socialCacheKey('user-a'), 'medicard.mediWorld.socialCache.user-a');
    assert.equal(unwrapSocialDisk(rawA, 'user-a').displayName, 'Ava');
    assert.equal(unwrapSocialDisk(rawA, 'user-b'), null);
    assert.equal(unwrapSocialDisk(rawB, 'user-a'), null);
    assert.equal(unwrapSocialDisk(rawA, null), null);
  });
});

describe('Social UI failure mapping', () => {
  it('does not treat 429 as unavailable or an empty inbox', () => {
    assert.equal(socialUiFailure({ status: 429 }), 'rate_limited');
    assert.equal(socialUiFailure({ status: 404, code: 'SOCIAL_NOT_FOUND' }), 'unavailable');
    assert.equal(socialUiFailure({ status: 500 }), 'error');
    const wave = inboxItemPresentation({
      kind: 'care_wave',
      payload: { displayName: 'CedarA', waveType: 'hello' },
    }, { careWave: 'Care Wave', hello: 'Hello' });
    assert.equal(wave.kindLabel, 'Care Wave');
    assert.equal(wave.sender, 'CedarA');
    assert.equal(wave.waveLabel, 'Hello');
  });
});

describe('Medi World map access', () => {
  it('does not require a Social game name, opt-in, or explore intro to browse the map', () => {
    assert.equal(worldMapRequiresSocialProfile(), false);
    assert.equal(worldMapRequiresExploreIntro(), false);
  });
});
