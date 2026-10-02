import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  listFeatureFlags, isFeatureEnabled, setFeatureFlag, resetFeatureFlagCacheForTests, FEATURES,
  featureDisabledMessage, publicFeatureFlags, publicFeatureMessages,
} from './featureFlags.js';

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

describe('module hierarchy', () => {
  beforeEach(() => resetFeatureFlagCacheForTests());

  it('pauses a child while its parent module is paused, with the parent message', async () => {
    const db = fakeDb();
    await setFeatureFlag('pets', { enabled: false, message: 'ცხოველები ისვენებენ' }, { db });
    resetFeatureFlagCacheForTests();
    assert.equal(await isFeatureEnabled('mediVet', db), false);
    assert.equal(await featureDisabledMessage('mediVet', db), 'ცხოველები ისვენებენ');
    const vet = (await listFeatureFlags(db)).find((f) => f.key === 'mediVet');
    assert.equal(vet.enabled, true);
    assert.equal(vet.effective, false);
    assert.equal(vet.blockedBy, 'pets');
    const flags = await publicFeatureFlags(db);
    assert.equal(flags.pets, false);
    assert.equal(flags.mediVet, false);
    assert.equal(flags.cycle, true);
    const messages = await publicFeatureMessages(db);
    assert.deepEqual(Object.keys(messages).sort(), ['mediVet', 'pets']);
    assert.equal(await featureDisabledMessage('mediVet', db, 'en'), 'Pets is paused for a moment. Your data is saved.');
    assert.equal((await publicFeatureMessages(db, 'en')).pets, 'Pets is paused for a moment. Your data is saved.');
  });

  it('every parent is a real top-level feature and every key is unique', () => {
    const keys = FEATURES.map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const f of FEATURES) {
      assert.ok(['module', 'ai', 'system'].includes(f.group), f.key);
      if (!f.parent) continue;
      const parent = FEATURES.find((p) => p.key === f.parent);
      assert.ok(parent, f.key);
      // blockingKey looks one level up only, so a parent must not have a parent of its own.
      assert.equal(parent.parent, undefined, f.key);
    }
  });

  it('pauses every Medi tool with Medi and each tool on its own', async () => {
    const db = fakeDb();
    await setFeatureFlag('medi', { enabled: false, message: 'Medi ისვენებს' }, { db });
    resetFeatureFlagCacheForTests();
    for (const key of ['mediDoctor', 'mediDeep', 'symptoms', 'imaging', 'skin', 'voice']) {
      assert.equal(await isFeatureEnabled(key, db), false, key);
      assert.equal(await featureDisabledMessage(key, db), 'Medi ისვენებს', key);
    }
    await setFeatureFlag('medi', { enabled: true }, { db });
    await setFeatureFlag('symptoms', { enabled: false }, { db });
    resetFeatureFlagCacheForTests();
    assert.equal(await isFeatureEnabled('medi', db), true);
    assert.equal(await isFeatureEnabled('symptoms', db), false);
    assert.equal(await isFeatureEnabled('mediDoctor', db), true);
  });

  it('lets core health modules be paused like any other', async () => {
    const db = fakeDb();
    await setFeatureFlag('visits', { enabled: false }, { db });
    resetFeatureFlagCacheForTests();
    assert.equal(await isFeatureEnabled('visits', db), false);
    assert.equal(await isFeatureEnabled('medications', db), true);
    const flags = await publicFeatureFlags(db);
    assert.equal(flags.visits, false);
    assert.ok((await featureDisabledMessage('visits', db)).length > 10);
    assert.ok(/visit/i.test(await featureDisabledMessage('visits', db, 'en')));
  });
});
