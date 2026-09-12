import { prisma as defaultPrisma } from '../prisma.js';
import { canAssignNewDailyPeriod, dailyPeriodKey, getEffectiveQuestTimezone } from '../questTime.js';
import {
  ACTIVITY_ADAPTERS,
  ENERGY_BALANCE_FIELDS,
  PHASE38_UNLOCKS,
  adapterById,
  awardsVerifiedProgress,
  isCareEnergyType,
  isProgressState,
  isWorldActionSource,
} from './contract.js';
import {
  MEDI_WORLD_ECONOMY_V2,
  REASON_CODES,
  isActivitySourceType,
  levelUpIdempotencyKey,
  worldProgressFromXp,
} from './ruleset.js';
import {
  cappedVerifiedReward,
  completionRatioBps,
  nextNonNegativeBalance,
  requireNonNegativeInt,
  requirePositiveInt,
  WORLD_TRANSACTION_CREDIT,
} from './economy.js';
import { isMediWorldEnabled } from './flags.js';
import { assertWorldPayloadSafe, sanitizeWorldMetadata } from './privacy.js';
import { assertIdempotencyMatch, fingerprintWorldIntent, loadLedgerByIdempotency } from './intent.js';

function dbOf(options = {}) {
  return options.db || defaultPrisma;
}

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function isUniqueViolation(error) {
  return error?.code === 'P2002';
}

export function isPrismaMissing(error) {
  return error?.code === 'P2021' || /does not exist/i.test(error?.message || '');
}

export function worldSchemaUnavailableError() {
  const error = new Error('Medi World persistence is unavailable.');
  error.status = 503;
  error.code = 'WORLD_UNAVAILABLE';
  return error;
}

export function reportWorldSchemaMissing(context, error) {
  console.warn(
    '[medi-world] WORLD_SCHEMA_MISSING',
    JSON.stringify({
      code: 'WORLD_SCHEMA_MISSING',
      context,
      prisma: error?.code || 'MISSING_CLIENT',
    }),
  );
}

function emptyEnergy() {
  return { movement: 0, hydration: 0, calm: 0, care: 0, connection: 0 };
}

function energyFromRow(row) {
  return {
    movement: row?.energyMovement || 0,
    hydration: row?.energyHydration || 0,
    calm: row?.energyCalm || 0,
    care: row?.energyCare || 0,
    connection: row?.energyConnection || 0,
  };
}

function displayParamsFromRow(row) {
  return {
    energyType: row?.energyType || null,
    energyGranted: row?.energyAmount || 0,
    worldXpGranted: row?.foundationXp || 0,
    periodKey: row?.periodKey || null,
  };
}

export { loadLedgerByIdempotency, fingerprintWorldIntent, assertIdempotencyMatch };

export function publicWorldProfile(row, extras = {}) {
  const xp = worldProgressFromXp(row?.foundationXp || 0);
  const payload = {
    userId: row?.userId || extras.userId || null,
    rulesetId: MEDI_WORLD_ECONOMY_V2.id,
    rulesetVersion: row?.rulesetVersion || MEDI_WORLD_ECONOMY_V2.rulesetVersion,
    currentRulesetVersion: MEDI_WORLD_ECONOMY_V2.rulesetVersion,
    worldLevel: xp.level,
    worldXp: xp.worldXp,
    foundation: {
      level: xp.level,
      xp: xp.worldXp,
      worldXp: xp.worldXp,
      worldLevel: xp.level,
      levelStartXp: xp.levelStartXp,
      nextLevelXp: xp.nextLevelXp,
      xpIntoLevel: xp.xpIntoLevel,
      xpRequiredForNextLevel: xp.xpRequiredForNextLevel,
      xpNeededForNextLevel: xp.xpNeededForNextLevel,
      progressBps: xp.progressBps,
      progressPercent: xp.progressPercent,
      atCap: xp.atCap,
    },
    careEnergy: energyFromRow(row),
    companionRef: {
      owned: Boolean(row?.companionProfileId),
      profileId: row?.companionProfileId || null,
    },
    coarseCommunityKey: null,
    unlocks: { ...PHASE38_UNLOCKS },
    awakening: true,
    createdAt: row?.createdAt instanceof Date ? row.createdAt.toISOString() : row?.createdAt || null,
    updatedAt: row?.updatedAt instanceof Date ? row.updatedAt.toISOString() : row?.updatedAt || null,
  };
  return assertWorldPayloadSafe(payload);
}

export function publicWorldLedgerRow(row) {
  if (!row) return null;
  return assertWorldPayloadSafe({
    id: row.id,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    adapterId: row.adapterId,
    energyType: row.energyType,
    transactionType: row.transactionType || WORLD_TRANSACTION_CREDIT,
    energyAmount: row.energyAmount,
    worldXp: row.foundationXp,
    foundationXp: row.foundationXp,
    progressState: row.progressState,
    completionRatioBps: row.completionRatioBps,
    rulesetVersion: row.rulesetVersion,
    reasonCode: row.reasonCode || REASON_CODES.FOUNDATION_LEGACY,
    periodKey: row.periodKey || null,
    displayParams: displayParamsFromRow(row),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  });
}

async function resolveCompanionProfileId(tx, userId) {
  if (typeof tx?.mediCompanionProfile?.findUnique !== 'function') return null;
  const companion = await tx.mediCompanionProfile.findUnique({ where: { userId } }).catch(() => null);
  return companion?.id || null;
}

export async function ensureMediWorldProfile(userId, options = {}) {
  const db = dbOf(options);
  if (typeof db?.mediWorldProfile?.upsert !== 'function') {
    reportWorldSchemaMissing('profile_ensure');
    throw worldSchemaUnavailableError();
  }
  const companionProfileId = await resolveCompanionProfileId(db, userId);
  const data = {
    userId,
    rulesetVersion: MEDI_WORLD_ECONOMY_V2.rulesetVersion,
    foundationXp: 0,
    foundationLevel: 1,
    energyMovement: 0,
    energyHydration: 0,
    energyCalm: 0,
    energyCare: 0,
    energyConnection: 0,
    companionProfileId,
    coarseCommunityKey: null,
  };
  try {
    return await db.mediWorldProfile.upsert({
      where: { userId },
      create: data,
      update: companionProfileId ? { companionProfileId } : {},
    });
  } catch (error) {
    if (isUniqueViolation(error) && typeof db?.mediWorldProfile?.findUnique === 'function') {
      const existing = await db.mediWorldProfile.findUnique({ where: { userId } });
      if (existing) return existing;
    }
    if (isPrismaMissing(error)) {
      reportWorldSchemaMissing('profile_ensure', error);
      throw worldSchemaUnavailableError();
    }
    throw error;
  }
}

function validateEvent(event = {}) {
  const sourceType = event.sourceType;
  if (!isWorldActionSource(sourceType)) {
    throw httpError('Unsupported Medi World activity source.', 400, 'WORLD_UNSUPPORTED_SOURCE');
  }
  const adapterId = String(event.adapterId || '');
  const adapter = adapterById(adapterId);
  if (!adapter) {
    throw httpError('Unsupported Medi World activity adapter.', 400, 'WORLD_UNSUPPORTED_ADAPTER');
  }
  const energyType = event.energyType || adapter.energyType;
  if (!isCareEnergyType(energyType) || energyType !== adapter.energyType) {
    throw httpError('Care Energy type does not match adapter.', 400, 'WORLD_ENERGY_TYPE');
  }
  const progressState = event.progressState;
  if (!isProgressState(progressState)) {
    throw httpError('Unknown progress state.', 400, 'WORLD_PROGRESS_STATE');
  }
  const personalTarget = requirePositiveInt(event.personalTarget, 'personalTarget');
  const completedAmount = requireNonNegativeInt(event.completedAmount, 'completedAmount');
  const sourceId = String(event.sourceId || '').trim();
  const idempotencyKey = String(event.idempotencyKey || '').trim();
  if (!sourceId || sourceId.length > 120) {
    throw httpError('Missing activity source id.', 400, 'WORLD_SOURCE_ID');
  }
  if (!idempotencyKey || idempotencyKey.length > 180) {
    throw httpError('Missing idempotency key.', 400, 'WORLD_IDEMPOTENCY');
  }
  return {
    sourceType,
    sourceId,
    idempotencyKey,
    adapterId,
    energyType,
    progressState,
    personalTarget,
    completedAmount,
    logicalEventId: String(event.logicalEventId || sourceId).trim(),
    metadata: sanitizeWorldMetadata(event.metadata),
  };
}

function duplicateResult({ profile, ledger, progressState, completionRatioBps }) {
  return {
    applied: false,
    duplicate: true,
    rejected: false,
    progressState,
    completionRatioBps,
    reasonCode: REASON_CODES.DUPLICATE_ACTIVITY,
    explanation: {
      reasonCode: REASON_CODES.DUPLICATE_ACTIVITY,
      params: displayParamsFromRow(ledger),
    },
    reward: {
      energyAmount: ledger?.energyAmount || 0,
      foundationXp: Number(ledger?.foundationXp) || 0,
      worldXp: Number(ledger?.foundationXp) || 0,
      completionRatioBps: ledger?.completionRatioBps || 0,
    },
    profile: publicWorldProfile(profile),
    ledger: publicWorldLedgerRow(ledger),
    levelUps: [],
  };
}

async function resolvePeriodKey(tx, userId, now, timezone) {
  const localYmd = dailyPeriodKey(now, timezone);
  const last = await tx.mediWorldLedger.findFirst({
    where: {
      userId,
      sourceType: { in: [...MEDI_WORLD_ECONOMY_V2.activitySourceTypes] },
      periodKey: { not: null },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  }).catch(() => null);
  if (!last?.periodKey) return localYmd;
  const allowed = canAssignNewDailyPeriod(
    { lastDailyAssignPeriodKey: last.periodKey, lastDailyAssignAt: last.createdAt },
    localYmd,
    now,
    timezone,
  );
  return allowed ? localYmd : last.periodKey;
}

async function sumDayUsage(tx, userId, periodKey) {
  const rows = await tx.mediWorldLedger.findMany({
    where: {
      userId,
      periodKey,
      transactionType: WORLD_TRANSACTION_CREDIT,
      sourceType: { in: [...MEDI_WORLD_ECONOMY_V2.activitySourceTypes] },
    },
  });
  const category = emptyEnergy();
  let worldXp = 0;
  for (const row of rows) {
    category[row.energyType] = (category[row.energyType] || 0) + (row.energyAmount || 0);
    worldXp += row.foundationXp || 0;
  }
  return { category, worldXp };
}

async function hasSpendableLogicalEvent(tx, userId, logicalEventId) {
  if (!logicalEventId) return false;
  const rows = await tx.mediWorldLedger.findMany({
    where: { userId, logicalEventId },
  });
  return rows.some(
    (row) =>
      row.transactionType === WORLD_TRANSACTION_CREDIT &&
      isActivitySourceType(row.sourceType) &&
      ((row.energyAmount || 0) > 0 || (row.foundationXp || 0) > 0),
  );
}

async function allocateLedgerCreatedAt(tx, userId, requested) {
  const requestedAt = requested instanceof Date ? requested : new Date(requested);
  if (typeof tx?.mediWorldLedger?.findFirst !== 'function') return requestedAt;
  const last = await tx.mediWorldLedger.findFirst({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  if (!last?.createdAt) return requestedAt;
  const lastMs = last.createdAt instanceof Date ? last.createdAt.getTime() : Date.parse(last.createdAt);
  const reqMs = requestedAt.getTime();
  if (Number.isNaN(lastMs) || reqMs > lastMs) return requestedAt;
  return new Date(lastMs + 1);
}

export { allocateLedgerCreatedAt };

async function grantLevelUps(tx, userId, fromLevel, toLevel, now) {
  const granted = [];
  const start = Math.max(1, fromLevel);
  const end = Math.min(MEDI_WORLD_ECONOMY_V2.maxLevel, toLevel);
  for (let level = start + 1; level <= end; level += 1) {
    const idempotencyKey = levelUpIdempotencyKey(userId, level);
    const existing = await loadLedgerByIdempotency(tx, idempotencyKey);
    if (existing) continue;
    try {
      const createdAt = await allocateLedgerCreatedAt(tx, userId, now);
      const ledger = await tx.mediWorldLedger.create({
        data: {
          userId,
          idempotencyKey,
          sourceType: 'LEVEL_UP',
          sourceId: `level:${level}`,
          adapterId: 'system.level_up',
          energyType: 'connection',
          transactionType: WORLD_TRANSACTION_CREDIT,
          energyAmount: MEDI_WORLD_ECONOMY_V2.levelUpConnectionEnergy,
          foundationXp: 0,
          progressState: 'verified',
          completionRatioBps: 0,
          rulesetVersion: MEDI_WORLD_ECONOMY_V2.rulesetVersion,
          reasonCode: REASON_CODES.LEVEL_UP_REWARD,
          logicalEventId: `level-up:${level}`,
          intentFingerprint: fingerprintWorldIntent({
            userId,
            transactionType: WORLD_TRANSACTION_CREDIT,
            energyType: 'connection',
            sourceType: 'LEVEL_UP',
            sourceId: `level:${level}`,
            adapterId: 'system.level_up',
            progressState: 'verified',
            requestedAmount: MEDI_WORLD_ECONOMY_V2.levelUpConnectionEnergy,
            logicalEventId: `level-up:${level}`,
            rulesetVersion: MEDI_WORLD_ECONOMY_V2.rulesetVersion,
          }),
          periodKey: null,
          metadata: { origin: 'level_up' },
          createdAt,
        },
      });
      granted.push({ level, ledger, energyAmount: MEDI_WORLD_ECONOMY_V2.levelUpConnectionEnergy });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return granted;
}

export async function processWorldActivityInTx(tx, userId, event, options = {}) {
  if (!isMediWorldEnabled(options.flags)) {
    throw httpError('მოთხოვნილი მისამართი ვერ მოიძებნა.', 404, 'MEDI_WORLD_DISABLED');
  }
  if (typeof tx?.mediWorldLedger?.create !== 'function') {
    reportWorldSchemaMissing('activity_write');
    throw worldSchemaUnavailableError();
  }

  const parsed = validateEvent(event);
  const timezone = getEffectiveQuestTimezone(options.user || {}, {
    timezone: options.timezone,
    deviceTimezone: options.deviceTimezone,
  });
  const now = options.now || new Date();
  const ratio = completionRatioBps(parsed.completedAmount, parsed.personalTarget);
  const verified = awardsVerifiedProgress(parsed.progressState);
  const band = verified
    ? cappedVerifiedReward(ratio)
    : { energyAmount: 0, foundationXp: 0, worldXp: 0, completionRatioBps: ratio, reasonCode: REASON_CODES.UNVERIFIED_ACTIVITY };

  if (options.beforeWrite) await options.beforeWrite();

  const intent = {
    userId,
    transactionType: WORLD_TRANSACTION_CREDIT,
    energyType: parsed.energyType,
    sourceType: parsed.sourceType,
    sourceId: parsed.sourceId,
    adapterId: parsed.adapterId,
    progressState: parsed.progressState,
    personalTarget: parsed.personalTarget,
    completedAmount: parsed.completedAmount,
    logicalEventId: parsed.logicalEventId,
    rulesetVersion: MEDI_WORLD_ECONOMY_V2.rulesetVersion,
  };

  const existing = await loadLedgerByIdempotency(tx, parsed.idempotencyKey);
  if (existing) {
    assertIdempotencyMatch(existing, intent);
    const profile = await ensureMediWorldProfile(userId, { ...options, db: tx });
    return duplicateResult({
      profile,
      ledger: existing,
      progressState: existing.progressState,
      completionRatioBps: existing.completionRatioBps,
    });
  }

  if (verified && (await hasSpendableLogicalEvent(tx, userId, parsed.logicalEventId))) {
    const profile = await ensureMediWorldProfile(userId, { ...options, db: tx });
    const prior = await tx.mediWorldLedger.findFirst({
      where: { userId, logicalEventId: parsed.logicalEventId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return duplicateResult({
      profile,
      ledger: prior,
      progressState: prior?.progressState || parsed.progressState,
      completionRatioBps: prior?.completionRatioBps || ratio,
    });
  }

  await ensureMediWorldProfile(userId, { ...options, db: tx });
  if (typeof tx.$executeRaw === 'function') {
    await tx.$executeRaw`SELECT 1 FROM "MediWorldProfile" WHERE "userId" = ${userId} FOR UPDATE`;
  }
  const profile = await tx.mediWorldProfile.findUnique({ where: { userId } });
  const periodKey = await resolvePeriodKey(tx, userId, now, timezone);
  const usage = await sumDayUsage(tx, userId, periodKey);
  const categoryUsed = usage.category[parsed.energyType] || 0;
  const categoryRemaining = Math.max(0, MEDI_WORLD_ECONOMY_V2.dailyCategoryEnergyCap - categoryUsed);
  const xpRemaining = Math.max(0, MEDI_WORLD_ECONOMY_V2.dailyWorldXpCap - usage.worldXp);

  let energyGranted = verified ? Math.min(band.energyAmount, categoryRemaining) : 0;
  let xpGranted = verified ? Math.min(band.foundationXp, xpRemaining) : 0;
  if (options.testGrantXp != null && process.env.NODE_ENV === 'test') {
    xpGranted = requireNonNegativeInt(options.testGrantXp, 'testGrantXp');
  }

  let reasonCode = band.reasonCode;
  if (!verified) reasonCode = REASON_CODES.UNVERIFIED_ACTIVITY;
  else if (band.energyAmount > 0 && energyGranted < band.energyAmount) reasonCode = REASON_CODES.DAILY_CATEGORY_CAP_REACHED;
  else if (band.foundationXp > 0 && xpGranted < band.foundationXp) reasonCode = REASON_CODES.DAILY_XP_CAP_REACHED;

  nextNonNegativeBalance(profile.foundationXp || 0, WORLD_TRANSACTION_CREDIT, xpGranted);
  const energyField = ENERGY_BALANCE_FIELDS[parsed.energyType];
  nextNonNegativeBalance(profile[energyField] || 0, WORLD_TRANSACTION_CREDIT, energyGranted);

  let ledger;
  try {
    const createdAt = await allocateLedgerCreatedAt(tx, userId, now);
    ledger = await tx.mediWorldLedger.create({
      data: {
        userId,
        idempotencyKey: parsed.idempotencyKey,
        sourceType: parsed.sourceType,
        sourceId: parsed.sourceId,
        adapterId: parsed.adapterId,
        energyType: parsed.energyType,
        transactionType: WORLD_TRANSACTION_CREDIT,
        energyAmount: energyGranted,
        foundationXp: xpGranted,
        progressState: parsed.progressState,
        completionRatioBps: band.completionRatioBps,
        rulesetVersion: MEDI_WORLD_ECONOMY_V2.rulesetVersion,
        reasonCode,
        periodKey,
        logicalEventId: parsed.logicalEventId,
        intentFingerprint: fingerprintWorldIntent(intent),
        metadata: parsed.metadata,
        createdAt,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await loadLedgerByIdempotency(tx, parsed.idempotencyKey);
    assertIdempotencyMatch(raced, intent);
    const latest = await ensureMediWorldProfile(userId, { ...options, db: tx });
    return duplicateResult({
      profile: latest,
      ledger: raced,
      progressState: raced?.progressState || parsed.progressState,
      completionRatioBps: raced?.completionRatioBps || ratio,
    });
  }

  const fromLevel = Math.max(1, profile.foundationLevel || 1, worldProgressFromXp(profile.foundationXp || 0).level);
  const nextXp = (profile.foundationXp || 0) + xpGranted;
  const derived = worldProgressFromXp(nextXp);
  const toLevel = Math.max(fromLevel, derived.level);
  const levelUps = await grantLevelUps(tx, userId, fromLevel, toLevel, now);
  const connectionGrant = levelUps.reduce((sum, item) => sum + item.energyAmount, 0);

  const updateData = {
    foundationXp: { increment: xpGranted },
    foundationLevel: toLevel,
    rulesetVersion: MEDI_WORLD_ECONOMY_V2.rulesetVersion,
    [energyField]: { increment: energyGranted + (energyField === 'energyConnection' ? connectionGrant : 0) },
  };
  if (energyField !== 'energyConnection' && connectionGrant) {
    updateData.energyConnection = { increment: connectionGrant };
  }

  const updated = await tx.mediWorldProfile.update({
    where: { userId },
    data: updateData,
  });

  if (verified && ratio >= 10_000) {
    try {
      const { awardVerifiedGoalBondInTx } = await import('./companion/bondAwards.js');
      await awardVerifiedGoalBondInTx(tx, userId, { logicalEventId: parsed.logicalEventId, periodKey }, options);
    } catch (error) {
      if (!(isPrismaMissing(error) || error?.code === 'P2021' || error?.code === 'WORLD_UNAVAILABLE')) throw error;
    }
  }

  if (verified && energyGranted > 0) {
    try {
      const { tryApplyGardenNurtureInTx } = await import('./garden/nurture.js');
      await tryApplyGardenNurtureInTx(
        tx,
        userId,
        {
          energyType: parsed.energyType,
          periodKey,
          ledgerId: ledger.id,
          sourceType: parsed.sourceType,
          energyAmount: energyGranted,
          progressState: parsed.progressState,
          reasonCode,
          createdAt: ledger.createdAt || now,
        },
        options,
      );
    } catch (error) {
      if (!(isPrismaMissing(error) || error?.code === 'P2021' || error?.code === 'WORLD_UNAVAILABLE')) {
        console.warn('[medi-world] garden_nurture_hook', error?.code || error?.message || error);
      }
    }
  }

  return {
    applied: true,
    duplicate: false,
    rejected: !verified,
    progressState: parsed.progressState,
    completionRatioBps: band.completionRatioBps,
    reasonCode,
    explanation: {
      reasonCode,
      params: {
        energyType: parsed.energyType,
        energyGranted,
        worldXpGranted: xpGranted,
        periodKey,
        categoryUsed: categoryUsed + energyGranted,
        categoryCap: MEDI_WORLD_ECONOMY_V2.dailyCategoryEnergyCap,
        dailyXpUsed: usage.worldXp + xpGranted,
        dailyXpCap: MEDI_WORLD_ECONOMY_V2.dailyWorldXpCap,
      },
    },
    reward: {
      energyAmount: energyGranted,
      foundationXp: xpGranted,
      worldXp: xpGranted,
      completionRatioBps: band.completionRatioBps,
    },
    profile: publicWorldProfile(updated),
    ledger: publicWorldLedgerRow(ledger),
    levelUps: levelUps.map((item) => ({
      level: item.level,
      energyType: 'connection',
      energyAmount: item.energyAmount,
      reasonCode: REASON_CODES.LEVEL_UP_REWARD,
    })),
    today: {
      periodKey,
      timezone,
    },
  };
}

export async function processWorldActivity(userId, event, options = {}) {
  const db = dbOf(options);
  try {
    if (typeof db?.$transaction === 'function') {
      return await db.$transaction((tx) => processWorldActivityInTx(tx, userId, event, options));
    }
    return await processWorldActivityInTx(db, userId, event, options);
  } catch (error) {
    if (isPrismaMissing(error)) {
      reportWorldSchemaMissing('activity_write', error);
      throw worldSchemaUnavailableError();
    }
    throw error;
  }
}

export async function setWorldXpForTests(userId, worldXp, options = {}) {
  if (process.env.NODE_ENV === 'production') {
    throw httpError('Test grant is not available.', 404, 'MEDI_WORLD_DISABLED');
  }
  const db = dbOf(options);
  const xp = requireNonNegativeInt(worldXp, 'worldXp');
  const run = async (tx) => {
    await ensureMediWorldProfile(userId, { ...options, db: tx });
    const profile = await tx.mediWorldProfile.findUnique({ where: { userId } });
    const fromLevel = Math.max(1, profile.foundationLevel || 1);
    const derived = worldProgressFromXp(xp);
    const levelUps = await grantLevelUps(tx, userId, fromLevel, derived.level, options.now || new Date());
    const connectionGrant = levelUps.reduce((sum, item) => sum + item.energyAmount, 0);
    const updated = await tx.mediWorldProfile.update({
      where: { userId },
      data: {
        foundationXp: xp,
        foundationLevel: derived.level,
        energyConnection: { increment: connectionGrant },
        rulesetVersion: MEDI_WORLD_ECONOMY_V2.rulesetVersion,
      },
    });
    return { profile: publicWorldProfile(updated), levelUps };
  };
  if (typeof db?.$transaction === 'function') return db.$transaction(run);
  return run(db);
}

export { ACTIVITY_ADAPTERS, emptyEnergy, energyFromRow, resolvePeriodKey as resolveWorldDailyPeriodKey };
