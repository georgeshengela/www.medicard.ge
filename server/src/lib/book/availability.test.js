import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canCancelFree, daysWithSlots, findConflict, isOfferedSlot, slotsForDay, staffWorkingRanges, subtractRange } from './availability.js';
import { tbilisiInstant } from './time.js';

const hours = { 1: [{ from: '10:00', to: '19:00' }], 2: [{ from: '10:00', to: '19:00' }], 3: [], 4: [{ from: '10:00', to: '19:00' }], 5: [{ from: '10:00', to: '19:00' }], 6: [{ from: '11:00', to: '16:00' }], 0: [] };
const business = { hours, settings: { slotMinutes: 30, leadMinutes: 60, horizonDays: 30 } };
const service = { id: 'svc', durationMin: 60, bufferMin: 0 };
const nino = { id: 'nino', serviceIds: [], schedule: {}, active: true, bookable: true };
const gio = { id: 'gio', serviceIds: ['svc'], schedule: { 1: [{ from: '14:00', to: '20:00' }] }, active: true, bookable: true };
// Monday 2026-10-19; "now" is the Sunday evening before, so the lead time never trims the day.
const monday = '2026-10-19';
const now = tbilisiInstant('2026-10-18', 20 * 60);

describe('MEDIBOOK availability', () => {
  it('subtracts ranges', () => {
    assert.deepEqual(subtractRange([[600, 1140]], 720, 780), [[600, 720], [780, 1140]]);
    assert.deepEqual(subtractRange([[600, 1140]], 500, 650), [[650, 1140]]);
    assert.deepEqual(subtractRange([[600, 1140]], 0, 2000), []);
  });

  it('a bundle of services needs a person who performs every one of them', () => {
    const bundle = { id: 'svc', ids: ['svc', 'colour'], durationMin: 150, bufferMin: 10 };
    const r = slotsForDay({ business, service: bundle, staff: [nino, gio], date: monday, now });
    assert.equal(r.closed, false);
    // Gio performs only 'svc', so every slot belongs to Nino alone.
    assert.ok(r.slots.length > 0);
    assert.ok(r.slots.every((s) => s.staffIds.length === 1 && s.staffIds[0] === 'nino'));
    // 150 minutes must fit before 19:00: the last start is 16:30.
    assert.equal(r.slots[r.slots.length - 1].time, '16:30');
  });

  it('a person without a schedule works the business hours; with one, the intersection', () => {
    assert.deepEqual(staffWorkingRanges(nino, hours, 1), [[600, 1140]]);
    assert.deepEqual(staffWorkingRanges(gio, hours, 1), [[840, 1140]]);
    assert.deepEqual(staffWorkingRanges(gio, hours, 2), []);
  });

  it('offers every grid start where the service fits, per person, unioned for „anyone“', () => {
    const r = slotsForDay({ business, service, staff: [nino, gio], date: monday, now });
    assert.equal(r.closed, false);
    assert.equal(r.slots[0].time, '10:00');
    assert.equal(r.slots.at(-1).time, '18:00'); // 18:00–19:00 is the last hour that fits
    assert.deepEqual(r.slots.find((s) => s.time === '10:00').staffIds, ['nino']);
    assert.deepEqual(r.slots.find((s) => s.time === '15:00').staffIds, ['nino', 'gio']);
    assert.equal(r.slots.length, 17);
  });

  it('removes booked time with the buffer and keeps the other person free', () => {
    const buffered = { ...service, bufferMin: 15 };
    const appointments = [{ id: 'a1', staffId: 'nino', status: 'CONFIRMED', startsAt: tbilisiInstant(monday, 12 * 60).toISOString(), endsAt: tbilisiInstant(monday, 13 * 60).toISOString() }];
    const r = slotsForDay({ business, service: buffered, staff: [nino, gio], appointments, date: monday, now });
    const times = (id) => r.slots.filter((s) => s.staffIds.includes(id)).map((s) => s.time);
    assert.ok(!times('nino').includes('11:00')); // 11:00–12:00 + 15 min buffer touches 12:00
    assert.ok(!times('nino').includes('12:30'));
    assert.ok(times('nino').includes('13:30'));
    assert.ok(times('gio').includes('14:00'));
  });

  it('respects a chosen person, time off, lead time, closed days and the horizon', () => {
    const only = slotsForDay({ business, service, staff: [nino, gio], date: monday, now, staffId: 'gio' });
    assert.equal(only.slots[0].time, '14:00');
    const off = slotsForDay({ business, service, staff: [nino], timeOff: [{ staffId: null, startsAt: tbilisiInstant(monday, 10 * 60).toISOString(), endsAt: tbilisiInstant(monday, 15 * 60).toISOString() }], date: monday, now });
    assert.equal(off.slots[0].time, '15:00');
    const soon = slotsForDay({ business, service, staff: [nino], date: monday, now: tbilisiInstant(monday, 11 * 60 + 10) });
    assert.equal(soon.slots[0].time, '12:30'); // now 11:10 + 60 min lead = 12:10 → next grid start 12:30
    assert.equal(slotsForDay({ business, service, staff: [nino], date: '2026-10-21', now }).reason, 'closed');
    assert.equal(slotsForDay({ business, service, staff: [nino], date: '2026-12-30', now }).reason, 'horizon');
    assert.equal(slotsForDay({ business, service, staff: [nino], date: '2026-10-17', now }).reason, 'past');
    assert.equal(slotsForDay({ business, service: { id: 'other', durationMin: 30 }, staff: [gio], date: monday, now }).reason, 'no-staff');
  });

  it('a walk-in booked by the business ignores lead time and horizon', () => {
    const r = slotsForDay({ business, service, staff: [nino], date: monday, now: tbilisiInstant(monday, 11 * 60 + 10), ignoreLead: true });
    assert.equal(r.slots[0].time, '10:00');
  });

  it('date strip counts, conflicts, offered slot check and the cancellation window', () => {
    const strip = daysWithSlots({ business, service, staff: [nino], appointments: [], timeOff: [], from: monday, now, days: 3 });
    assert.deepEqual(strip.map((d) => [d.date, d.count > 0]), [[monday, true], ['2026-10-20', true], ['2026-10-21', false]]);
    const list = [{ id: 'a1', staffId: 'nino', status: 'CONFIRMED', startsAt: tbilisiInstant(monday, 12 * 60).toISOString(), endsAt: tbilisiInstant(monday, 13 * 60).toISOString() }];
    assert.ok(findConflict(list, { staffId: 'nino', startsAt: tbilisiInstant(monday, 12 * 60 + 30), endsAt: tbilisiInstant(monday, 13 * 60 + 30) }));
    assert.equal(findConflict(list, { staffId: 'gio', startsAt: tbilisiInstant(monday, 12 * 60 + 30), endsAt: tbilisiInstant(monday, 13 * 60 + 30) }), null);
    assert.equal(findConflict(list, { staffId: 'nino', startsAt: tbilisiInstant(monday, 13 * 60), endsAt: tbilisiInstant(monday, 14 * 60) }), null);
    const r = slotsForDay({ business, service, staff: [nino, gio], date: monday, now });
    assert.ok(isOfferedSlot(r, tbilisiInstant(monday, 15 * 60), 'gio'));
    assert.ok(!isOfferedSlot(r, tbilisiInstant(monday, 10 * 60), 'gio'));
    assert.ok(!isOfferedSlot(r, tbilisiInstant(monday, 10 * 60 + 10)));
    const appt = { startsAt: tbilisiInstant(monday, 15 * 60).toISOString() };
    assert.ok(canCancelFree(appt, { cancelHours: 12 }, tbilisiInstant(monday, 2 * 60)));
    assert.ok(!canCancelFree(appt, { cancelHours: 12 }, tbilisiInstant(monday, 10 * 60)));
  });
});
