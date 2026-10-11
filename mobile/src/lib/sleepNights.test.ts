import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nightlySleepHours, sleepDayStart, sleepQueryStart, type SleepPiece } from './sleepNights.ts';

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const piece = (from: number, to: number, asleep = true): SleepPiece => ({ start: from, end: to, asleep });

test('a Watch night: in-bed and awake pieces do not add to the stages', () => {
  const pieces = [
    piece(at(10, 23, 0), at(11, 7, 30), false), // in bed
    piece(at(10, 23, 20), at(11, 2, 0)), // core
    piece(at(11, 2, 0), at(11, 2, 30)), // deep
    piece(at(11, 3, 0), at(11, 7, 0)), // REM / core
  ];
  assert.deepEqual(nightlySleepHours(pieces, '2026-10-01'), [{ date: '2026-10-11', value: 7.2 }]);
});

test('iPhone + Watch writing the same night count it once', () => {
  const watch = [piece(at(10, 23, 0), at(11, 6, 0))];
  const phone = [piece(at(10, 23, 30), at(11, 6, 30))];
  assert.deepEqual(nightlySleepHours([...watch, ...phone], '2026-10-01'), [{ date: '2026-10-11', value: 7.5 }]);
});

test('a night that starts before midnight belongs to the wake-up day, not split in two', () => {
  const pieces = [piece(at(10, 22, 0), at(10, 23, 59)), piece(at(11, 0, 0), at(11, 6, 0))];
  assert.deepEqual(nightlySleepHours(pieces, '2026-10-01'), [{ date: '2026-10-11', value: 8 }]);
});

test('in-bed time counts only for a day without asleep data', () => {
  const pieces = [
    piece(at(9, 23, 0), at(10, 7, 0), false), // iPhone-only night: in bed only
    piece(at(10, 23, 0), at(11, 7, 0), false),
    piece(at(10, 23, 30), at(11, 6, 30)),
  ];
  assert.deepEqual(nightlySleepHours(pieces, '2026-10-01'), [
    { date: '2026-10-10', value: 8 },
    { date: '2026-10-11', value: 7 },
  ]);
});

test('an afternoon nap joins that day; days before the window are dropped', () => {
  const pieces = [
    piece(at(4, 23, 0), at(5, 7, 0)),
    piece(at(10, 23, 0), at(11, 6, 0)),
    piece(at(11, 14, 0), at(11, 15, 0)),
  ];
  assert.deepEqual(nightlySleepHours(pieces, '2026-10-06'), [{ date: '2026-10-11', value: 8 }]);
});

test('the read starts early enough to hold the first day’s whole night', () => {
  const firstDay = new Date(2026, 9, 5);
  assert.equal(sleepDayStart(firstDay).getTime(), at(4, 18));
  assert.ok(sleepQueryStart(firstDay).getTime() < at(4, 18));
});
