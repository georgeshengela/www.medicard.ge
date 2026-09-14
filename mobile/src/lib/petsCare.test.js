import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { completeLabel, kindLabel, petsCareErrorKind, summarizePlanKa } from './petsCare.js';
import { ka } from '../i18n/ka.ts';

describe('pets care mobile helpers', () => {
  it('does not treat care 503 as empty history', () => {
    const error = { status: 503, schemaReady: false, careSchemaReady: false, isCareSchemaUnavailable: true };
    assert.equal(petsCareErrorKind(error), 'unavailable');
    assert.notEqual(petsCareErrorKind(error), 'error');
  });

  it('uses category-appropriate completion labels', () => {
    assert.equal(completeLabel('MEDICATION', ka.pets), 'მივეცი');
    assert.equal(completeLabel('VACCINATION', ka.pets), 'გაკეთდა');
    assert.equal(kindLabel('FLEA_TICK', ka.pets), 'რწყილი / ტკიპა');
  });

  it('summarizes a recurring plan without claiming reminders or protection', () => {
    const text = summarizePlanKa(
      {
        kind: 'FLEA_TICK',
        title: 'ბრუვექტო',
        productName: 'ბრუვექტო',
        startOn: '2026-09-20',
        recurrenceKind: 'EVERY_N_MONTHS',
        intervalCount: 1,
        recurrenceBasis: 'FIXED_CALENDAR',
      },
      ka.pets,
      (ymd) => ymd,
    );
    assert.match(text, /ბრუვექტო/);
    assert.match(text, /2026-09-20/);
    assert.match(text, /კალენდარული/);
    assert.match(text, /არა გარანტირებული დაცვა/);
    assert.match(text, /შეხსენება ამ გეგმაზე გამორთულია/);
    assert.equal(/Nightingale/i.test(text), false);
  });
});
