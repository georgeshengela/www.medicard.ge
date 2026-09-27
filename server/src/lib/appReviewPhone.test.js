import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { appReviewPhoneDigits, isAppReviewPhone, matchesAppReviewOtp } from './appReviewPhone.js';

const on = { phone: '+995 555 00 00 01', code: '4821' };

describe('App Review phone sign-in', () => {
  it('is off unless both the number and a 4-digit code are configured', () => {
    assert.equal(appReviewPhoneDigits('', ''), '');
    assert.equal(appReviewPhoneDigits('+995555000001', ''), '');
    assert.equal(appReviewPhoneDigits('', '4821'), '');
    assert.equal(appReviewPhoneDigits('+995555000001', '48210'), '');
    assert.equal(appReviewPhoneDigits('+995555000001', '4821'), '995555000001');
    assert.equal(isAppReviewPhone('+995555000001', { phone: '', code: '' }), false);
  });

  it('matches the review number in any spelling', () => {
    assert.equal(isAppReviewPhone('555000001', on), true);
    assert.equal(isAppReviewPhone('+995 555 000 001', on), true);
    assert.equal(isAppReviewPhone('+995555000002', on), false);
  });

  it('accepts only the review code, and only for the review number', () => {
    assert.equal(matchesAppReviewOtp('+995555000001', '4821', on), true);
    assert.equal(matchesAppReviewOtp('+995555000001', ' 4821 ', on), true);
    assert.equal(matchesAppReviewOtp('+995555000001', '0000', on), false);
    assert.equal(matchesAppReviewOtp('+995555000002', '4821', on), false);
    assert.equal(matchesAppReviewOtp('+995555000001', '4821', { phone: '', code: '' }), false);
  });
});
