/**
 * Cycle data lifecycle — export and wipe.
 * Does not change prediction math.
 */

import { serializeBleedClassificationsForExport } from './cyclePostpartumBleedClassification.js';

export const DELETE_CYCLE_CONFIRM = 'DELETE_CYCLE_DATA';

export async function revokeCycleShares(prisma, ownerUserId) {
  await prisma.cyclePartnerShare.updateMany({
    where: { ownerUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  try {
    await prisma.cycleProfile.updateMany({
      where: { userId: ownerUserId },
      data: { partnerShareCode: null, aiInsights: null, aiInsightsAt: null },
    });
  } catch {
    /* profile may not exist */
  }
}

export async function wipeCycleHealthData(prisma, userId) {
  await revokeCycleShares(prisma, userId);
  let carePlan = { count: 0 };
  try {
    carePlan = await prisma.pregnancyCarePlanItemState.deleteMany({ where: { userId } });
  } catch {
    carePlan = { count: 0 };
  }
  let postpartum = { count: 0 };
  let postpartumClassifications = { count: 0 };
  try {
    postpartumClassifications = await prisma.cyclePostpartumBleedClassification.deleteMany({ where: { userId } });
  } catch {
    postpartumClassifications = { count: 0 };
  }
  try {
    postpartum = await prisma.cyclePostpartumEpisode.deleteMany({ where: { userId } });
  } catch {
    postpartum = { count: 0 };
  }
  const [logs, tags, pregnancy, shares, snapshots, episodes, profile] = await prisma.$transaction([
    prisma.cycleLog.deleteMany({ where: { userId } }),
    prisma.cycleCustomTag.deleteMany({ where: { userId } }),
    prisma.pregnancyLog.deleteMany({ where: { userId } }),
    prisma.cyclePartnerShare.deleteMany({ where: { ownerUserId: userId } }),
    prisma.cyclePredictionSnapshot.deleteMany({ where: { userId } }),
    prisma.cyclePregnancyEpisode.deleteMany({ where: { userId } }),
    prisma.cycleProfile.deleteMany({ where: { userId } }),
  ]);
  return {
    logs: logs.count,
    tags: tags.count,
    pregnancyLogs: pregnancy.count,
    pregnancyEpisodes: episodes.count,
    pregnancyCarePlan: carePlan.count,
    postpartumEpisodes: postpartum.count,
    postpartumBleedClassifications: postpartumClassifications.count,
    shares: shares.count,
    predictionSnapshots: snapshots.count,
    profiles: profile.count,
  };
}

export function buildCycleExportPayload({
  profile = {},
  logs = [],
  customTags = [],
  inferred = {},
  contraception = null,
  pregnancyLogs = [],
  predictionSnapshots = [],
  pregnancyEpisodes = [],
  pregnancyCarePlan = [],
  postpartumEpisodes = [],
  postpartumBleedClassifications = [],
  postpartumReturn = null,
} = {}) {
  return {
    format: 'medicard.cycle.export.v1',
    exportedAt: new Date().toISOString(),
    timezone: 'Asia/Tbilisi',
    includesJournal: true,
    source: 'user_logged',
    horizonNote: 'logs_are_the_recent_server_window',
    profile: {
      mode: profile.mode ?? null,
      avgCycleLength: profile.avgCycleLength ?? null,
      avgPeriodLength: profile.avgPeriodLength ?? null,
      lastPeriodStart: profile.lastPeriodStart ?? null,
      isIrregular: Boolean(profile.isIrregular),
      conditions: Array.isArray(profile.conditions) ? profile.conditions : [],
      dueDate: profile.dueDate ?? null,
    },
    contraception: contraception
      ? {
          method: contraception.method ?? null,
          startedAt: contraception.startedAt ?? null,
          label: 'self_reported',
        }
      : {
          method: profile.contraceptionMethod ?? null,
          startedAt: profile.contraceptionStartedAt ?? null,
          label: 'self_reported',
        },
    periodStarts: inferred.periodStarts ?? [],
    periodRanges: inferred.periodRanges ?? [],
    customTags: (customTags || []).map((t) => ({
      id: t.id,
      name: t.name,
      archivedAt: t.archivedAt ?? null,
    })),
    logs: (logs || []).map((log) => ({
      date: log.date,
      flow: log.flow ?? null,
      symptoms: log.symptoms ?? [],
      moods: log.moods ?? [],
      sexualActivity: log.sexualActivity ?? null,
      libido: log.libido ?? null,
      bbt: log.bbt ?? null,
      cervicalMucus: log.cervicalMucus ?? null,
      ovulationTest: log.ovulationTest ?? null,
      pregnancyTest: log.pregnancyTest ?? null,
      notes: log.notes ?? null,
      painEntries: log.painEntries ?? [],
      sleepQuality: log.sleepQuality ?? null,
      stressLevel: log.stressLevel ?? null,
      exerciseLevel: log.exerciseLevel ?? null,
      caffeine: log.caffeine ?? null,
      alcohol: log.alcohol ?? null,
      customTagIds: log.customTagIds ?? [],
      observations: log.observations && typeof log.observations === 'object' ? log.observations : {},
      observationSchemaVersion: log.observationSchemaVersion ?? 1,
      observationAssessments:
        log.observationAssessments && typeof log.observationAssessments === 'object'
          ? log.observationAssessments
          : {},
      trackingContext: log.trackingContext ?? null,
      postpartumEpisodeId: log.postpartumEpisodeId ?? null,
    })),
    predictionSnapshots: (predictionSnapshots || []).map((row) => ({
      type: row.type,
      predictedDate: row.predictedDate,
      snapshotDate: row.snapshotDate,
      cycleAnchorDate: row.cycleAnchorDate,
      confidence: row.confidence,
      engineVersion: row.engineVersion,
    })),
    pregnancyEpisodes: (pregnancyEpisodes || []).map((row) => ({
      id: row.id ?? null,
      referenceDate: row.referenceDate ?? null,
      referenceType: row.referenceType ?? null,
      status: row.status ?? null,
      startedAt: row.startedAt ?? null,
      endedAt: row.endedAt ?? null,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    })),
    pregnancyLogs: (pregnancyLogs || []).map((p) => ({
      date: p.date,
      currentWeek: p.currentWeek ?? null,
      weightKg: p.weightKg ?? null,
      symptoms: p.symptoms ?? [],
      kickCount: p.kickCount ?? 0,
      notes: p.notes ?? null,
    })),
    pregnancyCarePlan: (pregnancyCarePlan || []).map((row) => ({
      careItemId: row.careItemId ?? null,
      status: row.status ?? null,
      plannedDate: row.plannedDate ?? null,
      plannedTime: row.plannedTime ?? null,
      plannedPlace: row.plannedPlace ?? null,
      completedDate: row.completedDate ?? null,
      note: row.note ?? null,
      reminderEnabled: Boolean(row.reminderEnabled),
      reminderOffset: row.reminderOffset ?? 1,
      reminderMode: row.reminderMode ?? 'DATE_BASED',
      exactReminderOffsetMinutes: row.exactReminderOffsetMinutes ?? null,
      catalogVersion: row.catalogVersion ?? null,
      pregnancyEpisodeId: row.pregnancyEpisodeId ?? null,
    })),
    postpartumEpisodes: (postpartumEpisodes || []).map((row) => ({
      id: row.id ?? null,
      referenceDate: row.referenceDate ?? null,
      status: row.status ?? null,
      startedAt: row.startedAt ?? null,
      endedAt: row.endedAt ?? null,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
    })),
    postpartumBleedClassifications: serializeBleedClassificationsForExport(postpartumBleedClassifications),
    postpartumReturn: postpartumReturn || null,
  };
}
