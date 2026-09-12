'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { gardenCopy, gardenCopyTables, GARDEN_COPY_KEYS, gardenReactionText } = require('./garden.js');

describe('Medi World garden i18n parity', () => {
  it('keeps the same keys in ka, en, fr, and ru', () => {
    const tables = gardenCopyTables();
    for (const locale of ['ka', 'en', 'fr', 'ru']) {
      assert.deepEqual(Object.keys(tables[locale]).sort(), [...GARDEN_COPY_KEYS].sort());
    }
  });

  it('uses warm return language and never punishes inactivity', () => {
    assert.match(gardenCopy('ka').returned_after_inactivity, /პროგრესი შეინარჩუნა/);
    assert.match(gardenCopy('en').returned_after_inactivity, /kept your progress/);
    assert.equal(gardenCopy('ka').empty.includes('unhealthy'), false);
    assert.equal(gardenCopy('en').empty.toLowerCase().includes('missed'), false);
    assert.equal(gardenReactionText('en', 'returned_after_inactivity').toLowerCase().includes('dying'), false);
    assert.equal(gardenReactionText('ka', 'insufficient_energy').includes('hungry'), false);
  });
});
