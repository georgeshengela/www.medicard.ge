import { prisma } from '../prisma.js';
import { writeAdminAudit } from '../adminAudit.js';
import { requireSchema } from './config.js';
import { tbilisiMovesError } from './errors.js';
import { roundLifecycle } from './lifecycle.js';
import { lockRoundTx, loadRound, refreshDistrictDay } from './rounds.js';

const REASON_MIN = 3;
const REASON_MAX = 400;

function requireReason(reason) {
  const trimmed = String(reason || '').trim();
  if (trimmed.length < REASON_MIN || trimmed.length > REASON_MAX) {
    throw tbilisiMovesError(400, 'REASON_REQUIRED', 'მიზეზი სავალდებულოა (3–400 სიმბოლო).');
  }
  return trimmed;
}

function publicCredit(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    date: row.date,
    districtId: row.districtId,
    publicHandle: row.publicHandleSnapshot,
    publicAvatarId: row.publicAvatarIdSnapshot,
    rawObservedSteps: row.rawObservedSteps,
    eligibleSteps: row.eligibleSteps,
    capSnapshot: row.capSnapshot,
    provider: row.authoritativeProvider,
    sourceInstallationId: row.sourceInstallationId,
    lastRecordedAt: row.lastRecordedAt,
    acceptedAt: row.acceptedAt,
    flagged: Boolean(row.flaggedAt),
    flagReason: row.flagReason,
    excluded: Boolean(row.excludedAt),
    excludedAt: row.excludedAt,
    excludedReason: row.excludedReason,
    correctionCount: row.correctionCount,
    evidenceNote: 'წყაროს ეტიკეტი დამოწმებული მტკიცებულება არ არის.',
  };
}

export async function listCredits({
  date,
  districtId,
  excluded,
  flagged,
  limit = 50,
  offset = 0,
} = {}) {
  await requireSchema();
  const take = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = Math.max(0, Number(offset) || 0);
  const where = {};
  if (date) where.date = date;
  if (districtId) where.districtId = districtId;
  if (excluded === true) where.excludedAt = { not: null };
  if (excluded === false) where.excludedAt = null;
  if (flagged === true) where.flaggedAt = { not: null };
  if (flagged === false) where.flaggedAt = null;

  const [total, rows] = await Promise.all([
    prisma.tbilisiMovesCredit.count({ where }),
    prisma.tbilisiMovesCredit.findMany({
      where,
      orderBy: [{ date: 'desc' }, { eligibleSteps: 'desc' }, { id: 'asc' }],
      take,
      skip,
      include: { district: { select: { nameKa: true, slug: true } } },
    }),
  ]);

  return {
    total,
    limit: take,
    offset: skip,
    evidenceNote: 'წყაროს ეტიკეტი დამოწმებული მტკიცებულება არ არის.',
    credits: rows.map((row) => ({
      ...publicCredit(row),
      districtNameKa: row.district?.nameKa,
      districtSlug: row.district?.slug,
    })),
  };
}

export async function listObservations({ creditId, date, userId, limit = 50, offset = 0 } = {}) {
  await requireSchema();
  const take = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = Math.max(0, Number(offset) || 0);
  const where = {};
  if (date) where.date = date;
  if (userId) where.userId = userId;
  if (creditId) {
    const credit = await prisma.tbilisiMovesCredit.findUnique({ where: { id: creditId } });
    if (!credit) throw tbilisiMovesError(404, 'CREDIT_NOT_FOUND', 'კრედიტი ვერ მოიძებნა.');
    where.userId = credit.userId;
    where.date = credit.date;
  }
  const [total, rows] = await Promise.all([
    prisma.tbilisiMovesObservation.count({ where }),
    prisma.tbilisiMovesObservation.findMany({
      where,
      orderBy: [{ receivedAt: 'desc' }],
      take,
      skip,
    }),
  ]);
  return {
    total,
    limit: take,
    offset: skip,
    evidenceNote: 'წყაროს ეტიკეტი დამოწმებული მტკიცებულება არ არის.',
    observations: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      date: row.date,
      provider: row.provider,
      sourceInstallationId: row.sourceInstallationId,
      intervalStart: row.intervalStart,
      intervalEnd: row.intervalEnd,
      cumulativeSteps: row.cumulativeSteps,
      recordedAt: row.recordedAt,
      clientSequence: row.clientSequence,
      receivedAt: row.receivedAt,
      applied: row.applied,
      ignoreReason: row.ignoreReason,
    })),
  };
}

export async function setCreditExclusion({ admin, creditId, excluded, reason, now = new Date() }) {
  await requireSchema();
  const trimmed = requireReason(reason);

  const result = await prisma.$transaction(async (tx) => {
    const credit = await tx.tbilisiMovesCredit.findUnique({ where: { id: creditId } });
    if (!credit) throw tbilisiMovesError(404, 'CREDIT_NOT_FOUND', 'კრედიტი ვერ მოიძებნა.');
    await lockRoundTx(tx, credit.date);
    const round = await loadRound(tx, credit.date);
    const already = Boolean(credit.excludedAt);
    if (excluded === already) {
      return { credit, round, unchanged: true };
    }

    const updated = await tx.tbilisiMovesCredit.update({
      where: { id: credit.id },
      data: excluded
        ? { excludedAt: now, excludedReason: trimmed }
        : { excludedAt: null, excludedReason: null },
    });
    if (round) {
      await refreshDistrictDay(tx, round, updated.districtId, credit.date);
    }
    return { credit: updated, previous: credit, round, unchanged: false };
  });

  const publishedRevision = result.round?.status === 'FINALIZED' ? result.round.resultRevision || 0 : null;
  await writeAdminAudit({
    admin,
    action: excluded ? 'tbilisi_moves.credit.exclude' : 'tbilisi_moves.credit.reinstate',
    targetType: 'tbilisi_moves_credit',
    targetId: creditId,
    previousValue: {
      excluded: Boolean(result.previous?.excludedAt ?? result.credit.excludedAt),
      excludedReason: result.previous?.excludedReason ?? null,
      eligibleSteps: result.previous?.eligibleSteps ?? result.credit.eligibleSteps,
      resultRevision: publishedRevision,
    },
    newValue: {
      excluded,
      reason: trimmed,
      eligibleSteps: result.credit.eligibleSteps,
      resultRevision: publishedRevision,
      publishedUnchanged: result.round?.status === 'FINALIZED',
    },
  });

  return {
    credit: publicCredit(result.credit),
    unchanged: result.unchanged,
    round: result.round
      ? {
          date: result.round.date,
          status: result.round.status,
          resultRevision: result.round.resultRevision || 0,
          lifecycle: roundLifecycle(result.round, now).phase,
          publishedUnchanged: result.round.status === 'FINALIZED',
        }
      : null,
  };
}

export async function listIssuedAwards({ date, status, limit = 50, offset = 0 } = {}) {
  await requireSchema();
  const take = Math.min(100, Math.max(1, Number(limit) || 50));
  const skip = Math.max(0, Number(offset) || 0);
  const where = {};
  if (date) where.date = date;
  if (status) where.status = status;
  try {
    const [total, rows] = await Promise.all([
      prisma.tbilisiMovesAward.count({ where }),
      prisma.tbilisiMovesAward.findMany({
        where,
        orderBy: [{ date: 'desc' }, { awardKey: 'asc' }, { rank: 'asc' }],
        take,
        skip,
        include: { district: { select: { nameKa: true, slug: true } } },
      }),
    ]);
    return {
      total,
      limit: take,
      offset: skip,
      awards: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        date: row.date,
        districtId: row.districtId,
        districtNameKa: row.district?.nameKa,
        awardKey: row.awardKey,
        rank: row.rank,
        status: row.status,
        titleKa: row.titleKa,
        reasonKa: row.reasonKa,
        publicHandle: row.publicHandleSnapshot,
        resultRevision: row.resultRevision,
        entitledAt: row.entitledAt,
        revokedAt: row.revokedAt,
        revokedReason: row.revokedReason,
      })),
    };
  } catch (error) {
    if (error?.code === 'P2021') {
      return { total: 0, limit: take, offset: skip, awards: [], schemaReady: false };
    }
    throw error;
  }
}
