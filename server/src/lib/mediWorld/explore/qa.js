import { randomUUID } from 'node:crypto';
import { prisma as defaultPrisma } from '../../prisma.js';
import { resolveWorldDailyPeriodKey } from '../engine.js';
import { canLoadExploreFixtures } from '../flags.js';
import { getEffectiveQuestTimezone } from '../../questTime.js';
import { DAILY_COLLECTION_CAP, EXPLORE_RULESET_ID } from './geo.js';

const arms = new Map();

function forbidden() {
  const error = new Error('მოთხოვნილი მისამართი ვერ მოიძებნა.');
  error.status = 404;
  error.code = 'EXPLORE_QA_FORBIDDEN';
  return error;
}

function flagsOf(userId) {
  if (!arms.has(userId)) arms.set(userId, { inaccurate: false, mapFail: false, expireSoon: null });
  return arms.get(userId);
}

export function resetExploreQaState() {
  arms.clear();
}

export function peekExploreQaFlags(userId) {
  const flags = arms.get(userId) || { inaccurate: false, mapFail: false, expireSoon: null };
  return { inaccurate: Boolean(flags.inaccurate), mapFail: Boolean(flags.mapFail) };
}

export function takeExpireSoon(userId, now = new Date()) {
  const flags = arms.get(userId);
  if (!flags?.expireSoon) return null;
  const arm = flags.expireSoon;
  if (new Date(arm.expiresAt).getTime() <= new Date(now).getTime()) {
    flags.expireSoon = null;
    return null;
  }
  return arm;
}

export function consumeInaccurateArm(userId) {
  const flags = arms.get(userId);
  if (!flags?.inaccurate) return false;
  flags.inaccurate = false;
  return true;
}

export async function applyExploreQaScenario(userId, scenario, options = {}) {
  if (!canLoadExploreFixtures(options.flags || {})) throw forbidden();
  const db = options.db || defaultPrisma;
  if (!db?.careSparkCollection || !db?.careSparkSpawn) {
    const error = new Error('Explore schema unavailable.');
    error.status = 503;
    error.code = 'WORLD_UNAVAILABLE';
    throw error;
  }
  const now = options.now || new Date();
  if (scenario === 'arm_inaccurate') {
    flagsOf(userId).inaccurate = true;
    return { ok: true, scenario, fixture: true };
  }
  if (scenario === 'arm_map_fail') {
    flagsOf(userId).mapFail = true;
    return { ok: true, scenario, fixture: true };
  }
  if (scenario === 'clear') {
    arms.delete(userId);
    return { ok: true, scenario, fixture: true };
  }
  if (scenario === 'expire_active') {
    const placeId = options.placeId || 'place.qa.park.beta';
    const updated = await db.careSparkSpawn.updateMany({
      where: { placeId, status: 'active' },
      data: { status: 'expired', expiresAt: new Date(now.getTime() - 60_000) },
    });
    return { ok: true, scenario, fixture: true, updated: updated?.count || 0, placeId };
  }
  if (scenario === 'expire_soon') {
    const placeId = options.placeId || 'place.qa.garden.alpha';
    const inMs = Math.min(60_000, Math.max(5_000, Number(options.inMs) || 15_000));
    const expiresAt = new Date(now.getTime() + inMs);
    flagsOf(userId).expireSoon = { placeId, expiresAt: expiresAt.toISOString(), inMs };
    return { ok: true, scenario, fixture: true, placeId, inMs, expiresAt: expiresAt.toISOString() };
  }
  if (scenario === 'fill_daily_cap') {
    const timezone = getEffectiveQuestTimezone(options.user || {}, {
      timezone: options.user?.timezone || options.timezone,
      profileTimezone: options.user?.questProfile?.timezone,
    });
    const periodKey = await resolveWorldDailyPeriodKey(db, userId, now, timezone);
    const existing = await db.careSparkCollection.count({
      where: { userId, periodKey, verificationOutcome: 'SPARK_COLLECTED' },
    });
    let created = 0;
    for (let i = existing; i < DAILY_COLLECTION_CAP; i += 1) {
      const spawnId = `qa.cap.spawn.${userId}.${periodKey}.${i}`;
      await db.careSparkSpawn.upsert({
        where: { id: spawnId },
        create: {
          id: spawnId,
          definitionId: 'spark.care',
          placeId: 'place.qa.square.gamma',
          windowKey: `qa-cap-${periodKey}-${i}`,
          startsAt: now,
          expiresAt: now,
          status: 'expired',
          rulesetVersion: EXPLORE_RULESET_ID,
        },
        update: { status: 'expired', expiresAt: now },
      });
      await db.careSparkCollection.create({
        data: {
          id: randomUUID(),
          userId,
          spawnId,
          placeId: 'place.qa.square.gamma',
          periodKey,
          collectedAt: now,
          coarseAreaKey: 'g37.40_-122.10',
          distanceBand: 'within_75m',
          accuracyBand: 'fine',
          verificationOutcome: 'SPARK_COLLECTED',
          rulesetVersion: EXPLORE_RULESET_ID,
          idempotencyKey: `qa-cap:${userId}:${periodKey}:${i}`,
          mockLocationSignal: false,
        },
      });
      created += 1;
    }
    return { ok: true, scenario, fixture: true, created, dailyCap: DAILY_COLLECTION_CAP };
  }
  const error = new Error('Unknown Explore QA scenario.');
  error.status = 400;
  error.code = 'EXPLORE_QA_SCENARIO_INVALID';
  throw error;
}
