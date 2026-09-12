import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { processWorldActivity } from '../engine.js';
import { getGarden, plantInPlot, storePlant } from './service.js';

const url = process.env.PHASE38_TEST_DATABASE_URL || '';
const skip = !url;
const NOW = new Date('2026-09-14T12:00:00.000Z');

function safeDb() {
  return new PrismaClient({
    datasources: { db: { url } },
    log: ['error'],
  });
}

function opts(db, extra = {}) {
  return {
    db,
    now: extra.now || NOW,
    timezone: extra.timezone || 'UTC',
    flags: { nodeEnv: 'test', flag: '1', gardenFlag: extra.gardenFlag ?? '1' },
    user: extra.user || { timezone: 'UTC' },
  };
}

async function seedUser(db, email) {
  return db.user.create({
    data: {
      email,
      fullName: 'Phase44 Garden',
      passwordHash: await bcrypt.hash('Phase44GardenPass!', 12),
    },
  });
}

async function grant(db, userId, type, adapterId, n = 2) {
  for (let i = 0; i < n; i += 1) {
    const now = new Date(NOW.getTime() + (i - 10) * 86_400_000);
    await processWorldActivity(
      userId,
      {
        sourceType: 'FOUNDATION_TEST',
        sourceId: `pg-g-${type}-${i}-${userId}`,
        idempotencyKey: `pg-g-${type}-${i}-${userId}`,
        adapterId,
        energyType: type,
        progressState: 'verified',
        personalTarget: 1500,
        completedAmount: 1500,
      },
      opts(db, { now }),
    );
  }
}

describe('Medi World Phase 44 PostgreSQL', { skip }, () => {
  it('persists planting, debit, nurture, and storage across a reconnect', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let user = null;
    try {
      user = await seedUser(db, `phase44.${stamp}@medicard.test`);
      await grant(db, user.id, 'movement', 'activity.walking');
      const planted = await plantInPlot(
        user.id,
        0,
        { catalogKey: 'pulse_fern', idempotencyKey: `pg-plant-${stamp}` },
        opts(db),
      );
      assert.equal(planted.plant.stage, 'seed');
      const afterDebit = planted.world.profile.careEnergy.movement;
      assert.equal(afterDebit, 0);
      assert.equal(await db.mediWorldLedger.count({ where: { userId: user.id, reasonCode: 'GARDEN_PLANT' } }), 1);

      await processWorldActivity(
        user.id,
        {
          sourceType: 'QUEST_COMPLETION',
          sourceId: `pg-nurture-${stamp}`,
          idempotencyKey: `pg-nurture-${stamp}`,
          adapterId: 'quest.daily_steps',
          energyType: 'movement',
          progressState: 'verified',
          personalTarget: 1500,
          completedAmount: 1500,
        },
        opts(db, { now: new Date(NOW.getTime() + 3600_000) }),
      );

      const grown = await getGarden(user.id, opts(db));
      assert.equal(grown.plots[0].plant.nurtureDays, 1);
      assert.equal(grown.plots[0].plant.stage, 'sprout');
      await storePlant(user.id, planted.plant.id, { idempotencyKey: `pg-store-${stamp}` }, opts(db));
    } finally {
      await db.$disconnect();
    }

    const db2 = safeDb();
    try {
      const again = await getGarden(user.id, opts(db2));
      assert.equal(again.stored[0].stage, 'sprout');
      assert.equal(again.stored[0].nurtureDays, 1);
      assert.equal(again.world.profile.careEnergy.movement, 10);
    } finally {
      await db2.$disconnect();
    }
  });

  it('does not nurture from an abandoned-style zero credit and stays disabled in production flags', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let user = null;
    try {
      user = await seedUser(db, `phase44b.${stamp}@medicard.test`);
      await grant(db, user.id, 'hydration', 'activity.hydration');
      await plantInPlot(
        user.id,
        0,
        { catalogKey: 'dew_lily', idempotencyKey: `pg-h-${stamp}` },
        opts(db),
      );
      await processWorldActivity(
        user.id,
        {
          sourceType: 'MOVEMENT_SESSION',
          sourceId: `pg-fail-${stamp}`,
          idempotencyKey: `pg-fail-${stamp}`,
          adapterId: 'activity.movement_session',
          energyType: 'movement',
          progressState: 'verified',
          personalTarget: 1500,
          completedAmount: 0,
        },
        opts(db),
      );
      const garden = await getGarden(user.id, opts(db));
      assert.equal(garden.plots[0].plant.nurtureDays, 0);
      await assert.rejects(
        () => getGarden(user.id, opts(db, { gardenFlag: '0' })),
        (error) => error.code === 'GARDEN_DISABLED',
      );
    } finally {
      if (user) {
        await db.careGarden.deleteMany({ where: { userId: user.id } }).catch(() => 0);
        await db.user.delete({ where: { id: user.id } }).catch(() => 0);
      }
      await db.$disconnect();
    }
  });
});
