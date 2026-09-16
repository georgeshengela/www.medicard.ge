import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';
import { writeAdminAudit } from '../adminAudit.js';
import {
  awardCounts,
  computeRoundResults,
  planAwards,
  previewFingerprint,
  publicDistrictResults,
  rewardPolicyFromSnapshot,
  shouldIssueAwards,
  snapshotPeople,
} from './compute.js';
import { loadLiveConfig, publicConfig, requireSchema } from './config.js';
import { isTbilisiMovesSchemaMissing, schemaUnavailable, tbilisiMovesError } from './errors.js';
import { assertCanFinalize, roundLifecycle } from './lifecycle.js';
import { lockRoundTx, loadRound } from './rounds.js';
import { assertYmd } from './time.js';
import { finalizeSchedulerConfigured } from './schedulerPolicy.js';

const FINALIZE_RUNNER_LOCK = 0x74626c31; // tbl1

function lockFlag(rows) {
  const row = Array.isArray(rows) ? rows[0] : rows;
  const value = row?.locked ?? row?.pg_try_advisory_lock;
  return value === true || value === 't' || value === 1n || value === 1;
}

export async function withFinalizeRunnerLock(fn, db = prisma) {
  let held = false;
  try {
    const rows = await db.$queryRaw`SELECT pg_try_advisory_lock(${FINALIZE_RUNNER_LOCK}) AS locked`;
    held = lockFlag(rows);
    if (!held) {
      return {
        skipped: true,
        reason: 'concurrent_run',
        scanned: 0,
        processed: [],
        failed: [],
        dryRun: false,
        automaticExecutionConfigured: finalizeSchedulerConfigured(),
      };
    }
    return await fn();
  } catch (error) {
    if (/advisory/i.test(error?.message || '') || error?.code === '26000') {
      return fn();
    }
    throw error;
  } finally {
    if (held) {
      try {
        await db.$queryRaw`SELECT pg_advisory_unlock(${FINALIZE_RUNNER_LOCK})`;
      } catch {
        /* connection already gone */
      }
    }
  }
}

export async function requireResultsSchema(db = prisma) {
  await requireSchema(db);
  try {
    await db.tbilisiMovesResultRevision.findFirst({ take: 1, select: { id: true } });
    await db.tbilisiMovesAward.findFirst({ take: 1, select: { id: true } });
  } catch (error) {
    if (isTbilisiMovesSchemaMissing(error)) throw schemaUnavailable();
    throw error;
  }
}

async function loadRoundCredits(tx, roundId) {
  return tx.tbilisiMovesCredit.findMany({
    where: { roundId },
    select: {
      id: true,
      userId: true,
      districtId: true,
      eligibleSteps: true,
      publicHandleSnapshot: true,
      publicAvatarIdSnapshot: true,
      excludedAt: true,
      excludedReason: true,
    },
  });
}

function publicPlan(plan) {
  return plan.map((row) => ({
    awardKey: row.awardKey,
    districtId: row.districtId,
    rank: row.rank,
    titleKa: row.titleKa,
    reasonKa: row.reasonKa,
    publicHandle: row.publicHandleSnapshot,
  }));
}

export function buildComputedPreview({ round, credits, districts, live, now }) {
  const lifecycle = roundLifecycle(round, now);
  const rules = round.rulesSnapshot || {};
  const targets = round.districtTargetsSnapshot || {};
  const policy = rewardPolicyFromSnapshot(rules);
  const competitionPausedNow = Boolean(live.competitionPaused);
  const competitionPausedAtOpen = Boolean(rules.competitionPausedAtOpen);
  const rankingPaused = competitionPausedNow;
  const computed = computeRoundResults({
    credits,
    districts,
    targets,
    rules,
    competitionPaused: rankingPaused,
  });
  const issuance = shouldIssueAwards({
    policy,
    competitionPausedNow,
    competitionPausedAtOpen,
  });
  const awards = planAwards({
    date: round.date,
    rankedDistricts: computed.districts,
    peopleByDistrict: computed.peopleByDistrict,
    policy,
    issue: issuance.issue,
  });
  const districtResults = publicDistrictResults(computed.districts);
  const peopleResults = snapshotPeople(computed.peopleByDistrict);
  const previewHash = previewFingerprint({
    date: round.date,
    credits,
    targets,
    rules,
    policy,
    competitionPausedAtFinalize: competitionPausedNow || competitionPausedAtOpen,
  });
  return {
    lifecycle,
    policy,
    issuance,
    computed,
    awards,
    districtResults,
    peopleResults,
    previewHash,
    awardCounts: awardCounts(awards),
    eligibleCreditCount: computed.eligibleCreditCount,
    empty: computed.eligibleCreditCount === 0,
  };
}

async function loadDistricts(tx) {
  return tx.tbilisiMovesDistrict.findMany({
    orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
  });
}

export async function previewFinalize({ date, now = new Date() }) {
  await requireResultsSchema();
  const ymd = assertYmd(date);
  const live = await loadLiveConfig();
  const round = await loadRound(prisma, ymd);
  if (!round) throw tbilisiMovesError(404, 'ROUND_NOT_FOUND', 'ამ დღის რაუნდი არ არის გახსნილი.');
  const [credits, districts] = await Promise.all([
    loadRoundCredits(prisma, round.id),
    loadDistricts(prisma),
  ]);
  const built = buildComputedPreview({ round, credits, districts, live, now });
  return serializePreview({ round, live, built, now });
}

function serializePreview({ round, live, built, now }) {
  return {
    date: round.date,
    round: {
      date: round.date,
      status: round.status,
      resultRevision: round.resultRevision || 0,
      graceEndsAt: round.graceEndsAt,
      openedAt: round.openedAt,
      finalizedAt: round.finalizedAt,
    },
    live: publicConfig(live),
    lifecycle: built.lifecycle,
    canFinalize: built.lifecycle.canFinalize,
    blocker: built.lifecycle.blocker,
    previewHash: built.previewHash,
    expectedRevision: (round.resultRevision || 0) + 1,
    empty: built.empty,
    eligibleCreditCount: built.eligibleCreditCount,
    awardCounts: built.awardCounts,
    awardPolicy: {
      ...built.policy,
      issuance: built.issuance,
    },
    districts: built.districtResults,
    awardPlan: publicPlan(built.awards),
    computedAt: now.toISOString(),
  };
}

async function reconcileAwards(tx, { round, date, awards, revision, now, revokeReason }) {
  const existing = await tx.tbilisiMovesAward.findMany({ where: { date } });
  const nextKeys = new Set(awards.map((row) => `${row.userId}:${row.awardKey}:${row.districtId}`));

  for (const row of existing) {
    const key = `${row.userId}:${row.awardKey}:${row.districtId}`;
    if (!nextKeys.has(key) && row.status === 'ACTIVE') {
      await tx.tbilisiMovesAward.update({
        where: { id: row.id },
        data: {
          status: 'REVOKED',
          revokedAt: now,
          revokedReason: revokeReason || 'correction',
          resultRevision: revision,
        },
      });
    }
  }

  for (const award of awards) {
    const current = existing.find(
      (row) =>
        row.userId === award.userId &&
        row.awardKey === award.awardKey &&
        row.districtId === award.districtId,
    );
    const data = {
      roundId: round.id,
      rank: award.rank,
      resultRevision: revision,
      status: 'ACTIVE',
      titleKa: award.titleKa,
      reasonKa: award.reasonKa,
      publicHandleSnapshot: award.publicHandleSnapshot,
      publicAvatarIdSnapshot: award.publicAvatarIdSnapshot,
      entitledAt: current?.entitledAt || now,
      revokedAt: null,
      revokedReason: null,
    };
    if (!current) {
      await tx.tbilisiMovesAward.create({
        data: {
          id: randomUUID(),
          userId: award.userId,
          date,
          districtId: award.districtId,
          awardKey: award.awardKey,
          ...data,
        },
      });
    } else {
      await tx.tbilisiMovesAward.update({
        where: { id: current.id },
        data,
      });
    }
  }
}

function publishedPayload(round, revisionRow, built) {
  return {
    date: round.date,
    status: 'FINALIZED',
    resultRevision: revisionRow.revision,
    kind: revisionRow.kind,
    previewHash: revisionRow.previewHash,
    corrected: revisionRow.revision > 1 || revisionRow.kind === 'CORRECTION',
    publishedAt: revisionRow.publishedAt,
    eligibleCreditCount: revisionRow.eligibleCreditCount,
    awardCount: revisionRow.awardCount,
    awardCounts: built?.awardCounts || awardCounts(revisionRow.awardPlan || []),
    districts: revisionRow.districtResults,
    reason: revisionRow.reason || null,
    idempotent: false,
  };
}

export async function finalizeRound({
  date,
  now = new Date(),
  kind = 'INITIAL',
  previewHash,
  expectedRevision,
  fromRevision,
  reason,
  admin = null,
  actor = 'admin',
} = {}) {
  await requireResultsSchema();
  const ymd = assertYmd(date);
  const live = await loadLiveConfig();

  const result = await prisma.$transaction(async (tx) => {
    await lockRoundTx(tx, ymd);
    const round = await loadRound(tx, ymd);
    if (!round) throw tbilisiMovesError(404, 'ROUND_NOT_FOUND', 'ამ დღის რაუნდი არ არის გახსნილი.');

    const [credits, districts] = await Promise.all([loadRoundCredits(tx, round.id), loadDistricts(tx)]);
    const built = buildComputedPreview({ round, credits, districts, live, now });

    if (kind === 'INITIAL') {
      if (round.status === 'FINALIZED') {
        const latest = round.latestResultId
          ? await tx.tbilisiMovesResultRevision.findUnique({ where: { id: round.latestResultId } })
          : await tx.tbilisiMovesResultRevision.findFirst({
              where: { roundId: round.id },
              orderBy: { revision: 'desc' },
            });
        if (latest && latest.previewHash === built.previewHash) {
          return {
            idempotent: true,
            round,
            revisionRow: latest,
            built,
          };
        }
        throw tbilisiMovesError(
          409,
          'ROUND_FINALIZED',
          'რაუნდი უკვე დაფიქსირებულია. ცვლილებისთვის გამოიყენეთ კორექცია.',
        );
      }
      assertCanFinalize(built.lifecycle);
      if (expectedRevision != null && expectedRevision !== (round.resultRevision || 0)) {
        throw tbilisiMovesError(409, 'RESULT_STALE', 'რაუნდის რევიზია შეიცვალა. განაახლეთ გადახედვა.');
      }
    } else {
      if (round.status !== 'FINALIZED') {
        throw tbilisiMovesError(409, 'NOT_FINALIZED', 'კორექცია მხოლოდ დაფიქსირებულ რაუნდზეა.');
      }
      const currentRev = round.resultRevision || 0;
      if (fromRevision != null && fromRevision !== currentRev) {
        throw tbilisiMovesError(409, 'RESULT_STALE', 'შედეგის რევიზია შეიცვალა. განაახლეთ გადახედვა.');
      }
      const trimmed = String(reason || '').trim();
      if (trimmed.length < 3) {
        throw tbilisiMovesError(400, 'REASON_REQUIRED', 'კორექციას სავალდებულო მიზეზი სჭირდება.');
      }
    }

    if (previewHash && previewHash !== built.previewHash) {
      throw tbilisiMovesError(
        409,
        'PREVIEW_STALE',
        'გადახედვა აღარ ემთხვევა მიმდინარე კრედიტებს. თავიდან გადახედეთ.',
      );
    }

    const nextRevision = (round.resultRevision || 0) + 1;
    const existingRev = await tx.tbilisiMovesResultRevision.findUnique({
      where: { roundId_revision: { roundId: round.id, revision: nextRevision } },
    });
    if (existingRev && existingRev.previewHash !== built.previewHash) {
      throw tbilisiMovesError(409, 'REVISION_CONFLICT', 'იგივე რევიზია სხვა შედეგით უკვე არსებობს.');
    }

    await reconcileAwards(tx, {
      round,
      date: ymd,
      awards: built.awards,
      revision: nextRevision,
      now,
      revokeReason: kind === 'CORRECTION' ? String(reason || 'correction') : 'superseded',
    });

    const revisionRow =
      existingRev ||
      (await tx.tbilisiMovesResultRevision.create({
        data: {
          id: randomUUID(),
          roundId: round.id,
          date: ymd,
          revision: nextRevision,
          kind,
          previewHash: built.previewHash,
          rulesSnapshot: {
            ...(round.rulesSnapshot || {}),
            awardPolicy: built.policy,
            issuance: built.issuance,
          },
          districtResults: built.districtResults,
          peopleResults: built.peopleResults,
          awardPlan: publicPlan(built.awards),
          eligibleCreditCount: built.eligibleCreditCount,
          awardCount: built.awards.length,
          reason: kind === 'CORRECTION' ? String(reason).trim().slice(0, 400) : null,
          createdByAdminId: admin?.id || null,
          publishedAt: now,
        },
      }));

    const updated = await tx.tbilisiMovesRound.update({
      where: { id: round.id },
      data: {
        status: 'FINALIZED',
        resultRevision: nextRevision,
        latestResultId: revisionRow.id,
        finalizedAt: round.finalizedAt || now,
      },
    });

    return { idempotent: Boolean(existingRev), round: updated, revisionRow, built };
  });

  if (admin) {
    await writeAdminAudit({
      admin,
      action: kind === 'CORRECTION' ? 'tbilisi_moves.round.correct' : 'tbilisi_moves.round.finalize',
      targetType: 'tbilisi_moves_round',
      targetId: ymd,
      previousValue: {
        status: kind === 'CORRECTION' ? 'FINALIZED' : 'PROVISIONAL',
        resultRevision: (result.round.resultRevision || 1) - 1,
      },
      newValue: {
        status: 'FINALIZED',
        resultRevision: result.revisionRow.revision,
        previewHash: result.revisionRow.previewHash,
        awardCount: result.revisionRow.awardCount,
        kind,
        actor,
        reason: reason || null,
      },
    });
  }

  return {
    ...publishedPayload(result.round, result.revisionRow, result.built),
    idempotent: result.idempotent,
    lifecycle: roundLifecycle(result.round, now),
  };
}

export async function finalizeDueRounds({
  now = new Date(),
  limit = 8,
  dryRun = false,
  date = null,
} = {}) {
  return withFinalizeRunnerLock(() => finalizeDueRoundsUnlocked({ now, limit, dryRun, date }));
}

async function finalizeDueRoundsUnlocked({
  now = new Date(),
  limit = 8,
  dryRun = false,
  date = null,
} = {}) {
  await requireResultsSchema();
  const take = Math.min(50, Math.max(1, Number(limit) || 8));
  const where = {
    status: 'PROVISIONAL',
    graceEndsAt: { lte: now },
  };
  if (date) where.date = assertYmd(date);
  const rounds = await prisma.tbilisiMovesRound.findMany({
    where,
    orderBy: { date: 'asc' },
    take,
    select: { date: true, graceEndsAt: true },
  });

  const processed = [];
  const failed = [];
  for (const round of rounds) {
    try {
      if (dryRun) {
        const preview = await previewFinalize({ date: round.date, now });
        processed.push({
          date: round.date,
          dryRun: true,
          phase: preview.lifecycle.phase,
          awardCount: preview.awardCounts.total,
          empty: preview.empty,
        });
      } else {
        const published = await finalizeRound({
          date: round.date,
          now,
          kind: 'INITIAL',
          actor: 'runner',
        });
        processed.push({
          date: round.date,
          dryRun: false,
          revision: published.resultRevision,
          idempotent: published.idempotent,
          awardCount: published.awardCount,
          empty: published.eligibleCreditCount === 0,
        });
      }
    } catch (error) {
      failed.push({
        date: round.date,
        code: error.code || 'ERROR',
      });
    }
  }
  return {
    scanned: rounds.length,
    processed,
    failed,
    dryRun,
    skipped: false,
    automaticExecutionConfigured: finalizeSchedulerConfigured(),
  };
}
