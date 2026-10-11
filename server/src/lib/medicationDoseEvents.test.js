import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDoseEventInput, upsertMedicationDoseEvents } from './medicationDoseEvents.js';

/**
 * Applies the dose-event upsert the way Postgres does: one row per (user, medication, date, time); on a
 * conflict the update runs unless the statement's WHERE (existing occurredAt <= new) rejects it.
 */
function fakeDb() {
  const rows = new Map();
  return {
    rows,
    $executeRawUnsafe: async () => 0,
    $executeRaw: async (strings, ...values) => {
      const sql = strings.join('?');
      assert.match(sql, /INSERT INTO "MedicationDoseEvent"/);
      const [id, userId, medicationId, date, time, status, source, occurredAt] = values;
      const key = [userId, medicationId, date, time].join('|');
      const existing = rows.get(key);
      if (!existing) {
        rows.set(key, { id, userId, medicationId, date, time, status, source, occurredAt });
        return 1;
      }
      const guarded = /WHERE "MedicationDoseEvent"\."occurredAt" <= EXCLUDED\."occurredAt"/.test(sql);
      if (guarded && !(existing.occurredAt <= occurredAt)) return 0;
      rows.set(key, { ...existing, status, source, occurredAt });
      return 1;
    },
  };
}

const dose = (over = {}) => ({ medicationId: 'med-1', date: '2026-10-11', time: '08:30', status: 'taken', ...over });
const only = (db) => [...db.rows.values()][0];

describe('medication dose events', () => {
  it('stores a reminder answer with its notification source', async () => {
    const db = fakeDb();
    await upsertMedicationDoseEvents('u1', [dose({ source: 'notification', occurredAt: '2026-10-11T04:31:00.000Z' })], db);
    assert.equal(db.rows.size, 1);
    assert.equal(only(db).source, 'notification');
    assert.equal(only(db).status, 'taken');
    assert.equal(only(db).time, '08:30');
  });

  it('a replayed older answer never overwrites a newer one of the same dose', async () => {
    const db = fakeDb();
    // She undid the reminder's „მივიღე ✓“ in the app; the phone sends the queued tap only afterwards.
    await upsertMedicationDoseEvents('u1', [dose({ status: 'skipped', source: 'app', occurredAt: '2026-10-11T05:00:00.000Z' })], db);
    await upsertMedicationDoseEvents('u1', [dose({ source: 'notification', occurredAt: '2026-10-11T04:31:00.000Z' })], db);
    assert.equal(db.rows.size, 1);
    assert.equal(only(db).status, 'skipped');
    assert.equal(only(db).source, 'app');
  });

  it('a newer answer still replaces an older one', async () => {
    const db = fakeDb();
    await upsertMedicationDoseEvents('u1', [dose({ source: 'notification', occurredAt: '2026-10-11T04:31:00.000Z' })], db);
    await upsertMedicationDoseEvents('u1', [dose({ status: 'skipped', source: 'app', occurredAt: '2026-10-11T05:00:00.000Z' })], db);
    assert.equal(only(db).status, 'skipped');
    assert.equal(only(db).source, 'app');
  });

  it('keeps the two known sources and drops anything else', () => {
    assert.equal(sanitizeDoseEventInput(dose({ source: 'notification' }), 'u1').source, 'notification');
    assert.equal(sanitizeDoseEventInput(dose({ source: 'NOTIFICATION' }), 'u1').source, 'notification');
    assert.equal(sanitizeDoseEventInput(dose(), 'u1').source, 'app');
    assert.equal(sanitizeDoseEventInput(dose({ source: 'push' }), 'u1'), null);
  });
});
