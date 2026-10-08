import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SMS_OTP_PER_NUMBER_DAILY, otpCapReached } from './sms.js';

// SmsLog rows in memory; `count` honours the where clauses otpCapReached builds.
function fakeLogs(rows) {
  const matches = (row, where) =>
    Object.entries(where).every(([key, cond]) => {
      if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('gt' in cond && !(row[key] > cond.gt)) return false;
        if ('in' in cond && !cond.in.includes(row[key])) return false;
        return true;
      }
      return row[key] === cond;
    });
  return { smsLog: { count: async ({ where }) => rows.filter((row) => matches(row, where)).length } };
}

const log = (status, destination = '995555123456') => ({ destination, purpose: 'OTP', status, createdAt: new Date() });

describe('otpCapReached', () => {
  it('failed sends during a provider outage do not use up the number’s daily allowance', async () => {
    const rows = Array.from({ length: SMS_OTP_PER_NUMBER_DAILY }, () => log('FAILED'));
    assert.equal(await otpCapReached('995555123456', fakeLogs(rows)), null);
  });

  it('sent and queued codes still count toward the per-number cap', async () => {
    const rows = [
      ...Array.from({ length: SMS_OTP_PER_NUMBER_DAILY - 1 }, () => log('SENT')),
      log('QUEUED'),
      log('FAILED'),
    ];
    assert.equal(await otpCapReached('995555123456', fakeLogs(rows)), 'number');
  });

  it('the service-wide fuse also ignores failed sends', async () => {
    const prev = process.env.SMS_OTP_DAILY_CAP;
    process.env.SMS_OTP_DAILY_CAP = '3';
    try {
      const failed = [log('FAILED', '995555000001'), log('FAILED', '995555000002'), log('FAILED', '995555000003')];
      assert.equal(await otpCapReached('995555123456', fakeLogs(failed)), null);
      const sent = [log('SENT', '995555000001'), log('SENT', '995555000002'), log('QUEUED', '995555000003')];
      assert.equal(await otpCapReached('995555123456', fakeLogs(sent)), 'service');
    } finally {
      if (prev === undefined) delete process.env.SMS_OTP_DAILY_CAP;
      else process.env.SMS_OTP_DAILY_CAP = prev;
    }
  });
});
