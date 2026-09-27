import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { listFeatureFlags, isFeatureEnabled, setFeatureFlag, resetFeatureFlagCacheForTests, FEATURES } from './featureFlags.js';

function fakeDb(rows = []) {
  const db = {
    rows,
    async $executeRawUnsafe() { return 0; },
    async $queryRaw() { return db.rows.map((r) => ({ ...r })); },
    async $executeRaw(strings, key, enabled, message, updatedBy) {
      const next = { key, enabled, message, updatedAt: new Date(), updatedBy };
      db.rows = db.rows.filter((r) => r.key !== key).concat(next);
      return 1;
    },
  };
  return db;
}

describe('feature flags', () => {
  beforeEach(() => resetFeatureFlagCacheForTests());

  it('treats a missing row as enabled', async () => {
    const db = fakeDb();
    assert.equal(await isFeatureEnabled('medi', db), true);
    const list = await listFeatureFlags(db);
    assert.equal(list.length, FEATURES.length);
    assert.ok(list.every((f) => f.enabled && f.message));
  });

  it('pauses and resumes a module with a custom message', async () => {
    const db = fakeDb();
    const off = await setFeatureFlag('medi', { enabled: false, message: 'მალე დავბრუნდებით' }, { admin: { email: 'a@x' }, db });
    assert.equal(off.enabled, false);
    assert.equal(off.message, 'მალე დავბრუნდებით');
    resetFeatureFlagCacheForTests();
    assert.equal(await isFeatureEnabled('medi', db), false);
    await setFeatureFlag('medi', { enabled: true }, { db });
    resetFeatureFlagCacheForTests();
    assert.equal(await isFeatureEnabled('medi', db), true);
  });

  it('rejects unknown modules and ignores unknown keys when reading', async () => {
    const db = fakeDb();
    await assert.rejects(() => setFeatureFlag('nope', { enabled: false }, { db }), /უცნობი/);
    assert.equal(await isFeatureEnabled('nope', db), true);
  });

  it('fails open when the table cannot be read', async () => {
    const db = { async $executeRawUnsafe() { throw new Error('down'); } };
    assert.equal(await isFeatureEnabled('medi', db), true);
  });
});
