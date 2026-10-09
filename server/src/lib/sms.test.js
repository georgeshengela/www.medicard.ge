import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../config/env.js';
import { SMS_OTP_PER_NUMBER_DAILY, adminSmsLogView, buildOtpMessage, maskOtpDigits, otpCapReached, sendSms, smsDestinationHash } from './sms.js';

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

// IR-12: deleting the account must not reset the number's daily cap, and must not keep the number.
describe('a deleted account’s SMS rows keep counting without the number', () => {
  it('every spelling of one number gets the same keyed hash, which holds no digits', () => {
    const hash = smsDestinationHash('995555123456');
    assert.match(hash, /^h:[a-p]{32}$/);
    assert.equal(smsDestinationHash('+995555123456'), hash);
    assert.equal(smsDestinationHash('555123456'), hash);
    assert.equal(smsDestinationHash('+995 555 12 34 56'), hash);
    assert.notEqual(smsDestinationHash('995555123457'), hash);
    assert.equal(smsDestinationHash(''), null);
    assert.equal(smsDestinationHash('[deleted]'), null);
  });

  it('hashed rows still count toward the per-number cap; older „[deleted]“ rows do not', async () => {
    const hashed = Array.from({ length: SMS_OTP_PER_NUMBER_DAILY }, () => log('SENT', smsDestinationHash('995555123456')));
    assert.equal(await otpCapReached('995555123456', fakeLogs(hashed)), 'number');
    const mixed = [...hashed.slice(0, 4), ...Array.from({ length: SMS_OTP_PER_NUMBER_DAILY - 4 }, () => log('SENT'))];
    assert.equal(await otpCapReached('995555123456', fakeLogs(mixed)), 'number');
    assert.equal(await otpCapReached('995555999999', fakeLogs(hashed)), null);
    const legacy = Array.from({ length: SMS_OTP_PER_NUMBER_DAILY }, () => log('SENT', '[deleted]'));
    assert.equal(await otpCapReached('995555123456', fakeLogs(legacy)), null);
  });

  it('the admin journal shows a hashed number as „[deleted]“, never the hash', () => {
    const row = { id: 'c', purpose: 'OTP', content: 'Medicard: ••••', destination: smsDestinationHash('995555123456') };
    assert.equal(adminSmsLogView(row).destination, '[deleted]');
    const admin = { id: 'd', purpose: 'ADMIN', content: 'Hello', destination: smsDestinationHash('995555123456') };
    assert.equal(adminSmsLogView(admin).destination, '[deleted]');
    assert.equal(adminSmsLogView(admin).content, 'Hello');
  });
});

describe('OTP codes never sit in the SMS journal (auth-06)', () => {
  function journal() {
    const rows = [];
    return {
      rows,
      smsLog: {
        count: async () => 0,
        create: async ({ data }) => { const row = { id: `log-${rows.length + 1}`, ...data }; rows.push(row); return row; },
        update: async ({ where, data }) => Object.assign(rows.find((row) => row.id === where.id), data),
      },
    };
  }

  it('masks the code in both languages and leaves the rest of the text', () => {
    assert.equal(maskOtpDigits(buildOtpMessage('4821', 'ka')), 'Medicard: შენი დამადასტურებელი კოდია ••••. ვადა 10 წუთი.');
    assert.equal(maskOtpDigits(buildOtpMessage('4821', 'en')), 'Medicard: your verification code is ••••. Valid for 10 minutes.');
    assert.equal(maskOtpDigits(null), '');
  });

  it('the provider gets the real code, SmsLog only the masked text', async () => {
    const db = journal();
    const previousKey = env.SMS_OFFICE_API_KEY;
    const previousFetch = globalThis.fetch;
    let providerBody = '';
    env.SMS_OFFICE_API_KEY = 'test-key';
    globalThis.fetch = async (_url, init) => {
      providerBody = new URLSearchParams(init.body).get('content');
      return new Response(JSON.stringify({ Success: true, ErrorCode: 0, Message: 'ok' }));
    };
    try {
      const sent = await sendSms({ destination: '+995555123456', content: buildOtpMessage('4821', 'ka'), purpose: 'OTP' }, { db });
      assert.equal(sent.ok, true);
    } finally {
      env.SMS_OFFICE_API_KEY = previousKey;
      globalThis.fetch = previousFetch;
    }
    assert.match(providerBody, /4821/);
    assert.equal(db.rows.length, 1);
    assert.doesNotMatch(db.rows[0].content, /4821/);
    assert.match(db.rows[0].content, /••••/);
    assert.equal(db.rows[0].status, 'SENT');
  });

  it('admin and marketing messages are logged as written', async () => {
    const db = journal();
    await sendSms({ destination: '995555123456', content: 'Visit 2026 at 1430', purpose: 'ADMIN' }, { db });
    assert.equal(db.rows[0].content, 'Visit 2026 at 1430');
  });

  it('the admin API masks OTP rows written before this change and nothing else', () => {
    const legacy = { id: 'a', purpose: 'OTP', content: buildOtpMessage('9137', 'en'), destination: '995555123456' };
    const admin = { id: 'b', purpose: 'ADMIN', content: 'Code 9137 for the gate', destination: '995555123456' };
    assert.doesNotMatch(adminSmsLogView(legacy).content, /9137/);
    assert.equal(adminSmsLogView(legacy).destination, '995555123456');
    assert.equal(adminSmsLogView(admin), admin);
  });
});
