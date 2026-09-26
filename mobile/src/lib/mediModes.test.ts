import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apiModeFor, legacyChatRouteToMedi, mediModeForSession, mediModeFromParam, mediRoute } from './mediModes.ts';

describe('one Medi modes', () => {
  it('reads every historic spelling, including the uppercase CONSILIUM push route', () => {
    assert.equal(mediModeFromParam('doctor'), 'doctor');
    assert.equal(mediModeFromParam('DOCTOR'), 'doctor');
    assert.equal(mediModeFromParam('consilium'), 'deep');
    assert.equal(mediModeFromParam('CONSILIUM'), 'deep');
    assert.equal(mediModeFromParam('deep'), 'deep');
    assert.equal(mediModeFromParam(undefined), 'medi');
    assert.equal(mediModeFromParam(['doctor']), 'doctor');
  });

  it('maps saved sessions back to the right mode', () => {
    assert.equal(mediModeForSession('CONSILIUM'), 'deep');
    assert.equal(mediModeForSession('DOCTOR'), 'doctor');
    assert.equal(mediModeForSession('ASSISTANT'), 'medi');
    assert.equal(apiModeFor('medi'), null);
    assert.equal(apiModeFor('deep'), 'CONSILIUM');
  });

  it('builds /assistant routes and converts legacy chat links', () => {
    assert.equal(mediRoute(), '/assistant');
    assert.equal(mediRoute({ mode: 'deep', sessionId: 'abc' }), '/assistant?mode=deep&sessionId=abc');
    assert.equal(legacyChatRouteToMedi('/chat/DOCTOR'), '/assistant?mode=doctor');
    assert.equal(legacyChatRouteToMedi('/chat/CONSILIUM?sessionId=s1'), '/assistant?mode=deep&sessionId=s1');
    assert.equal(legacyChatRouteToMedi('/chat/doctor?prefill=%E1%83%97'), '/assistant?mode=doctor&prefill=%E1%83%97');
    assert.equal(legacyChatRouteToMedi('/medications'), '/medications');
  });
});
