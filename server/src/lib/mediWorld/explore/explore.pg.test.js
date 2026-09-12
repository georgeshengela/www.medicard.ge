import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { collectSpark, getExploreArea, getExploreCollections, getExploreConfig } from './service.js';
import { coarseAreaKey } from './geo.js';

const url = process.env.PHASE38_TEST_DATABASE_URL || '';
const skip = !url;

const NOW = new Date('2026-09-12T12:00:00.000Z');
const AREA = coarseAreaKey(37.422, -122.084);

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
    flags: { nodeEnv: 'test', flag: '1', exploreFlag: extra.exploreFlag ?? '1' },
    user: extra.user || { timezone: 'UTC' },
  };
}

function sample(extra = {}) {
  return {
    latitude: extra.latitude ?? 37.422,
    longitude: extra.longitude ?? -122.084,
    horizontalAccuracy: extra.horizontalAccuracy ?? 12,
    locationTimestamp: extra.locationTimestamp || NOW,
    idempotencyKey: extra.idempotencyKey || 'pg-idem',
    mockLocation: Boolean(extra.mockLocation),
    speedMps: extra.speedMps,
  };
}

async function seedUser(db, email) {
  return db.user.create({
    data: {
      email,
      fullName: 'Phase42 Explore',
      passwordHash: await bcrypt.hash('Phase42ExplorePass!', 12),
    },
  });
}

describe('Medi World Phase 42 PostgreSQL', { skip }, () => {
  it('collects once, persists without coordinates, and survives restart', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let user = null;
    try {
      user = await seedUser(db, `phase42.${stamp}@medicard.test`);
      const config = await getExploreConfig(user.id, opts(db));
      assert.equal(config.foregroundOnly, true);
      assert.equal(config.developmentFixtures, true);
      const area = await getExploreArea(user.id, AREA, opts(db));
      const garden = area.places.find((place) => place.id === 'place.qa.garden.alpha');
      assert.ok(garden);
      assert.equal(garden.accessibility, 'unknown');
      const spawnId = garden.spark.spawnId;
      const first = await collectSpark(user.id, spawnId, sample({ idempotencyKey: `pg-${stamp}` }), opts(db));
      assert.equal(first.outcome, 'SPARK_COLLECTED');
      const retry = await collectSpark(user.id, spawnId, sample({ idempotencyKey: `pg-${stamp}` }), opts(db));
      assert.equal(retry.already, true);
      const raced = await Promise.all([
        collectSpark(user.id, spawnId, sample({ idempotencyKey: `pg-race-a-${stamp}` }), opts(db)),
        collectSpark(user.id, spawnId, sample({ idempotencyKey: `pg-race-b-${stamp}` }), opts(db)),
      ]);
      assert.ok(raced.every((row) => row.outcome === 'SPARK_ALREADY_COLLECTED' || row.already));
      assert.equal(
        await db.careSparkCollection.count({
          where: { userId: user.id, spawnId, verificationOutcome: 'SPARK_COLLECTED' },
        }),
        1,
      );
      const stored = await db.careSparkCollection.findFirst({ where: { userId: user.id } });
      assert.equal(Object.prototype.hasOwnProperty.call(stored, 'latitude'), false);
      assert.equal(stored.latitude, undefined);
      assert.equal(JSON.stringify(stored).includes('37.422'), false);
      assert.equal(await db.mediWorldLedger.count({ where: { userId: user.id } }), 0);
      const history = await getExploreCollections(user.id, opts(db));
      assert.equal(history.discoveryCount, 1);
      assert.equal(JSON.stringify(history).includes('37.422'), false);
    } finally {
      await db.$disconnect();
    }
  });

  it('enforces the daily cap concurrently and does not load fixtures when production-flagged', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let user = null;
    try {
      user = await seedUser(db, `phase42.cap.${stamp}@medicard.test`);
      await db.worldPlace.updateMany({
        where: { id: { startsWith: 'place.qa.cap.' } },
        data: { active: false },
      });
      const area = await getExploreArea(user.id, AREA, opts(db));
      const collected = [];
      for (const place of area.places) {
        collected.push(
          await collectSpark(
            user.id,
            place.spark.spawnId,
            sample({
              idempotencyKey: `cap-${place.id}-${stamp}`,
              latitude: place.publicLat,
              longitude: place.publicLng,
            }),
            opts(db),
          ),
        );
      }
      const extras = [];
      for (let i = collected.filter((row) => row.outcome === 'SPARK_COLLECTED').length; i < 6; i += 1) {
        const id = `place.qa.cap.${stamp}.${i}`;
        await db.worldPlace.create({
          data: {
            id,
            nameKa: `QA cap ${i}`,
            nameEn: `QA cap ${i}`,
            placeType: 'park',
            latitude: 37.422,
            longitude: -122.084,
            coarseAreaKey: AREA,
            status: 'approved',
            active: true,
            source: 'development_fixture',
            sourceIdentifier: `dev:cap:${stamp}:${i}`,
            accessibility: 'unknown',
          },
        });
        extras.push(id);
      }
      const more = await getExploreArea(user.id, AREA, opts(db));
      const remaining = more.places.filter((place) => extras.includes(place.id) && place.spark);
      const attempts = await Promise.all(
        remaining.map((place, index) =>
          collectSpark(
            user.id,
            place.spark.spawnId,
            sample({
              idempotencyKey: `cap-more-${stamp}-${index}`,
              latitude: place.publicLat,
              longitude: place.publicLng,
            }),
            opts(db),
          ),
        ),
      );
      const success = await db.careSparkCollection.count({
        where: { userId: user.id, verificationOutcome: 'SPARK_COLLECTED' },
      });
      assert.equal(success, 5);
      assert.ok(attempts.some((row) => row.outcome === 'SPARK_DAILY_CAP_REACHED') || success === 5);
      await assert.rejects(
        () => getExploreConfig(user.id, opts(db, { exploreFlag: '0' })),
        (err) => err.code === 'EXPLORE_DISABLED',
      );
    } finally {
      await db.$disconnect();
    }
  });

  it('has Explore tables and no user-coordinate columns on collections', async () => {
    const db = safeDb();
    try {
      const tables = await db.$queryRawUnsafe(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN ('WorldPlace', 'CareSparkDefinition', 'CareSparkSpawn', 'CareSparkCollection')
        ORDER BY 1
      `);
      assert.deepEqual(tables.map((row) => row.tablename), [
        'CareSparkCollection',
        'CareSparkDefinition',
        'CareSparkSpawn',
        'WorldPlace',
      ]);
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'CareSparkCollection'
        ORDER BY 1
      `);
      const names = cols.map((row) => row.column_name);
      assert.equal(names.includes('latitude'), false);
      assert.equal(names.includes('longitude'), false);
      assert.equal(names.includes('lat'), false);
      assert.equal(names.includes('lng'), false);
      assert.ok(names.includes('distanceBand'));
      assert.ok(names.includes('accuracyBand'));
      assert.ok(names.includes('verificationOutcome'));
    } finally {
      await db.$disconnect();
    }
  });
});
