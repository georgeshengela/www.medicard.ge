'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { movementCopy, movementCopyTables, MOVEMENT_COPY_KEYS, movementMediLine } = require('./movement.js');

describe('Movement i18n parity', () => {
  it('keeps the same keys in ka, en, fr, and ru', () => {
    const tables = movementCopyTables();
    for (const locale of ['ka', 'en', 'fr', 'ru']) {
      assert.deepEqual(Object.keys(tables[locale]).sort(), [...MOVEMENT_COPY_KEYS].sort());
    }
  });

  it('keeps Georgian and English copy non-medical and non-shameful', () => {
    assert.match(movementCopy('ka').introTitle, /Medi/);
    assert.match(movementCopy('en').safetyNotPrescription, /not prescribing exercise/i);
    assert.equal(movementCopy('en').mediNone.toLowerCase().includes('fail'), true);
    assert.equal(movementCopy('en').noShame.toLowerCase().includes('fail'), false);
    assert.equal(movementCopy('ka').gentleHint.includes('მკურნალობა'), true);
    assert.notEqual(movementCopy('en').reanchor, movementCopy('en').lowGps);
    assert.notEqual(movementCopy('en').reanchor, movementCopy('en').backgroundReturn);
    assert.match(movementMediLine('en', 'reanchor'), /not counted/i);
    assert.match(movementCopy('ka').lowGps, /ზუსტი არ არის/);
  });
});
