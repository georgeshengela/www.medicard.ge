import { randomUUID } from 'node:crypto';
import { prisma as defaultPrisma } from '../../prisma.js';
import { resolveWorldDailyPeriodKey, isPrismaMissing, isUniqueViolation, worldSchemaUnavailableError } from '../engine.js';
import { isMediWorldEnabled, isMediWorldExploreEnabled, mediWorldDisabledError, exploreDisabledError, canLoadExploreFixtures } from '../flags.js';
import { assertWorldPayloadSafe } from '../privacy.js';
import { getEffectiveQuestTimezone } from '../../questTime.js';
import {
  ACCURACY_MAX_M,
  AREA_RESULT_LIMIT,
  COLLECTION_RADIUS_M,
  DAILY_COLLECTION_CAP,
  EXPLORE_RULESET_ID,
  FRESHNESS_MS,
  MOTORIZED_MPS,
  accuracyBand,
  categoryForPlaceWindow,
  coarseAreaKey,
  distanceBand,
  geodesicMeters,
  isAllowedPlaceType,
  isValidLatitude,
  isValidLongitude,
  spawnIdFor,
  spawnWindow,
} from './geo.js';
import { DEVELOPMENT_PLACES, SPARK_DEFINITIONS, assertFixturesAllowed, developmentPlaceRows } from './fixtures.js';
import { logExploreSafe } from './privacy.js';
import { consumeInaccurateArm, peekExploreQaFlags } from './qa.js';

function dbOf(options = {}) {
  return options.db || defaultPrisma;
}

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function exploreResult(code, extra = {}) {
  return assertWorldPayloadSafe({
    enabled: true,
    rulesetId: EXPLORE_RULESET_ID,
    outcome: code,
    ...extra,
  });
}

function tablesReady(db) {
  return Boolean(
    db?.worldPlace?.findMany
    && db?.careSparkDefinition?.findMany
    && db?.careSparkSpawn?.upsert
    && db?.careSparkCollection?.findFirst,
  );
}

async function requireExplore(options = {}) {
  if (!isMediWorldEnabled(options.flags)) throw mediWorldDisabledError();
  if (!isMediWorldExploreEnabled(options.flags)) throw exploreDisabledError();
}

export async function ensureExploreCatalog(options = {}) {
  const db = dbOf(options);
  if (!tablesReady(db)) throw worldSchemaUnavailableError();
  const now = options.now || new Date();
  for (const definition of SPARK_DEFINITIONS) {
    if (typeof db.careSparkDefinition.upsert === 'function') {
      await db.careSparkDefinition.upsert({
        where: { id: definition.id },
        create: { ...definition, rulesetVersion: EXPLORE_RULESET_ID, active: true },
        update: { category: definition.category, locKey: definition.locKey, active: true, rulesetVersion: EXPLORE_RULESET_ID },
      });
    } else {
      const existing = await db.careSparkDefinition.findUnique({ where: { id: definition.id } });
      if (!existing) {
        await db.careSparkDefinition.create({
          data: { ...definition, rulesetVersion: EXPLORE_RULESET_ID, active: true },
        });
      }
    }
  }
  if (!canLoadExploreFixtures(options.flags || {})) return { fixtures: false };
  assertFixturesAllowed(options);
  for (const place of developmentPlaceRows(now)) {
    if (typeof db.worldPlace.upsert === 'function') {
      await db.worldPlace.upsert({
        where: { id: place.id },
        create: place,
        update: {
          nameKa: place.nameKa,
          nameEn: place.nameEn,
          placeType: place.placeType,
          latitude: place.latitude,
          longitude: place.longitude,
          coarseAreaKey: place.coarseAreaKey,
          status: 'approved',
          active: true,
          source: 'development_fixture',
          updatedAt: now,
        },
      });
    } else {
      const existing = await db.worldPlace.findUnique({ where: { id: place.id } });
      if (!existing) await db.worldPlace.create({ data: place });
    }
  }
  return { fixtures: true };
}

async function expireWindows(db, now) {
  if (typeof db.careSparkSpawn.updateMany !== 'function') return;
  await db.careSparkSpawn.updateMany({
    where: { status: 'active', expiresAt: { lte: now } },
    data: { status: 'expired' },
  });
}

async function ensureSpawnsForPlaces(db, places, now) {
  const window = spawnWindow(now);
  const spawns = [];
  for (const place of places) {
    if (!place.active || place.status !== 'approved' || !isAllowedPlaceType(place.placeType)) continue;
    const category = categoryForPlaceWindow(place.id, window.windowKey);
    const definitionId = `spark.${category}`;
    const id = spawnIdFor(place.id, window.windowKey);
    const data = {
      id,
      definitionId,
      placeId: place.id,
      windowKey: window.windowKey,
      startsAt: window.startsAt,
      expiresAt: window.expiresAt,
      status: 'active',
      rulesetVersion: EXPLORE_RULESET_ID,
    };
    let spawn;
    if (typeof db.careSparkSpawn.upsert === 'function') {
      spawn = await db.careSparkSpawn.upsert({
        where: { placeId_windowKey: { placeId: place.id, windowKey: window.windowKey } },
        create: data,
        update: { status: 'active', definitionId, expiresAt: window.expiresAt, rulesetVersion: EXPLORE_RULESET_ID },
      });
    } else {
      spawn = await db.careSparkSpawn.findUnique({ where: { id } });
      if (!spawn) spawn = await db.careSparkSpawn.create({ data });
    }
    spawns.push({ ...spawn, category, locKey: definitionId });
  }
  return spawns;
}

function publicPlace(place, spawn, collected, locale = 'ka') {
  const fixture = place.source === 'development_fixture';
  return {
    id: place.id,
    name: locale === 'en' ? place.nameEn : place.nameKa,
    nameKa: place.nameKa,
    nameEn: place.nameEn,
    placeType: place.placeType,
    publicLat: place.latitude,
    publicLng: place.longitude,
    coarseAreaKey: place.coarseAreaKey,
    accessibility: place.accessibility || 'unknown',
    accessibilityNote: place.accessibility === 'unknown' ? null : place.accessibilityNote || null,
    safeHoursPolicy: place.safeHoursPolicy || null,
    developmentFixture: fixture,
    spark: spawn
      ? {
          spawnId: spawn.id,
          category: spawn.category || spawn.definitionId?.replace('spark.', ''),
          locKey: spawn.locKey || spawn.definitionId,
          expiresAt: spawn.expiresAt instanceof Date ? spawn.expiresAt.toISOString() : spawn.expiresAt,
          collected: Boolean(collected),
        }
      : null,
  };
}

export async function getExploreConfig(userId, options = {}) {
  await requireExplore(options);
  const db = dbOf(options);
  try {
    const seeded = await ensureExploreCatalog(options);
    const found = await db.careSparkCollection.count({ where: { userId, verificationOutcome: 'SPARK_COLLECTED' } });
    const qa = canLoadExploreFixtures(options.flags || {}) ? peekExploreQaFlags(userId) : {};
    return assertWorldPayloadSafe({
      enabled: true,
      rulesetId: EXPLORE_RULESET_ID,
      collectionRadiusM: COLLECTION_RADIUS_M,
      accuracyMaxM: ACCURACY_MAX_M,
      freshnessMs: FRESHNESS_MS,
      dailyCap: DAILY_COLLECTION_CAP,
      developmentFixtures: Boolean(seeded.fixtures),
      discoveryCount: found,
      foregroundOnly: true,
      ...(qa.mapFail ? { mapUnavailable: true } : {}),
    });
  } catch (error) {
    if (isPrismaMissing(error) || error?.code === 'WORLD_UNAVAILABLE') throw worldSchemaUnavailableError();
    throw error;
  }
}

export async function getExploreArea(userId, coarseKey, options = {}) {
  await requireExplore(options);
  const db = dbOf(options);
  if (!/^[a-z0-9._:-]+$/i.test(String(coarseKey || '')) || String(coarseKey).length > 40) {
    throw httpError('არასწორი არე.', 400, 'EXPLORE_AREA_INVALID');
  }
  try {
    await ensureExploreCatalog(options);
    const now = options.now || new Date();
    await expireWindows(db, now);
    const places = await db.worldPlace.findMany({
      where: { coarseAreaKey: coarseKey, status: 'approved', active: true },
      take: AREA_RESULT_LIMIT,
    });
    const allowed = (places || []).filter((place) => isAllowedPlaceType(place.placeType));
    const spawns = await ensureSpawnsForPlaces(db, allowed, now);
    const spawnByPlace = new Map(spawns.map((row) => [row.placeId, row]));
    const collected = await db.careSparkCollection.findMany({
      where: { userId, spawnId: { in: spawns.map((row) => row.id) }, verificationOutcome: 'SPARK_COLLECTED' },
    });
    const collectedSet = new Set((collected || []).map((row) => row.spawnId));
    const locale = options.locale === 'en' ? 'en' : 'ka';
    return assertWorldPayloadSafe({
      enabled: true,
      rulesetId: EXPLORE_RULESET_ID,
      coarseAreaKey: coarseKey,
      stale: false,
      places: allowed.map((place) => publicPlace(place, spawnByPlace.get(place.id), collectedSet.has(spawnByPlace.get(place.id)?.id), locale)),
    });
  } catch (error) {
    if (isPrismaMissing(error) || error?.code === 'WORLD_UNAVAILABLE') throw worldSchemaUnavailableError();
    throw error;
  }
}

export async function getExploreSparks(userId, coarseKey, options = {}) {
  const area = await getExploreArea(userId, coarseKey, options);
  return assertWorldPayloadSafe({
    enabled: true,
    rulesetId: EXPLORE_RULESET_ID,
    coarseAreaKey: coarseKey,
    sparks: (area.places || []).map((place) => place.spark).filter(Boolean),
  });
}

export async function getExploreCollections(userId, options = {}) {
  await requireExplore(options);
  const db = dbOf(options);
  const take = Math.min(50, Math.max(1, Number(options.take) || 20));
  try {
    const rows = await db.careSparkCollection.findMany({
      where: { userId, verificationOutcome: 'SPARK_COLLECTED' },
      orderBy: [{ collectedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      include: { place: true, spawn: true },
    });
    const slice = (rows || []).slice(0, take);
    const next = (rows || []).length > take ? rows[take].id : null;
    return assertWorldPayloadSafe({
      enabled: true,
      discoveryCount: await db.careSparkCollection.count({ where: { userId, verificationOutcome: 'SPARK_COLLECTED' } }),
      nextCursor: next,
      items: slice.map((row) => ({
        id: row.id,
        spawnId: row.spawnId,
        placeId: row.placeId,
        placeNameKa: row.place?.nameKa,
        placeNameEn: row.place?.nameEn,
        placeType: row.place?.placeType,
        collectedAt: row.collectedAt instanceof Date ? row.collectedAt.toISOString() : row.collectedAt,
        coarseAreaKey: row.coarseAreaKey,
        distanceBand: row.distanceBand,
        accuracyBand: row.accuracyBand,
        periodKey: row.periodKey,
        rulesetVersion: row.rulesetVersion,
        narrativeKey: 'spark.found',
        reactionKey: 'spark.medi_notice',
      })),
    });
  } catch (error) {
    if (isPrismaMissing(error) || error?.code === 'WORLD_UNAVAILABLE') throw worldSchemaUnavailableError();
    throw error;
  }
}

function sampleQuality(sample, now) {
  if (!sample || !isValidLatitude(sample.latitude) || !isValidLongitude(sample.longitude)) {
    return 'SPARK_LOCATION_UNAVAILABLE';
  }
  if (Number.isFinite(sample.speedMps) && sample.speedMps >= MOTORIZED_MPS) {
    return 'SPARK_VERIFICATION_REQUIRED';
  }
  const stamped = sample.locationTimestamp ? new Date(sample.locationTimestamp).getTime() : NaN;
  if (!Number.isFinite(stamped)) return 'SPARK_LOCATION_STALE';
  if (stamped > now.getTime() + 5_000) return 'SPARK_LOCATION_STALE';
  if (now.getTime() - stamped > FRESHNESS_MS) return 'SPARK_LOCATION_STALE';
  if (!Number.isFinite(sample.horizontalAccuracy) || sample.horizontalAccuracy > ACCURACY_MAX_M) {
    return 'SPARK_LOCATION_INACCURATE';
  }
  return null;
}

export async function collectSpark(userId, spawnId, sample, options = {}) {
  await requireExplore(options);
  const db = dbOf(options);
  const now = options.now || new Date();
  try {
    await ensureExploreCatalog(options);
    await expireWindows(db, now);
    if (canLoadExploreFixtures(options.flags || {}) && consumeInaccurateArm(userId)) {
      return exploreResult('SPARK_LOCATION_INACCURATE', { collected: false });
    }
    const quality = sampleQuality(sample, now);
    if (quality) return exploreResult(quality, { collected: false });

    const spawn = await db.careSparkSpawn.findUnique({ where: { id: spawnId } });
    if (!spawn || spawn.status !== 'active' || new Date(spawn.expiresAt).getTime() <= now.getTime()) {
      return exploreResult('SPARK_EXPIRED', { collected: false });
    }
    const place = await db.worldPlace.findUnique({ where: { id: spawn.placeId } });
    if (!place || !place.active || place.status !== 'approved' || !isAllowedPlaceType(place.placeType)) {
      return exploreResult('SPARK_PLACE_UNAVAILABLE', { collected: false });
    }

    const meters = geodesicMeters(
      { latitude: sample.latitude, longitude: sample.longitude },
      { latitude: place.latitude, longitude: place.longitude },
    );
    const band = distanceBand(meters);
    const acc = accuracyBand(sample.horizontalAccuracy);
    if (meters > COLLECTION_RADIUS_M) {
      return exploreResult('SPARK_TOO_FAR', { collected: false, distanceBand: band, accuracyBand: acc });
    }

    const timezone = getEffectiveQuestTimezone(options.user || {}, {
      timezone: options.user?.timezone || options.timezone,
      profileTimezone: options.user?.questProfile?.timezone,
    });
    const periodKey = await resolveWorldDailyPeriodKey(db, userId, now, timezone);
    const idempotencyKey = String(sample.idempotencyKey || '').trim();
    if (!idempotencyKey || idempotencyKey.length > 180) {
      throw httpError('idempotencyKey აუცილებელია.', 400, 'WORLD_IDEMPOTENCY_CONFLICT');
    }

    const run = async (tx) => {
      const existingKey = await tx.careSparkCollection.findFirst({
        where: { userId, idempotencyKey },
      });
      if (existingKey) {
        if (existingKey.spawnId !== spawnId) {
          throw httpError('ეს მოთხოვნა უკვე სხვა Spark-ს ეკუთვნის.', 409, 'WORLD_IDEMPOTENCY_CONFLICT');
        }
        return exploreResult(existingKey.verificationOutcome, {
          collected: existingKey.verificationOutcome === 'SPARK_COLLECTED',
          already: true,
          spawnId,
          placeId: existingKey.placeId,
          discoveryCount: await tx.careSparkCollection.count({
            where: { userId, verificationOutcome: 'SPARK_COLLECTED' },
          }),
        });
      }
      const existingSpawn = await tx.careSparkCollection.findFirst({
        where: { userId, spawnId, verificationOutcome: 'SPARK_COLLECTED' },
      });
      if (existingSpawn) {
        return exploreResult('SPARK_ALREADY_COLLECTED', {
          collected: true,
          already: true,
          spawnId,
          placeId: place.id,
          discoveryCount: await tx.careSparkCollection.count({
            where: { userId, verificationOutcome: 'SPARK_COLLECTED' },
          }),
        });
      }
      if (typeof tx.$executeRaw === 'function') {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${periodKey}))`;
      }
      const todayCount = await tx.careSparkCollection.count({
        where: { userId, periodKey, verificationOutcome: 'SPARK_COLLECTED' },
      });
      if (todayCount >= DAILY_COLLECTION_CAP) {
        return exploreResult('SPARK_DAILY_CAP_REACHED', { collected: false, dailyCap: DAILY_COLLECTION_CAP });
      }
      await tx.careSparkCollection.create({
        data: {
          id: randomUUID(),
          userId,
          spawnId,
          placeId: place.id,
          periodKey,
          collectedAt: now,
          coarseAreaKey: place.coarseAreaKey || coarseAreaKey(place.latitude, place.longitude),
          distanceBand: band,
          accuracyBand: acc,
          verificationOutcome: 'SPARK_COLLECTED',
          rejectionReason: null,
          rulesetVersion: EXPLORE_RULESET_ID,
          idempotencyKey,
          mockLocationSignal: Boolean(sample.mockLocation),
        },
      });
      const discoveryCount = await tx.careSparkCollection.count({
        where: { userId, verificationOutcome: 'SPARK_COLLECTED' },
      });
      return exploreResult('SPARK_COLLECTED', {
        collected: true,
        spawnId,
        placeId: place.id,
        discoveryCount,
        narrativeKey: 'spark.found',
        reactionKey: 'spark.medi_notice',
        distanceBand: band,
        accuracyBand: acc,
      });
    };

    if (typeof db.$transaction === 'function') return db.$transaction((tx) => run(tx));
    return run(db);
  } catch (error) {
    if (error?.code === 'WORLD_IDEMPOTENCY_CONFLICT' || error?.code === 'EXPLORE_DISABLED' || error?.code === 'MEDI_WORLD_DISABLED') {
      throw error;
    }
    if (isUniqueViolation(error)) {
      const raced = await db.careSparkCollection.findFirst({
        where: { userId, spawnId, verificationOutcome: 'SPARK_COLLECTED' },
      });
      if (raced) {
        return exploreResult('SPARK_ALREADY_COLLECTED', {
          collected: true,
          already: true,
          spawnId,
          placeId: raced.placeId,
        });
      }
      throw httpError('ეს მოთხოვნა უკვე სხვა Spark-ს ეკუთვნის.', 409, 'WORLD_IDEMPOTENCY_CONFLICT');
    }
    if (isPrismaMissing(error) || error?.code === 'WORLD_UNAVAILABLE') throw worldSchemaUnavailableError();
    logExploreSafe('[medi-world] explore collect failed', { code: error?.code, message: error?.message });
    throw error;
  }
}

export const EXPLORE_DEV_PLACE_IDS = DEVELOPMENT_PLACES.map((row) => row.id);
