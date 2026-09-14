import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideOwnedRecordAccess } from './ownerAccess.js';
import { decideOwnedActivePet, isPetsCareSchemaMissing, isPetsChatSchemaMissing } from './petsOwnership.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('pet ownership helpers', () => {
  it('treats another account as a 404, not a 403', () => {
    const pet = { id: 'pet-1', userId: OWNER, archivedAt: null };
    assert.equal(decideOwnedRecordAccess(pet, OTHER).status, 404);
    assert.equal(decideOwnedRecordAccess(pet, OTHER).body, null);
    assert.equal(decideOwnedActivePet(pet, OWNER).status, 200);
  });

  it('excludes archived pets from active access', () => {
    const pet = { id: 'pet-1', userId: OWNER, archivedAt: new Date() };
    assert.equal(decideOwnedActivePet(pet, OWNER).status, 404);
    assert.equal(decideOwnedActivePet(null, OWNER).status, 404);
  });

  it('splits missing chat schema from care schema', () => {
    const chatErr = { code: 'P2021', meta: { modelName: 'PetChatMessage' }, message: 'does not exist' };
    assert.equal(isPetsChatSchemaMissing(chatErr), true);
    assert.equal(isPetsCareSchemaMissing(chatErr), false);
  });
});
