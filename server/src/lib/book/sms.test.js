import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bookSmsText, smsKindOn, whenText, monthStart } from './sms.js';
import { normalizeNotify, normalizeSettings } from './catalog.js';
import { tbilisiInstant } from './time.js';

const now = tbilisiInstant('2026-10-18', 20 * 60); // Sunday evening
const a = {
  id: 'a1', businessId: 'b1', businessName: 'Lile Beauty Studio', businessNameKa: 'სილამაზის სტუდია „ლილე“', businessPhone: '599000000', businessAddressKa: 'ჭავჭავაძის 12',
  serviceName: 'ქალის თმის შეჭრა + ჰიგიენური წმენდა', staffName: 'ნინო', startsAt: tbilisiInstant('2026-10-19', 15 * 60).toISOString(), clientPhone: '+995555000111', clientUserId: null,
};

describe('MEDIBOOK SMS', () => {
  it('names the day the way people say it', () => {
    assert.equal(whenText(tbilisiInstant('2026-10-18', 21 * 60), now), 'დღეს 21:00');
    assert.equal(whenText(tbilisiInstant('2026-10-19', 15 * 60), now), 'ხვალ 15:00');
    assert.equal(whenText(tbilisiInstant('2026-10-21', 9 * 60 + 30), now), 'ოთხ, 21 ოქტ 09:30');
  });

  it('writes short Georgian texts with the place, the service and the time, never a note', () => {
    const confirm = bookSmsText('confirm', a, { now });
    assert.equal(confirm, 'MEDICARD: ჯავშანი დადასტურდა — სილამაზის სტუდია „ლილე“: ქალის თმის შეჭრა + ჰიგიენური წმენდა, ხვალ 15:00, ნინო. დარეკე: 599000000');
    assert.ok(bookSmsText('day', a, { now }).includes('შეხსენება') && bookSmsText('day', a, { now }).includes('ჭავჭავაძის 12'));
    assert.ok(bookSmsText('soon', a, { now }).startsWith('MEDICARD: ქალის თმის შეჭრა + ჰიგიენური წმენდა ხვალ 15:00-ზე'));
    assert.equal(bookSmsText('cancelled', a, { now, reason: 'მასტერი ავად არის.' }), 'MEDICARD: სილამაზის სტუდია „ლილე“ — ჯავშანი გაუქმდა: ქალის თმის შეჭრა + ჰიგიენური წმენდა, ხვალ 15:00. მასტერი ავად არის. დარეკე: 599000000');
    assert.ok(bookSmsText('moved', a, { now }).includes('ახალი დრო'));
    assert.ok(bookSmsText('waitlist', { ...a, startsAt: null, offeredStartsAt: a.startsAt }, { now }).includes('გათავისუფლდა დრო'));
    assert.equal(bookSmsText('nope', a), '');
    for (const kind of ['confirm', 'day', 'soon', 'cancelled', 'moved', 'waitlist']) assert.ok(bookSmsText(kind, a, { now }).length <= 220, kind);
  });

  it('notification settings default to pushes on and SMS off, and clamp the choices', () => {
    const n = normalizeNotify(undefined);
    assert.equal(n.reminderHours, 24);
    assert.equal(n.soonHours, 2);
    assert.deepEqual(n.push, { reminderDay: true, reminderSoon: true, reviewAsk: true });
    assert.equal(n.sms.enabled, false);
    assert.equal(n.sms.onlyWithoutApp, true);
    assert.equal(n.sms.monthlyCap, 200);
    assert.deepEqual(n.email, { newBooking: true, cancelled: true });
    const custom = normalizeNotify({ reminderHours: 48, soonHours: 9, sms: { enabled: true, monthlyCap: 500, reminderSoon: true }, push: { reviewAsk: false } });
    assert.equal(custom.reminderHours, 48);
    assert.equal(custom.soonHours, 2);
    assert.equal(custom.sms.enabled, true);
    assert.equal(custom.sms.monthlyCap, 500);
    assert.equal(custom.sms.reminderSoon, true);
    assert.equal(custom.push.reviewAsk, false);
    assert.equal(normalizeSettings({}).notify.sms.enabled, false);
  });

  it('a kind goes by SMS only when the master switch and its own switch are on', () => {
    const off = normalizeNotify({});
    assert.equal(smsKindOn(off, 'confirm'), false);
    const on = normalizeNotify({ sms: { enabled: true } });
    assert.equal(smsKindOn(on, 'confirm'), true);
    assert.equal(smsKindOn(on, 'pending'), true);
    assert.equal(smsKindOn(on, 'soon'), false);
    assert.equal(smsKindOn(normalizeNotify({ sms: { enabled: true, changes: false } }), 'cancelled'), false);
  });

  it('the month starts at Tbilisi midnight', () => {
    assert.equal(monthStart(tbilisiInstant('2026-10-18', 20 * 60)).toISOString(), '2026-09-30T20:00:00.000Z');
  });
});
