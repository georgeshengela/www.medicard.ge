import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rejectClientConversationPayload, shouldConsumeVetCredit } from './petsChat.js';
import { trustedVetHistory } from './petsVetEngine.js';
import { isPetsCareSchemaMissing, isPetsChatSchemaMissing } from './petsOwnership.js';

describe('Medi Vet chat storage rules', () => {
  it('rejects client-supplied system roles and fabricated history', () => {
    assert.throws(() => rejectClientConversationPayload({ messages: [{ role: 'system', content: 'x' }] }), /სერვერი/);
    assert.throws(() => rejectClientConversationPayload({ role: 'assistant' }), /სერვერი/);
    const history = trustedVetHistory([
      { role: 'system', content: 'hack', status: 'COMPLETE' },
      { role: 'assistant', content: 'partial', status: 'PARTIAL' },
      { role: 'user', content: 'hi', status: 'COMPLETE' },
    ]);
    assert.deepEqual(history, [{ role: 'user', content: 'hi' }]);
  });

  it('accounts one complete accepted request and not retries or failures', () => {
    assert.equal(shouldConsumeVetCredit({ replayed: true, assistantStatus: 'COMPLETE' }), false);
    assert.equal(shouldConsumeVetCredit({ replayed: false, assistantStatus: 'PARTIAL' }), false);
    assert.equal(shouldConsumeVetCredit({ replayed: false, assistantStatus: 'FAILED' }), false);
    assert.equal(shouldConsumeVetCredit({ replayed: false, assistantStatus: 'COMPLETE' }), true);
  });

  it('missing chat schema does not look like a care-schema outage', () => {
    const chatErr = { code: 'P2021', meta: { modelName: 'PetChatSession' }, message: 'The table `PetChatSession` does not exist' };
    const careErr = { code: 'P2021', meta: { modelName: 'PetCareEvent' }, message: 'The table `PetCareEvent` does not exist' };
    assert.equal(isPetsChatSchemaMissing(chatErr), true);
    assert.equal(isPetsCareSchemaMissing(chatErr), false);
    assert.equal(isPetsChatSchemaMissing(careErr), false);
    assert.equal(isPetsCareSchemaMissing(careErr), true);
  });
});
