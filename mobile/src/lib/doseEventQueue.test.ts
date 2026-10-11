import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOSE_EVENT_BATCH,
  DOSE_EVENT_TTL_MS,
  dueDoseEvents,
  keepAfterFailure,
  parseDoseEvents,
  queueDoseEvent,
  settleDoseEvents,
  type DoseEvent,
} from './doseEventQueue.ts';

const NOW = Date.parse('2026-10-11T06:00:00.000Z');
const event = (over: Partial<DoseEvent> = {}): DoseEvent => ({
  medicationId: 'med-1',
  date: '2026-10-11',
  time: '08:30',
  status: 'taken',
  source: 'notification',
  occurredAt: '2026-10-11T04:31:00.000Z',
  ...over,
});

test('a queued answer is kept until the server took it', () => {
  const queue = queueDoseEvent([], event());
  assert.deepEqual(dueDoseEvents(queue, NOW), [event()]);
  // Nothing sent (offline, suspended, locked phone): still there.
  assert.deepEqual(settleDoseEvents(queue, [], NOW), [event()]);
  // Sent: gone.
  assert.deepEqual(settleDoseEvents(queue, [event()], NOW), []);
});

test('one row per dose: the newer answer replaces the queued one, an older one never does', () => {
  const tap = event();
  const undo = event({ status: 'skipped', source: 'app', occurredAt: '2026-10-11T05:00:00.000Z' });
  assert.deepEqual(queueDoseEvent(queueDoseEvent([], tap), undo), [undo]);
  assert.deepEqual(queueDoseEvent(queueDoseEvent([], undo), tap), [undo]);
  // Another dose of the day is its own row.
  const evening = event({ time: '20:30', occurredAt: '2026-10-11T16:31:00.000Z' });
  assert.equal(queueDoseEvent(queueDoseEvent([], tap), evening).length, 2);
});

test('an answer given again while the request was out keeps its newer row', () => {
  const tap = event();
  const inFlight = dueDoseEvents(queueDoseEvent([], tap), NOW);
  const undo = event({ status: 'skipped', source: 'app', occurredAt: '2026-10-11T05:00:00.000Z' });
  const meanwhile = queueDoseEvent(queueDoseEvent([], tap), undo);
  assert.deepEqual(settleDoseEvents(meanwhile, inFlight, NOW), [undo]);
});

test('oldest first, one request at a time, expired answers are dropped unsent', () => {
  const old = event({ date: '2026-10-01', occurredAt: new Date(NOW - DOSE_EVENT_TTL_MS - 60_000).toISOString() });
  const queue = queueDoseEvent(queueDoseEvent([], event({ time: '20:30', occurredAt: '2026-10-10T16:31:00.000Z' })), old);
  const queued = queueDoseEvent(queue, event());
  assert.deepEqual(
    dueDoseEvents(queued, NOW).map((row) => row.time),
    ['20:30', '08:30'],
  );
  assert.equal(settleDoseEvents(queued, [], NOW).some((row) => row.date === '2026-10-01'), false);
  let many: DoseEvent[] = [];
  for (let i = 0; i < DOSE_EVENT_BATCH + 5; i += 1) {
    many = queueDoseEvent(many, event({ medicationId: `med-${i}`, occurredAt: new Date(NOW - (i + 1) * 60_000).toISOString() }));
  }
  assert.equal(dueDoseEvents(many, NOW).length, DOSE_EVENT_BATCH);
});

test('unreadable storage and rows are ignored', () => {
  assert.deepEqual(parseDoseEvents(null), []);
  assert.deepEqual(parseDoseEvents('{oops'), []);
  assert.deepEqual(parseDoseEvents('{"a":1}'), []);
  const raw = JSON.stringify([event(), { medicationId: 'x' }, event({ source: 'push' as never }), event({ occurredAt: 'soon' })]);
  assert.deepEqual(parseDoseEvents(raw), [event()]);
});

test('passing failures are tried again; a refusal is final', () => {
  for (const status of [0, 401, 408, 429, 500, 502, 503]) assert.equal(keepAfterFailure(status), true, String(status));
  for (const status of [400, 403, 404, 409, 413, 422]) assert.equal(keepAfterFailure(status), false, String(status));
});
