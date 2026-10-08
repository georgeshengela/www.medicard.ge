import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'deleteUser.js'), 'utf8');

describe('account-deletion SMS retention', () => {
  it('redacts SmsLog content instead of only nulling userId', () => {
    assert.match(src, /export const SMS_LOG_REDACTED_CONTENT = '\[redacted\]'/);
    assert.match(src, /smsLogAccountDeletePatch\(\)/);
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
    assert.match(src, /prisma\.smsLog\.updateMany\(\{ where: phoneRows\.smsLog, data: smsLogAccountDeletePatch\(\) \}\)/);
    assert.match(src, /to_regclass\('"EmailVerification"'\)/);
    assert.match(src, /DELETE FROM "EmailVerification" WHERE "userId" = \$\{userId\}/);
  });
});
