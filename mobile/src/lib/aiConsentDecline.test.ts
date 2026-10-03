import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aiConsentDeclinedText, aiConsentRetryLabel, isAiConsentDeclined } from './aiConsentDecline.ts';

describe('AI consent decline is a choice, not an error (App Review 2026-09-22)', () => {
  it('recognises the app decline/close and the server „consent missing“ refusal', () => {
    assert.equal(isAiConsentDeclined(Object.assign(new Error('x'), { code: 'AI_CONSENT_DECLINED' })), true);
    assert.equal(isAiConsentDeclined({ code: 'AI_CONSENT_REQUIRED' }), true);
  });

  it('leaves real failures alone', () => {
    for (const error of [null, undefined, 'AI_CONSENT_DECLINED', new Error('network'), { code: 'AI_ENGINE_ERROR' }, { code: 'MONTHLY_LIMIT_REACHED' }, { status: 403 }]) {
      assert.equal(isAiConsentDeclined(error), false, String(error));
    }
  });

  it('the calm line says nothing was sent and invites a retry — no error words', () => {
    const text = aiConsentDeclinedText();
    assert.equal(text, 'AI-ს არაფერი გაეგზავნა. როცა გინდა, შეგიძლია ხელახლა სცადო.');
    assert.doesNotMatch(text, /შეცდომ|ვერ |კავშირ|error|failed/i);
    assert.equal(aiConsentRetryLabel(), 'ხელახლა ცდა');
  });
});
