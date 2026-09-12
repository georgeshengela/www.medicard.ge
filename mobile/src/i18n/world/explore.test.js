'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { exploreCopy, exploreCopyTables, EXPLORE_COPY_KEYS } = require('./explore.js');

describe('Explore i18n parity', () => {
  it('keeps the same keys in ka, en, fr, and ru', () => {
    const tables = exploreCopyTables();
    for (const locale of ['ka', 'en', 'fr', 'ru']) {
      assert.deepEqual(Object.keys(tables[locale]).sort(), [...EXPLORE_COPY_KEYS].sort());
    }
  });

  it('keeps Georgian and English safety copy non-legalistic', () => {
    assert.match(exploreCopy('ka').introTitle, /საჯარო/);
    assert.match(exploreCopy('en').introLead, /does not choose a safe walking route/i);
    assert.equal(exploreCopy('en').introLead.toLowerCase().includes('liable'), false);
    assert.equal(exploreCopy('ka').foundCount.includes('XP'), false);
    assert.equal(exploreCopy('en').successBody.toLowerCase().includes('health score'), true);
  });
});
