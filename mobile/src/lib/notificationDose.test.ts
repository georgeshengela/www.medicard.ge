import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PENDING_DOSE_TTL_MS,
  doseDateForNotification,
  mergeDoseLogs,
  notificationDoseEntry,
  notificationTimeMs,
  queuePendingDose,
  takePendingDoses,
} from './notificationDose.ts';

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).getTime();

test('delivery time: iOS sends seconds, Android milliseconds', () => {
  const ms = at(2026, 10, 8, 8, 0);
  assert.equal(notificationTimeMs(ms / 1000, ms + 60_000), ms);
  assert.equal(notificationTimeMs(ms, ms + 60_000), ms);
  assert.equal(notificationTimeMs((ms + 500) / 1000, ms + 60_000), ms + 500);
});

test('delivery time: missing, broken or future values fall back to now', () => {
  const now = at(2026, 10, 8, 9, 0);
  assert.equal(notificationTimeMs(undefined, now), now);
  assert.equal(notificationTimeMs(null, now), now);
  assert.equal(notificationTimeMs('soon', now), now);
  assert.equal(notificationTimeMs(0, now), now);
  assert.equal(notificationTimeMs(-5, now), now);
  assert.equal(notificationTimeMs(Number.NaN, now), now);
  assert.equal(notificationTimeMs(now + 3 * 3_600_000, now), now);
});

test('dose date: an ordinary morning reminder is today', () => {
  assert.equal(doseDateForNotification('08:00', at(2026, 10, 8, 8, 0)), '2026-10-08');
  assert.equal(doseDateForNotification('08:00', at(2026, 10, 8, 21, 30)), '2026-10-08');
});

test('dose date: a late-evening dose answered after midnight belongs to the evening before', () => {
  // The 23:30 reminder, snoozed twice, fires at 00:10 — still yesterday's 23:30 dose.
  assert.equal(doseDateForNotification('23:30', at(2026, 10, 9, 0, 10)), '2026-10-08');
  assert.equal(doseDateForNotification('20:00', at(2026, 10, 9, 7, 30)), '2026-10-08');
});

test('dose date: month and year rollover', () => {
  assert.equal(doseDateForNotification('23:00', at(2026, 11, 1, 0, 20)), '2026-10-31');
  assert.equal(doseDateForNotification('22:00', at(2027, 1, 1, 0, 5)), '2026-12-31');
});

test('dose date: a malformed time keeps the delivery day', () => {
  assert.equal(doseDateForNotification('soon', at(2026, 10, 9, 0, 10)), '2026-10-09');
});

test('„მივიღე ✓“ entry: dated by the delivery, not by the tap', () => {
  const delivered = at(2026, 10, 8, 23, 30);
  const tappedAt = at(2026, 10, 9, 0, 15);
  const entry = notificationDoseEntry({ medicationId: 'med-1', time: '23:30' }, delivered / 1000, tappedAt);
  assert.deepEqual(entry, {
    medicationId: 'med-1',
    date: '2026-10-08',
    time: '23:30',
    status: 'taken',
    updatedAt: new Date(tappedAt).toISOString(),
  });
});

test('„მივიღე ✓“ entry: needs a medication id', () => {
  assert.equal(notificationDoseEntry({ time: '08:00' }, undefined, at(2026, 10, 8, 8)), null);
  assert.equal(notificationDoseEntry({ medicationId: '', time: '08:00' }, undefined, at(2026, 10, 8, 8)), null);
});

test('„მივიღე ✓“ entry: an old payload without a time keeps the old 08:00 fallback', () => {
  const entry = notificationDoseEntry({ medicationId: 'med-1' }, undefined, at(2026, 10, 8, 9));
  assert.equal(entry?.time, '08:00');
  assert.equal(entry?.date, '2026-10-08');
});

const log = (medicationId: string, date: string, time: string, updatedAt: string, status = 'taken') =>
  ({ medicationId, date, time, status, updatedAt }) as const;

test('merge: a newer mark replaces the same dose, other doses stay', () => {
  const base = [
    log('a', '2026-10-08', '08:00', '2026-10-08T05:00:00.000Z', 'skipped'),
    log('b', '2026-10-08', '20:00', '2026-10-08T17:00:00.000Z'),
  ];
  const merged = mergeDoseLogs(base, [log('a', '2026-10-08', '08:00', '2026-10-08T06:00:00.000Z')]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((row) => row.medicationId === 'a')?.status, 'taken');
  assert.equal(merged.find((row) => row.medicationId === 'b')?.status, 'taken');
});

test('merge: an older mark never overwrites a newer one', () => {
  const base = [log('a', '2026-10-08', '08:00', '2026-10-08T07:00:00.000Z', 'skipped')];
  const merged = mergeDoseLogs(base, [log('a', '2026-10-08', '08:00', '2026-10-08T06:00:00.000Z')]);
  assert.equal(merged[0].status, 'skipped');
});

test('pending queue: one entry per dose, newest wins', () => {
  const now = at(2026, 10, 8, 8, 1);
  let queue = queuePendingDose([], log('a', '2026-10-08', '08:00', '2026-10-08T05:01:00.000Z'), now);
  queue = queuePendingDose(queue, log('a', '2026-10-08', '08:00', '2026-10-08T05:02:00.000Z'), now + 60_000);
  queue = queuePendingDose(queue, log('b', '2026-10-08', '08:00', '2026-10-08T05:02:00.000Z'), now + 60_000);
  assert.equal(queue.length, 2);
  assert.equal(queue.find((row) => row.medicationId === 'a')?.updatedAt, '2026-10-08T05:02:00.000Z');
});

test('pending queue: entries older than the TTL are dropped, fresh ones are applied', () => {
  const queuedAt = at(2026, 10, 8, 8, 1);
  const queue = queuePendingDose([], log('a', '2026-10-08', '08:00', '2026-10-08T05:01:00.000Z'), queuedAt);
  assert.equal(takePendingDoses(queue, queuedAt + 60_000).length, 1);
  assert.equal(takePendingDoses(queue, queuedAt + PENDING_DOSE_TTL_MS + 1).length, 0);
  // Garbage from storage never crashes the drain.
  assert.deepEqual(takePendingDoses([null, { medicationId: 3 }, 'x'] as unknown[], queuedAt), []);
  const applied = takePendingDoses(queue, queuedAt + 60_000)[0];
  assert.deepEqual(Object.keys(applied).sort(), ['date', 'medicationId', 'status', 'time', 'updatedAt']);
});
