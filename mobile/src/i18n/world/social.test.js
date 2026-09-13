'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { socialCopy, socialCopyTables, SOCIAL_COPY_KEYS } = require('./social.js');

describe('Medi World Phase 45 social copy', () => {
  it('keeps ka/en/fr/ru keys aligned and stays non-medical', () => {
    const tables = socialCopyTables();
    for (const locale of ['ka', 'en', 'fr', 'ru']) {
      assert.deepEqual(Object.keys(tables[locale]).sort(), [...SOCIAL_COPY_KEYS].sort());
    }
    assert.match(socialCopy('ka').promise, /ჯანმრთელობის გარეშე/);
    assert.match(socialCopy('en').promise, /without exposing your health/);
    assert.equal(socialCopy('en').introBody.toLowerCase().includes('location'), true);
    assert.equal(socialCopy('en').waveHint.includes('emergency'), true);
    assert.equal(socialCopy('ka').enableSocial.includes('Nightingale'), false);
    assert.equal(socialCopy('ka').addTitle, 'მეგობრის დამატება');
    assert.equal(socialCopy('ka').sendRequest, 'მოთხოვნის გაგზავნა');
    assert.equal(socialCopy('ka').socialOff, 'მეგობრების ფუნქცია ამჟამად მიუწვდომელია.');
  });
});
