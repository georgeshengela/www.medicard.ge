import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalytics, periodFor, resourceUtilisation, uniqueBlocks, workingMinutes } from './analytics.js';
import { tbilisiInstant } from './time.js';

const hours = { 1: [{ from: '10:00', to: '18:00' }], 2: [{ from: '10:00', to: '18:00' }], 3: [{ from: '10:00', to: '18:00' }], 4: [], 5: [], 6: [], 0: [] };
const nino = { id: 'nino', name: 'ნინო', schedule: {}, active: true, bookable: true };
const gio = { id: 'gio', name: 'გიო', schedule: { 1: [{ from: '14:00', to: '18:00' }] }, active: true, bookable: true };
// Mon 19 … Wed 21 Oct 2026; "now" = Wednesday 14:00.
const from = tbilisiInstant('2026-10-19', 0);
const to = tbilisiInstant('2026-10-22', 0);
const now = tbilisiInstant('2026-10-21', 14 * 60);
const at = (ymd, h, m = 0) => tbilisiInstant(ymd, h * 60 + m);
const appt = (id, staffId, ymd, h, dur, status, extra = {}) => ({ id, staffId, serviceId: extra.serviceId ?? 's1', serviceName: extra.serviceName ?? 'ჰიგიენა', clientId: extra.clientId ?? `c-${id}`, status, source: extra.source ?? 'APP', price: extra.price ?? 80, discountAmount: extra.discountAmount ?? 0, startsAt: at(ymd, h), endsAt: at(ymd, h + dur / 60), durationMin: dur, createdAt: at('2026-10-18', 12) });

describe('MEDIBOOK analytics', () => {
  it('counts working minutes from schedules, business hours, time off and the clock', () => {
    // Nino: Mon 8 h + Tue 8 h + Wed up to 14:00 (4 h) = 20 h.
    assert.equal(workingMinutes({ staff: nino, businessHours: hours, from, to, now }), 20 * 60);
    // Gio: only Monday 14–18 = 4 h.
    assert.equal(workingMinutes({ staff: gio, businessHours: hours, from, to, now }), 4 * 60);
    // A Tuesday off for Nino removes 8 h.
    assert.equal(workingMinutes({ staff: nino, businessHours: hours, timeOff: [{ staffId: 'nino', startsAt: at('2026-10-20', 0), endsAt: at('2026-10-21', 0) }], from, to, now }), 12 * 60);
  });

  it('builds totals, utilisation, funnel, series and clients', () => {
    const appointments = [
      appt('a1', 'nino', '2026-10-19', 10, 60, 'COMPLETED', { clientId: 'old' }),
      appt('a2', 'nino', '2026-10-19', 12, 60, 'NO_SHOW'),
      appt('a3', 'gio', '2026-10-19', 15, 120, 'COMPLETED', { price: 200, serviceId: 's2', serviceName: 'იმპლანტი', source: 'BUSINESS' }),
      appt('a4', 'nino', '2026-10-20', 11, 60, 'CANCELLED'),
      appt('a5', 'nino', '2026-10-21', 16, 60, 'CONFIRMED'),
    ];
    const transactions = [
      { kind: 'INCOME', category: 'SERVICE', amount: 80, method: 'CARD', at: at('2026-10-19', 10), staffId: 'nino' },
      { kind: 'INCOME', category: 'SERVICE', amount: 200, method: 'CASH', at: at('2026-10-19', 15), staffId: 'gio' },
      { kind: 'EXPENSE', category: 'SUPPLIES', amount: 50, method: null, at: at('2026-10-20', 9), staffId: null },
    ];
    const events = [
      { kind: 'VIEW', viewerHash: 'v1', at: at('2026-10-19', 9) }, { kind: 'VIEW', viewerHash: 'v2', at: at('2026-10-19', 9) }, { kind: 'VIEW', viewerHash: 'v1', at: at('2026-10-20', 9) },
      { kind: 'CALL', viewerHash: 'v2', at: at('2026-10-19', 9) }, { kind: 'BOOK_DONE', viewerHash: 'v1', at: at('2026-10-18', 12) },
    ];
    const clients = [{ id: 'old', createdAt: at('2026-09-01', 10), visits: 3 }, { id: 'c-a2', createdAt: at('2026-10-18', 12), visits: 0 }, { id: 'c-a3', createdAt: at('2026-10-19', 14), visits: 1 }, { id: 'c-a5', createdAt: at('2026-10-20', 12), visits: 0 }];
    const r = buildAnalytics({ appointments, events, transactions, staff: [nino, gio], clients, reviews: [{ rating: 5, createdAt: at('2026-10-19', 12) }, { rating: 4, createdAt: at('2026-10-19', 13) }], business: { hours, ratingAvg: 4.5, ratingCount: 2 }, from, to, now });
    assert.equal(r.totals.bookings, 4);
    assert.equal(r.totals.completed, 2);
    assert.equal(r.totals.noShow, 1);
    assert.equal(r.totals.cancelled, 1);
    assert.equal(r.totals.revenue, 280);
    assert.equal(r.totals.expense, 50);
    assert.equal(r.totals.profit, 230);
    assert.equal(r.totals.averageTicket, 140);
    // Past non-cancelled visits by now: a1, a2, a3 (a5 is at 16:00, still ahead) → 1 no-show of 3.
    assert.equal(r.totals.noShowRate, 33.3);
    // Nino: booked 60 + 60 (a5 is in the future, not counted) = 120 of 1200 → 10 %; Gio 120 of 240 → 50 %.
    const nin = r.utilisation.find((u) => u.staffId === 'nino');
    const gi = r.utilisation.find((u) => u.staffId === 'gio');
    assert.equal(nin.utilisation, 10);
    assert.equal(gi.utilisation, 50);
    assert.equal(r.totals.utilisation, Math.round((240 / 1440) * 1000) / 10);
    assert.equal(r.funnel.views, 3);
    assert.equal(r.funnel.viewers, 2);
    assert.equal(r.funnel.booked, 4); // every non-BUSINESS appointment incl. the cancelled one
    assert.equal(r.series.length, 3);
    assert.equal(r.series[0].bookings, 3);
    assert.equal(r.series[0].revenue, 280);
    assert.equal(r.series[1].expense, 50);
    assert.equal(r.topServices[0].name, 'ჰიგიენა');
    assert.equal(r.topServices[1].revenue, 200);
    assert.deepEqual([r.clients.new, r.clients.returning], [2, 2]); // c-a2 was created before the period
    assert.equal(r.sources.BUSINESS, 1);
    assert.equal(r.reviews.avg, 4.5);
    assert.equal(r.money.methods.CARD, 80);
    assert.equal(r.peak.hour, 10);
  });

  it('periods end tomorrow 00:00 Tbilisi', () => {
    const p = periodFor('7', tbilisiInstant('2026-10-21', 14 * 60));
    assert.equal(p.from.toISOString(), tbilisiInstant('2026-10-15', 0).toISOString());
    assert.equal(p.to.toISOString(), tbilisiInstant('2026-10-22', 0).toISOString());
    assert.equal(periodFor('month', tbilisiInstant('2026-10-21', 14 * 60)).from.toISOString(), tbilisiInstant('2026-10-01', 0).toISOString());
  });
});

describe('MEDIBOOK analytics — rooms and equipment', () => {
  it('utilisation per room: booked ÷ open minutes × capacity, passed hours only, retired ones left out', () => {
    const resources = [{ id: 'r1', name: 'Room 1', kind: 'ROOM', capacity: 1, active: true }, { id: 'r2', name: 'Chairs', kind: 'ROOM', capacity: 2, active: true }, { id: 'old', name: 'Old', capacity: 1, active: false }];
    const appointments = [
      { ...appt('a1', 'nino', '2026-10-19', 10, 60, 'COMPLETED'), resourceIds: ['r1'] },
      { ...appt('a2', 'gio', '2026-10-19', 15, 120, 'CONFIRMED'), resourceIds: ['r1', 'r2'] },
      { ...appt('a3', 'nino', '2026-10-20', 11, 60, 'CANCELLED'), resourceIds: ['r1'] },
      { ...appt('a4', 'nino', '2026-10-21', 16, 60, 'CONFIRMED'), resourceIds: ['r2'] }, // later today (now = Wed 14:00): not yet
    ];
    const r = resourceUtilisation({ resources, appointments, businessHours: hours, from, to, now });
    assert.deepEqual(r.map((x) => x.resourceId), ['r1', 'r2']);
    // Open: Mon 8 h + Tue 8 h + Wed up to 14:00 = 20 h.
    const r1 = r.find((x) => x.resourceId === 'r1');
    assert.equal(r1.workingMinutes, 1200);
    assert.equal(r1.bookedMinutes, 180);
    assert.equal(r1.utilisation, 15);
    assert.equal(r1.appointments, 2);
    assert.equal(r1.completed, 1);
    const r2 = r.find((x) => x.resourceId === 'r2');
    assert.equal(r2.workingMinutes, 2400);
    assert.equal(r2.bookedMinutes, 120);
    assert.equal(r2.utilisation, 5);
    // A business-wide Tuesday off shrinks the open time; a person's own day off does not.
    const off = resourceUtilisation({ resources: resources.slice(0, 1), appointments, businessHours: hours, timeOff: [{ staffId: null, startsAt: at('2026-10-20', 0), endsAt: at('2026-10-21', 0) }, { staffId: 'nino', startsAt: at('2026-10-19', 0), endsAt: at('2026-10-20', 0) }], from, to, now });
    assert.equal(off[0].workingMinutes, 720);
    assert.equal(buildAnalytics({ appointments, resources, business: { hours }, from, to, now }).resources.length, 2);
  });
});

describe('MEDIBOOK analytics — group classes', () => {
  it('a class counts every attendee as a booking but one block of the trainer\'s time and one unit of the room', () => {
    const cls = { id: 'cls1', serviceId: 'yoga', staffId: 'nino', startsAt: at('2026-10-19', 18 - 1), endsAt: at('2026-10-19', 18), seats: 15, resourceIds: ['hall'], status: 'OPEN' };
    const attendee = (id, status) => ({ ...appt(id, 'nino', '2026-10-19', 17, 60, status, { price: 20, serviceId: 'yoga', serviceName: 'იოგა' }), classId: 'cls1', resourceIds: [] });
    const appointments = [attendee('y1', 'COMPLETED'), attendee('y2', 'COMPLETED'), attendee('y3', 'NO_SHOW'), attendee('y4', 'CANCELLED')];
    const hall = { id: 'hall', name: 'დარბაზი', kind: 'ROOM', capacity: 1, active: true };
    const r = buildAnalytics({ appointments, staff: [nino], business: { hours }, resources: [hall], classes: [cls], from, to, now });
    assert.equal(r.totals.bookings, 3);
    assert.equal(r.totals.completed, 2);
    assert.equal(r.totals.noShow, 1);
    const u = r.utilisation.find((x) => x.staffId === 'nino');
    assert.equal(u.bookedMinutes, 60);
    assert.equal(u.appointments, 3);
    assert.equal(r.topServices[0].count, 3);
    const room = r.resources.find((x) => x.resourceId === 'hall');
    assert.equal(room.bookedMinutes, 60);
    assert.equal(room.appointments, 1);
    assert.deepEqual(uniqueBlocks([{ id: 1, classId: 'c' }, { id: 2, classId: 'c' }, { id: 3 }, { id: 4, classId: 'd' }]).map((x) => x.id), [1, 3, 4]);
  });
});
