import { prisma } from '../prisma.js';
import { SCORING_FIELDS } from './constants.js';
import { loadLiveConfig, publicConfig, requireSchema, roundIngestOpen } from './config.js';
import { previewFinalize } from './finalize.js';
import { roundLifecycle } from './lifecycle.js';
import { listDistricts } from './membership.js';
import { rankDistricts } from './ranking.js';
import { loadRound } from './rounds.js';
import { tbilisiYmd } from './time.js';

export async function adminOverview(now = new Date()) {
  await requireSchema();
  const live = await loadLiveConfig();
  const ymd = tbilisiYmd(now);
  const round = await loadRound(prisma, ymd);
  const [enrolled, contributing, flagged, lastObs, days, districts, holds] = await Promise.all([
    prisma.tbilisiMovesMembership.count({ where: { status: 'ACTIVE' } }),
    round
      ? prisma.tbilisiMovesCredit.count({
          where: { date: ymd, excludedAt: null, eligibleSteps: { gt: 0 } },
        })
      : 0,
    prisma.tbilisiMovesCredit.count({
      where: { flaggedAt: { not: null }, excludedAt: null },
    }),
    prisma.tbilisiMovesObservation.findFirst({
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true, date: true, ignoreReason: true, applied: true },
    }),
    round ? prisma.tbilisiMovesDistrictDay.findMany({ where: { roundId: round.id } }) : [],
    prisma.tbilisiMovesDistrict.findMany(),
    prisma.tbilisiMovesIngestHold.findMany({ orderBy: { startedAt: 'desc' }, take: 5 }),
  ]);

  const byId = new Map(districts.map((row) => [row.id, row]));
  const ranked = rankDistricts(
    days.map((day) => ({
      id: day.districtId,
      districtId: day.districtId,
      slug: byId.get(day.districtId)?.slug,
      nameKa: byId.get(day.districtId)?.nameKa,
      sortOrder: byId.get(day.districtId)?.sortOrder ?? 0,
      target: day.target,
      eligibleStepsSum: day.eligibleStepsSum,
      contributorCount: day.contributorCount,
      enrolledCount: day.enrolledCount,
    })),
    {
      minParticipantsForRank: round?.rulesSnapshot?.minParticipantsForRank ?? live.minParticipantsForRank,
      competitionPaused: live.competitionPaused,
    },
  );

  const eligibleTotal = ranked.reduce((sum, row) => sum + (Number(row.eligibleStepsSum) || 0), 0);
  const ignored = await prisma.tbilisiMovesObservation.groupBy({
    by: ['ignoreReason'],
    where: { applied: false, receivedAt: { gte: new Date(now.getTime() - 7 * 86400000) } },
    _count: { _all: true },
  });

  return {
    date: ymd,
    schemaReady: true,
    pilotMode: true,
    config: publicConfig(live),
    round: round
      ? {
          date: round.date,
          status: round.status,
          provisional: round.status !== 'FINALIZED',
          ingestOpen: roundIngestOpen(round, now) && !live.ingestionPaused,
          openedAt: round.openedAt,
          graceEndsAt: round.graceEndsAt,
          lastObservationAt: round.lastObservationAt,
          lastAggregatedAt: round.lastAggregatedAt,
          rulesSnapshot: round.rulesSnapshot,
          liveScoring: {
            defaultDailyTarget: live.defaultDailyTarget,
            competitiveCap: live.competitiveCap,
            minParticipantsForRank: live.minParticipantsForRank,
            lateSyncGraceHours: live.lateSyncGraceHours,
            cooldownDays: live.cooldownDays,
          },
          scoringFrozen: true,
        }
      : {
          date: ymd,
          status: 'NOT_OPENED',
          provisional: true,
          ingestOpen: false,
          scoringFrozen: false,
          liveScoring: {
            defaultDailyTarget: live.defaultDailyTarget,
            competitiveCap: live.competitiveCap,
            minParticipantsForRank: live.minParticipantsForRank,
            lateSyncGraceHours: live.lateSyncGraceHours,
            cooldownDays: live.cooldownDays,
          },
        },
    kpis: {
      enrolledUsers: enrolled,
      contributingUsers: contributing,
      eligibleSteps: eligibleTotal,
      flaggedCredits: flagged,
      lastObservationAt: lastObs?.receivedAt ?? round?.lastObservationAt ?? null,
    },
    districts: ranked.map((row) => ({
      id: row.districtId,
      slug: row.slug,
      nameKa: row.nameKa,
      target: row.target,
      eligibleSteps: row.eligibleStepsSum,
      goalRatio: row.goalRatio,
      participantCount: row.contributorCount,
      rank: row.rank,
      unranked: row.unranked,
      goalReached: row.goalReached,
    })),
    syncIssues: {
      flaggedCredits: flagged,
      ignoredObservations7d: ignored
        .filter((row) => row.ignoreReason)
        .map((row) => ({ reason: row.ignoreReason, count: row._count._all })),
      openIngestHold: holds.find((row) => row.endedAt == null) || null,
      recentHolds: holds,
    },
    deferred: {
      contributionModeration: false,
      finalization: false,
      rewardManagement: false,
      map: true,
      scheduler: true,
    },
  };
}

export async function adminConfigView(now = new Date()) {
  await requireSchema();
  const live = await loadLiveConfig();
  const ymd = tbilisiYmd(now);
  const round = await loadRound(prisma, ymd);
  return {
    live: publicConfig(live),
    currentRound: round
      ? {
          date: round.date,
          status: round.status,
          scoringFrozen: true,
          rulesSnapshot: round.rulesSnapshot,
          districtTargetsSnapshot: round.districtTargetsSnapshot,
          ingestOpen: roundIngestOpen(round, now) && !live.ingestionPaused,
        }
      : {
          date: ymd,
          status: 'NOT_OPENED',
          scoringFrozen: false,
          note: 'Scoring edits still apply to today until the round opens (first board read or observation).',
        },
    effective: {
      operationalImmediate: [
        'featureEnabled',
        'enrollmentOpen',
        'ingestionPaused',
        'competitionPaused',
        'sanityMaxRawSteps',
        'correctionDropFlagPct',
      ],
      scoringNextUnopenedRound: [...SCORING_FIELDS],
      existingLockUntilDatesUnchanged: true,
      pilotModeLocked: true,
    },
  };
}

export async function adminRounds({ limit = 30, before } = {}, now = new Date()) {
  await requireSchema();
  const take = Math.min(50, Math.max(1, Number(limit) || 30));
  const where = {};
  if (before) where.date = { lt: before };
  const rows = await prisma.tbilisiMovesRound.findMany({
    where,
    orderBy: { date: 'desc' },
    take: take + 1,
  });
  const page = rows.slice(0, take);
  return {
    items: page.map((row) => {
      const life = roundLifecycle(row, now);
      return {
        date: row.date,
        status: row.status,
        lifecycle: life.phase,
        resultRevision: row.resultRevision || 0,
        graceEndsAt: row.graceEndsAt,
        finalizedAt: row.finalizedAt,
        lastObservationAt: row.lastObservationAt,
        canFinalize: life.canFinalize,
        blocker: life.blocker,
      };
    }),
    nextCursor: rows.length > take ? page[page.length - 1].date : null,
  };
}

export async function adminRoundDetail(date, now = new Date()) {
  await requireSchema();
  const round = await loadRound(prisma, date);
  if (!round) {
    return {
      date,
      status: 'NOT_OPENED',
      lifecycle: roundLifecycle(null, now),
      note: 'რაუნდი არ გაიხსნება დღევანდელი პარამეტრებით. ისტორიული დღე არ რეკონსტრუირდება.',
    };
  }
  let preview = null;
  try {
    preview = await previewFinalize({ date: round.date, now });
  } catch {
    preview = null;
  }
  let published = null;
  try {
    if (round.latestResultId) {
      published = await prisma.tbilisiMovesResultRevision.findUnique({ where: { id: round.latestResultId } });
    }
  } catch {
    published = null;
  }
  return {
    date: round.date,
    status: round.status,
    resultRevision: round.resultRevision || 0,
    lifecycle: roundLifecycle(round, now),
    openedAt: round.openedAt,
    graceEndsAt: round.graceEndsAt,
    finalizedAt: round.finalizedAt,
    lastObservationAt: round.lastObservationAt,
    rulesSnapshot: round.rulesSnapshot,
    districtTargetsSnapshot: round.districtTargetsSnapshot,
    published: published
      ? {
          revision: published.revision,
          kind: published.kind,
          previewHash: published.previewHash,
          awardCount: published.awardCount,
          eligibleCreditCount: published.eligibleCreditCount,
          publishedAt: published.publishedAt,
          reason: published.reason,
          districts: published.districtResults,
        }
      : null,
    preview,
  };
}

export async function adminDistrictsView() {
  const { config, districts } = await listDistricts();
  return { config: publicConfig(config), districts };
}
