import { prisma as defaultPrisma } from '../prisma.js';
import { ENERGY_BALANCE_FIELDS, adapterById, isCareEnergyType } from './contract.js';
import { DEBIT_REASON_CODES, REASON_CODES } from './ruleset.js';
import { nextNonNegativeBalance, requirePositiveInt, WORLD_TRANSACTION_DEBIT } from './economy.js';
import {
  ensureMediWorldProfile,
  isPrismaMissing,
  isUniqueViolation,
  publicWorldLedgerRow,
  publicWorldProfile,
  reportWorldSchemaMissing,
  worldSchemaUnavailableError,
  allocateLedgerCreatedAt,
} from './engine.js';
import { assertIdempotencyMatch, fingerprintWorldIntent, loadLedgerByIdempotency } from './intent.js';
import { isMediWorldEnabled } from './flags.js';

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function dbOf(options = {}) {
  return options.db || defaultPrisma;
}

export async function debitCareEnergyInTx(tx, userId, input = {}, options = {}) {
  if (!isMediWorldEnabled(options.flags)) {
    throw httpError('მოთხოვნილი მისამართი ვერ მოიძებნა.', 404, 'MEDI_WORLD_DISABLED');
  }
  if (typeof tx?.mediWorldLedger?.create !== 'function') {
    reportWorldSchemaMissing('debit_write');
    throw worldSchemaUnavailableError();
  }

  const energyType = input.energyType;
  if (!isCareEnergyType(energyType)) {
    throw httpError('Unknown Care Energy category.', 400, 'WORLD_ENERGY_TYPE');
  }
  const amount = requirePositiveInt(input.amount, 'amount');
  const idempotencyKey = String(input.idempotencyKey || '').trim();
  if (!idempotencyKey || idempotencyKey.length > 180) {
    throw httpError('Missing idempotency key.', 400, 'WORLD_IDEMPOTENCY');
  }
  const reasonCode = String(input.reasonCode || '').trim();
  if (!DEBIT_REASON_CODES.includes(reasonCode)) {
    throw httpError('Unknown debit reason.', 400, 'WORLD_DEBIT_REASON');
  }
  const sourceId = String(input.sourceId || idempotencyKey).trim();
  const adapterId = String(input.adapterId || 'system.debit');
  if (adapterId !== 'system.debit' && !adapterById(adapterId)) {
    throw httpError('Unsupported Medi World activity adapter.', 400, 'WORLD_UNSUPPORTED_ADAPTER');
  }

  const intent = {
    userId,
    transactionType: WORLD_TRANSACTION_DEBIT,
    energyType,
    sourceType: 'INTERNAL_DEBIT',
    sourceId,
    adapterId,
    progressState: 'verified',
    requestedAmount: amount,
    logicalEventId: sourceId,
    rulesetVersion: 2,
  };

  const existing = await loadLedgerByIdempotency(tx, idempotencyKey);
  if (existing) {
    assertIdempotencyMatch(existing, intent);
    const profile = await ensureMediWorldProfile(userId, { ...options, db: tx });
    return {
      applied: false,
      duplicate: true,
      reasonCode: existing.reasonCode,
      profile: publicWorldProfile(profile),
      ledger: publicWorldLedgerRow(existing),
    };
  }

  await ensureMediWorldProfile(userId, { ...options, db: tx });
  if (typeof tx.$executeRaw === 'function') {
    await tx.$executeRaw`SELECT 1 FROM "MediWorldProfile" WHERE "userId" = ${userId} FOR UPDATE`;
  }
  const profile = await tx.mediWorldProfile.findUnique({ where: { userId } });
  const field = ENERGY_BALANCE_FIELDS[energyType];
  try {
    nextNonNegativeBalance(profile[field] || 0, WORLD_TRANSACTION_DEBIT, amount);
  } catch (error) {
    if (error.code === 'WORLD_NEGATIVE_BALANCE') {
      throw httpError('Not enough Care Energy for this action.', 400, REASON_CODES.INSUFFICIENT_CARE_ENERGY);
    }
    throw error;
  }

  const now = options.now || new Date();
  let ledger;
  try {
    const createdAt = await allocateLedgerCreatedAt(tx, userId, now);
    ledger = await tx.mediWorldLedger.create({
      data: {
        userId,
        idempotencyKey,
        sourceType: 'INTERNAL_DEBIT',
        sourceId,
        adapterId,
        energyType,
        transactionType: WORLD_TRANSACTION_DEBIT,
        energyAmount: amount,
        foundationXp: 0,
        progressState: 'verified',
        completionRatioBps: 0,
        rulesetVersion: 2,
        reasonCode,
        logicalEventId: sourceId,
        intentFingerprint: fingerprintWorldIntent(intent),
        periodKey: null,
        metadata: { origin: 'internal_debit' },
        createdAt,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await loadLedgerByIdempotency(tx, idempotencyKey);
    assertIdempotencyMatch(raced, intent);
    const latest = await ensureMediWorldProfile(userId, { ...options, db: tx });
    return {
      applied: false,
      duplicate: true,
      reasonCode: raced?.reasonCode,
      profile: publicWorldProfile(latest),
      ledger: publicWorldLedgerRow(raced),
    };
  }

  const updated = await tx.mediWorldProfile.update({
    where: { userId },
    data: { [field]: { decrement: amount } },
  });

  if (options.beforeCommit) await options.beforeCommit();

  return {
    applied: true,
    duplicate: false,
    reasonCode,
    profile: publicWorldProfile(updated),
    ledger: publicWorldLedgerRow(ledger),
  };
}

export async function debitCareEnergy(userId, input, options = {}) {
  const db = dbOf(options);
  try {
    if (typeof db?.$transaction === 'function') {
      return await db.$transaction((tx) => debitCareEnergyInTx(tx, userId, input, options));
    }
    return await debitCareEnergyInTx(db, userId, input, options);
  } catch (error) {
    if (isPrismaMissing(error)) {
      reportWorldSchemaMissing('debit_write', error);
      throw worldSchemaUnavailableError();
    }
    throw error;
  }
}
