import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDaysYmd,
  competitionInterval,
  datesToCollect,
  intervalSpansTwoCompetitionDates,
  tbilisiMidnight,
  tbilisiYmd,
} from './civilTime.js';

describe('tbilisi moves civil time', () => {
  it('uses Asia/Tbilisi, not the host timezone, for a UTC evening instant', () => {
    const utcEvening = new Date('2026-09-14T21:30:00.000Z');
    assert.equal(tbilisiYmd(utcEvening), '2026-09-15');
    assert.equal(tbilisiMidnight('2026-09-15').toISOString(), '2026-09-14T20:00:00.000Z');
  });

  it('never returns an interval spanning two competition dates', () => {
    const now = new Date('2026-09-14T18:00:00.000Z');
    const interval = competitionInterval('2026-09-14', now);
    assert.equal(interval.tbilisiDate, '2026-09-14');
    assert.equal(intervalSpansTwoCompetitionDates(interval.start, interval.end), false);
    assert.ok(interval.end.getTime() <= tbilisiMidnight('2026-09-15').getTime());
  });

  it('collects yesterday separately while grace is open', () => {
    const now = new Date('2026-09-15T00:30:00.000+04:00');
    const dates = datesToCollect({ serverDate: '2026-09-15', graceHours: 8, now });
    assert.deepEqual(dates, ['2026-09-15', '2026-09-14']);
    assert.equal(addDaysYmd('2026-09-15', -1), '2026-09-14');
  });
});
