import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldOfferBiometric, type BiometricOfferInput } from './biometricOffer.ts';

const base: BiometricOfferInput = { completed: true, alreadyPrompted: false, launches: 2, available: true, enrolled: true, onHome: true, otherPromptOpen: false };

describe('Face ID offer after onboarding', () => {
  it('is offered once, from the second launch, on Home', () => {
    assert.equal(shouldOfferBiometric(base), true);
    assert.equal(shouldOfferBiometric({ ...base, launches: 1 }), false);
    assert.equal(shouldOfferBiometric({ ...base, alreadyPrompted: true }), false);
    assert.equal(shouldOfferBiometric({ ...base, onHome: false }), false);
  });

  it('never stacks on another prompt or shows on devices without enrolled biometrics', () => {
    assert.equal(shouldOfferBiometric({ ...base, otherPromptOpen: true }), false);
    assert.equal(shouldOfferBiometric({ ...base, enrolled: false }), false);
    assert.equal(shouldOfferBiometric({ ...base, available: false }), false);
    assert.equal(shouldOfferBiometric({ ...base, completed: false }), false);
  });
});
