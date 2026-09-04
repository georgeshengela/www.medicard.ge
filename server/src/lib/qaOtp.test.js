import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveQaCodes } from './qaOtpCodes.js';

describe('resolveQaCodes', () => {
  it('defaults to 0000 / 000000 when env is empty', () => {
    const codes = resolveQaCodes('');
    assert.equal(codes.enabledByEnv, false);
    assert.equal(codes.phone, '0000');
    assert.equal(codes.email, '000000');
  });

  it('uses a 4-digit env code for phone and pads email', () => {
    const codes = resolveQaCodes('0000');
    assert.equal(codes.enabledByEnv, true);
    assert.equal(codes.phone, '0000');
    assert.equal(codes.email, '000000');
  });

  it('uses a 6-digit env code for email only', () => {
    const codes = resolveQaCodes('654321');
    assert.equal(codes.enabledByEnv, true);
    assert.equal(codes.phone, '0000');
    assert.equal(codes.email, '654321');
  });

  it('ignores non-digit values', () => {
    assert.equal(resolveQaCodes('abcd').enabledByEnv, false);
    assert.equal(resolveQaCodes('12').enabledByEnv, false);
  });
});
