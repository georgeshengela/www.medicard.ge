import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';
import { MEMBERSHIP_STATUS } from './constants.js';
import { loadLiveConfig, roundIngestOpen, scoringSnapshot } from './config.js';
import { tbilisiMovesError } from './errors.js';
import { addDaysYmd, graceEndsAtFor, tbilisiMidnight, tbilisiYmd } from './time.js';

export async function lockRoundTx(tx, ymd) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tbilisi-moves:round:${ymd}`}))`;
}

export async function loadRound(db, ymd) {
  return db.tbilisiMovesRound.findUnique({ where: { date: ymd } });
}

export async function ensureRoundInTx(tx, ymd, now = new Date()) {
  await lockRoundTx(tx, ymd);
  const again = await tx.tbilisiMovesRound.findUnique({ where: { date: ymd } });
  if (again) return again;

  const config = await loadLiveConfig(tx);
  const districts = await tx.tbilisiMovesDistrict.findMany();
  const snap = scoringSnapshot(config, districts, now);
  const openedAt = tbilisiMidnight(ymd);
  const graceEndsAt = graceEndsAtFor(ymd, snap.rules.lateSyncGraceHours);
  const round = await tx.tbilisiMovesRound.create({
    data: {
      id: randomUUID(),
      date: ymd,
      status: 'PROVISIONAL',
      rulesSnapshot: snap.rules,
      districtTargetsSnapshot: snap.districtTargets,
      openedAt,
      graceEndsAt,
    },
  });

  const enrolledCounts = await tx.tbilisiMovesMembershipPeriod.groupBy({
    by: ['districtId'],
    where: {
      startDate: { lte: ymd },
      OR: [{ endDate: null }, { endDate: { gt: ymd } }],
    },
    _count: { userId: true },
  });
  const enrolledByDistrict = new Map(enrolledCounts.map((row) => [row.districtId, row._count.userId]));

  if (districts.length) {
    await tx.tbilisiMovesDistrictDay.createMany({
      data: districts.map((district) => ({
        id: randomUUID(),
        roundId: round.id,
        districtId: district.id,
        target: snap.districtTargets[district.id] ?? config.defaultDailyTarget,
        eligibleStepsSum: 0,
        contributorCount: 0,
        enrolledCount: enrolledByDistrict.get(district.id) || 0,
      })),
    });
  }
  return round;
}

export async function ensureRound(ymd, now = new Date(), db = prisma) {
  const existing = await loadRound(db, ymd);
  if (existing) return existing;
  if (db !== prisma) return ensureRoundInTx(db, ymd, now);
  try {
    return await prisma.$transaction((tx) => ensureRoundInTx(tx, ymd, now));
  } catch (error) {
    if (error?.code === 'P2002') {
      const raced = await loadRound(prisma, ymd);
      if (raced) return raced;
    }
    throw error;
  }
}

export async function refreshDistrictDay(tx, round, districtId, ymd) {
  const sum = await tx.tbilisiMovesCredit.aggregate({
    where: { roundId: round.id, districtId, excludedAt: null },
    _sum: { eligibleSteps: true },
  });
  const contributors = await tx.tbilisiMovesCredit.count({
    where: {
      roundId: round.id,
      districtId,
      excludedAt: null,
      eligibleSteps: { gt: 0 },
    },
  });
  const enrolledCount = await tx.tbilisiMovesMembershipPeriod.count({
    where: {
      districtId,
      startDate: { lte: ymd },
      OR: [{ endDate: null }, { endDate: { gt: ymd } }],
    },
  });
  const targetMap = round.districtTargetsSnapshot || {};
  const target = targetMap[districtId] ?? 0;
  await tx.tbilisiMovesDistrictDay.upsert({
    where: { roundId_districtId: { roundId: round.id, districtId } },
    create: {
      id: randomUUID(),
      roundId: round.id,
      districtId,
      target,
      eligibleStepsSum: sum._sum.eligibleSteps || 0,
      contributorCount: contributors,
      enrolledCount,
    },
    update: {
      eligibleStepsSum: sum._sum.eligibleSteps || 0,
      contributorCount: contributors,
      enrolledCount,
    },
  });
  await tx.tbilisiMovesRound.update({
    where: { id: round.id },
    data: { lastAggregatedAt: new Date() },
  });
}

export function assertRoundAcceptsIngest(round, now = new Date()) {
  if (!round) throw tbilisiMovesError(409, 'ROUND_NOT_OPEN', 'რაუნდი არ არის გახსნილი.');
  if (round.status === 'FINALIZED') {
    throw tbilisiMovesError(409, 'ROUND_FINALIZED', 'რაუნდი დახურულია.');
  }
  if (!roundIngestOpen(round, now)) {
    throw tbilisiMovesError(409, 'ROUND_CLOSED', 'ამ დღის ინგესტიის ფანჯარა ამოიწურა.');
  }
}

export function assertDateIngestible(ymd, now, liveGraceHours, existingRound) {
  const today = tbilisiYmd(now);
  const yesterday = addDaysYmd(today, -1);
  if (ymd !== today && ymd !== yesterday) {
    throw tbilisiMovesError(400, 'DATE_OUT_OF_WINDOW', 'ეს თბილისის დღე ინგესტიის ფანჯარაში აღარაა.');
  }
  if (ymd === yesterday) {
    const graceEnd = existingRound
      ? new Date(existingRound.graceEndsAt)
      : graceEndsAtFor(yesterday, liveGraceHours);
    if (now.getTime() >= graceEnd.getTime()) {
      throw tbilisiMovesError(400, 'DATE_OUT_OF_WINDOW', 'გუშინდელი ინგესტიის ფანჯარა ამოიწურა.');
    }
  }
}

export async function getActiveEnrollmentCount() {
  return prisma.tbilisiMovesMembership.count({ where: { status: MEMBERSHIP_STATUS.ACTIVE } });
}
