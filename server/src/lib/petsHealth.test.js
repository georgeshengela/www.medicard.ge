import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLERGY_STATUSES,
  CONDITION_BASES,
  convertToKg,
  decideOwnedChild,
  mergeConditionUpdate,
  mergeWeightUpdate,
  normalizeAllergyInput,
  normalizeConditionInput,
  normalizeWeightInput,
  pickLatestWeight,
  publicWeightLog,
} from './petsHealth.js';
import { isPetsHealthSchemaMissing, isPetsSchemaMissing } from './petsOwnership.js';

const TODAY = '2026-09-14';

describe('pet weight conversion and precision', () => {
  it('converts grams and pounds without dog-sized floors', () => {
    assert.equal(convertToKg(12, 'g').weightKg, 0.012);
    assert.equal(convertToKg(1, 'g').weightKg, 0.001);
    assert.equal(convertToKg(10, 'lb').weightKg, 4.53592);
    assert.equal(convertToKg(4.25, 'kg').weightKg, 4.25);
    assert.equal(convertToKg(1200, 'kg').weightKg, 1200);
  });

  it('round-trips displayed input values', () => {
    const hamster = convertToKg(28.5, 'g');
    assert.equal(hamster.inputValue, 28.5);
    assert.equal(hamster.inputUnit, 'g');
    assert.equal(hamster.weightKg, 0.0285);
    const lb = convertToKg(11.2, 'lb');
    assert.equal(lb.inputValue, 11.2);
    assert.equal(lb.inputUnit, 'lb');
  });

  it('rejects invalid numbers', () => {
    assert.throws(() => convertToKg(0, 'kg'));
    assert.throws(() => convertToKg(-1, 'kg'));
    assert.throws(() => convertToKg(Number.POSITIVE_INFINITY, 'kg'));
    assert.throws(() => convertToKg('abc', 'kg'));
    assert.throws(() => convertToKg(2, 'stone'));
  });
});

describe('pet weight latest selection', () => {
  it('uses recordedOn first, then createdAt, then id — backdated rows stay history', () => {
    const latest = pickLatestWeight([
      { id: 'a', recordedOn: '2026-09-01', createdAt: '2026-09-14T10:00:00.000Z' },
      { id: 'b', recordedOn: '2026-09-10', createdAt: '2026-09-14T09:00:00.000Z' },
      { id: 'c', recordedOn: '2026-09-10', createdAt: '2026-09-14T11:00:00.000Z' },
    ]);
    assert.equal(latest.id, 'c');

    const afterBackdate = pickLatestWeight([
      { id: 'c', recordedOn: '2026-09-10', createdAt: '2026-09-14T11:00:00.000Z' },
      { id: 'old', recordedOn: '2026-08-01', createdAt: '2026-09-14T12:00:00.000Z' },
    ]);
    assert.equal(afterBackdate.id, 'c');
  });

  it('recalculates after deleting the latest entry', () => {
    const rows = [
      { id: 'older', recordedOn: '2026-08-01', createdAt: '2026-08-01T00:00:00.000Z' },
      { id: 'latest', recordedOn: '2026-09-10', createdAt: '2026-09-14T11:00:00.000Z' },
    ];
    assert.equal(pickLatestWeight(rows).id, 'latest');
    assert.equal(pickLatestWeight(rows.filter((row) => row.id !== 'latest')).id, 'older');
  });

  it('does not silently collapse same-day measurements', () => {
    const rows = [
      { id: 'morning', recordedOn: '2026-09-14', createdAt: '2026-09-14T08:00:00.000Z' },
      { id: 'evening', recordedOn: '2026-09-14', createdAt: '2026-09-14T18:00:00.000Z' },
    ];
    assert.equal(pickLatestWeight(rows).id, 'evening');
    assert.equal(rows.length, 2);
  });
});

describe('pet weight dates', () => {
  it('rejects future and impossible measurement dates', () => {
    assert.throws(() =>
      normalizeWeightInput({ recordedOn: '2026-09-15', inputValue: 4, inputUnit: 'kg' }, { todayYmd: TODAY }),
    );
    assert.throws(() =>
      normalizeWeightInput({ recordedOn: '2026-02-30', inputValue: 4, inputUnit: 'kg' }, { todayYmd: TODAY }),
    );
  });

  it('keeps civil dates as YYYY-MM-DD', () => {
    const row = normalizeWeightInput(
      { recordedOn: '2026-03-15', inputValue: 4.2, inputUnit: 'kg', note: 'vet' },
      { todayYmd: TODAY },
    );
    assert.equal(row.recordedOn, '2026-03-15');
    const edited = mergeWeightUpdate(row, { inputValue: 4300, inputUnit: 'g' }, TODAY);
    assert.equal(edited.recordedOn, '2026-03-15');
    assert.equal(edited.weightKg, 4.3);
    assert.equal(publicWeightLog({ ...row, id: 'x', petId: 'p', createdAt: new Date('2026-09-14T00:00:00.000Z'), updatedAt: new Date('2026-09-14T00:00:00.000Z') }).recordedOn, '2026-03-15');
  });
});

describe('pet allergies', () => {
  it('stores suspected vs veterinarian-confirmed without inferring from notes', () => {
    const suspected = normalizeAllergyInput(
      { name: 'Chicken', category: 'food', reportedStatus: 'suspected', notes: 'vet said maybe' },
      { todayYmd: TODAY },
    );
    assert.equal(suspected.reportedStatus, 'suspected');
    assert.equal(suspected.category, 'food');
    const confirmed = normalizeAllergyInput(
      { name: 'Penicillin', category: 'medication', reportedStatus: 'veterinarian_confirmed' },
      { todayYmd: TODAY },
    );
    assert.equal(confirmed.reportedStatus, 'veterinarian_confirmed');
    assert.ok(ALLERGY_STATUSES.includes(confirmed.reportedStatus));
  });

  it('rejects empty names and unknown statuses', () => {
    assert.throws(() => normalizeAllergyInput({ name: '  ', reportedStatus: 'suspected' }, { todayYmd: TODAY }));
    assert.throws(() =>
      normalizeAllergyInput({ name: 'Dust', reportedStatus: 'confirmed' }, { todayYmd: TODAY }),
    );
  });
});

describe('pet conditions', () => {
  it('allows missing dates and rejects inconsistent resolved dates', () => {
    const open = normalizeConditionInput(
      { name: 'Arthritis', status: 'active', reportedBasis: 'owner_reported' },
      { todayYmd: TODAY },
    );
    assert.equal(open.onsetOn, null);
    assert.equal(open.resolvedOn, null);
    assert.ok(CONDITION_BASES.includes(open.reportedBasis));

    assert.throws(() =>
      normalizeConditionInput(
        {
          name: 'Allergy',
          status: 'resolved',
          reportedBasis: 'veterinarian_confirmed',
          onsetOn: '2026-06-01',
          resolvedOn: '2026-05-01',
        },
        { todayYmd: TODAY },
      ),
    );
    assert.throws(() =>
      normalizeConditionInput(
        { name: 'Allergy', status: 'active', reportedBasis: 'owner_reported', resolvedOn: '2026-05-01' },
        { todayYmd: TODAY },
      ),
    );
  });

  it('clears resolution date when status is not resolved', () => {
    const updated = mergeConditionUpdate(
      {
        name: 'Arthritis',
        status: 'resolved',
        reportedBasis: 'owner_reported',
        onsetOn: '2025-01-01',
        resolvedOn: '2026-01-01',
        notes: null,
      },
      { status: 'active' },
      TODAY,
    );
    assert.equal(updated.status, 'active');
    assert.equal(updated.resolvedOn, null);
    assert.equal(updated.onsetOn, '2025-01-01');
  });
});

describe('pet health ownership', () => {
  it('404s a child id on a different pet URL, including same owner', () => {
    const child = { id: 'w1', userId: 'owner', petId: 'pet-a' };
    assert.equal(decideOwnedChild(child, 'pet-b', 'owner').status, 404);
    assert.equal(decideOwnedChild(child, 'pet-a', 'other').status, 404);
    assert.equal(decideOwnedChild(child, 'pet-a', 'owner').status, 200);
  });
});

describe('pets health schema missing', () => {
  it('treats Phase 3 tables as health-unavailable, not identity-missing', () => {
    const health = { code: 'P2021', meta: { modelName: 'PetWeightLog' }, message: 'The table `public.PetWeightLog` does not exist' };
    const identity = { code: 'P2021', meta: { modelName: 'Pet' }, message: 'The table `public.Pet` does not exist' };
    assert.equal(isPetsSchemaMissing(health), true);
    assert.equal(isPetsHealthSchemaMissing(health), true);
    assert.equal(isPetsHealthSchemaMissing(identity), false);
    assert.equal(isPetsSchemaMissing(identity), true);
  });
});
