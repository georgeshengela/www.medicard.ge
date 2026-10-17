import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { BOOK_REVIEW_DEMO_ID, bookReviewDemoOn, bookReviewDemoRows, canSeeBookReviewDemo, ensureBookReviewDemo, isBookReviewDemo } from './reviewDemo.js';
import { daysWithSlots } from './availability.js';
import { normalizeSettings } from './catalog.js';
import { tbilisiInstant, tbilisiYmd } from './time.js';
import { searchBusinesses, businessDetail } from './store.js';

const REVIEW = { phone: '+995 555 12 34 56', code: '4321' };

test('review demo: only the App Review phone account and team accounts see the demo place', () => {
  assert.equal(canSeeBookReviewDemo({ phone: '+995555123456', email: null }, REVIEW), true);
  assert.equal(canSeeBookReviewDemo({ phone: null, email: 'demo.woman@MEDICARD.ge' }, REVIEW), true);
  assert.equal(canSeeBookReviewDemo({ phone: '+995555000000', email: 'someone@gmail.com' }, REVIEW), false);
  assert.equal(canSeeBookReviewDemo({ phone: null, email: 'x@medicard.ge.evil.com' }, REVIEW), false);
  assert.equal(canSeeBookReviewDemo(null, REVIEW), false);
  // No review number configured: the phone never matches.
  assert.equal(canSeeBookReviewDemo({ phone: '+995555123456' }, { phone: '', code: '' }), false);
  assert.ok(isBookReviewDemo(BOOK_REVIEW_DEMO_ID) && isBookReviewDemo('medicard-demo-studio') && !isBookReviewDemo('bk-31b9b4e11f9e'));
  assert.equal(bookReviewDemoOn({ APP_REVIEW_BOOK_DEMO: ' OFF ' }), false);
  assert.equal(bookReviewDemoOn({}), true);
});

test('review demo: a clearly marked demo with online booking, no prices and no SMS', () => {
  const { business, staff, services } = bookReviewDemoRows();
  assert.match(business.name, /Demo/);
  assert.match(business.nameKa, /დემო/);
  assert.match(business.description, /not a real business/);
  assert.equal(business.phone, undefined);
  const s = normalizeSettings(business.settings);
  assert.equal(s.onlineBooking, true);
  assert.equal(s.autoConfirm, true);
  assert.equal(s.notify.sms.enabled, false);
  assert.equal(s.notify.email.newBooking, false);
  assert.deepEqual(Object.keys(business.hours).sort(), ['0', '1', '2', '3', '4', '5', '6']);
  assert.equal(staff.length, 2);
  assert.ok(services.every((x) => x.price === undefined && x.id.startsWith('bksv-app-review-demo-')));
  assert.ok(staff.every((x) => x.id.startsWith('bks-app-review-demo-')));
});

test('review demo: free times always lie ahead of now — at any hour, on 6–7 of the next 7 days', () => {
  const { business, staff, services } = bookReviewDemoRows();
  const people = staff.map((p) => ({ id: p.id, serviceIds: [], schedule: {}, active: true, bookable: true }));
  for (const service of services) {
    for (const clock of [0, 8 * 60, 13 * 60, 20 * 60 + 30, 23 * 60 + 59]) {
      const now = tbilisiInstant('2026-10-17', clock);
      const days = daysWithSlots({ business, service: { ...service, bufferMin: 0 }, staff: people, appointments: [], timeOff: [], from: tbilisiYmd(now), now, days: 7 });
      const free = days.filter((d) => d.count > 0).length;
      assert.ok(free >= 6, `${service.name} at ${clock}: ${free} free days`);
    }
  }
});

/** A fake db that records the writes; reads answer the probe, the existing row and nothing else. */
function fakeDb({ existing = null } = {}) {
  const writes = [];
  const text = (strings) => strings.join('?');
  return {
    writes,
    async $queryRaw(strings) {
      const sql = text(strings);
      if (sql.includes('to_regclass')) return [{ ok: true }];
      if (sql.includes('FROM "BookBusiness" WHERE id =')) return existing ? [existing] : [];
      throw new Error(`unexpected query ${sql}`);
    },
    async $executeRaw(strings, ...values) {
      writes.push({ sql: text(strings), values });
      return 1;
    },
  };
}
const strip = async ({ businessId }) => {
  assert.equal(businessId, BOOK_REVIEW_DEMO_ID);
  return { days: [1, 1, 1, 0, 1, 1, 1].map((count, i) => ({ date: `d${i}`, count })) };
};

test('review demo pass: writes only the demo ids, stops when hidden or switched off', async () => {
  const now = new Date('2026-10-17T10:00:00Z');
  const off = fakeDb();
  assert.deepEqual(await ensureBookReviewDemo({ db: off, now, env: { APP_REVIEW_BOOK_DEMO: 'off' }, strip }), { skipped: 'off' });
  assert.equal(off.writes.length, 0);

  const hidden = fakeDb({ existing: { id: BOOK_REVIEW_DEMO_ID, status: 'HIDDEN' } });
  assert.deepEqual(await ensureBookReviewDemo({ db: hidden, now, env: {}, strip }), { skipped: 'hidden' });
  assert.equal(hidden.writes.length, 0);

  const fresh = fakeDb();
  assert.deepEqual(await ensureBookReviewDemo({ db: fresh, now, env: {}, strip }), { created: true, written: 6, freeDays: 6 });
  assert.equal(fresh.writes.length, 6);
  assert.match(fresh.writes[0].sql, /^INSERT INTO "BookBusiness"/);
  assert.match(fresh.writes[0].sql, /WHERE "BookBusiness".status <> 'HIDDEN'/);
  for (const w of fresh.writes) {
    assert.ok(w.values.some((v) => v === BOOK_REVIEW_DEMO_ID), 'every write names the demo place');
    assert.match(w.sql, /ON CONFLICT \(id\) DO UPDATE/);
  }
  for (const w of fresh.writes.slice(1)) assert.match(w.sql, /"businessId" = \? AND/, 'an existing row of another business is never changed');
});

/** Store reads with a fake db: the SQL a query builds, values flattened like Prisma does. */
function capture() {
  const seen = [];
  return {
    seen,
    async $queryRaw(strings, ...values) {
      seen.push(Prisma.sql(strings, ...values));
      return [];
    },
  };
}

test('catalogue reads keep the demo place out of public lists unless showDemo', async () => {
  const pub = capture();
  await searchBusinesses({ q: 'demo' }, pub);
  assert.ok(pub.seen[0].values.includes(BOOK_REVIEW_DEMO_ID));
  const review = capture();
  await searchBusinesses({ q: 'demo', showDemo: true }, review);
  assert.ok(!review.seen[0].values.includes(BOOK_REVIEW_DEMO_ID));
});

test('the demo business page is not found without showDemo', async () => {
  const row = { id: BOOK_REVIEW_DEMO_ID, status: 'CLAIMED', settings: {}, hours: {}, photos: [] };
  const db = {
    async $queryRaw(strings) {
      const sql = strings.join('?');
      if (sql.includes('FROM "BookBusiness" b WHERE b.id =')) return [row];
      return [];
    },
  };
  assert.equal(await businessDetail(BOOK_REVIEW_DEMO_ID, {}, db), null);
  const shown = await businessDetail(BOOK_REVIEW_DEMO_ID, { showDemo: true }, db);
  assert.equal(shown?.id, BOOK_REVIEW_DEMO_ID);
  const admin = await businessDetail(BOOK_REVIEW_DEMO_ID, { includeHidden: true }, db);
  assert.equal(admin?.id, BOOK_REVIEW_DEMO_ID);
});
