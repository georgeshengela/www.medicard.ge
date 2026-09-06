import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyHydrationEvents,
  clampHydrationMl,
  mergeHydrationSnapshot,
  sanitizeHydrationEvent,
} from './hydrationSync.js';
import { createQuestFakeDb } from './questFakeDb.js';

describe('hydration snapshot merge', () => {
  it('uses max so a retried daily total cannot double', () => {
    assert.equal(mergeHydrationSnapshot(null, 1500), 1500);
    assert.equal(mergeHydrationSnapshot(1500, 1500), 1500);
    assert.equal(mergeHydrationSnapshot(800, 1500), 1500);
    assert.equal(mergeHydrationSnapshot(1500, null), 1500);
    assert.equal(clampHydrationMl(25_000), 20_000);
  });
});

describe('hydration event idempotency', () => {
  it('accepts a unique event once and ignores the same retry', async () => {
    const db = createQuestFakeDb();
    const event = { clientEventId: 'log-1', date: '2026-09-06', deltaMl: 250 };
    const first = await applyHydrationEvents(db, 'u1', [event]);
    const second = await applyHydrationEvents(db, 'u1', [event]);
    assert.equal(first.inserted, 1);
    assert.equal(second.inserted, 0);
    assert.equal(second.duplicates, 1);
    assert.equal(first.totals.get('2026-09-06'), 250);
    assert.equal(second.totals.get('2026-09-06'), 250);
  });

  it('sums distinct events and applies a delete without resurrecting the add', async () => {
    const db = createQuestFakeDb();
    await applyHydrationEvents(db, 'u1', [
      { clientEventId: 'add-1', date: '2026-09-06', deltaMl: 400 },
    ]);
    const afterDelete = await applyHydrationEvents(db, 'u1', [
      { clientEventId: 'del-1', date: '2026-09-06', deltaMl: -400 },
    ]);
    assert.equal(afterDelete.totals.get('2026-09-06'), 0);
    const replay = await applyHydrationEvents(db, 'u1', [
      { clientEventId: 'add-1', date: '2026-09-06', deltaMl: 400 },
      { clientEventId: 'del-1', date: '2026-09-06', deltaMl: -400 },
    ]);
    assert.equal(replay.inserted, 0);
    assert.equal(replay.totals.get('2026-09-06'), 0);
  });

  it('rejects malformed events', () => {
    assert.equal(sanitizeHydrationEvent({ clientEventId: '', date: '2026-09-06', deltaMl: 10 }), null);
    assert.equal(sanitizeHydrationEvent({ clientEventId: 'x', date: 'bad', deltaMl: 10 }), null);
    assert.equal(sanitizeHydrationEvent({ clientEventId: 'x', date: '2026-09-06', deltaMl: 0 }), null);
  });
});
