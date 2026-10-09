import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { requestPhoneOtp } from './phoneOtp.js';

const PHONE = '+995555123456';
const DIGITS = '995555123456';
const SMS_FAILED_KA = 'SMS გაგზავნა ვერ მოხერხდა.';

// In-memory PhoneVerification table that understands the where clauses phoneOtp.js uses.
function fakeDb(rows = []) {
  let seq = 0;
  const table = rows.map((row) => ({ attempts: 0, usedAt: null, userId: null, ...row }));
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, cond]) => {
      const value = row[key];
      if (cond === null) return value === null || value === undefined;
      if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('gt' in cond && !(value > cond.gt)) return false;
        if ('lt' in cond && !(value < cond.lt)) return false;
        if ('not' in cond && value === cond.not) return false;
        return true;
      }
      return value === cond;
    });
  const db = {
    table,
    phoneVerification: {
      async findFirst({ where }) {
        return table.filter((row) => matches(row, where)).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
      },
      async updateMany({ where, data }) {
        const hit = table.filter((row) => matches(row, where));
        hit.forEach((row) => Object.assign(row, data));
        return { count: hit.length };
      },
      async update({ where, data }) {
        const row = table.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      },
      async create({ data }) {
        seq += 1;
        const row = { id: `new-${seq}`, attempts: 0, usedAt: null, createdAt: new Date(Date.now() - 1000 + seq), ...data };
        table.push(row);
        return row;
      },
    },
  };
  return db;
}

/** A code that was really delivered five minutes ago and is still valid. */
const deliveredRow = () => ({
  id: 'delivered',
  phone: DIGITS,
  purpose: 'AUTH',
  codeHash: 'x',
  reference: 'otp-AUTH-old',
  createdAt: new Date(Date.now() - 5 * 60 * 1000),
  expiresAt: new Date(Date.now() + 5 * 60 * 1000),
});

const active = (db) => db.table.filter((row) => row.usedAt == null && row.expiresAt > new Date());
const prod = (db, send) => ({ db, send, production: true, qaEnabled: async () => false });

describe('requestPhoneOtp when the SMS does not go out', () => {
  it('provider failure: localized error, earlier code still works, nothing new is active', async () => {
    const db = fakeDb([deliveredRow()]);
    const result = await requestPhoneOtp(
      { phone: PHONE, purpose: 'AUTH', lang: 'ka' },
      prod(db, async () => ({ ok: false, reference: 'r', errorCode: 30, message: 'Insufficient balance (provider)' })),
    );
    assert.equal(result.ok, false);
    assert.equal(result.status, 502);
    assert.equal(result.error, SMS_FAILED_KA);
    assert.deepEqual(active(db).map((r) => r.id), ['delivered']);
  });

  it('English requests get the English failure text, never the provider message', async () => {
    const db = fakeDb();
    const result = await requestPhoneOtp(
      { phone: PHONE, lang: 'en' },
      prod(db, async () => ({ ok: false, message: 'Balance exhausted' })),
    );
    assert.equal(result.error, "We couldn't send the SMS.");
  });

  it('thrown send: 502 and no unsent code left active', async () => {
    const db = fakeDb([deliveredRow()]);
    const result = await requestPhoneOtp({ phone: PHONE, lang: 'ka' }, prod(db, async () => { throw new Error('timeout'); }));
    assert.equal(result.status, 502);
    assert.equal(result.error, SMS_FAILED_KA);
    assert.deepEqual(active(db).map((r) => r.id), ['delivered']);
  });

  it('daily cap: 429 with the cap text and the delivered code is not voided', async () => {
    const db = fakeDb([deliveredRow()]);
    const capText = 'SMS კოდების დღიური ლიმიტი ამოიწურა. სცადე მოგვიანებით ან დაგვიკავშირდი.';
    const result = await requestPhoneOtp(
      { phone: PHONE, lang: 'ka' },
      prod(db, async () => ({ ok: false, reference: 'r', message: capText, capped: 'number' })),
    );
    assert.equal(result.status, 429);
    assert.equal(result.error, capText);
    assert.deepEqual(active(db).map((r) => r.id), ['delivered']);
  });

  it('a retry right after a failed send sends again instead of claiming „code sent“', async () => {
    const db = fakeDb();
    let sends = 0;
    const failing = async () => { sends += 1; return { ok: false, message: 'down' }; };
    await requestPhoneOtp({ phone: PHONE, lang: 'ka' }, prod(db, failing));
    const again = await requestPhoneOtp({ phone: PHONE, lang: 'ka' }, prod(db, async () => { sends += 1; return { ok: true, reference: 'r' }; }));
    assert.equal(sends, 2);
    assert.equal(again.ok, true);
    assert.equal(again.cooldownSec, undefined);
  });
});

describe('requestPhoneOtp when the SMS goes out', () => {
  it('voids the earlier code, keeps the new one and answers in the old shape', async () => {
    const db = fakeDb([deliveredRow()]);
    const result = await requestPhoneOtp({ phone: PHONE, purpose: 'AUTH', lang: 'ka' }, prod(db, async () => ({ ok: true, reference: 'r' })));
    assert.deepEqual(Object.keys(result).sort(), ['masked', 'message', 'ok', 'phone', 'reference', 'sent']);
    assert.equal(result.ok, true);
    assert.equal(result.sent, true);
    assert.equal(result.phone, `+${DIGITS}`);
    const live = active(db);
    assert.equal(live.length, 1);
    assert.notEqual(live[0].id, 'delivered');
    assert.equal(live[0].reference, result.reference);
  });

  it('a second request within a minute is the cooldown answer and sends nothing', async () => {
    const db = fakeDb();
    let sends = 0;
    const ok = async () => { sends += 1; return { ok: true, reference: 'r' }; };
    await requestPhoneOtp({ phone: PHONE, lang: 'ka' }, prod(db, ok));
    const again = await requestPhoneOtp({ phone: PHONE, lang: 'ka' }, prod(db, ok));
    assert.equal(sends, 1);
    assert.equal(again.ok, true);
    assert.equal(again.sent, true);
    assert.ok(again.cooldownSec > 0 && again.cooldownSec <= 60);
  });

  it('never voids a code created after this one (two requests racing)', async () => {
    const db = fakeDb();
    const result = await requestPhoneOtp(
      { phone: PHONE, lang: 'ka' },
      prod(db, async () => {
        // A parallel request created its own code while this SMS was in flight.
        db.table.push({ id: 'newer', phone: DIGITS, purpose: 'AUTH', codeHash: 'y', usedAt: null, attempts: 0, createdAt: new Date(Date.now() + 60_000), expiresAt: new Date(Date.now() + 10 * 60_000) });
        return { ok: true, reference: 'r' };
      }),
    );
    assert.equal(result.ok, true);
    assert.ok(active(db).some((r) => r.id === 'newer'));
  });

  it('development keeps the code usable through devCode even when the SMS failed', async () => {
    const db = fakeDb();
    const result = await requestPhoneOtp(
      { phone: PHONE, lang: 'ka' },
      { db, send: async () => ({ ok: false, message: 'not configured', dev: true }), production: false, qaEnabled: async () => false },
    );
    assert.equal(result.ok, true);
    assert.match(result.devCode, /^\d{4}$/);
    assert.equal(active(db).length, 1);
  });

  it('the voided purpose is scoped: a LINK code does not touch AUTH codes', async () => {
    const db = fakeDb([deliveredRow()]);
    await requestPhoneOtp({ phone: PHONE, purpose: 'LINK', lang: 'ka' }, prod(db, async () => ({ ok: true })));
    assert.ok(active(db).some((r) => r.id === 'delivered'));
  });
});
