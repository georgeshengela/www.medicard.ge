import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  birthDateToYmd,
  civilYmdToUtcDate,
  displayAgeParts,
  exactAgeParts,
  mergePetUpdate,
  normalizeAgeFields,
  normalizePetIdentity,
} from './petsAge.js';

const TODAY = '2026-09-14';

describe('pet age invariants', () => {
  it('stores exact birth dates as UTC midnight DATE without fabricating approx fields', () => {
    const age = normalizeAgeFields(
      { ageKind: 'EXACT', birthDate: '2018-03-15' },
      { todayYmd: TODAY },
    );
    assert.equal(age.ageKind, 'EXACT');
    assert.equal(age.birthDate.toISOString(), '2018-03-15T00:00:00.000Z');
    assert.equal(birthDateToYmd(age.birthDate), '2018-03-15');
    assert.equal(age.approxAgeYears, null);
    assert.equal(age.approxAgeMonths, null);
    assert.equal(age.approxAgeRecordedOn, null);
  });

  it('does not invent a birth date for approximate age', () => {
    const age = normalizeAgeFields(
      { ageKind: 'APPROXIMATE', approxAgeYears: 3, approxAgeMonths: 2 },
      { todayYmd: TODAY },
    );
    assert.equal(age.ageKind, 'APPROXIMATE');
    assert.equal(age.birthDate, null);
    assert.equal(age.approxAgeYears, 3);
    assert.equal(age.approxAgeMonths, 2);
    assert.equal(age.approxAgeRecordedOn, TODAY);
  });

  it('unknown age stores no birth date and no approximate fields', () => {
    const age = normalizeAgeFields({ ageKind: 'UNKNOWN' }, { todayYmd: TODAY });
    assert.deepEqual(age, {
      ageKind: 'UNKNOWN',
      birthDate: null,
      approxAgeYears: null,
      approxAgeMonths: null,
      approxAgeRecordedOn: null,
    });
  });

  it('rejects future birth dates, impossible days, negatives, and mixed representations', () => {
    assert.throws(() => normalizeAgeFields({ ageKind: 'EXACT', birthDate: '2026-09-15' }, { todayYmd: TODAY }));
    assert.throws(() => normalizeAgeFields({ ageKind: 'EXACT', birthDate: '2018-02-30' }, { todayYmd: TODAY }));
    assert.throws(() =>
      normalizeAgeFields({ ageKind: 'EXACT', birthDate: '2018-03-15', approxAgeYears: 3 }, { todayYmd: TODAY }),
    );
    assert.throws(() =>
      normalizeAgeFields({ ageKind: 'APPROXIMATE', approxAgeYears: -1 }, { todayYmd: TODAY }),
    );
    assert.throws(() =>
      normalizeAgeFields({ ageKind: 'APPROXIMATE', approxAgeYears: 1, approxAgeMonths: 12 }, { todayYmd: TODAY }),
    );
    assert.throws(() =>
      normalizeAgeFields({ ageKind: 'APPROXIMATE', birthDate: '2018-03-15', approxAgeYears: 1 }, { todayYmd: TODAY }),
    );
    assert.throws(() =>
      normalizeAgeFields({ ageKind: 'UNKNOWN', birthDate: '2018-03-15' }, { todayYmd: TODAY }),
    );
    assert.throws(() =>
      normalizeAgeFields({ ageKind: 'APPROXIMATE', approxAgeYears: 0, approxAgeMonths: 0 }, { todayYmd: TODAY }),
    );
  });

  it('display age for approximate accounts for elapsed months since recording', () => {
    const parts = displayAgeParts(
      {
        ageKind: 'APPROXIMATE',
        approxAgeYears: 2,
        approxAgeMonths: 0,
        approxAgeRecordedOn: '2025-09-14',
      },
      '2026-09-14',
    );
    assert.equal(parts.kind, 'APPROXIMATE');
    assert.equal(parts.years, 3);
    assert.equal(parts.months, 0);
    assert.equal(birthDateToYmd(null), null);
  });

  it('exact civil dates round-trip across timezone boundaries', () => {
    const stored = civilYmdToUtcDate('2018-03-15');
    assert.equal(stored.toISOString(), '2018-03-15T00:00:00.000Z');
    assert.equal(birthDateToYmd(stored), '2018-03-15');
    const previous = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      assert.equal(birthDateToYmd(stored), '2018-03-15');
      assert.equal(birthDateToYmd(new Date('2018-03-15T00:00:00.000Z')), '2018-03-15');
    } finally {
      if (previous == null) delete process.env.TZ;
      else process.env.TZ = previous;
    }
    const parts = exactAgeParts('2020-09-15', '2026-09-14');
    assert.deepEqual(parts, { years: 5, months: 11 });
  });
});

describe('pet identity validation', () => {
  it('requires name and species and defaults breed to unknown', () => {
    const pet = normalizePetIdentity({ name: 'ნუკრი', speciesId: 'dog' }, { todayYmd: TODAY });
    assert.equal(pet.breedId, 'unknown');
    assert.equal(pet.customBreed, null);
    assert.equal(pet.ageKind, 'UNKNOWN');
    assert.equal(pet.sex, 'UNKNOWN');
    assert.equal(pet.neutered, null);
  });

  it('rejects incompatible breed/species and requires custom text', () => {
    assert.throws(() =>
      normalizePetIdentity({ name: 'Mila', speciesId: 'cat', breedId: 'labrador-retriever' }, { todayYmd: TODAY }),
    );
    assert.throws(() =>
      normalizePetIdentity({ name: 'Mila', speciesId: 'fish', breedId: 'mixed' }, { todayYmd: TODAY }),
    );
    assert.throws(() =>
      normalizePetIdentity({ name: 'Mila', speciesId: 'dog', breedId: 'custom' }, { todayYmd: TODAY }),
    );
    const custom = normalizePetIdentity(
      { name: 'Mila', speciesId: 'other', breedId: 'custom', customBreed: 'Axolotl' },
      { todayYmd: TODAY },
    );
    assert.equal(custom.customBreed, 'Axolotl');
  });

  it('switching species on update clears an incompatible breed', () => {
    const current = {
      name: 'ნუკრი',
      speciesId: 'dog',
      breedId: 'labrador-retriever',
      customBreed: null,
      sex: 'MALE',
      neutered: null,
      ageKind: 'UNKNOWN',
      birthDate: null,
      approxAgeYears: null,
      approxAgeMonths: null,
      approxAgeRecordedOn: null,
      vetClinicName: null,
      vetName: null,
      vetPhone: null,
      vetAddress: null,
      vetNotes: null,
    };
    const next = mergePetUpdate(current, { speciesId: 'cat' }, TODAY);
    assert.equal(next.speciesId, 'cat');
    assert.equal(next.breedId, 'unknown');
  });
});
