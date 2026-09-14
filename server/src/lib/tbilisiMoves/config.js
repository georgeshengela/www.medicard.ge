import { prisma } from '../prisma.js';
import { writeAdminAudit } from '../adminAudit.js';
import { TBILISI_MOVES_CONFIG_ID } from './catalog.js';
import { CONFIG_DEFAULTS, OPERATIONAL_FIELDS, SCORING_FIELDS } from './constants.js';
import { isTbilisiMovesSchemaMissing, schemaUnavailable, tbilisiMovesError } from './errors.js';
import { assertConfigRelationships, normalizeConfigPatch } from './schema.js';
import { graceEndsAtFor, tbilisiClock } from './time.js';

export function publicConfig(row) {
  const source = row || CONFIG_DEFAULTS;
  return {
    featureEnabled: Boolean(source.featureEnabled),
    enrollmentOpen: Boolean(source.enrollmentOpen),
    ingestionPaused: Boolean(source.ingestionPaused),
    ingestionEnabled: !source.ingestionPaused,
    competitionPaused: Boolean(source.competitionPaused),
    rewardsEnabled: Boolean(source.rewardsEnabled),
    leaderRecognitionEnabled: source.leaderRecognitionEnabled !== false,
    leaderRewardedRanks: Number(source.leaderRewardedRanks) || 3,
    districtGoalBadgeEnabled: source.districtGoalBadgeEnabled !== false,
    pilotMode: true,
    defaultDailyTarget: source.defaultDailyTarget,
    competitiveCap: source.competitiveCap,
    cooldownDays: source.cooldownDays,
    minParticipantsForRank: source.minParticipantsForRank,
    lateSyncGraceHours: source.lateSyncGraceHours,
    sanityMaxRawSteps: source.sanityMaxRawSteps,
    correctionDropFlagPct: source.correctionDropFlagPct,
    geometryAssetVersion: source.geometryAssetVersion ?? null,
    revision: source.revision ?? 1,
    updatedAt: source.updatedAt ?? null,
    visualQaFixture: process.env.TBILISI_MOVES_VISUAL_QA === '1',
  };
}

export function scoringSnapshot(config, districts, now = new Date()) {
  const targets = {};
  for (const district of districts) {
    targets[district.id] = district.dailyTargetOverride ?? config.defaultDailyTarget;
  }
  return {
    rules: {
      competitiveCap: config.competitiveCap,
      defaultDailyTarget: config.defaultDailyTarget,
      cooldownDays: config.cooldownDays,
      minParticipantsForRank: config.minParticipantsForRank,
      lateSyncGraceHours: config.lateSyncGraceHours,
      rewardsEnabled: config.rewardsEnabled,
      leaderRecognitionEnabled: config.leaderRecognitionEnabled !== false,
      leaderRewardedRanks: Number(config.leaderRewardedRanks) || 3,
      districtGoalBadgeEnabled: config.districtGoalBadgeEnabled !== false,
      rewards: {
        enabled: config.rewardsEnabled !== false,
        leaderRecognitionEnabled: config.leaderRecognitionEnabled !== false,
        leaderRewardedRanks: Number(config.leaderRewardedRanks) || 3,
        districtGoalBadgeEnabled: config.districtGoalBadgeEnabled !== false,
      },
      pilotMode: true,
      competitionPausedAtOpen: Boolean(config.competitionPaused),
      ingestionPausedAtOpen: Boolean(config.ingestionPaused),
      snapshottedAt: now.toISOString(),
    },
    districtTargets: targets,
  };
}

export async function loadConfigRow(db = prisma) {
  try {
    return await db.tbilisiMovesConfig.findUnique({ where: { id: TBILISI_MOVES_CONFIG_ID } });
  } catch (error) {
    if (isTbilisiMovesSchemaMissing(error)) return null;
    throw error;
  }
}

export async function requireSchema(db = prisma) {
  try {
    const row = await db.tbilisiMovesConfig.findUnique({ where: { id: TBILISI_MOVES_CONFIG_ID } });
    if (row) return row;
    await db.tbilisiMovesDistrict.findMany({ take: 1 });
    throw schemaUnavailable();
  } catch (error) {
    if (isTbilisiMovesSchemaMissing(error)) throw schemaUnavailable();
    throw error;
  }
}

export async function loadLiveConfig(db = prisma) {
  const row = await requireSchema(db);
  return publicConfig(row);
}

function publicStatusBody(row, now) {
  const clock = tbilisiClock(now);
  const schemaReady = Boolean(row);
  const featureEnabled = Boolean(row?.featureEnabled);
  const ingestionPaused = row ? Boolean(row.ingestionPaused) : true;
  return {
    schemaReady,
    featureEnabled,
    enrollmentOpen: Boolean(row?.enrollmentOpen),
    ingestionPaused,
    competitionPaused: Boolean(row?.competitionPaused),
    pilotMode: true,
    date: clock.date,
    serverNow: clock.serverNow,
    timezone: clock.timezone,
    dayStart: clock.dayStart,
    dayEnd: clock.dayEnd,
    nextMidnight: clock.nextMidnight,
    clock,
    cooldownDays: row?.cooldownDays ?? null,
    competitiveCap: row?.competitiveCap ?? null,
    defaultDailyTarget: row?.defaultDailyTarget ?? null,
    minParticipantsForRank: row?.minParticipantsForRank ?? null,
    lateSyncGraceHours: row?.lateSyncGraceHours ?? null,
    ingestEligible: schemaReady && featureEnabled && !ingestionPaused,
    resultsReady: Boolean(row?.resultsReady),
    visualQaFixture: process.env.TBILISI_MOVES_VISUAL_QA === '1',
    sync: {
      schemaReady,
      featureEnabled,
      enrollmentOpen: Boolean(row?.enrollmentOpen),
      ingestionPaused,
      competitionPaused: Boolean(row?.competitionPaused),
      ingestEligible: schemaReady && featureEnabled && !ingestionPaused,
      resultsReady: Boolean(row?.resultsReady),
    },
  };
}

export async function getPublicStatus(now = new Date()) {
  try {
    const row = await prisma.tbilisiMovesConfig.findUnique({ where: { id: TBILISI_MOVES_CONFIG_ID } });
    if (!row) return publicStatusBody(null, now);
    let resultsReady = false;
    try {
      await prisma.tbilisiMovesResultRevision.findFirst({ take: 1, select: { id: true } });
      await prisma.tbilisiMovesAward.findFirst({ take: 1, select: { id: true } });
      resultsReady = true;
    } catch (error) {
      if (!isTbilisiMovesSchemaMissing(error)) throw error;
    }
    return publicStatusBody({ ...row, resultsReady }, now);
  } catch (error) {
    if (isTbilisiMovesSchemaMissing(error)) {
      return publicStatusBody(null, now);
    }
    throw error;
  }
}

async function syncIngestHold(tx, paused, now) {
  const open = await tx.tbilisiMovesIngestHold.findFirst({ where: { endedAt: null } });
  if (paused && !open) {
    await tx.tbilisiMovesIngestHold.create({ data: { startedAt: now } });
  }
  if (!paused && open) {
    await tx.tbilisiMovesIngestHold.update({ where: { id: open.id }, data: { endedAt: now } });
  }
}

export async function patchConfig({ admin, body, now = new Date() }) {
  const input = normalizeConfigPatch(body);
  const reason = String(input.reason || 'config_update').slice(0, 400);
  delete input.reason;
  const revision = input.revision;
  delete input.revision;

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.tbilisiMovesConfig.findUnique({ where: { id: TBILISI_MOVES_CONFIG_ID } });
    if (!current) throw schemaUnavailable();
    if (current.revision !== revision) {
      throw tbilisiMovesError(409, 'CONFIG_STALE', 'კონფიგურაცია შეიცვალა. განაახლეთ გვერდი.');
    }

    const next = { ...current, ...input, pilotMode: true };
    assertConfigRelationships(next);

    const updated = await tx.tbilisiMovesConfig.update({
      where: { id: TBILISI_MOVES_CONFIG_ID },
      data: {
        ...input,
        pilotMode: true,
        revision: { increment: 1 },
      },
    });

    if (typeof input.ingestionPaused === 'boolean') {
      await syncIngestHold(tx, updated.ingestionPaused, now);
    }

    const effective = {
      immediate: OPERATIONAL_FIELDS.filter((key) => key in input),
      nextUnopenedRound: SCORING_FIELDS.filter((key) => key in input),
      existingLockUntilDatesUnchanged: 'cooldownDays' in input,
    };

    return {
      previous: publicConfig(current),
      config: publicConfig(updated),
      effective,
    };
  });

  await writeAdminAudit({
    admin,
    action: 'tbilisi_moves.config.patch',
    targetType: 'tbilisi_moves_config',
    targetId: TBILISI_MOVES_CONFIG_ID,
    previousValue: result.previous,
    newValue: {
      ...result.config,
      reason,
      effectiveAt: now.toISOString(),
      effective: result.effective,
    },
  });

  return { config: result.config, effective: result.effective, reason };
}

export function resolvedDistrictTarget(district, config) {
  return district.dailyTargetOverride ?? config.defaultDailyTarget;
}

export function roundIngestOpen(round, now = new Date()) {
  if (!round) return false;
  if (round.status === 'FINALIZED') return false;
  return now.getTime() < new Date(round.graceEndsAt).getTime();
}

export function computeGraceEndsAt(ymd, graceHours) {
  return graceEndsAtFor(ymd, graceHours);
}
