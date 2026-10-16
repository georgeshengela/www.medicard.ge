import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBookOverview, BOOK_WALL_MAX } from './adminUsageBook.js';

const NOW = new Date('2026-10-16T09:00:00Z');
const daysAgo = (n, h = 10) => new Date(NOW.getTime() - n * 86_400_000 + (h - 9) * 3_600_000);
const biz = (id, status, extra = {}) => ({ id, name: `B ${id}`, nameKa: `ბ ${id}`, category: 'BEAUTY', city: 'თბილისი', status, source: 'OWNER', phone: '5', hours: { 1: [{ from: '10:00', to: '18:00' }] }, settings: {}, ownerUserId: null, claimedAt: null, createdAt: daysAgo(40), ...extra });
const appt = (businessId, status, created, extra = {}) => ({ id: `${businessId}-${created}-${Math.random()}`, businessId, clientUserId: null, clientId: 'c1', status, source: 'APP', createdAt: daysAgo(created), startsAt: daysAgo(created - 1), ...extra });

function fixture() {
  return {
    teamUserIds: ['team1'],
    people: [{ id: 'own1', fullName: 'ნინო', email: '599000000@phone.medicard.ge', phone: null, createdAt: daysAgo(60), lastSeenAt: daysAgo(1) }, { id: 'team1', fullName: 'Demo', email: 'demo@medicard.ge', createdAt: daysAgo(90) }],
    businesses: [
      biz('a', 'CLAIMED', { ownerUserId: 'own1', claimedAt: daysAgo(30), settings: { loyalty: { cashbackPercent: 5 }, notify: { sms: { enabled: true } } } }),
      biz('b', 'CLAIMED', { ownerUserId: 'own1', phone: null, hours: {} }),
      biz('t', 'CLAIMED', { ownerUserId: 'team1' }),
      biz('l', 'LISTED', { city: null }),
      biz('p', 'PENDING', { ownerUserId: 'own1' }),
      biz('h', 'HIDDEN'),
    ],
    services: [{ businessId: 'a', n: 5 }, { businessId: 't', n: 3 }],
    staff: [{ businessId: 'a', n: 2 }, { businessId: 't', n: 1 }],
    photos: [{ businessId: 'a', n: 3 }],
    products: [{ businessId: 'a', n: 2 }],
    supplies: [], resources: [{ businessId: 'a', n: 1 }], memberships: [],
    clients: [{ businessId: 'a', n: 4 }],
    reviews: [{ businessId: 'a', n: 2, avg: 4.5 }],
    favourites: [{ businessId: 'a', n: 7 }],
    bookingsLifetime: [{ businessId: 'a', n: 6, completed: 3, noShow: 1, lastAt: daysAgo(2) }, { businessId: 't', n: 50, completed: 50, noShow: 0, lastAt: daysAgo(1) }],
    appointments: [
      appt('a', 'COMPLETED', 20, { clientId: 'c1' }), appt('a', 'COMPLETED', 5, { clientId: 'c1' }), appt('a', 'CONFIRMED', 2, { clientId: 'c2', source: 'BUSINESS' }),
      appt('a', 'CANCELLED', 3, { clientId: 'c3' }), appt('a', 'NO_SHOW', 4, { clientId: 'c4' }),
      appt('l', 'COMPLETED', 1, { clientId: 'c5', source: 'WEB' }),
      appt('t', 'COMPLETED', 1, { clientId: 'c9' }),
    ],
    events: [
      { businessId: 'a', kind: 'VIEW', viewerHash: 'v1', at: daysAgo(1) }, { businessId: 'a', kind: 'VIEW', viewerHash: 'v2', at: daysAgo(2) }, { businessId: 'a', kind: 'CALL', viewerHash: 'v1', at: daysAgo(1) },
      { businessId: 'l', kind: 'VIEW', viewerHash: 'v3', at: daysAgo(3) }, { businessId: 't', kind: 'VIEW', viewerHash: 'v4', at: daysAgo(1) }, { businessId: 'a', kind: 'VIEW', viewerHash: 'v5', at: daysAgo(40) },
    ],
    claims: [{ id: 'cl1', businessId: 'p', userId: 'own1', kind: 'REGISTER', status: 'PENDING', createdAt: daysAgo(2), businessName: 'B p', businessNameKa: 'ბ p', userName: 'ნინო' }, { id: 'cl2', businessId: 't', userId: 'team1', kind: 'CLAIM', status: 'PENDING', createdAt: daysAgo(1), businessName: 'B t', userName: 'Demo' }],
    flags: [],
  };
}

test('MEDIBOOK usage: team businesses are left out, totals and ladders count the real ones', () => {
  const d = buildBookOverview(fixture(), { days: 30, now: NOW });
  assert.equal(d.totals.claimed, 2);
  assert.equal(d.totals.pending, 1);
  assert.equal(d.totals.listed, 1);
  assert.equal(d.totals.hidden, 1);
  assert.equal(d.totals.ready, 1);
  assert.equal(d.totals.booked, 1);
  assert.equal(d.totals.active, 1);
  assert.equal(d.totals.idle, 1);
  assert.equal(d.totals.claimsPending, 1);
  assert.equal(d.team.businesses, 1);
  assert.deepEqual(d.ladder.map((s) => [s.key, s.count]), [['catalogue', 4], ['claimed', 3], ['ready', 1], ['booked', 1], ['active', 1]]);
  assert.deepEqual(d.peopleLadder.map((s) => [s.key, s.count]), [['viewed', 3], ['booked', 4], ['came', 2], ['returned', 1]]);
  assert.ok(!d.businesses.some((b) => b.id === 't'));
  assert.ok(!d.businesses.some((b) => b.id === 'h'), 'hidden places with no activity stay off the wall');
});

test('MEDIBOOK usage: the period counts bookings created in the window, sources and views', () => {
  const d = buildBookOverview(fixture(), { days: 30, now: NOW });
  const p = d.period;
  assert.equal(p.bookings, 5);
  assert.equal(p.completed, 3);
  assert.equal(p.noShow, 1);
  assert.equal(p.cancelled, 1);
  assert.equal(p.people, 4);
  assert.equal(p.newClients, 3);
  assert.equal(p.businesses, 2);
  assert.equal(p.views, 3);
  assert.equal(p.calls, 1);
  assert.deepEqual(p.sources, { APP: 3, BUSINESS: 1, WEB: 1 });
  assert.equal(p.trend.bookings.length, 30);
  assert.equal(p.trend.bookings.reduce((s, x) => s + x.count, 0), 5);
});

test('MEDIBOOK usage: a business card carries setup, period, lifetime, modules and the owner', () => {
  const d = buildBookOverview(fixture(), { days: 30, now: NOW });
  const a = d.businesses.find((b) => b.id === 'a');
  assert.equal(a.name, 'ბ a');
  assert.deepEqual(a.setup, { services: 5, staff: 2, photos: 3, hours: true, phone: true, city: true, clients: 4 });
  assert.equal(a.period.bookings, 4);
  assert.equal(a.period.views, 2);
  assert.equal(a.lifetime.rating, 4.5);
  assert.equal(a.lifetime.favourites, 7);
  assert.equal(a.modulesOn, 4);
  assert.equal(a.owner.name, 'ნინო');
  assert.equal(a.owner.team, false);
  assert.equal(d.businesses[0].status, 'PENDING', 'pending places come first');
  const q = d.quality;
  assert.equal(q.noServices, 1);
  assert.equal(q.noHours, 1);
  assert.equal(q.noPhone, 1);
  assert.equal(q.catalogueNoCity, 1);
  assert.equal(q.modules.cashback, 1);
  assert.equal(d.claimsPending.length, 1);
  assert.equal(d.claimsPending[0].waitingDays, 1);
});

test('MEDIBOOK usage: „გუნდის ჩათვლით“ brings the demo business back; a 7-day window drops older rows', () => {
  const d = buildBookOverview(fixture(), { days: 30, includeTeam: true, now: NOW });
  assert.equal(d.totals.claimed, 3);
  assert.equal(d.totals.claimsPending, 2);
  assert.ok(d.businesses.some((b) => b.id === 't' && b.team));
  const week = buildBookOverview(fixture(), { days: 7, now: NOW });
  assert.equal(week.period.bookings, 4);
  assert.equal(week.period.trend.bookings.length, 7);
  assert.ok(BOOK_WALL_MAX > 0);
});
