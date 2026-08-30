/**
 * Cycle data lifecycle — export and wipe.
 * Does not change prediction math.
 */

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
  const [logs, tags, pregnancy, shares, profile] = await prisma.$transaction([
    prisma.cycleLog.deleteMany({ where: { userId } }),
    prisma.cycleCustomTag.deleteMany({ where: { userId } }),
    prisma.pregnancyLog.deleteMany({ where: { userId } }),
    prisma.cyclePartnerShare.deleteMany({ where: { ownerUserId: userId } }),
    prisma.cycleProfile.deleteMany({ where: { userId } }),
  ]);
  return {
    logs: logs.count,
    tags: tags.count,
    pregnancyLogs: pregnancy.count,
    shares: shares.count,
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
    })),
    pregnancyLogs: (pregnancyLogs || []).map((p) => ({
      date: p.date,
      currentWeek: p.currentWeek ?? null,
      weightKg: p.weightKg ?? null,
      symptoms: p.symptoms ?? [],
      kickCount: p.kickCount ?? 0,
      notes: p.notes ?? null,
    })),
  };
}
