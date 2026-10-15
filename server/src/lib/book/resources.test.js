import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dayLoad, normalizeResourceIds, sanitizeResource } from './resources.js';
import { tbilisiInstant } from './time.js';

describe('MEDIBOOK rooms and equipment — rows and the day load', () => {
  it('normalises ids and the resource input', () => {
    assert.deepEqual(normalizeResourceIds(['a', 'a', ' b ', '', null]), ['a', 'b']);
    assert.deepEqual(normalizeResourceIds('x,y,x'), ['x', 'y']);
    assert.deepEqual(normalizeResourceIds(undefined), []);
    assert.deepEqual(sanitizeResource({ name: ' Room 1 ', kind: 'laser', capacity: '0', note: '' }), { name: 'Room 1', kind: 'ROOM', capacity: 1, note: null });
    assert.deepEqual(sanitizeResource({ kind: 'equipment', capacity: 99 }), { kind: 'EQUIPMENT', capacity: 50 });
  });

  it("today's load = booked minutes inside the day ÷ open minutes × capacity", () => {
    const hours = { 1: [{ from: '10:00', to: '18:00' }] };
    const monday = '2026-10-19';
    const at = (h) => tbilisiInstant(monday, h * 60).toISOString();
    const appointments = [
      { status: 'CONFIRMED', startsAt: at(10), endsAt: at(12), resourceIds: ['r1'] },
      { status: 'CANCELLED', startsAt: at(12), endsAt: at(13), resourceIds: ['r1'] },
      { status: 'CONFIRMED', startsAt: at(17), endsAt: at(19), resourceIds: ['r1', 'r2'] },
    ];
    const [r1, r2, r3] = dayLoad({ resources: [{ id: 'r1', capacity: 1 }, { id: 'r2', capacity: 2 }, { id: 'r3', capacity: 1 }], appointments, businessHours: hours, date: monday });
    assert.deepEqual(r1, { id: 'r1', bookedMinutes: 240, workingMinutes: 480, appointments: 2, load: 50 });
    assert.deepEqual(r2, { id: 'r2', bookedMinutes: 120, workingMinutes: 960, appointments: 1, load: 13 });
    assert.deepEqual(r3, { id: 'r3', bookedMinutes: 0, workingMinutes: 480, appointments: 0, load: 0 });
    assert.equal(dayLoad({ resources: [{ id: 'r1' }], appointments, businessHours: hours, date: '2026-10-18' })[0].load, null);
  });
});
