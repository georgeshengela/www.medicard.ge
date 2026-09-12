import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mediWorldRouter } from '../../../routes/mediWorld.routes.js';
import { logExploreSafe, redactExploreValue } from './privacy.js';
import {
  COLLECTION_RADIUS_M,
  categoryForPlaceWindow,
  coarseAreaKey,
  destinationPoint,
  geodesicMeters,
  spawnIdFor,
  spawnWindow,
} from './geo.js';
import { createExploreFakeDb } from './exploreFake.js';
import {
  collectSpark,
  getExploreArea,
  getExploreCollections,
  getExploreConfig,
} from './service.js';
import { applyExploreQaScenario, resetExploreQaState } from './qa.js';

const NOW = new Date('2026-09-12T12:00:00.000Z');
const USER = 'user-explore-1';
const AREA = coarseAreaKey(37.422, -122.084);

function flags(extra = {}) {
  return { nodeEnv: extra.nodeEnv || 'test', flag: extra.flag || '1', exploreFlag: extra.exploreFlag ?? '1' };
}

function opts(db, extra = {}) {
  return { db, now: extra.now || NOW, timezone: extra.timezone || 'UTC', flags: flags(extra), user: extra.user };
}

function sample(extra = {}) {
  const now = extra.now || NOW;
  return {
    latitude: 37.422,
    longitude: -122.084,
    horizontalAccuracy: 12,
    locationTimestamp: now,
    idempotencyKey: extra.idempotencyKey || 'idem-alpha',
    mockLocation: false,
    ...extra,
  };
}

describe('Phase 42 migration order', () => {
  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../../prisma/migrations');

  it('sorts Explore after Phase 41 Adventure', () => {
    const dirs = readdirSync(migrationsDir).filter((name) => !name.includes('.')).sort();
    const phase41 = dirs.indexOf('20260912220000_medi_world_adventure');
    const phase42 = dirs.indexOf('20260912230000_medi_world_explore');
    assert.ok(phase41 >= 0 && phase42 > phase41);
  });

  it('keeps canonical SQL and migrate-folder SQL in lockstep', () => {
    const canonical = readFileSync(join(migrationsDir, '../phase42-medi-world-explore.sql'), 'utf8');
    const folder = readFileSync(join(migrationsDir, '20260912230000_medi_world_explore/migration.sql'), 'utf8');
    const strip = (text) => text.replace(/^--.*$/gm, '').replace(/\s+/g, ' ').trim();
    assert.equal(strip(canonical), strip(folder));
  });
});

describe('geodesic verification', () => {
  const origin = { latitude: 37.422, longitude: -122.084 };

  it('is zero at the same point and inside 75m', () => {
    assert.equal(geodesicMeters(origin, origin), 0);
    const inside = destinationPoint(origin, 90, 40);
    assert.ok(geodesicMeters(origin, inside) < COLLECTION_RADIUS_M);
  });

  it('treats the 75m boundary as inside and 76m as outside', () => {
    const edge = destinationPoint(origin, 0, 75);
    const outside = destinationPoint(origin, 0, 76);
    assert.ok(geodesicMeters(origin, edge) <= 75.5);
    assert.ok(geodesicMeters(origin, outside) > 75);
  });

  it('rejects invalid coordinates and wraps longitude', () => {
    const wrap = { latitude: 0, longitude: 179.9 };
    const other = { latitude: 0, longitude: -179.9 };
    assert.ok(geodesicMeters(wrap, other) < 50_000);
  });
});

describe('privacy redaction', () => {
  it('removes coordinate fields from log payloads', () => {
    const redacted = redactExploreValue({
      latitude: 41.7,
      longitude: 44.8,
      accuracy: 8,
      spawnId: 'cs:x',
      nested: { lat: 1, outcome: 'SPARK_COLLECTED' },
    });
    assert.equal(redacted.latitude, '[redacted]');
    assert.equal(redacted.longitude, '[redacted]');
    assert.equal(redacted.nested.lat, '[redacted]');
    assert.equal(redacted.nested.outcome, 'SPARK_COLLECTED');
    const lines = [];
    const original = console.warn;
    console.warn = (...args) => lines.push(args.join(' '));
    try {
      logExploreSafe('[medi-world] explore collect failed', { latitude: 37.422, longitude: -122.084, code: 'X' });
    } finally {
      console.warn = original;
    }
    assert.equal(lines.join(' ').includes('37.422'), false);
    assert.equal(lines.join(' ').includes('[redacted]'), true);
  });
});

describe('Explore service', () => {
  it('seeds development fixtures only outside production and hides rejected places', async () => {
    const db = createExploreFakeDb();
    const config = await getExploreConfig(USER, opts(db));
    assert.equal(config.developmentFixtures, true);
    assert.equal(config.foregroundOnly, true);
    const area = await getExploreArea(USER, AREA, opts(db));
    assert.ok(area.places.some((place) => place.id === 'place.qa.garden.alpha'));
    assert.equal(area.places.every((place) => place.developmentFixture), true);
    await db.worldPlace.create({
      data: {
        id: 'place.hospital.secret',
        nameKa: 'hospital',
        nameEn: 'hospital',
        placeType: 'park',
        latitude: 37.422,
        longitude: -122.084,
        coarseAreaKey: AREA,
        status: 'rejected',
        active: true,
        source: 'import',
        sourceIdentifier: 'bad',
        accessibility: 'unknown',
      },
    });
    const again = await getExploreArea(USER, AREA, opts(db));
    assert.equal(again.places.some((place) => place.id === 'place.hospital.secret'), false);
    const prod = await getExploreConfig(USER, opts(db, { nodeEnv: 'production', flag: '1', exploreFlag: '1' }));
    assert.equal(prod.developmentFixtures, false);
  });

  it('spawns deterministically at approved places only', async () => {
    const db = createExploreFakeDb();
    const first = await getExploreArea(USER, AREA, opts(db));
    const retry = await getExploreArea(USER, AREA, opts(db));
    assert.equal(first.places[0].spark.spawnId, retry.places[0].spark.spawnId);
    const window = spawnWindow(NOW);
    assert.equal(
      first.places.find((place) => place.id === 'place.qa.garden.alpha').spark.spawnId,
      spawnIdFor('place.qa.garden.alpha', window.windowKey),
    );
    assert.equal(
      first.places.find((place) => place.id === 'place.qa.garden.alpha').spark.category,
      categoryForPlaceWindow('place.qa.garden.alpha', window.windowKey),
    );
  });

  it('collects once, retries, and never awards World currency', async () => {
    const db = createExploreFakeDb();
    const area = await getExploreArea(USER, AREA, opts(db));
    const spawnId = area.places.find((place) => place.id === 'place.qa.garden.alpha').spark.spawnId;
    const first = await collectSpark(USER, spawnId, sample(), opts(db));
    assert.equal(first.outcome, 'SPARK_COLLECTED');
    assert.equal(first.discoveryCount, 1);
    const retry = await collectSpark(USER, spawnId, sample(), opts(db));
    assert.equal(retry.outcome, 'SPARK_COLLECTED');
    assert.equal(retry.already, true);
    const already = await collectSpark(USER, spawnId, sample({ idempotencyKey: 'idem-other' }), opts(db));
    assert.equal(already.outcome, 'SPARK_ALREADY_COLLECTED');
    assert.equal(await db.mediWorldLedger.count(), 0);
    assert.equal(await db.mediCompanionBondEvent.count(), 0);
    const blob = JSON.stringify(first);
    assert.equal(blob.includes('37.422'), false);
    assert.equal(blob.includes('latitude'), false);
    const history = await getExploreCollections(USER, opts(db));
    assert.equal(history.discoveryCount, 1);
    assert.equal(JSON.stringify(history).includes('37.422'), false);
    const row = await db.careSparkCollection.findFirst({ where: { userId: USER } });
    assert.equal(row.latitude, undefined);
    assert.equal(row.longitude, undefined);
  });

  it('rejects far, stale, inaccurate, missing, future, and motorized samples', async () => {
    const db = createExploreFakeDb();
    const area = await getExploreArea(USER, AREA, opts(db));
    const spawnId = area.places.find((place) => place.id === 'place.qa.garden.alpha').spark.spawnId;
    const far = await collectSpark(USER, spawnId, sample({ latitude: 37.43, longitude: -122.07 }), opts(db));
    assert.equal(far.outcome, 'SPARK_TOO_FAR');
    const stale = await collectSpark(
      USER,
      spawnId,
      sample({ locationTimestamp: new Date(NOW.getTime() - 60_000) }),
      opts(db),
    );
    assert.equal(stale.outcome, 'SPARK_LOCATION_STALE');
    const future = await collectSpark(
      USER,
      spawnId,
      sample({ locationTimestamp: new Date(NOW.getTime() + 60_000) }),
      opts(db),
    );
    assert.equal(future.outcome, 'SPARK_LOCATION_STALE');
    const poor = await collectSpark(USER, spawnId, sample({ horizontalAccuracy: 80 }), opts(db));
    assert.equal(poor.outcome, 'SPARK_LOCATION_INACCURATE');
    const missing = await collectSpark(USER, spawnId, sample({ latitude: 999, longitude: 0 }), opts(db));
    assert.equal(missing.outcome, 'SPARK_LOCATION_UNAVAILABLE');
    const speed = await collectSpark(USER, spawnId, sample({ speedMps: 12 }), opts(db));
    assert.equal(speed.outcome, 'SPARK_VERIFICATION_REQUIRED');
    assert.equal(await db.careSparkCollection.count(), 0);
  });

  it('enforces the five-per-day cap and conflicting idempotency', async () => {
    const db = createExploreFakeDb();
    const area = await getExploreArea(USER, AREA, opts(db));
    const garden = area.places.find((place) => place.id === 'place.qa.garden.alpha').spark.spawnId;
    await collectSpark(USER, garden, sample({ idempotencyKey: 'k1' }), opts(db));
    const extras = area.places.filter((place) => place.id !== 'place.qa.garden.alpha');
    let n = 1;
    for (const place of extras) {
      n += 1;
      await collectSpark(
        USER,
        place.spark.spawnId,
        sample({
          idempotencyKey: `k${n}`,
          latitude: place.publicLat,
          longitude: place.publicLng,
        }),
        opts(db),
      );
    }
    await db.worldPlace.create({
      data: {
        id: 'place.qa.extra',
        nameKa: 'extra',
        nameEn: 'extra',
        placeType: 'park',
        latitude: 37.422,
        longitude: -122.084,
        coarseAreaKey: AREA,
        status: 'approved',
        active: true,
        source: 'development_fixture',
        sourceIdentifier: 'dev:extra',
        accessibility: 'unknown',
      },
    });
    const more = await getExploreArea(USER, AREA, opts(db));
    const extraSpawn = more.places.find((place) => place.id === 'place.qa.extra').spark.spawnId;
    while ((await db.careSparkCollection.count({ where: { userId: USER } })) < 5) {
      const id = `fill-${await db.careSparkCollection.count()}`;
      await db.careSparkCollection.create({
        data: {
          id: id,
          userId: USER,
          spawnId: `fill-${id}`,
          placeId: 'place.qa.garden.alpha',
          periodKey: '2026-09-12',
          collectedAt: NOW,
          coarseAreaKey: AREA,
          distanceBand: 'within_75m',
          accuracyBand: 'fine',
          verificationOutcome: 'SPARK_COLLECTED',
          rulesetVersion: 'medi-world-explore-v1',
          idempotencyKey: id,
        },
      });
    }
    const cap = await collectSpark(USER, extraSpawn, sample({ idempotencyKey: 'cap-new' }), opts(db));
    assert.equal(cap.outcome, 'SPARK_DAILY_CAP_REACHED');
    await assert.rejects(
      () => collectSpark(USER, extraSpawn, sample({ idempotencyKey: 'k1' }), opts(db)),
      (err) => err.code === 'WORLD_IDEMPOTENCY_CONFLICT',
    );
  });

  it('returns disabled and unavailable errors', async () => {
    const db = createExploreFakeDb();
    await assert.rejects(
      () => getExploreConfig(USER, opts(db, { flag: '0' })),
      (err) => err.code === 'MEDI_WORLD_DISABLED',
    );
    await assert.rejects(
      () => getExploreConfig(USER, opts(db, { exploreFlag: '0' })),
      (err) => err.code === 'EXPLORE_DISABLED',
    );
    const broken = createExploreFakeDb();
    broken.worldPlace = {};
    await assert.rejects(() => getExploreConfig(USER, opts(broken)), (err) => err.code === 'WORLD_UNAVAILABLE');
  });

  it('does not insert development fixtures in production', async () => {
    const db = createExploreFakeDb();
    await getExploreConfig(USER, opts(db, { nodeEnv: 'production', flag: '1', exploreFlag: '1' }));
    assert.equal(await db.worldPlace.count(), 0);
  });

  it('hides inactive places and keeps accessibility unknown without a verified note', async () => {
    const db = createExploreFakeDb();
    const area = await getExploreArea(USER, AREA, opts(db));
    const garden = area.places.find((place) => place.id === 'place.qa.garden.alpha');
    assert.equal(garden.accessibility, 'unknown');
    assert.equal(garden.accessibilityNote, null);
    await db.worldPlace.create({
      data: {
        id: 'place.qa.inactive',
        nameKa: 'inactive',
        nameEn: 'inactive',
        placeType: 'park',
        latitude: 37.422,
        longitude: -122.084,
        coarseAreaKey: AREA,
        status: 'approved',
        active: false,
        source: 'review',
        sourceIdentifier: 'dev:inactive',
        accessibility: 'unknown',
      },
    });
    const hidden = await getExploreArea(USER, AREA, opts(db));
    assert.equal(hidden.places.some((place) => place.id === 'place.qa.inactive'), false);
  });

  it('rejects expired spawns and disabled places without creating a collection', async () => {
    const db = createExploreFakeDb();
    await db.worldPlace.create({
      data: {
        id: 'place.qa.custom',
        nameKa: 'custom',
        nameEn: 'custom',
        placeType: 'park',
        latitude: 37.422,
        longitude: -122.084,
        coarseAreaKey: AREA,
        status: 'approved',
        active: true,
        source: 'review',
        sourceIdentifier: 'dev:custom',
        accessibility: 'unknown',
      },
    });
    const area = await getExploreArea(USER, AREA, opts(db));
    const spawnId = area.places.find((place) => place.id === 'place.qa.custom').spark.spawnId;
    await db.worldPlace.upsert({
      where: { id: 'place.qa.custom' },
      create: { id: 'place.qa.custom' },
      update: { status: 'rejected', active: false },
    });
    const unavailable = await collectSpark(USER, spawnId, sample({ idempotencyKey: 'custom-1' }), opts(db));
    assert.equal(unavailable.outcome, 'SPARK_PLACE_UNAVAILABLE');
    await db.worldPlace.upsert({
      where: { id: 'place.qa.custom' },
      create: { id: 'place.qa.custom' },
      update: { status: 'approved', active: true },
    });
    await db.careSparkSpawn.upsert({
      where: { id: spawnId },
      create: { id: spawnId },
      update: { status: 'expired', expiresAt: new Date(NOW.getTime() - 1000) },
    });
    const expired = await collectSpark(USER, spawnId, sample({ idempotencyKey: 'exp-1' }), opts(db));
    assert.equal(expired.outcome, 'SPARK_EXPIRED');
    assert.equal(
      await db.careSparkCollection.count({ where: { verificationOutcome: 'SPARK_COLLECTED' } }),
      0,
    );
  });

  it('keeps collection history self-only and paginated without coordinates', async () => {
    const db = createExploreFakeDb();
    const area = await getExploreArea(USER, AREA, opts(db));
    const spawnId = area.places.find((place) => place.id === 'place.qa.garden.alpha').spark.spawnId;
    await collectSpark(USER, spawnId, sample(), opts(db));
    const mine = await getExploreCollections(USER, { ...opts(db), take: 1 });
    assert.equal(mine.items.length, 1);
    assert.equal(mine.items[0].placeId, 'place.qa.garden.alpha');
    assert.equal(JSON.stringify(mine).includes('latitude'), false);
    const other = await getExploreCollections('user-explore-2', opts(db));
    assert.equal(other.discoveryCount, 0);
    assert.equal(other.items.length, 0);
  });

  it('does not reset the daily cap when a request claims another timezone', async () => {
    const db = createExploreFakeDb();
    const area = await getExploreArea(USER, AREA, opts(db));
    let n = 0;
    for (const place of area.places) {
      n += 1;
      await collectSpark(
        USER,
        place.spark.spawnId,
        sample({
          idempotencyKey: `tz-${n}`,
          latitude: place.publicLat,
          longitude: place.publicLng,
        }),
        { ...opts(db), user: { timezone: 'UTC' } },
      );
    }
    await db.worldPlace.create({
      data: {
        id: 'place.qa.tz',
        nameKa: 'tz',
        nameEn: 'tz',
        placeType: 'promenade',
        latitude: 37.422,
        longitude: -122.084,
        coarseAreaKey: AREA,
        status: 'approved',
        active: true,
        source: 'development_fixture',
        sourceIdentifier: 'dev:tz',
        accessibility: 'unknown',
      },
    });
    const more = await getExploreArea(USER, AREA, opts(db));
    const extra = more.places.find((place) => place.id === 'place.qa.tz').spark.spawnId;
    while ((await db.careSparkCollection.count({ where: { userId: USER, verificationOutcome: 'SPARK_COLLECTED' } })) < 5) {
      const id = `tzfill-${await db.careSparkCollection.count()}`;
      await db.careSparkCollection.create({
        data: {
          id,
          userId: USER,
          spawnId: id,
          placeId: 'place.qa.garden.alpha',
          periodKey: '2026-09-12',
          collectedAt: NOW,
          coarseAreaKey: AREA,
          distanceBand: 'within_75m',
          accuracyBand: 'fine',
          verificationOutcome: 'SPARK_COLLECTED',
          rulesetVersion: 'medi-world-explore-v1',
          idempotencyKey: id,
        },
      });
    }
    const hopped = await collectSpark(
      USER,
      extra,
      sample({ idempotencyKey: 'tz-hop' }),
      { ...opts(db), user: { timezone: 'UTC' }, timezone: 'Pacific/Kiritimati', deviceTimezone: 'Pacific/Kiritimati' },
    );
    assert.equal(hopped.outcome, 'SPARK_DAILY_CAP_REACHED');
  });
});

describe('Explore API surface', () => {
  it('registers self-only explore routes and no admin place manager', () => {
    const paths = mediWorldRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => `${Object.keys(layer.route.methods).join(',').toUpperCase()} ${layer.route.path}`);
    assert.ok(paths.some((row) => row.includes('/explore/config')));
    assert.ok(paths.some((row) => row.includes('/explore/area')));
    assert.ok(paths.some((row) => row.includes('/explore/sparks') && row.includes('POST')));
    assert.ok(paths.some((row) => row.includes('/explore/qa/scenario')));
    assert.equal(paths.some((row) => row.includes('/admin') || row.includes('/places/import')), false);
  });

  it('never requests background location and never reuses profile location ping', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../../../mobile/src/lib/mediWorld/exploreLocation.ts'), 'utf8');
    assert.equal(src.includes('requestBackgroundPermissionsAsync'), false);
    assert.equal(src.includes('grantUserLocation'), false);
    assert.equal(src.includes('/api/location'), false);
    assert.equal(src.includes('Accuracy.Balanced'), false);
    assert.equal(src.includes('Accuracy.High'), true);
    const collectFn = src.slice(src.indexOf('export async function readCollectSample'), src.indexOf('export function collectSampleRejectReason'));
    assert.equal(collectFn.includes('getLastKnownPositionAsync'), false);
    const mapSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../../../mobile/src/lib/mediWorld/exploreMapHtml.ts'), 'utf8');
    assert.equal(mapSrc.includes('basemaps.cartocdn.com'), false);
    assert.equal(mapSrc.includes('tile.openstreetmap.org'), true);
  });
});

describe('Explore QA scenarios', () => {
  it('is impossible in production and arms inaccurate without collecting', async () => {
    resetExploreQaState();
    const db = createExploreFakeDb();
    await assert.rejects(
      () => applyExploreQaScenario(USER, 'arm_inaccurate', { db, flags: { nodeEnv: 'production' } }),
      (error) => error.code === 'EXPLORE_QA_FORBIDDEN',
    );
    await getExploreArea(USER, AREA, opts(db));
    const armed = await applyExploreQaScenario(USER, 'arm_inaccurate', opts(db));
    assert.equal(armed.ok, true);
    const spawnId = (await getExploreArea(USER, AREA, opts(db))).places[0].spark.spawnId;
    const result = await collectSpark(USER, spawnId, sample({ idempotencyKey: 'qa-inacc' }), opts(db));
    assert.equal(result.outcome, 'SPARK_LOCATION_INACCURATE');
    assert.equal(await db.careSparkCollection.count({ where: { userId: USER } }), 0);
  });

  it('fills the daily cap and can mark the map unavailable without coordinates', async () => {
    resetExploreQaState();
    const db = createExploreFakeDb();
    await getExploreArea(USER, AREA, opts(db));
    const filled = await applyExploreQaScenario(USER, 'fill_daily_cap', opts(db));
    assert.equal(filled.created, 5);
    const rows = await db.careSparkCollection.findMany({ where: { userId: USER } });
    assert.equal(rows.length, 5);
    assert.equal(JSON.stringify(rows).includes('37.422'), false);
    assert.equal(JSON.stringify(rows).includes('latitude'), false);
    await applyExploreQaScenario(USER, 'arm_map_fail', opts(db));
    const cfg = await getExploreConfig(USER, opts(db));
    assert.equal(cfg.mapUnavailable, true);
    assert.equal(cfg.discoveryCount, 5);
  });
});
