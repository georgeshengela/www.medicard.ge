import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { forgetAiConsent, hasFreshAiConsent, isAiSharingRequest, needsAiConsentPrompt, rememberAiConsent } from './aiSharingRoutes.js';

describe('AI consent prompt gate', () => {
  it('does not prompt again after the current consent is accepted', () => {
    const accepted = { accepted: true, version: '2026-09-25.1' };
    assert.equal(needsAiConsentPrompt(accepted), false);
    assert.equal(needsAiConsentPrompt(accepted), false);
    assert.equal(needsAiConsentPrompt({ accepted: false }), true);
    assert.equal(needsAiConsentPrompt({ accepted: true }, true), true);
  });

  it('leaves ordinary app calls alone and guards every AI provider route', () => {
    assert.equal(isAiSharingRequest('/api/health-profile', 'GET'), false);
    assert.equal(isAiSharingRequest('/api/auth/login', 'POST'), false);
    assert.equal(isAiSharingRequest('/api/ai/feedback', 'POST'), false);
    assert.equal(isAiSharingRequest('/api/medications', 'POST'), false);
    for (const path of [
      '/api/ai/query',
      '/api/ai/symptom-check',
      '/api/assistant/plan',
      '/api/assistant/transcribe',
      '/api/assistant/speak',
      '/api/health-profile/onboarding-analysis',
      '/api/cycle/insights',
      '/api/nutrition/estimate',
      '/api/pets/pet_1/chat/query',
    ]) {
      assert.equal(isAiSharingRequest(path, 'POST'), true, path);
    }
  });

  it('remembers an accepted decision per account for a bounded time', () => {
    forgetAiConsent();
    assert.equal(hasFreshAiConsent('A', 0), false);
    rememberAiConsent('A', { accepted: true, version: '2026-09-25.1' }, 0);
    assert.equal(hasFreshAiConsent('A', 60_000), true);
    assert.equal(hasFreshAiConsent('B', 60_000), false, 'another account never inherits consent');
    assert.equal(hasFreshAiConsent('A', 16 * 60_000), false, 'stale memory re-checks the server');
    rememberAiConsent('A', { accepted: false, version: '2026-09-25.1' }, 0);
    assert.equal(hasFreshAiConsent('A', 0), false, 'a declined or revoked answer is never remembered as consent');
    rememberAiConsent('A', { accepted: true, version: '2026-09-25.1' }, 0);
    forgetAiConsent();
    assert.equal(hasFreshAiConsent('A', 0), false);
  });
});
