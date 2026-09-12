import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPARISON_KEYS,
  DEVELOPMENT_FACT_KEYS,
  HADLOCK_CRL_CM,
  PREGNANCY_WEEK_CATALOG,
  PREGNANCY_WEEK_CATALOG_MAX,
  PREGNANCY_WEEK_DATA_VERSION,
  WHO_EFW_P50_G,
  attachWeekDevelopment,
  formatLengthCm,
  formatWeightGrams,
  weekDevelopmentForCompletedWeek,
  williamsCrownHeelCm,
} from './pregnancyWeekData.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../assets/pregnancy-size');

describe('Pregnancy week catalog integrity', () => {
  it('has unique weeks 1-40 and a data version', () => {
    const weeks = PREGNANCY_WEEK_CATALOG.map((row) => row.week);
    assert.deepEqual(weeks, Array.from({ length: 40 }, (_, i) => i + 1));
    assert.equal(new Set(weeks).size, 40);
    assert.equal(PREGNANCY_WEEK_DATA_VERSION, '1.0.0');
  });

  it('uses CRL for 5-18, omits length at 19, uses CHL for 20-40', () => {
    for (const row of PREGNANCY_WEEK_CATALOG) {
      if (row.week <= 3) {
        assert.equal(row.kind, 'informational');
        assert.equal(row.lengthCm, null);
        assert.equal(row.comparisonKey, null);
      }
      if (row.week === 4) {
        assert.equal(row.kind, 'analogy');
        assert.equal(row.lengthCm, null);
        assert.equal(row.weightGrams, null);
        assert.equal(row.comparisonKey, 'poppy_seed');
      }
      if (row.week >= 5 && row.week <= 18) {
        assert.equal(row.measurementType, 'CRL');
        assert.equal(row.lengthCm, HADLOCK_CRL_CM[row.week]);
      }
      if (row.week === 19) {
        assert.equal(row.lengthCm, null);
        assert.equal(row.measurementType, null);
        assert.equal(row.weightGrams, 272);
      }
      if (row.week >= 20) {
        assert.equal(row.measurementType, 'CHL');
        assert.equal(row.lengthCm, williamsCrownHeelCm(row.week));
      }
    }
  });

  it('keeps WHO weight from week 14 and does not invent early grams', () => {
    for (const row of PREGNANCY_WEEK_CATALOG) {
      if (row.week < 14) assert.equal(row.weightGrams, null);
      else assert.equal(row.weightGrams, WHO_EFW_P50_G[row.week]);
    }
  });

  it('Williams anchors stay 25/30/35/40/45/50 and interpolate to whole cm', () => {
    assert.equal(williamsCrownHeelCm(20), 25);
    assert.equal(williamsCrownHeelCm(24), 30);
    assert.equal(williamsCrownHeelCm(28), 35);
    assert.equal(williamsCrownHeelCm(32), 40);
    assert.equal(williamsCrownHeelCm(36), 45);
    assert.equal(williamsCrownHeelCm(40), 50);
    assert.equal(williamsCrownHeelCm(19), null);
    assert.equal(williamsCrownHeelCm(8), null);
  });

  it('every fact and comparison key is known', () => {
    for (const row of PREGNANCY_WEEK_CATALOG) {
      assert.ok(row.developmentFactKeys.length >= 2);
      assert.ok(row.developmentFactKeys.length <= 4);
      for (const key of row.developmentFactKeys) {
        assert.equal(DEVELOPMENT_FACT_KEYS.includes(key), true, key);
      }
      if (row.comparisonKey) {
        assert.equal(COMPARISON_KEYS.includes(row.comparisonKey), true, row.comparisonKey);
      }
    }
  });

  it('every illustration key resolves to a WebP asset', () => {
    const needed = new Set(
      PREGNANCY_WEEK_CATALOG.map((row) => row.illustrationKey).filter(Boolean),
    );
    needed.add('placeholder');
    for (const key of needed) {
      const file = join(ROOT, `${key}.webp`);
      assert.equal(existsSync(file), true, file);
    }
    for (const key of COMPARISON_KEYS) {
      assert.equal(existsSync(join(ROOT, `${key}.webp`)), true, key);
    }
  });
});

describe('Pregnancy week copy keys', () => {
  it('translates every comparison and fact key', async () => {
    const copy = await import('./pregnancyWeekCopy.js');
    for (const key of COMPARISON_KEYS) {
      assert.equal(Boolean(copy.PREGNANCY_COMPARISON_KA[key]), true, key);
      assert.equal(Boolean(copy.PREGNANCY_COMPARISON_LINE_KA[key]), true, key);
      assert.match(copy.PREGNANCY_COMPARISON_LINE_KA[key], /დაახლოებით/);
    }
    for (const key of DEVELOPMENT_FACT_KEYS) {
      assert.equal(Boolean(copy.PREGNANCY_FACT_KA[key]), true, key);
    }
  });
});

describe('Catalog lookup consumes completed week only', () => {
  it('maps 8 weeks + 6 days convention to catalog week 8 when given week 8', () => {
    const row = weekDevelopmentForCompletedWeek(8);
    assert.equal(row.week, 8);
    assert.equal(row.comparisonKey, 'raspberry');
    assert.equal(row.lengthCm, 1.4);
    assert.equal(row.measurementType, 'CRL');
    assert.equal(row.weightGrams, null);
  });

  it('does not invent a week from elapsed days', () => {
    const beyond = weekDevelopmentForCompletedWeek(44);
    assert.equal(beyond.week, 40);
    assert.equal(beyond.beyondCatalog, true);
    assert.equal(beyond.requestedWeek, 44);
    assert.equal(weekDevelopmentForCompletedWeek(40).beyondCatalog, false);
  });

  it('returns informational rows for weeks 0-3', () => {
    assert.equal(weekDevelopmentForCompletedWeek(0).kind, 'informational');
    assert.equal(weekDevelopmentForCompletedWeek(2).kind, 'informational');
    assert.equal(weekDevelopmentForCompletedWeek(-1), null);
    assert.equal(weekDevelopmentForCompletedWeek(8.5), null);
  });

  it('attachWeekDevelopment uses existing dating week and honors reviewRequired', () => {
    const attached = attachWeekDevelopment({
      reviewRequired: false,
      estimatedGestationalAge: { week: 12, day: 2, dayOfPregnancy: 86, trimester: 1 },
    });
    assert.equal(attached.week, 12);
    assert.equal(attached.comparisonKey, 'lime');
    assert.equal(attached.lengthCm, 5.6);
    assert.equal(
      attachWeekDevelopment({
        reviewRequired: true,
        estimatedGestationalAge: { week: 12, day: 0 },
      }),
      null,
    );
    assert.equal(attachWeekDevelopment({ reviewRequired: false, estimatedGestationalAge: null }), null);
  });
});

describe('Display formatting avoids false precision', () => {
  it('formats CRL as one decimal under 10 cm and WHO grams then kg', () => {
    assert.equal(formatLengthCm(1.4), '1.4');
    assert.equal(formatLengthCm(12), '12');
    assert.equal(formatLengthCm(25), '25');
    assert.deepEqual(formatWeightGrams(90), { value: 90, unit: 'g' });
    assert.deepEqual(formatWeightGrams(1189), { value: 1.2, unit: 'kg' });
    assert.equal(formatLengthCm(null), null);
    assert.equal(formatWeightGrams(null), null);
  });
});
