'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { adventureCopy, adventureCopyTables, ADVENTURE_COPY_KEYS } = require('./adventure.js');

describe('Adventure i18n parity', () => {
  it('keeps the same keys in ka, en, fr, and ru', () => {
    const tables = adventureCopyTables();
    for (const locale of ['ka', 'en', 'fr', 'ru']) {
      assert.deepEqual(Object.keys(tables[locale]).sort(), [...ADVENTURE_COPY_KEYS].sort());
    }
  });

  it('uses warm non-medical copy in Georgian and English', () => {
    assert.match(adventureCopy('ka').greeting, /გზა/);
    assert.match(adventureCopy('en').greeting, /path is ready/i);
    assert.equal(adventureCopy('ka').rest.includes('failed'), false);
    assert.equal(adventureCopy('en').rest.toLowerCase().includes('lazy'), false);
    assert.equal(adventureCopy('en').recovery.includes('punish'), false);
  });
});
