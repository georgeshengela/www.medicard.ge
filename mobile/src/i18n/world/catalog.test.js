'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { worldCopy, worldCopyTables, WORLD_COPY_KEYS } = require('./catalog.js');

describe('Medi World i18n parity', () => {
  it('keeps the same keys in ka, en, fr, and ru', () => {
    const tables = worldCopyTables();
    for (const locale of ['ka', 'en', 'fr', 'ru']) {
      assert.deepEqual(Object.keys(tables[locale]).sort(), [...WORLD_COPY_KEYS].sort());
    }
  });

  it('returns Georgian and English product copy', () => {
    assert.match(worldCopy('ka').productLine, /ქალაქ/);
    assert.match(worldCopy('en').productLine, /city back to life/i);
    assert.equal(worldCopy('ka').title, 'Medi World');
    assert.equal(worldCopy('en').awakening.toLowerCase().includes('awaken'), true);
  });

  it('falls back to Georgian for unknown locales', () => {
    assert.equal(worldCopy('xx').locale, 'ka');
    assert.equal(worldCopy('xx').title, worldCopy('ka').title);
  });
});
