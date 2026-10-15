import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bboxAround, businessCard, catalogRowsFromDirectory, discountApplies, discountedPrice, distanceKm, guessCategory,
  hoursFromMapboxPeriods, hoursFromOsm, normalizeHours, normalizePhone, normalizeSettings, normalizeWebsite, openState, slugFor,
} from './catalog.js';
import { tbilisiInstant } from './time.js';

describe('MEDIBOOK catalogue helpers', () => {
  it('guesses the category from words before provider categories', () => {
    assert.equal(guessCategory({ mapbox: ['salon'], name: 'Nail Bar Vake' }), 'NAILS');
    assert.equal(guessCategory({ mapbox: ['salon'], name: 'ესთეტიკური ცენტრი Lumi' }), 'AESTHETIC');
    assert.equal(guessCategory({ mapbox: ['dentist'], name: 'DentEffect' }), 'DENTAL');
    assert.equal(guessCategory({ osm: ['hairdresser'], name: 'Studio 7' }), 'HAIR');
    assert.equal(guessCategory({ mapbox: ['salon'], name: 'Beauty House' }), 'BEAUTY');
    assert.equal(guessCategory({ name: 'Random Shop' }), 'OTHER');
  });

  it('normalizes phones, websites, hours and settings', () => {
    assert.equal(normalizePhone('599 92 50 07'), '+995599925007');
    assert.equal(normalizePhone('+995 32 2 96 95 54'), '+995322969554');
    assert.equal(normalizePhone('032 2 123456'), '+995322123456');
    assert.equal(normalizeWebsite('denteffect.ge'), 'https://denteffect.ge');
    assert.equal(normalizeWebsite('javascript:alert(1)'), null);
    const h = normalizeHours({ 1: [{ from: '9:00', to: '18:00' }], 6: [{ from: '11:00', to: '24:00' }], 9: [{ from: 'x', to: 'y' }] });
    assert.deepEqual(h['1'], [{ from: '09:00', to: '18:00' }]);
    assert.deepEqual(h['6'], [{ from: '11:00', to: '24:00' }]);
    assert.deepEqual(h['0'], []);
    const s = normalizeSettings({ slotMinutes: 25, leadMinutes: -5, horizonDays: 999, autoConfirm: 'yes' });
    assert.equal(s.slotMinutes, 30);
    assert.equal(s.leadMinutes, 0);
    assert.equal(s.horizonDays, 180);
    assert.equal(s.autoConfirm, true);
  });

  it('reads Mapbox periods and simple OSM opening_hours', () => {
    const mb = hoursFromMapboxPeriods([{ open: { day: 1, time: '1000' }, close: { day: 1, time: '1800' } }, { open: { day: 6, time: '1100' }, close: { day: 6, time: '0000' } }]);
    assert.deepEqual(mb['1'], [{ from: '10:00', to: '18:00' }]);
    assert.deepEqual(mb['6'], [{ from: '11:00', to: '24:00' }]);
    assert.deepEqual(hoursFromMapboxPeriods([{ open: { day: 0, time: '0000' } }])['3'], [{ from: '00:00', to: '24:00' }]);
    const osm = hoursFromOsm('Mo-Fr 10:00-19:00; Sa 11:00-17:00');
    assert.deepEqual(osm['3'], [{ from: '10:00', to: '19:00' }]);
    assert.deepEqual(osm['6'], [{ from: '11:00', to: '17:00' }]);
    assert.deepEqual(osm['0'], []);
    assert.deepEqual(hoursFromOsm('24/7')['0'], [{ from: '00:00', to: '24:00' }]);
  });

  it('knows whether a place is open now in Tbilisi', () => {
    const hours = normalizeHours({ 1: [{ from: '10:00', to: '19:00' }] });
    const mondayNoon = tbilisiInstant('2026-10-19', 12 * 60);
    const mondayNight = tbilisiInstant('2026-10-19', 20 * 60);
    assert.equal(openState(hours, mondayNoon).open, true);
    assert.equal(openState(hours, mondayNoon).closesAt, '19:00');
    assert.equal(openState(hours, mondayNight).open, false);
    assert.equal(openState(hours, tbilisiInstant('2026-10-19', 8 * 60)).opensAt, '10:00');
    assert.equal(openState({}, mondayNoon).open, null);
  });

  it('builds directory rows with stable ids, slugs and a Georgia check', () => {
    const rows = catalogRowsFromDirectory({ businesses: [
      { source: 'mapbox', ref: 'abc', name: 'DentEffect', category: 'DENTAL', phone: '322969554', lat: 41.72, lng: 44.79, city: 'Tbilisi', hours: { 1: [{ from: '10:00', to: '18:00' }] } },
      { source: 'mapbox', ref: 'abc', name: 'Duplicate', lat: 41.72, lng: 44.79 },
      { source: 'osm', ref: 'n1', name: 'Paris salon', lat: 48.8, lng: 2.3 },
      { source: 'osm', ref: 'n2', name: '', lat: 41.7, lng: 44.8 },
    ] });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id.slice(0, 3), 'bk-');
    assert.equal(rows[0].phone, '+995322969554');
    assert.match(rows[0].slug, /^denteffect-[a-z0-9]{6}$/);
    assert.equal(slugFor('სილამაზის სალონი „ლილე“', 'abcdef123456'), 'სილამაზის-სალონი-ლილე-123456');
  });

  it('cards carry distance, open state and the claimed flag', () => {
    const row = { id: 'x', slug: 'x', name: 'Lumi', nameKa: 'ლუმი', category: 'AESTHETIC', lat: 41.7151, lng: 44.8271, status: 'CLAIMED', settings: {}, hours: {}, ratingAvg: 4.6667, ratingCount: 3 };
    const card = businessCard(row, { lang: 'ka', origin: { lat: 41.7251, lng: 44.8271 } });
    assert.equal(card.name, 'ლუმი');
    assert.equal(card.claimed, true);
    assert.equal(card.rating, 4.7);
    assert.ok(Math.abs(card.distanceKm - 1.11) < 0.05);
    assert.equal(businessCard(row, { lang: 'en' }).name, 'Lumi');
    const box = bboxAround({ lat: 41.7, lng: 44.8 }, 5);
    assert.ok(box.maxLat > 41.74 && box.minLng < 44.75);
    assert.ok(Math.abs(distanceKm({ lat: 41.7151, lng: 44.8271 }, { lat: 41.6938, lng: 44.8015 }) - 3.1) < 0.3);
  });

  it('applies discounts by service, date, weekday, hours and code', () => {
    const monday15 = tbilisiInstant('2026-10-19', 15 * 60);
    const d = { active: true, kind: 'PERCENT', value: 20, serviceIds: ['svc'], weekdays: [1, 2], hoursFrom: '12:00', hoursTo: '17:00', startsOn: '2026-10-01', endsOn: '2026-12-31' };
    assert.ok(discountApplies(d, { serviceId: 'svc', at: monday15 }));
    assert.ok(!discountApplies(d, { serviceId: 'other', at: monday15 }));
    assert.ok(!discountApplies(d, { serviceId: 'svc', at: tbilisiInstant('2026-10-19', 18 * 60) }));
    assert.ok(!discountApplies(d, { serviceId: 'svc', at: tbilisiInstant('2026-10-21', 15 * 60) }));
    assert.ok(!discountApplies({ ...d, code: 'VIP10' }, { serviceId: 'svc', at: monday15 }));
    assert.ok(discountApplies({ ...d, code: 'VIP10' }, { serviceId: 'svc', at: monday15, code: 'vip10' }));
    assert.ok(!discountApplies({ ...d, maxUses: 2, usedCount: 2 }, { serviceId: 'svc', at: monday15 }));
    assert.deepEqual(discountedPrice(80, d), { price: 64, off: 16 });
    assert.deepEqual(discountedPrice(10, { kind: 'FIXED', value: 15 }), { price: 0, off: 10 });
  });
});
