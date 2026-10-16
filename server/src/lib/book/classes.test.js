import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clampSeats, classPublic, expandWeekly, normalizeSlot, normalizeWeekly } from './classes.js';
import { tbilisiInstant } from './time.js';

describe('MEDIBOOK group classes', () => {
  it('seats clamp to 1…200 and the public shape carries the arithmetic', () => {
    assert.equal(clampSeats(0), 1);
    assert.equal(clampSeats('15'), 15);
    assert.equal(clampSeats(999), 200);
    assert.equal(clampSeats('x'), 1);
    const c = classPublic({ id: 'c1', businessId: 'b', serviceId: 'yoga', staffId: 'nino', startsAt: tbilisiInstant('2026-10-19', 18 * 60), endsAt: tbilisiInstant('2026-10-19', 19 * 60), seats: 15, booked: 7, resourceIds: ['hall'], status: 'OPEN' });
    assert.deepEqual([c.seats, c.booked, c.seatsLeft, c.label, c.durationMin], [15, 7, 8, '7 / 15', 60]);
    assert.equal(c.attendees, undefined);
  });

  it('a weekly template is normalised: bad rows dropped, duplicates merged, Monday first', () => {
    assert.deepEqual(normalizeSlot({ weekday: 1, time: '9:05' }), { weekday: 1, time: '09:05' });
    assert.equal(normalizeSlot({ weekday: 7, time: '09:00' }), null);
    assert.equal(normalizeSlot({ weekday: 1, time: '25:00' }), null);
    assert.equal(normalizeSlot({ weekday: 1, time: 'evening' }), null);
    assert.deepEqual(normalizeWeekly([{ weekday: 0, time: '10:00' }, { weekday: 3, time: '19:00' }, { weekday: 1, time: '18:00' }, { weekday: 1, time: '18:00' }, { weekday: 9, time: '18:00' }]),
      [{ weekday: 1, time: '18:00' }, { weekday: 3, time: '19:00' }, { weekday: 0, time: '10:00' }]);
  });

  it('expands the template into the next weeks, only after now, in order', () => {
    // Monday 2026-10-19 at 12:00 Tbilisi: today's 18:00 is still ahead, today's 10:00 has passed.
    const now = tbilisiInstant('2026-10-19', 12 * 60);
    const plan = expandWeekly({ weekly: [{ weekday: 1, time: '18:00' }, { weekday: 1, time: '10:00' }, { weekday: 3, time: '19:00' }], weeks: 2, now });
    assert.deepEqual(plan.map((p) => `${p.date} ${p.time}`), ['2026-10-19 18:00', '2026-10-21 19:00', '2026-10-26 10:00', '2026-10-26 18:00', '2026-10-28 19:00']);
    assert.equal(plan[0].startsAt, tbilisiInstant('2026-10-19', 18 * 60).toISOString());
    // Four weeks of one weekly class = four occurrences; the week count is clamped to 1…12.
    assert.equal(expandWeekly({ weekly: [{ weekday: 2, time: '07:30' }], weeks: 4, now }).length, 4);
    assert.equal(expandWeekly({ weekly: [{ weekday: 2, time: '07:30' }], weeks: 99, now }).length, 12);
    assert.deepEqual(expandWeekly({ weekly: [], weeks: 4, now }), []);
    // A `from` day starts the plan later.
    assert.equal(expandWeekly({ weekly: [{ weekday: 1, time: '18:00' }], weeks: 1, from: '2026-10-20', now })[0]?.date, '2026-10-26');
  });
});
