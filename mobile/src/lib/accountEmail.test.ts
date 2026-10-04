import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { displayEmail, isSyntheticEmail } from './accountEmail.ts';

describe('accountEmail', () => {
  it('hides phone and Apple synthetic logins', () => {
    assert.equal(isSyntheticEmail('995599123456@phone.medicard.ge'), true);
    assert.equal(isSyntheticEmail('apple.3f9a@APPLE.medicard.ge'), true);
    assert.equal(displayEmail('995599123456@phone.medicard.ge'), null);
  });
  it('keeps real addresses, including our own domain', () => {
    assert.equal(displayEmail(' nino@example.com '), 'nino@example.com');
    assert.equal(displayEmail('support@medicard.ge'), 'support@medicard.ge');
    assert.equal(displayEmail(''), null);
    assert.equal(displayEmail(null), null);
  });
});
