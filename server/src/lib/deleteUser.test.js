import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'deleteUser.js'), 'utf8');

// IR-12: deleteUserAccount runs against this in-memory database (src/lib/prisma.js reuses
// globalThis.__medicardPrisma; node --test runs each file in its own process). Only SmsLog keeps rows.
const smsRows = [];
const operations = [];
function rowMatches(row, where) {
  if (where.OR) return where.OR.some((part) => rowMatches(row, part));
  if (where.AND) return where.AND.every((part) => rowMatches(row, part));
  return Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond && !cond.in.includes(row[key])) return false;
      if ('gt' in cond && !(row[key] > cond.gt)) return false;
      return true;
    }
    return row[key] === cond;
  });
}
const model = (name) => ({
  findMany: async () => [],
  updateMany: async () => { operations.push(`${name}.updateMany`); return { count: 0 }; },
  deleteMany: async () => { operations.push(`${name}.deleteMany`); return { count: 0 }; },
});
globalThis.__medicardPrisma = {
  user: {
    findUnique: async ({ where }) => (where.id === 'u1' ? { id: 'u1', fullName: 'Nino', email: 'u1@phone.medicard.ge', phone: '+995555123456', _count: { records: 0, chats: 0, medications: 0 } } : null),
    delete: async () => { operations.push('user.delete'); return {}; },
  },
  cyclePartnerShare: model('cyclePartnerShare'),
  cycleProfile: model('cycleProfile'),
  medicalRecord: model('medicalRecord'),
  pet: model('pet'),
  dailyUsage: model('dailyUsage'),
  phoneVerification: model('phoneVerification'),
  aiEvalResult: model('aiEvalResult'),
  pushEvent: model('pushEvent'),
  smsLog: {
    findMany: async ({ where, distinct }) => {
      const rows = smsRows.filter((row) => rowMatches(row, where));
      return distinct ? [...new Set(rows.map((row) => row.destination))].map((destination) => ({ destination })) : rows;
    },
    updateMany: async ({ where, data }) => {
      const rows = smsRows.filter((row) => rowMatches(row, where));
      for (const row of rows) Object.assign(row, data);
      return { count: rows.length };
    },
    count: async ({ where }) => smsRows.filter((row) => rowMatches(row, where)).length,
  },
  $queryRaw: async () => [],
  $executeRaw: async () => 0,
  $transaction: async (work) => (typeof work === 'function' ? work(globalThis.__medicardPrisma) : Promise.all(work)),
};

describe('account-deletion SMS retention', () => {
  it('redacts SmsLog content instead of only nulling userId', () => {
    assert.match(src, /export const SMS_LOG_REDACTED_CONTENT = '\[redacted\]'/);
    assert.match(src, /smsLogAccountDeletePatch\(destination\)/);
    assert.match(src, /content: SMS_LOG_REDACTED_CONTENT/);
    assert.doesNotMatch(
      src,
      /smsLog\.updateMany\(\{ where: \{ userId \}, data: \{ userId: null \} \}\)/,
    );
  });
});

// Evaluates the Prisma `where` shapes accountPhoneRowsWhere builds (OR / equality / { in }).
function matches(row, where) {
  if (where.OR) return where.OR.some((part) => matches(row, part));
  return Object.entries(where).every(([key, cond]) => (cond && typeof cond === 'object' && 'in' in cond ? cond.in.includes(row[key]) : row[key] === cond));
}

describe('account deletion reaches the sign-in SMS rows of the number (auth-05)', () => {
  it('matches the digits-only number the SMS rows store, not only User.phone’s +995 spelling', async () => {
    const { accountPhoneRowsWhere } = await import('./deleteUser.js');
    const where = accountPhoneRowsWhere('u1', '+995555123456');
    const smsRows = [
      { id: 'sign-in code', userId: null, destination: '995555123456' },
      { id: 'own link code', userId: 'u1', destination: '995555123456' },
      { id: 'legacy +995 row', userId: null, destination: '+995555123456' },
      { id: 'another number', userId: null, destination: '995555999999' },
      { id: 'another account, same number', userId: 'u2', destination: '995555123456' },
    ];
    assert.deepEqual(smsRows.filter((row) => matches(row, where.smsLog)).map((row) => row.id), ['sign-in code', 'own link code', 'legacy +995 row']);
    const codes = [
      { id: 'sign-in code', userId: null, phone: '995555123456' },
      { id: 'another number', userId: null, phone: '995555999999' },
      { id: 'another account, same number', userId: 'u2', phone: '995555123456' },
    ];
    assert.deepEqual(codes.filter((row) => matches(row, where.phoneVerification)).map((row) => row.id), ['sign-in code']);
  });

  it('an account without a phone only touches its own rows', async () => {
    const { accountPhoneRowsWhere } = await import('./deleteUser.js');
    const where = accountPhoneRowsWhere('u1', null);
    assert.deepEqual(where.smsLog, { OR: [{ userId: 'u1' }] });
    assert.deepEqual(where.phoneVerification, { OR: [{ userId: 'u1' }] });
  });

  it('deleteUserAccount uses those rows and removes add-email codes (EmailVerification has no foreign key)', () => {
    assert.match(src, /prisma\.phoneVerification\.deleteMany\(\{ where: phoneRows\.phoneVerification \}\)/);
    assert.match(src, /prisma\.smsLog\.updateMany\(\{ where: \{ AND: \[phoneRows\.smsLog, \{ destination \}\] \}, data: smsLogAccountDeletePatch\(destination\) \}\)/);
    assert.match(src, /to_regclass\('"EmailVerification"'\)/);
    assert.match(src, /DELETE FROM "EmailVerification" WHERE "userId" = \$\{userId\}/);
  });
});

describe('account deletion keeps the per-number SMS-code cap (IR-12)', () => {
  it('a number’s codes still count after its account is deleted, and no row keeps the number', async () => {
    const { deleteUserAccount } = await import('./deleteUser.js');
    const { SMS_OTP_PER_NUMBER_DAILY, otpCapReached, smsDestinationHash } = await import('./sms.js');
    const sent = (destination, userId = null) => ({ destination, userId, purpose: 'OTP', status: 'SENT', content: 'Medicard: ••••', reference: 'r', providerMsg: 'ok', createdAt: new Date() });
    smsRows.length = 0;
    smsRows.push(...Array.from({ length: SMS_OTP_PER_NUMBER_DAILY - 1 }, () => sent('995555123456')));
    smsRows.push(sent('995555777777', 'u1')); // a link code this account sent to another number
    smsRows.push(sent('995555123456', 'u1'));
    smsRows.push(sent('995555000000', 'u2')); // another account: untouched
    assert.equal(await otpCapReached('995555123456', globalThis.__medicardPrisma), 'number');

    const result = await deleteUserAccount('u1');
    assert.equal(result.ok, true);
    assert.ok(operations.includes('user.delete'));
    // The cap still holds for her number (8 codes today) and counts the other number's code too.
    assert.equal(await otpCapReached('995555123456', globalThis.__medicardPrisma), 'number');
    assert.equal(smsRows.filter((row) => row.destination === smsDestinationHash('995555777777')).length, 1);
    const own = smsRows.filter((row) => row.userId !== 'u2');
    for (const row of own) {
      assert.doesNotMatch(row.destination, /\d/, 'no readable number is left');
      assert.equal(row.userId, null);
      assert.equal(row.content, '[redacted]');
      assert.equal(row.reference, null);
      assert.equal(row.providerMsg, null);
    }
    assert.deepEqual(smsRows.filter((row) => row.userId === 'u2').map((row) => row.destination), ['995555000000']);
  });

  it('without a number the patch falls back to „[deleted]“', async () => {
    const { smsLogAccountDeletePatch } = await import('./deleteUser.js');
    assert.equal(smsLogAccountDeletePatch().destination, '[deleted]');
    assert.equal(smsLogAccountDeletePatch('[deleted]').destination, '[deleted]');
  });
});
