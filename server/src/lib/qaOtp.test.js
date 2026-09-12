import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveQaCodes } from './qaOtpCodes.js';
import { qaMasterCodeAllowed, qaOtpEnabledForEnv } from './qaOtp.js';

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

describe('qaOtpEnabledForEnv production fail-closed', () => {
  it('is false in production even when DB flag and env code are set', () => {
    assert.equal(qaOtpEnabledForEnv('production', true, true), false);
    assert.equal(qaOtpEnabledForEnv('production', false, true), false);
    assert.equal(qaOtpEnabledForEnv('production', true, false), false);
  });

  it('allows non-production when the DB flag or env code is on', () => {
    assert.equal(qaOtpEnabledForEnv('development', false, true), true);
    assert.equal(qaOtpEnabledForEnv('development', true, false), true);
    assert.equal(qaOtpEnabledForEnv('development', false, false), false);
  });

  it('never matches master codes when the switch is off', () => {
    assert.equal(qaMasterCodeAllowed(false, '0000', '0000'), false);
    assert.equal(qaMasterCodeAllowed(false, '000000', '000000'), false);
    assert.equal(qaMasterCodeAllowed(true, '0000', '0000'), true);
  });
});
