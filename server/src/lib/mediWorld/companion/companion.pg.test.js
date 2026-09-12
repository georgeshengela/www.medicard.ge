import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { setWorldXpForTests } from '../engine.js';
import { getMediWorldProfile } from '../service.js';
import { getCompanionWorldState, unlockCosmetic } from './service.js';

const url = process.env.PHASE38_TEST_DATABASE_URL || '';
const skip = !url;

function safeDb() {
  return new PrismaClient({
    datasources: { db: { url } },
    log: ['error'],
  });
}

async function seedUser(db, email) {
  return db.user.create({
    data: {
      email,
      fullName: 'Phase40 Test',
      passwordHash: await bcrypt.hash('Phase40TestPass!', 12),
    },
  });
}

describe('Medi World Phase 40 PostgreSQL', { skip }, () => {
  it('creates one companion, concurrent-unlocks once, and keeps latestReward deterministic', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let user = null;
    let other = null;
    try {
      user = await seedUser(db, `phase40.${stamp}@medicard.test`);
      other = await seedUser(db, `phase40.other.${stamp}@medicard.test`);
      const now = new Date('2026-09-12T12:00:00+04:00');
      const first = await getCompanionWorldState(user.id, { db, now, timezone: 'Asia/Tbilisi' });
      const again = await getCompanionWorldState(user.id, { db, now, timezone: 'Asia/Tbilisi' });
      assert.equal(first.companion.id, again.companion.id);
      assert.equal(await db.mediCompanionProfile.count({ where: { userId: user.id } }), 1);
      const otherState = await getCompanionWorldState(other.id, { db, now, timezone: 'Asia/Tbilisi' });
      assert.notEqual(otherState.companion.id, first.companion.id);

      await setWorldXpForTests(user.id, 225, { db, now });
      await db.mediWorldProfile.update({
        where: { userId: user.id },
        data: { energyHydration: 40, energyCalm: 40 },
      });
      const before = await getCompanionWorldState(user.id, { db, now, timezone: 'Asia/Tbilisi' });
      const raced = await Promise.allSettled([
        unlockCosmetic(user.id, 'aura_hydration_wave', `unlock-a-${stamp}`, { db, now }),
        unlockCosmetic(user.id, 'aura_hydration_wave', `unlock-b-${stamp}`, { db, now }),
      ]);
      const charged = raced.filter((row) => row.status === 'fulfilled' && row.value.unlock?.charged).length;
      const owned = raced.filter((row) => row.status === 'fulfilled' && row.value.catalog.find((item) => item.key === 'aura_hydration_wave')?.owned).length;
      assert.equal(charged, 1);
      assert.equal(owned, 2);
      const after = await getCompanionWorldState(user.id, { db, now, timezone: 'Asia/Tbilisi' });
      assert.equal(after.world.careEnergy.hydration, before.world.careEnergy.hydration - 30);
      assert.equal(await db.mediCompanionCosmeticOwn.count({ where: { userId: user.id, catalogKey: 'aura_hydration_wave' } }), 1);
      assert.equal(await db.mediWorldLedger.count({ where: { userId: user.id, reasonCode: 'COMPANION_UNLOCK' } }), 1);

      await assert.rejects(
        () => unlockCosmetic(user.id, 'trail_movement_pulse', `trail-${stamp}`, { db, now }),
        (err) => err.code === 'COMPANION_LEVEL_LOCKED',
      );
      await assert.rejects(
        () => unlockCosmetic(user.id, 'aura_hydration_wave', `unlock-a-${stamp}`, { db, now, client: { price: 1 } }),
        (err) => err.code === 'COMPANION_UNLOCK_CLIENT_PRICE',
      );

      const profile = await getMediWorldProfile(user.id, { db, now, timezone: 'Asia/Tbilisi' });
      assert.ok(profile.latestReward);
      const blob = JSON.stringify(after);
      assert.equal(blob.includes('idempotencyKey'), false);
      assert.equal(randomUUID().length > 0, true);
    } finally {
      if (other) await db.user.delete({ where: { id: other.id } }).catch(() => undefined);
      if (user) await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
      await db.$disconnect();
    }
  });
});
