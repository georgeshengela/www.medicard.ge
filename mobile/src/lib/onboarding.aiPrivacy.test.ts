import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nextProfileSetupHref } from './onboarding.ts';

const user = { phone: '+995555000000' };

function profile(extra: Record<string, unknown>) {
  return { completedAt: null, extraAnswers: extra };
}

const ready = {
  avatarId: 'avatar-1',
  phoneVerified: true,
  faceIdPrompted: true,
  privacyAccepted: true,
  notificationsEnabled: true,
};

describe('AI privacy onboarding step', () => {
  it('asks for AI permission after notifications and before analysis', () => {
    assert.equal(nextProfileSetupHref(profile(ready) as never, user as never), '/(auth)/profile-setup/ai-privacy');
    assert.equal(
      nextProfileSetupHref(profile({ ...ready, aiPrivacyPrompted: true, aiPrivacyDecision: 'declined' }) as never, user as never),
      '/(auth)/profile-setup/location',
    );
    assert.equal(
      nextProfileSetupHref(profile({
        ...ready,
        aiPrivacyPrompted: true,
        locationPrompted: true,
      }) as never, user as never),
      '/(auth)/profile-setup/analyzing',
    );
  });
});
