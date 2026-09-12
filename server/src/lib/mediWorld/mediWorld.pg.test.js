import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import {
  processWorldActivity,
  ensureMediWorldProfile,
} from './engine.js';
import { getMediWorldLedger, getMediWorldProfile } from './service.js';
import { debitCareEnergy } from './debit.js';
import {
  assignDailyQuests,
  completeQuest,
} from '../quest.js';
import { QUEST_TIMEZONE } from '../questTime.js';

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
      fullName: 'Phase38 Test',
      passwordHash: await bcrypt.hash('Phase38TestPass!', 12),
    },
  });
}

describe('Medi World Phase 38.1 PostgreSQL', { skip }, () => {
  it('enforces uniqueness, non-negative CHECKs, cascade, and concurrent awards', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let user = null;
    let other = null;
    try {
      user = await seedUser(db, `phase38.${stamp}@medicard.test`);
      other = await seedUser(db, `phase38.other.${stamp}@medicard.test`);

      const first = await processWorldActivity(
        user.id,
        {
          sourceType: 'FOUNDATION_TEST',
          sourceId: `evt-${stamp}`,
          idempotencyKey: `idem-${stamp}`,
          adapterId: 'activity.walking',
          energyType: 'movement',
          progressState: 'verified',
          personalTarget: 1500,
          completedAmount: 1500,
        },
        { db, now: new Date() },
      );
      assert.equal(first.applied, true);
      assert.equal(first.ledger.transactionType, 'CREDIT');
      assert.equal(first.profile.careEnergy.movement, 10);

      const dup = await processWorldActivity(
        user.id,
        {
          sourceType: 'FOUNDATION_TEST',
          sourceId: `evt-${stamp}`,
          idempotencyKey: `idem-${stamp}`,
          adapterId: 'activity.walking',
          energyType: 'movement',
          progressState: 'verified',
          personalTarget: 1500,
          completedAmount: 1500,
        },
        { db, now: new Date() },
      );
      assert.equal(dup.duplicate, true);

      const racedKey = `race-${stamp}`;
      const event = {
        sourceType: 'FOUNDATION_TEST',
        sourceId: racedKey,
        idempotencyKey: racedKey,
        adapterId: 'activity.walking',
        energyType: 'movement',
        progressState: 'verified',
        personalTarget: 1500,
        completedAmount: 1500,
      };
      const raced = await Promise.all([
        processWorldActivity(user.id, event, { db, now: new Date() }),
        processWorldActivity(user.id, event, { db, now: new Date() }),
      ]);
      assert.equal(raced.filter((row) => row.applied).length, 1);
      const ledgerCount = await db.mediWorldLedger.count({
        where: { userId: user.id, idempotencyKey: racedKey },
      });
      assert.equal(ledgerCount, 1);

      const lazyA = await Promise.all([
        ensureMediWorldProfile(other.id, { db }),
        ensureMediWorldProfile(other.id, { db }),
      ]);
      assert.equal(lazyA[0].userId, other.id);
      const profiles = await db.mediWorldProfile.findMany({ where: { userId: other.id } });
      assert.equal(profiles.length, 1);

      await assert.rejects(
        () =>
          db.mediWorldLedger.create({
            data: {
              id: randomUUID(),
              userId: user.id,
              idempotencyKey: `neg-${stamp}`,
              sourceType: 'FOUNDATION_TEST',
              sourceId: 'neg',
              adapterId: 'activity.walking',
              energyType: 'movement',
              transactionType: 'CREDIT',
              energyAmount: -1,
              foundationXp: 0,
              progressState: 'verified',
              completionRatioBps: 0,
            },
          }),
      );

      await assert.rejects(
        () =>
          db.mediWorldLedger.create({
            data: {
              id: randomUUID(),
              userId: user.id,
              idempotencyKey: `bad-type-${stamp}`,
              sourceType: 'FOUNDATION_TEST',
              sourceId: 'bad-type',
              adapterId: 'activity.walking',
              energyType: 'movement',
              transactionType: 'SPEND',
              energyAmount: 1,
              foundationXp: 0,
              progressState: 'verified',
              completionRatioBps: 0,
            },
          }),
      );

      const page = await getMediWorldLedger(user.id, { db, take: 10 });
      assert.ok(page.items.length >= 1);
      assert.equal(page.items[0].transactionType, 'CREDIT');

      const mine = await getMediWorldProfile(user.id, { db });
      const theirs = await getMediWorldProfile(other.id, { db });
      assert.equal(mine.profile.careEnergy.movement >= 10, true);
      assert.equal(theirs.profile.careEnergy.movement, 0);

      await db.user.delete({ where: { id: user.id } });
      assert.equal(await db.mediWorldProfile.count({ where: { userId: user.id } }), 0);
      assert.equal(await db.mediWorldLedger.count({ where: { userId: user.id } }), 0);
      user = null;
    } finally {
      if (user) await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
      if (other) await db.user.delete({ where: { id: other.id } }).catch(() => undefined);
      await db.$disconnect();
    }
  });

  it('awards Quest Care Energy once through completeQuest and not on retry', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let user = null;
    try {
      user = await seedUser(db, `phase38.quest.${stamp}@medicard.test`);
      await db.hydrationPreference.create({ data: { userId: user.id, goalMl: 2000 } });
      await db.stepTrackingCapability.create({
        data: { userId: user.id, status: 'AVAILABLE', source: 'APPLE_HEALTH' },
      });
      const now = new Date('2026-09-12T12:00:00+04:00');
      const options = { db, now, timezone: QUEST_TIMEZONE };
      await assignDailyQuests(user.id, '2026-09-12', options);
      const steps = (await db.userQuest.findMany({ where: { userId: user.id }, include: { template: true } })).find(
        (row) => row.template?.key === 'daily_steps',
      );
      assert.ok(steps);
      await db.userQuest.update({ where: { id: steps.id }, data: { progress: steps.target } });
      const first = await completeQuest(user.id, steps.id, { ...options, source: 'sync' });
      const second = await completeQuest(user.id, steps.id, { ...options, source: 'sync' });
      assert.equal(first.completed, true);
      assert.equal(second.alreadyCompleted, true);
      const rows = await db.mediWorldLedger.findMany({ where: { userId: user.id } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].transactionType, 'CREDIT');
      assert.equal(rows[0].adapterId, 'quest.daily_steps');
      assert.equal(rows[0].energyAmount, 10);
      assert.equal(rows[0].foundationXp, 12);
      assert.equal(rows[0].rulesetVersion, 2);
    } finally {
      if (user) await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
      await db.$disconnect();
    }
  });
});

describe('Medi World Phase 39 PostgreSQL', { skip }, () => {
  it('enforces semantic idempotency conflicts, daily caps, and debit overdraft', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let user = null;
    try {
      user = await seedUser(db, `phase39.${stamp}@medicard.test`);
      const now = new Date('2026-09-12T12:00:00+04:00');
      const base = {
        sourceType: 'FOUNDATION_TEST',
        adapterId: 'activity.walking',
        energyType: 'movement',
        progressState: 'verified',
        personalTarget: 1500,
        completedAmount: 1500,
      };
      await processWorldActivity(user.id, { ...base, sourceId: `a-${stamp}`, idempotencyKey: `a-${stamp}` }, { db, now, timezone: 'Asia/Tbilisi' });
      await processWorldActivity(user.id, { ...base, sourceId: `b-${stamp}`, idempotencyKey: `b-${stamp}` }, { db, now, timezone: 'Asia/Tbilisi' });
      const capped = await processWorldActivity(user.id, { ...base, sourceId: `c-${stamp}`, idempotencyKey: `c-${stamp}` }, { db, now, timezone: 'Asia/Tbilisi' });
      assert.equal(capped.reward.energyAmount, 0);
      assert.equal(capped.reasonCode, 'DAILY_CATEGORY_CAP_REACHED');

      await assert.rejects(
        () =>
          processWorldActivity(
            user.id,
            {
              ...base,
              sourceId: `other-${stamp}`,
              idempotencyKey: `a-${stamp}`,
              adapterId: 'activity.hydration',
              energyType: 'hydration',
            },
            { db, now },
          ),
        (err) => err.code === 'WORLD_IDEMPOTENCY_CONFLICT',
      );

      const conflictKey = `pg-conflict-${stamp}`;
      const conflictEvent = {
        ...base,
        sourceId: conflictKey,
        idempotencyKey: conflictKey,
      };
      const otherEvent = {
        ...base,
        sourceId: `${conflictKey}-h`,
        idempotencyKey: conflictKey,
        adapterId: 'activity.hydration',
        energyType: 'hydration',
      };
      const raced = await Promise.allSettled([
        processWorldActivity(user.id, conflictEvent, { db, now }),
        processWorldActivity(user.id, otherEvent, { db, now }),
      ]);
      const ok = raced.filter((row) => row.status === 'fulfilled').length;
      const conflicted = raced.filter((row) => row.status === 'rejected' && row.reason?.code === 'WORLD_IDEMPOTENCY_CONFLICT').length;
      assert.equal(ok + conflicted, 2);
      assert.ok(ok <= 1);

      await debitCareEnergy(
        user.id,
        { energyType: 'movement', amount: 5, idempotencyKey: `deb-${stamp}`, reasonCode: 'INTERNAL_TEST' },
        { db, now },
      );
      const profile = await getMediWorldProfile(user.id, { db, now, timezone: 'Asia/Tbilisi' });
      assert.equal(profile.profile.careEnergy.movement, 15);
      await assert.rejects(
        () =>
          debitCareEnergy(
            user.id,
            { energyType: 'movement', amount: 99, idempotencyKey: `deb-over-${stamp}`, reasonCode: 'INTERNAL_TEST' },
            { db, now },
          ),
        (err) => err.code === 'INSUFFICIENT_CARE_ENERGY',
      );
      const page = await getMediWorldLedger(user.id, { db, take: 20 });
      assert.ok(page.items.every((item) => !Object.prototype.hasOwnProperty.call(item, 'idempotencyKey')));

      const stored = await db.mediWorldProfile.findUnique({ where: { userId: user.id } });
      const { worldProgressFromXp } = await import('./ruleset.js');
      assert.equal(stored.foundationLevel, worldProgressFromXp(stored.foundationXp).level);

      await assert.rejects(
        () =>
          debitCareEnergy(
            user.id,
            { energyType: 'movement', amount: 2, idempotencyKey: `deb-rb-${stamp}`, reasonCode: 'INTERNAL_TEST' },
            {
              db,
              now,
              beforeCommit: async () => {
                throw new Error('forced-pg-debit-rollback');
              },
            },
          ),
      );
      const afterRollback = await db.mediWorldProfile.findUnique({ where: { userId: user.id } });
      assert.equal(afterRollback.energyMovement, 15);
      assert.equal(
        await db.mediWorldLedger.count({ where: { userId: user.id, idempotencyKey: `deb-rb-${stamp}` } }),
        0,
      );

      const racedDebits = await Promise.allSettled([
        debitCareEnergy(
          user.id,
          { energyType: 'movement', amount: 15, idempotencyKey: `deb-race-a-${stamp}`, reasonCode: 'INTERNAL_TEST' },
          { db, now },
        ),
        debitCareEnergy(
          user.id,
          { energyType: 'movement', amount: 15, idempotencyKey: `deb-race-b-${stamp}`, reasonCode: 'INTERNAL_TEST' },
          { db, now },
        ),
      ]);
      const debitOk = racedDebits.filter((row) => row.status === 'fulfilled' && row.value.applied).length;
      const debitDenied = racedDebits.filter(
        (row) => row.status === 'rejected' && row.reason?.code === 'INSUFFICIENT_CARE_ENERGY',
      ).length;
      assert.equal(debitOk, 1);
      assert.equal(debitDenied, 1);
      const afterRace = await db.mediWorldProfile.findUnique({ where: { userId: user.id } });
      assert.equal(afterRace.energyMovement, 0);
    } finally {
      if (user) await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
      await db.$disconnect();
    }
  });

  it('orders latestReward by createdAt DESC, id DESC even when timestamps match', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let user = null;
    try {
      user = await seedUser(db, `phase39.latest.${stamp}@medicard.test`);
      const now = new Date('2026-09-12T12:00:00+04:00');
      await ensureMediWorldProfile(user.id, { db, now });
      await db.mediWorldLedger.create({
        data: {
          id: 'aaaaaaaa-0000-4000-8000-000000000001',
          userId: user.id,
          idempotencyKey: `pg-latest-a-${stamp}`,
          sourceType: 'FOUNDATION_TEST',
          sourceId: `a-${stamp}`,
          adapterId: 'activity.walking',
          energyType: 'movement',
          transactionType: 'CREDIT',
          energyAmount: 10,
          foundationXp: 12,
          progressState: 'verified',
          completionRatioBps: 10_000,
          rulesetVersion: 2,
          reasonCode: 'PERSONAL_GOAL_COMPLETE',
          createdAt: now,
        },
      });
      await db.mediWorldLedger.create({
        data: {
          id: 'ffffffff-0000-4000-8000-00000000000f',
          userId: user.id,
          idempotencyKey: `pg-latest-z-${stamp}`,
          sourceType: 'FOUNDATION_TEST',
          sourceId: `z-${stamp}`,
          adapterId: 'activity.walking',
          energyType: 'movement',
          transactionType: 'CREDIT',
          energyAmount: 0,
          foundationXp: 0,
          progressState: 'verified',
          completionRatioBps: 10_000,
          rulesetVersion: 2,
          reasonCode: 'DAILY_CATEGORY_CAP_REACHED',
          createdAt: now,
        },
      });
      const profile = await getMediWorldProfile(user.id, { db, now, timezone: 'Asia/Tbilisi' });
      assert.equal(profile.latestReward.reasonCode, 'DAILY_CATEGORY_CAP_REACHED');
      assert.equal(profile.latestReward.energyAmount, 0);

      const sameClock = new Date('2026-09-12T13:00:00+04:00');
      const base = {
        sourceType: 'FOUNDATION_TEST',
        adapterId: 'activity.walking',
        energyType: 'movement',
        progressState: 'verified',
        personalTarget: 1500,
        completedAmount: 1500,
      };
      await processWorldActivity(user.id, { ...base, sourceId: `seq-a-${stamp}`, idempotencyKey: `seq-a-${stamp}` }, { db, now: sameClock, timezone: 'Asia/Tbilisi' });
      await processWorldActivity(user.id, { ...base, sourceId: `seq-b-${stamp}`, idempotencyKey: `seq-b-${stamp}` }, { db, now: sameClock, timezone: 'Asia/Tbilisi' });
      const capped = await processWorldActivity(user.id, { ...base, sourceId: `seq-c-${stamp}`, idempotencyKey: `seq-c-${stamp}` }, { db, now: sameClock, timezone: 'Asia/Tbilisi' });
      assert.equal(capped.reasonCode, 'DAILY_CATEGORY_CAP_REACHED');
      const afterSeq = await getMediWorldProfile(user.id, { db, now: sameClock, timezone: 'Asia/Tbilisi' });
      assert.equal(afterSeq.latestReward.reasonCode, 'DAILY_CATEGORY_CAP_REACHED');
      assert.equal(afterSeq.profile.careEnergy.movement, 20);
    } finally {
      if (user) await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
      await db.$disconnect();
    }
  });
});
