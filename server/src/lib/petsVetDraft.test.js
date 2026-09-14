import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { modelCannotMutateCare, shouldInventMissingDose, validateCareDraft } from './petsVetDraft.js';

describe('Medi Vet care drafts', () => {
  it('requires confirmation-shaped drafts and does not invent doses', () => {
    const draft = validateCareDraft(
      { kind: 'FLEA_TICK', title: 'რწყილი', startOn: '2026-09-20', provenance: 'owner_instruction' },
      { petId: 'pet-1', todayYmd: '2026-09-14' },
    );
    assert.equal(draft.petId, 'pet-1');
    assert.equal(draft.reminderEnabled, false);
    assert.equal(draft.dose, null);
    assert.equal(shouldInventMissingDose(draft), false);
    assert.deepEqual(modelCannotMutateCare(), {
      canCreateSchedule: false,
      canRecordAdministration: false,
      canCancelSchedule: false,
      canEnableReminders: false,
    });
  });

  it('rejects another pet id and unknown owned product', () => {
    assert.throws(
      () => validateCareDraft({ petId: 'pet-other', kind: 'OTHER', title: 'x', startOn: '2026-09-20' }, { petId: 'pet-1' }),
      /არ ეკუთვნის/,
    );
    assert.throws(
      () =>
        validateCareDraft(
          { kind: 'OTHER', title: 'x', startOn: '2026-09-20', productId: 'prod-1' },
          { petId: 'pet-1', ownedProductIds: new Set() },
        ),
      /პროდუქტი/,
    );
  });

  it('leaves incomplete drafts incomplete instead of filling medical fields', () => {
    const draft = validateCareDraft(
      { kind: 'MEDICATION', title: 'ანტიბიოტიკი' },
      { petId: 'pet-1', todayYmd: '2026-09-14' },
    );
    assert.equal(draft.incomplete, true);
    assert.ok(draft.missingFields.includes('startOn'));
  });
});
