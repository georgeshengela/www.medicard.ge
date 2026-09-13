'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { formatRateLimitMessage, publicApiErrorMessage } = require('./rateLimitCopy.js');

describe('rate-limit copy', () => {
  it('uses the server wait instead of always saying one minute', () => {
    assert.equal(
      publicApiErrorMessage(429, { error: 'ძალიან ბევრი მოთხოვნა. გთხოვთ, დაელოდოთ ერთ წუთს.', retryAfterSeconds: 12 }, '12', 'fallback'),
      'ძალიან ბევრი მოთხოვნა. გთხოვთ, დაელოდოთ 12 წამს.',
    );
    assert.equal(formatRateLimitMessage(12).includes('ერთ წუთს'), false);
  });

  it('does not rewrite non-429 errors', () => {
    assert.equal(publicApiErrorMessage(400, { error: 'ელ-ფოსტა ან პაროლი არასწორია.' }, null, 'x'), 'ელ-ფოსტა ან პაროლი არასწორია.');
  });
});
