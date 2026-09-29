import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { suggestEmailFix } from './emailTypo.ts';

describe('suggestEmailFix', () => {
  it('fixes the typo that broke a real password reset', () => {
    assert.equal(suggestEmailFix('george@icoud.com'), 'george@icloud.com');
  });
  it('fixes common gmail typos', () => {
    assert.equal(suggestEmailFix('Nino@GMIAL.com'), 'nino@gmail.com');
    assert.equal(suggestEmailFix('a@gmail.co'), 'a@gmail.com');
    assert.equal(suggestEmailFix('a@gmail.vom'), 'a@gmail.com');
  });
  it('leaves correct and unknown domains alone', () => {
    assert.equal(suggestEmailFix('a@icloud.com'), null);
    assert.equal(suggestEmailFix('a@medicard.ge'), null);
    assert.equal(suggestEmailFix('a@company.co.uk'), null);
    assert.equal(suggestEmailFix('not-an-email'), null);
  });
});
