'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { formatRateLimitMessage, publicApiErrorMessage } = require('./rateLimitCopy.js');

describe('rate-limit copy', () => {
  it('uses the server wait instead of always saying one minute', () => {
    assert.equal(
      publicApiErrorMessage(429, { error: 'ძალიან ბევრი მოთხოვნა. გთხოვთ, დაელოდოთ ერთ წუთს.', retryAfterSeconds: 12 }, '12', 'fallback'),
      'ძალიან ბევრი მოთხოვნა. დაელოდე 12 წამს.',
    );
    assert.equal(formatRateLimitMessage(12).includes('ერთ წუთს'), false);
  });

  // Medi chat F9 (2026-10-08): AI limits came out as „დაელოდე 60 წამს“ (no Retry-After) or „დაელოდე 3600 წამს“.
  it('keeps the server text for AI limits the server words itself', () => {
    const busy = 'ანალიზი უკვე მიმდინარეობს. დაელოდე დასრულებას და ხელახლა სცადე.';
    assert.equal(publicApiErrorMessage(429, { error: busy, code: 'AI_BUSY' }, null, 'x'), busy);
    const starts = 'ძალიან ბევრი AI მოთხოვნა. ცოტა ხანში სცადე.';
    assert.equal(publicApiErrorMessage(429, { error: starts, code: 'RATE_LIMITED' }, null, 'x'), starts);
    const cap = 'დღევანდელი ლიმიტი ამოიწურა. ისევ სცადე დაახლოებით 7 საათში.';
    assert.equal(publicApiErrorMessage(429, { error: cap, code: 'AI_DAILY_CAP', retryAfterSeconds: 25000 }, '25000', 'x'), cap);
    const quota = 'You have reached your daily limit. It resets at this time tomorrow.';
    assert.equal(publicApiErrorMessage(429, { error: quota, code: 'DAILY_LIMIT_REACHED' }, null, 'x'), quota);
    assert.equal(publicApiErrorMessage(429, { error: quota, code: 'MONTHLY_LIMIT_REACHED' }, null, 'x'), quota);
  });

  // Review (2026-10-09): RATE_LIMITED is also the generic limiters' code, and those send Retry-After.
  it('a generic limiter with a known wait still reads it, not just „try later“', () => {
    const later = { error: 'ძალიან ბევრი მცდელობა. სცადე მოგვიანებით.', code: 'RATE_LIMITED' };
    assert.equal(publicApiErrorMessage(429, later, '600', 'x'), 'ძალიან ბევრი მოთხოვნა. დაელოდე 10 წუთს.');
    const seconds = { error: 'ძალიან ბევრი მოთხოვნა. დაელოდე 900 წამს.', code: 'RATE_LIMITED', retryAfterSeconds: 900 };
    assert.equal(publicApiErrorMessage(429, seconds, '900', 'x'), 'ძალიან ბევრი მოთხოვნა. დაელოდე 15 წუთს.');
    const aiStarts = { error: 'ძალიან ბევრი AI მოთხოვნა. ცოტა ხანში სცადე.', code: 'RATE_LIMITED', usage: {} };
    assert.equal(publicApiErrorMessage(429, aiStarts, null, 'x'), aiStarts.error);
  });

  it('says long waits in minutes or hours, never thousands of seconds', () => {
    assert.equal(formatRateLimitMessage(90), 'ძალიან ბევრი მოთხოვნა. დაელოდე 90 წამს.');
    assert.equal(formatRateLimitMessage(600), 'ძალიან ბევრი მოთხოვნა. დაელოდე 10 წუთს.');
    assert.equal(formatRateLimitMessage(25000), 'ძალიან ბევრი მოთხოვნა. ისევ სცადე დაახლოებით 7 საათში.');
    assert.equal(publicApiErrorMessage(429, { error: 'ძალიან ბევრი მოთხოვნა.' }, '900', 'x'), 'ძალიან ბევრი მოთხოვნა. დაელოდე 15 წუთს.');
  });

  it('does not rewrite non-429 errors', () => {
    assert.equal(publicApiErrorMessage(400, { error: 'ელ-ფოსტა ან პაროლი არასწორია.' }, null, 'x'), 'ელ-ფოსტა ან პაროლი არასწორია.');
  });
});
