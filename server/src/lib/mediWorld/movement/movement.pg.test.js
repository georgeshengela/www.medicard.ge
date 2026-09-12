import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { destinationPoint } from '../explore/geo.js';
import { abandonMovementSession, finishMovementSession, getMovementHistory, startMovementSession, submitMovementSegment } from './service.js';
import { getMediWorldProfileSnapshot } from '../service.js';

const url = process.env.PHASE38_TEST_DATABASE_URL || '';
const skip = !url;
const SECRET = process.env.JWT_SECRET || 'phase43-movement-test-secret';
const NOW = new Date('2026-09-13T12:00:00.000Z');
const ORIGIN = { latitude: 37.422, longitude: -122.084 };

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
    flags: { nodeEnv: 'test', flag: '1', movementFlag: extra.movementFlag ?? '1' },
    user: extra.user || { timezone: 'UTC' },
    tokenSecret: SECRET,
  };
}

function sample(extra = {}) {
  const at = extra.now || NOW;
  const point = extra.meters != null ? destinationPoint(ORIGIN, 0, extra.meters) : ORIGIN;
  return {
    latitude: extra.latitude ?? point.latitude,
    longitude: extra.longitude ?? point.longitude,
    horizontalAccuracy: extra.horizontalAccuracy ?? 12,
    locationTimestamp: extra.locationTimestamp || at,
    mockLocation: false,
    appState: 'active',
    idempotencyKey: extra.idempotencyKey || 'pg-start',
  };
}

async function seedUser(db, email) {
  return db.user.create({
    data: {
      email,
      fullName: 'Phase43 Movement',
      passwordHash: await bcrypt.hash('Phase43MovePass!', 12),
    },
  });
}

describe('Medi World Phase 43 PostgreSQL', { skip }, () => {
  it('survives restart, stores aggregates only, and rewards once', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let user = null;
    try {
      user = await seedUser(db, `phase43.${stamp}@medicard.test`);
      const started = await startMovementSession(
        user.id,
        {
          ...sample({ idempotencyKey: `pg-start-${stamp}` }),
          movementMode: 'walk',
          targetMinutes: 5,
          idempotencyKey: `pg-start-${stamp}`,
        },
        opts(db),
      );
      assert.equal(started.session.status, 'active');
      let token = started.session.continuationToken;
      for (let i = 1; i <= 8; i += 1) {
        const at = new Date(NOW.getTime() + i * 20_000);
        const res = await submitMovementSegment(
          user.id,
          started.session.id,
          { ...sample({ meters: i * 28, now: at, idempotencyKey: `pg-seg-${stamp}-${i}` }), continuationToken: token },
          opts(db, { now: at }),
        );
        assert.equal(res.outcome, 'SEGMENT_ACCEPTED');
        token = res.session.continuationToken;
      }
      const finished = await finishMovementSession(
        user.id,
        started.session.id,
        { idempotencyKey: `pg-fin-${stamp}` },
        opts(db, { now: new Date(NOW.getTime() + 200_000) }),
      );
      assert.equal(finished.session.status, 'completed');
      assert.equal(finished.reward.reasonCode, 'PERSONAL_GOAL_HALF_COMPLETE');
      const snap = await getMediWorldProfileSnapshot(user.id, opts(db, { now: new Date(NOW.getTime() + 200_000) }));
      assert.equal(finished.world.profile.careEnergy.movement, snap.profile.careEnergy.movement);
      assert.equal(finished.world.today.worldXp.used, snap.today.worldXp.used);
      assert.equal(finished.world.latestReward.sourceType, 'MOVEMENT_SESSION');
      const retry = await finishMovementSession(
        user.id,
        started.session.id,
        { idempotencyKey: `pg-fin-${stamp}` },
        opts(db),
      );
      assert.equal(retry.reward.duplicate, true);
      assert.equal(retry.world.profile.careEnergy.movement, finished.world.profile.careEnergy.movement);
      assert.equal(await db.mediWorldLedger.count({ where: { userId: user.id, sourceType: 'MOVEMENT_SESSION' } }), 1);

      const row = await db.worldMovementSession.findUnique({ where: { id: started.session.id } });
      const json = JSON.stringify(row);
      assert.equal(json.includes('37.422'), false);
      assert.equal(json.includes('-122.084'), false);
      assert.equal(json.toLowerCase().includes('latitude'), false);
      assert.equal(row.distanceBand, 'within_500m');

      const raced = await Promise.allSettled([
        startMovementSession(user.id, { ...sample({ idempotencyKey: `pg-race-a-${stamp}` }), movementMode: 'walk', targetMinutes: 5, idempotencyKey: `pg-race-a-${stamp}` }, opts(db)),
        startMovementSession(user.id, { ...sample({ idempotencyKey: `pg-race-b-${stamp}` }), movementMode: 'walk', targetMinutes: 5, idempotencyKey: `pg-race-b-${stamp}` }, opts(db)),
      ]);
      const opened = raced.filter((row) => row.status === 'fulfilled').length;
      const blocked = raced.filter((row) => row.status === 'rejected' && row.reason?.code === 'MOVEMENT_OPEN_SESSION').length;
      assert.equal(opened + blocked, 2);
      assert.equal(
        await db.worldMovementSession.count({
          where: { userId: user.id, status: { in: ['created', 'active', 'paused'] } },
        }),
        1,
      );

      const history = await getMovementHistory(user.id, opts(db));
      assert.equal(history.items[0].continuationToken, undefined);
      assert.equal(JSON.stringify(history).includes('mw1.'), false);
    } finally {
      if (user) {
        await db.worldMovementSession.deleteMany({ where: { userId: user.id } }).catch(() => {});
        await db.worldMovementPreference.deleteMany({ where: { userId: user.id } }).catch(() => {});
        await db.mediWorldLedger.deleteMany({ where: { userId: user.id } }).catch(() => {});
        await db.mediWorldProfile.deleteMany({ where: { userId: user.id } }).catch(() => {});
        await db.user.delete({ where: { id: user.id } }).catch(() => {});
      }
      await db.$disconnect();
    }
  });

  it('abandons without ledger credit', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let user = null;
    try {
      user = await seedUser(db, `phase43.ab.${stamp}@medicard.test`);
      const started = await startMovementSession(
        user.id,
        { ...sample({ idempotencyKey: `pg-ab-${stamp}` }), movementMode: 'walk', targetMinutes: 10, idempotencyKey: `pg-ab-${stamp}` },
        opts(db),
      );
      await abandonMovementSession(user.id, started.session.id, { idempotencyKey: `pg-abn-${stamp}` }, opts(db));
      assert.equal(await db.mediWorldLedger.count({ where: { userId: user.id } }), 0);
    } finally {
      if (user) {
        await db.worldMovementSession.deleteMany({ where: { userId: user.id } }).catch(() => {});
        await db.user.delete({ where: { id: user.id } }).catch(() => {});
      }
      await db.$disconnect();
    }
  });
});
