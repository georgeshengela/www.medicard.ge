'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { companionCopy, companionCopyTables, COMPANION_COPY_KEYS } = require('./companion.js');

describe('Medi Companion i18n parity', () => {
  it('keeps the same keys in ka, en, fr, and ru', () => {
    const tables = companionCopyTables();
    for (const locale of ['ka', 'en', 'fr', 'ru']) {
      assert.deepEqual(Object.keys(tables[locale]).sort(), [...COMPANION_COPY_KEYS].sort());
    }
  });

  it('uses natural Georgian return language', () => {
    assert.match(companionCopy('ka').returned_after_inactivity, /სასიამოვნოა/);
    assert.match(companionCopy('en').returned_after_inactivity, /Nice to see you/);
    assert.equal(companionCopy('ka').returned_after_inactivity.includes('failed'), false);
    assert.equal(companionCopy('en').careMomentBody.includes('exercise occurred'), false);
  });
});
