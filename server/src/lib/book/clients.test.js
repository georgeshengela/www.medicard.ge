import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { statsFrom } from './clients.js';

const day = (n) => new Date(Date.UTC(2026, 9, 1 + n, 10)).toISOString();
const visit = (n, extra = {}) => ({ status: 'COMPLETED', startsAt: day(n), endsAt: day(n), serviceName: 'მანიკური', staffName: 'ნინო', ...extra });

describe('MEDIBOOK client card numbers', () => {
  it('cadence, average check, favourites, overdue', () => {
    const now = new Date(Date.UTC(2026, 9, 31, 12));
    const client = { visits: 3, noShows: 1, totalSpent: 300, firstVisitAt: day(0), lastVisitAt: day(20) };
    const s = statsFrom(client, [visit(0), visit(10), visit(20, { serviceName: 'პედიკური' }), { status: 'CANCELLED', startsAt: day(25), endsAt: day(25) }], { now });
    assert.equal(s.avgCheck, 100);
    assert.equal(s.cadenceDays, 10);
    assert.equal(s.cancelled, 1);
    assert.equal(s.noShowRate, 25);
    assert.deepEqual(s.favouriteService, { name: 'მანიკური', count: 2 });
    assert.equal(s.favouriteStaff.name, 'ნინო');
    assert.equal(s.daysSinceLast, 10);
    assert.equal(s.dueAt, day(30));
    assert.equal(s.overdue, true);
    assert.equal(s.nextAt, null);
  });

  it('an upcoming booking cancels the overdue flag; one visit has no cadence', () => {
    const now = new Date(Date.UTC(2026, 9, 31, 12));
    const future = new Date(Date.UTC(2026, 10, 5, 10)).toISOString();
    const s = statsFrom({ visits: 1, noShows: 0, totalSpent: 50 }, [visit(0), { status: 'CONFIRMED', startsAt: future, endsAt: future }], { now });
    assert.equal(s.cadenceDays, null);
    assert.equal(s.dueAt, null);
    assert.equal(s.overdue, false);
    assert.equal(s.nextAt, future);
    assert.equal(s.upcomingCount, 1);
  });
});
