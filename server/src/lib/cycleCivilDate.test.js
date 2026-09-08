import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, toDateKey, todayInTimeZone } from './cycle.js';
import {
  assertStableCivilDate,
  CYCLE_TIMEZONE_FALLBACK,
  cycleTodayKey,
  resolveCycleClock,
  resolveCycleTimezone,
} from './cycleCivilDate.js';

describe('cycle civil-date contract', () => {
  it('keeps stored YYYY-MM-DD identical across Tbilisi, Brussels, New York, Los Angeles, Tokyo', () => {
    const stored = '2026-09-08';
    const zones = [
      'Asia/Tbilisi',
      'Europe/Brussels',
      'America/New_York',
      'America/Los_Angeles',
      'Asia/Tokyo',
    ];
    for (const tz of zones) {
      assert.equal(assertStableCivilDate(stored), stored, tz);
      assert.equal(toDateKey(stored), stored, tz);
      const clock = resolveCycleClock({
        deviceTimezone: tz,
        now: new Date('2026-09-08T12:00:00.000Z'),
      });
      assert.equal(clock.timezone, tz);
      assert.match(clock.today, /^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('does not rewrite a logged civil date when the user travels', () => {
    const logged = '2026-09-08';
    const tbilisi = resolveCycleClock({
      deviceTimezone: 'Asia/Tbilisi',
      now: new Date('2026-09-08T22:00:00.000Z'),
    });
    const brussels = resolveCycleClock({
      deviceTimezone: 'Europe/Brussels',
      now: new Date('2026-09-08T22:00:00.000Z'),
    });
    const nyc = resolveCycleClock({
      deviceTimezone: 'America/New_York',
      now: new Date('2026-09-08T22:00:00.000Z'),
    });
    assert.equal(assertStableCivilDate(logged), logged);
    assert.equal(toDateKey(logged), logged);
    assert.notEqual(tbilisi.today, nyc.today);
    assert.equal(brussels.timezone, 'Europe/Brussels');
  });

  it('uses device timezone, then stored quest timezone, then Asia/Tbilisi', () => {
    assert.equal(resolveCycleTimezone({ deviceTimezone: 'Europe/Brussels', storedTimezone: 'Asia/Tokyo' }), 'Europe/Brussels');
    assert.equal(resolveCycleTimezone({ storedTimezone: 'Asia/Tokyo' }), 'Asia/Tokyo');
    assert.equal(resolveCycleTimezone({}), CYCLE_TIMEZONE_FALLBACK);
    assert.equal(resolveCycleTimezone({ deviceTimezone: 'not-a-zone', storedTimezone: 'nope' }), CYCLE_TIMEZONE_FALLBACK);
  });

  it('keeps civil today correct around DST start and end in Brussels', () => {
    const spring = new Date('2026-03-29T01:30:00.000Z');
    const fall = new Date('2026-10-25T01:30:00.000Z');
    assert.equal(cycleTodayKey('Europe/Brussels', spring), '2026-03-29');
    assert.equal(todayInTimeZone('Europe/Brussels', spring), '2026-03-29');
    assert.match(cycleTodayKey('Europe/Brussels', fall), /^2026-10-2[45]$/);
    assert.equal(addDays('2026-03-29', 1), '2026-03-30');
    assert.equal(addDays('2026-10-25', 1), '2026-10-26');
  });

  it('resolves midnight edges without turning civil dates into UTC timestamps', () => {
    const cases = [
      { tz: 'Asia/Tbilisi', instant: '2026-09-07T19:30:00.000Z', today: '2026-09-07' },
      { tz: 'Asia/Tbilisi', instant: '2026-09-07T19:59:00.000Z', today: '2026-09-07' },
      { tz: 'Asia/Tbilisi', instant: '2026-09-07T20:01:00.000Z', today: '2026-09-08' },
      { tz: 'America/New_York', instant: '2026-09-08T03:30:00.000Z', today: '2026-09-07' },
      { tz: 'America/New_York', instant: '2026-09-08T04:01:00.000Z', today: '2026-09-08' },
      { tz: 'Asia/Tokyo', instant: '2026-09-07T14:30:00.000Z', today: '2026-09-07' },
      { tz: 'Asia/Tokyo', instant: '2026-09-07T15:01:00.000Z', today: '2026-09-08' },
      { tz: 'Europe/Brussels', instant: '2026-09-07T21:30:00.000Z', today: '2026-09-07' },
      { tz: 'Europe/Brussels', instant: '2026-09-07T22:01:00.000Z', today: '2026-09-08' },
      { tz: 'America/Los_Angeles', instant: '2026-09-08T06:30:00.000Z', today: '2026-09-07' },
      { tz: 'America/Los_Angeles', instant: '2026-09-08T07:01:00.000Z', today: '2026-09-08' },
    ];
    for (const row of cases) {
      const clock = resolveCycleClock({ deviceTimezone: row.tz, now: new Date(row.instant) });
      assert.equal(clock.today, row.today, `${row.tz} ${row.instant}`);
      assert.equal(toDateKey('2026-09-08'), '2026-09-08');
    }
  });

  it('round-trips YYYY-MM-DD through toDateKey without a day shift', () => {
    for (const key of ['2026-09-08', '2024-02-29', '2026-01-01']) {
      assert.equal(toDateKey(key), key);
      assert.equal(toDateKey(`${key}T00:00:00.000Z`), key);
      assert.equal(assertStableCivilDate(key), key);
    }
  });
});

function clientAddDaysToKey(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

describe('civil-date addDays mobile/server parity', () => {
  const cases = [
    ['2026-03-28', 1, '2026-03-29'],
    ['2026-03-29', 1, '2026-03-30'],
    ['2026-10-24', 1, '2026-10-25'],
    ['2026-10-25', 1, '2026-10-26'],
    ['2024-02-28', 1, '2024-02-29'],
    ['2025-02-28', 1, '2025-03-01'],
    ['2025-12-31', 1, '2026-01-01'],
    ['2026-01-31', 1, '2026-02-01'],
    ['2026-03-01', -1, '2026-02-28'],
  ];

  it('matches UTC civil arithmetic on DST, leap, and month/year boundaries', () => {
    for (const [key, delta, expected] of cases) {
      assert.equal(addDays(key, delta), expected, `server ${key}+${delta}`);
      assert.equal(clientAddDaysToKey(key, delta), expected, `mobile ${key}+${delta}`);
      assert.equal(clientAddDaysToKey(key, delta), addDays(key, delta));
    }
  });
});
