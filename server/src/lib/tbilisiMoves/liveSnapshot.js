import { prisma } from '../prisma.js';
import { isTbilisiMovesSchemaMissing } from './errors.js';
import { loadRound } from './rounds.js';
import { tbilisiClock, tbilisiYmd } from './time.js';

export const TBILISI_MOVES_LIVE_EVENT = 'tbilisi-moves:live';

function emptySnap(now) {
  const clock = tbilisiClock(now);
  return {
    schemaReady: false,
    refreshedAt: now.toISOString(),
    date: clock.date,
    timezone: clock.timezone,
    serverNow: clock.serverNow,
    nextMidnight: clock.nextMidnight,
    pilotMode: true,
    kpis: {
      enrolledUsers: 0,
      contributingUsers: 0,
      eligibleSteps: 0,
      flaggedCredits: 0,
      lastObservationAt: null,
      cityTarget: 0,
      goalPercent: 0,
    },
  };
}

export async function getTbilisiMovesLiveSnapshot(now = new Date()) {
  try {
    const { loadLiveConfig, publicConfig, roundIngestOpen } = await import('./config.js');
    const live = await loadLiveConfig();
    const cfg = publicConfig(live);
    const ymd = tbilisiYmd(now);
    const clock = tbilisiClock(now);
    const round = await loadRound(prisma, ymd);
    const [enrolled, contributing, flagged, lastObs, eligibleAgg, districts] = await Promise.all([
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
        select: { receivedAt: true },
      }),
      round
        ? prisma.tbilisiMovesDistrictDay.aggregate({
            where: { roundId: round.id },
            _sum: { eligibleStepsSum: true },
          })
        : { _sum: { eligibleStepsSum: 0 } },
      prisma.tbilisiMovesDistrict.findMany({
        where: { status: 'ACTIVE' },
        select: { dailyTargetOverride: true },
      }),
    ]);

    const eligibleSteps = Number(eligibleAgg._sum.eligibleStepsSum || 0);
    const cityTarget = districts.reduce(
      (sum, row) => sum + (row.dailyTargetOverride ?? live.defaultDailyTarget),
      0,
    );
    const goalPercent =
      cityTarget > 0 ? Math.max(0, Math.min(100, Math.round((eligibleSteps / cityTarget) * 100))) : 0;

    return {
      schemaReady: true,
      refreshedAt: now.toISOString(),
      date: ymd,
      timezone: clock.timezone,
      serverNow: clock.serverNow,
      nextMidnight: clock.nextMidnight,
      revision: cfg.revision,
      featureEnabled: cfg.featureEnabled,
      enrollmentOpen: cfg.enrollmentOpen,
      ingestionEnabled: cfg.ingestionEnabled,
      ingestionPaused: cfg.ingestionPaused,
      competitionPaused: cfg.competitionPaused,
      rewardsEnabled: cfg.rewardsEnabled,
      leaderRecognitionEnabled: cfg.leaderRecognitionEnabled,
      leaderRewardedRanks: cfg.leaderRewardedRanks,
      districtGoalBadgeEnabled: cfg.districtGoalBadgeEnabled,
      defaultDailyTarget: cfg.defaultDailyTarget,
      competitiveCap: cfg.competitiveCap,
      cooldownDays: cfg.cooldownDays,
      minParticipantsForRank: cfg.minParticipantsForRank,
      lateSyncGraceHours: cfg.lateSyncGraceHours,
      sanityMaxRawSteps: cfg.sanityMaxRawSteps,
      correctionDropFlagPct: cfg.correctionDropFlagPct,
      pilotMode: true,
      round: round
        ? {
            date: round.date,
            status: round.status,
            scoringFrozen: true,
            ingestOpen: roundIngestOpen(round, now) && !live.ingestionPaused,
            lastObservationAt: round.lastObservationAt,
            graceEndsAt: round.graceEndsAt,
          }
        : {
            date: ymd,
            status: 'NOT_OPENED',
            scoringFrozen: false,
            ingestOpen: false,
            lastObservationAt: null,
            graceEndsAt: null,
          },
      kpis: {
        enrolledUsers: enrolled,
        contributingUsers: contributing,
        eligibleSteps,
        flaggedCredits: flagged,
        lastObservationAt: lastObs?.receivedAt ?? round?.lastObservationAt ?? null,
        cityTarget,
        goalPercent,
      },
    };
  } catch (error) {
    if (isTbilisiMovesSchemaMissing(error)) return emptySnap(now);
    throw error;
  }
}

export function notifyTbilisiMovesLive(userId) {
  void import('../adminRealtime.js')
    .then((mod) => {
      if (typeof mod.emitTbilisiMovesLive === 'function') mod.emitTbilisiMovesLive();
      if (userId && typeof mod.emitTbilisiMovesUser === 'function') mod.emitTbilisiMovesUser(userId);
    })
    .catch(() => undefined);
}
