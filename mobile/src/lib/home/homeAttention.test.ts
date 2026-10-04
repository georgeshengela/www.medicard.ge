import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysUntil, recentLab, upcomingVisit } from './homeAttention.ts';

const visit = (id: string, visitDate: string, visitTime = '10:00', active = true) => ({ id, visitDate, visitTime, active, doctorType: 'CARDIOLOGIST' });

test('the nearest active visit within 7 days, today included', () => {
  const today = '2026-10-04';
  assert.equal(upcomingVisit([visit('a', '2026-10-09'), visit('b', '2026-10-05', '09:00'), visit('c', '2026-10-05', '08:00')], today)?.id, 'c');
  assert.equal(upcomingVisit([visit('a', '2026-10-04')], today)?.id, 'a');
  assert.equal(upcomingVisit([visit('a', '2026-10-12')], today), null);
  assert.equal(upcomingVisit([visit('a', '2026-10-03')], today), null);
  assert.equal(upcomingVisit([visit('a', '2026-10-05', '10:00', false)], today), null);
});

test('days until crosses month ends', () => {
  assert.equal(daysUntil('2026-11-01', '2026-10-31'), 1);
  assert.equal(daysUntil('2026-10-04', '2026-10-04'), 0);
});

test('a lab from the last 14 days, with values outside the range counted', () => {
  const today = '2026-10-04';
  const panels = [
    { date: '2026-09-28', parameters: [{ flag: 'H' }, { flag: 'N' }] },
    { date: '2026-09-28', parameters: [{ flag: 'L' }] },
    { date: '2026-08-01', parameters: [{ flag: 'H' }] },
  ];
  assert.deepEqual(recentLab(panels, today), { date: '2026-09-28', outside: 2, total: 3 });
  assert.equal(recentLab([{ date: '2026-09-01', parameters: [{ flag: 'H' }] }], today), null);
  assert.equal(recentLab([], today), null);
});
