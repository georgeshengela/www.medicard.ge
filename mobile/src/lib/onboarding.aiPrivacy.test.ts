import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextProfileSetupHref } from './onboarding.ts';

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
