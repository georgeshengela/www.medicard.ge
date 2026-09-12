import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { assignDailyQuests, completeQuest } from '../../quest.js';
import {
  activateRestDay,
  getTodayAdventure,
  swapAdventureSlot,
  updateAdventurePreferences,
} from './service.js';

const url = process.env.PHASE38_TEST_DATABASE_URL || '';
const skip = !url;

function safeDb() {
  return new PrismaClient({
    datasources: { db: { url } },
    log: ['error'],
  });
}

async function seedUser(db, email) {
  const user = await db.user.create({
    data: {
      email,
      fullName: 'Phase41 Test',
      passwordHash: await bcrypt.hash('Phase41TestPass!', 12),
    },
  });
  await db.hydrationPreference.create({ data: { userId: user.id, goalMl: 2000 } });
  await db.stepTrackingCapability.create({
    data: { userId: user.id, status: 'AVAILABLE', source: 'APPLE_HEALTH' },
  });
  return user;
}

describe('Medi World Phase 41 PostgreSQL', { skip }, () => {
  it('persists one adventure, concurrent generation, swap, rest day, and quest completion', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let user = null;
    try {
      user = await seedUser(db, `phase41.${stamp}@medicard.test`);
      const now = new Date('2026-09-12T12:00:00+04:00');
      const opts = { db, now, timezone: 'Asia/Tbilisi' };
      await updateAdventurePreferences(user.id, { intensity: 'balanced' }, opts);
      await assignDailyQuests(user.id, '2026-09-12', opts);
      const raced = await Promise.all([
        getTodayAdventure(user.id, opts),
        getTodayAdventure(user.id, opts),
      ]);
      assert.equal(raced[0].adventure.periodKey, raced[1].adventure.periodKey);
      assert.equal(await db.mediWorldDailyAdventure.count({ where: { userId: user.id } }), 1);
      const stored = await db.mediWorldDailyAdventure.findFirst({ where: { userId: user.id } });
      assert.equal(stored.rulesetVersion, 'medi-world-adventure-v1');

      const retry = await getTodayAdventure(user.id, opts);
      assert.equal(retry.adventure.periodKey, raced[0].adventure.periodKey);

      const swapped = await swapAdventureSlot(user.id, 'anchor', `swap-${stamp}`, opts);
      assert.ok(swapped.adventure.swapCount >= 1);

      const rest = await activateRestDay(user.id, opts);
      assert.equal(rest.adventure.restDay, true);
      const restAgain = await activateRestDay(user.id, opts);
      assert.equal(restAgain.adventure.restDay, true);

      const medi = retry.adventure.slots.find((row) => row.capabilityKey === 'quest.daily_medi')
        || restAgain.adventure.slots.find((row) => row.userQuestId);
      if (medi?.userQuestId) {
        await db.userQuest.update({ where: { id: medi.userQuestId }, data: { progress: 99 } });
        const quest = await db.userQuest.findUnique({ where: { id: medi.userQuestId } });
        await db.userQuest.update({ where: { id: medi.userQuestId }, data: { progress: quest.target } });
        const done = await completeQuest(user.id, medi.userQuestId, opts);
        assert.equal(done.completed || done.alreadyCompleted, true);
        const after = await getTodayAdventure(user.id, opts);
        const slot = after.adventure.slots.find((row) => row.userQuestId === medi.userQuestId);
        if (slot && slot.selected) assert.equal(slot.status, 'completed');
        assert.equal(
          await db.mediWorldLedger.count({ where: { userId: user.id, sourceType: 'QUEST_COMPLETION' } }),
          1,
        );
      }
    } finally {
      await db.$disconnect();
    }
  });

  it('has Phase 41 Adventure objects and no failed Prisma migration on this database', async () => {
    const db = safeDb();
    try {
      const tables = await db.$queryRawUnsafe(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN (
            'MediWorldAdventurePreference',
            'MediWorldDailyAdventure',
            'MediWorldAdventureSlot',
            'MediWorldAdventureSwap'
          )
        ORDER BY 1
      `);
      assert.deepEqual(tables.map((row) => row.tablename), [
        'MediWorldAdventurePreference',
        'MediWorldAdventureSlot',
        'MediWorldAdventureSwap',
        'MediWorldDailyAdventure',
      ]);
      const indexes = await db.$queryRawUnsafe(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'MediWorldDailyAdventure'
          AND indexname = 'MediWorldDailyAdventure_userId_periodKey_key'
      `);
      assert.equal(indexes.length, 1);
    } finally {
      await db.$disconnect();
    }
  });
});
