import {
  BOND_DAILY_REPEATABLE_CAP,
  BOND_POINTS,
  BOND_REASON_CODES,
  BOND_REPEATABLE_REASONS,
  MEDI_WORLD_BOND_RULESET_VERSION,
} from './bond.js';
import { isPrismaMissing, isUniqueViolation } from '../engine.js';

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function bondIdempotency(kind, userId, rest) {
  return `bond:${kind}:${userId}:${rest}`;
}

export async function repeatableBondUsedToday(tx, userId, periodKey) {
  if (!periodKey || typeof tx?.mediCompanionBondEvent?.findMany !== 'function') return 0;
  const rows = await tx.mediCompanionBondEvent.findMany({
    where: { userId, periodKey, reasonCode: { in: [...BOND_REPEATABLE_REASONS] } },
  });
  return rows.reduce((sum, row) => sum + (Number(row.points) || 0), 0);
}

export async function awardBondEventInTx(tx, userId, input = {}, options = {}) {
  if (typeof tx?.mediCompanionBondEvent?.create !== 'function') return null;
  const idempotencyKey = String(input.idempotencyKey || '').trim();
  const reasonCode = String(input.reasonCode || '').trim();
  const requested = Math.max(0, Math.floor(Number(input.points) || 0));
  if (!idempotencyKey || !reasonCode) {
    throw httpError('Missing Bond event identity.', 400, 'WORLD_BOND_IDEMPOTENCY');
  }

  const existing = await tx.mediCompanionBondEvent.findUnique({ where: { idempotencyKey } }).catch(() => null);
  if (existing) {
    if (existing.userId !== userId) throw httpError('Bond conflict.', 409, 'WORLD_IDEMPOTENCY_CONFLICT');
    return { applied: false, duplicate: true, event: existing, points: existing.points };
  }

  let points = requested;
  if (input.countsTowardDailyCap) {
    const used = await repeatableBondUsedToday(tx, userId, input.periodKey);
    points = Math.max(0, Math.min(requested, BOND_DAILY_REPEATABLE_CAP - used));
  }

  try {
    const event = await tx.mediCompanionBondEvent.create({
      data: {
        userId,
        idempotencyKey,
        reasonCode,
        points,
        periodKey: input.periodKey || null,
        rulesetVersion: MEDI_WORLD_BOND_RULESET_VERSION,
        createdAt: options.now || new Date(),
      },
    });
  if (points > 0 && typeof tx.mediCompanionProfile?.upsert === 'function') {
      await tx.mediCompanionProfile.upsert({
        where: { userId },
        create: {
          userId,
          selectedCosmetics: {},
          selectedEnvironmentKey: 'env.day',
          bondPoints: points,
        },
        update: { bondPoints: { increment: points } },
      });
    }
    return { applied: true, duplicate: false, event, points };
  } catch (error) {
    if (isPrismaMissing(error)) return null;
    if (!isUniqueViolation(error)) throw error;
    const raced = await tx.mediCompanionBondEvent.findUnique({ where: { idempotencyKey } });
    if (raced && raced.userId !== userId) throw httpError('Bond conflict.', 409, 'WORLD_IDEMPOTENCY_CONFLICT');
    return { applied: false, duplicate: true, event: raced, points: raced?.points || 0 };
  }
}

export async function awardVerifiedGoalBondInTx(tx, userId, input = {}, options = {}) {
  const logicalEventId = String(input.logicalEventId || '').trim();
  if (!logicalEventId) return null;
  return awardBondEventInTx(
    tx,
    userId,
    {
      idempotencyKey: bondIdempotency('goal', userId, logicalEventId),
      reasonCode: BOND_REASON_CODES.VERIFIED_GOAL,
      points: BOND_POINTS.VERIFIED_GOAL,
      periodKey: input.periodKey,
      countsTowardDailyCap: true,
    },
    options,
  );
}

export async function awardFirstVisitBondInTx(tx, userId, periodKey, options = {}) {
  return awardBondEventInTx(
    tx,
    userId,
    {
      idempotencyKey: bondIdempotency('visit', userId, periodKey),
      reasonCode: BOND_REASON_CODES.FIRST_VISIT,
      points: BOND_POINTS.FIRST_VISIT,
      periodKey,
      countsTowardDailyCap: true,
    },
    options,
  );
}

export async function awardStageUnlockBondInTx(tx, userId, stageKey, options = {}) {
  return awardBondEventInTx(
    tx,
    userId,
    {
      idempotencyKey: bondIdempotency('stage', userId, stageKey),
      reasonCode: BOND_REASON_CODES.STAGE_UNLOCK,
      points: BOND_POINTS.STAGE_UNLOCK,
      periodKey: null,
      countsTowardDailyCap: false,
    },
    options,
  );
}

export async function awardCareMomentBondInTx(tx, userId, periodKey, options = {}) {
  return awardBondEventInTx(
    tx,
    userId,
    {
      idempotencyKey: bondIdempotency('care', userId, periodKey),
      reasonCode: BOND_REASON_CODES.CARE_MOMENT,
      points: BOND_POINTS.CARE_MOMENT,
      periodKey,
      countsTowardDailyCap: true,
    },
    options,
  );
}
