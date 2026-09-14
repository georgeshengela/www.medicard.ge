import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ageToApproxBirth, approxBirthToAge, approxBirthYears, formatPetAgeKa } from './petsAge.js';

describe('pets approximate birth', () => {
  const now = new Date(2026, 8, 15); // Sep 2026

  it('converts year + Georgian month to age', () => {
    assert.deepEqual(approxBirthToAge(2023, 3, now), { years: 3, months: 6 });
    assert.equal(approxBirthToAge(2026, 9, now), null);
    assert.deepEqual(approxBirthToAge(2026, 8, now), { years: 0, months: 1 });
  });

  it('round-trips age back to year and month', () => {
    assert.deepEqual(ageToApproxBirth(3, 6, now), { year: 2023, month: 3 });
  });

  it('lists recent years newest first', () => {
    const years = approxBirthYears(now, 2);
    assert.deepEqual(years, [2026, 2025, 2024]);
  });

  it('formats display age in Georgian copy', () => {
    const copy = {
      ageUnknown: 'უცნობია',
      ageMonthsOnly: (n) => `${n} თვე`,
      ageYearsOnly: (n) => `${n} წელი`,
      ageYearsMonths: (y, m) => `${y} წ. ${m} თვე`,
    };
    assert.equal(formatPetAgeKa({ kind: 'APPROXIMATE', years: 3, months: 2 }, copy), '3 წ. 2 თვე');
  });
});
