import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FINISH_RETRY_DELAYS_MS, finishRetryDelay, keepLocalAnswers, nextProfileSetupHref, withExtraAnswers } from './onboarding.ts';

const user = { phone: null };

function profile(extra: Record<string, unknown>) {
  return { completedAt: null, extraAnswers: extra };
}

describe('7-step onboarding tail (privacy → AI → notifications)', () => {
  it('asks for the required privacy acceptance first', () => {
    assert.equal(nextProfileSetupHref(profile({}) as never, user as never), '/(auth)/profile-setup/privacy');
  });

  it('asks for AI consent right after privacy, and a decline still moves on', () => {
    assert.equal(nextProfileSetupHref(profile({ privacyAccepted: true }) as never, user as never), '/(auth)/profile-setup/ai-privacy');
    assert.equal(
      nextProfileSetupHref(profile({ privacyAccepted: true, aiPrivacyPrompted: true, aiPrivacyDecision: 'declined' }) as never, user as never),
      '/(auth)/profile-setup/notifications',
    );
  });

  it('asks for the Home layout after the notification step whatever the answer', () => {
    for (const notificationsEnabled of [true, false]) {
      assert.equal(
        nextProfileSetupHref(profile({ privacyAccepted: true, aiPrivacyPrompted: true, notificationsEnabled }) as never, user as never),
        '/(auth)/profile-setup/home-layout',
      );
    }
  });

  it('finishes once a Home layout is chosen', () => {
    for (const homeLayout of ['women', 'active', 'weight', 'standard']) {
      assert.equal(
        nextProfileSetupHref(profile({ privacyAccepted: true, aiPrivacyPrompted: true, notificationsEnabled: true, homeLayout }) as never, user as never),
        '/(auth)/profile-setup/analyzing',
      );
    }
  });

  it('no longer blocks on avatar, phone verification, Face ID or location', () => {
    assert.equal(
      nextProfileSetupHref(profile({ privacyAccepted: true, aiPrivacyPrompted: true, notificationsEnabled: true, homeLayout: 'standard' }) as never, { phone: '' } as never),
      '/(auth)/profile-setup/analyzing',
    );
  });
});

describe('notification answer when the save fails (ONB-6)', () => {
  it('an answer kept in memory moves the person on instead of back to the primer', () => {
    const base = profile({ privacyAccepted: true, aiPrivacyPrompted: true, avatarId: 'avatar-2' });
    for (const notificationsEnabled of [true, false]) {
      const local = withExtraAnswers(base as never, { notificationsEnabled });
      assert.equal(nextProfileSetupHref(local, user as never), '/(auth)/profile-setup/home-layout');
      assert.equal((local.extraAnswers as Record<string, unknown>).avatarId, 'avatar-2');
    }
    assert.equal((base.extraAnswers as Record<string, unknown>).notificationsEnabled, undefined);
  });

  it('survives the AI analysis answer, which carries only what the server stored', () => {
    const local = withExtraAnswers(profile({ privacyAccepted: true, aiPrivacyDecision: 'accepted' }) as never, {
      notificationsEnabled: false,
    });
    const server = { completedAt: null, weightKg: 70, extraAnswers: { privacyAccepted: true, aiPrivacyDecision: 'accepted', onboardingAnalysis: { score: 80 } } };
    const merged = keepLocalAnswers(server as never, local);
    const extra = merged.extraAnswers as Record<string, unknown>;
    assert.equal(extra.notificationsEnabled, false);
    assert.deepEqual(extra.onboardingAnalysis, { score: 80 });
    assert.equal((merged as unknown as { weightKg: number }).weightKg, 70);
    // The server wins wherever both have a value.
    const stale = withExtraAnswers(profile({ aiPrivacyDecision: 'declined' }) as never, {});
    assert.equal((keepLocalAnswers(server as never, stale).extraAnswers as Record<string, unknown>).aiPrivacyDecision, 'accepted');
  });
});

describe('last onboarding save retries (ONB-1)', () => {
  const err = (status: number) => Object.assign(new Error('x'), { status });

  it('retries a dropped connection, rate limit or server error a bounded number of times', () => {
    for (const status of [0, 429, 500, 502, 503]) {
      assert.deepEqual(
        FINISH_RETRY_DELAYS_MS.map((_, i) => finishRetryDelay(err(status), i + 1)),
        [...FINISH_RETRY_DELAYS_MS],
      );
      assert.equal(finishRetryDelay(err(status), FINISH_RETRY_DELAYS_MS.length + 1), null);
    }
  });

  it('never retries what a retry cannot fix', () => {
    for (const status of [400, 401, 403, 404, 409, 422]) assert.equal(finishRetryDelay(err(status), 1), null);
    // A timeout already waited the whole request timeout (3 min): show the error, never wait again on its own.
    assert.equal(finishRetryDelay(err(408), 1), null);
    assert.equal(finishRetryDelay(new Error('completePayload: birthdate'), 1), null);
    assert.equal(finishRetryDelay(null, 1), null);
    assert.equal(finishRetryDelay(err(0), 0), null);
  });
});
