import { prisma as defaultPrisma } from '../prisma.js';
import { PHASE38_UNLOCKS } from './contract.js';
import { MEDI_WORLD_ECONOMY_V2 } from './ruleset.js';
import {
  energyFromRow,
  ensureMediWorldProfile,
  publicWorldLedgerRow,
  publicWorldProfile,
  reportWorldSchemaMissing,
  worldSchemaUnavailableError,
} from './engine.js';
import { isMediWorldEnabled, isMediWorldFoundationTestPathEnabled, mediWorldDisabledError } from './flags.js';
import { processWorldActivity } from './engine.js';
import { assertWorldPayloadSafe } from './privacy.js';
import { dailyPeriodKey, getEffectiveQuestTimezone } from '../questTime.js';

function dbOf(options = {}) {
  return options.db || defaultPrisma;
}

function emptyEnergy() {
  return { movement: 0, hydration: 0, calm: 0, care: 0, connection: 0 };
}

export const WORLD_LEDGER_ORDER = Object.freeze([{ createdAt: 'desc' }, { id: 'desc' }]);

export async function findLatestWorldLedger(db, userId, extraWhere = {}) {
  if (typeof db?.mediWorldLedger?.findMany !== 'function') return null;
  const rows = await db.mediWorldLedger.findMany({
    where: { userId, ...extraWhere },
    orderBy: WORLD_LEDGER_ORDER,
    take: 1,
  });
  return rows[0] || null;
}

async function todayUsage(db, userId, periodKey) {
  if (!periodKey || typeof db?.mediWorldLedger?.findMany !== 'function') {
    return { category: emptyEnergy(), worldXp: 0 };
  }
  const rows = await db.mediWorldLedger.findMany({
    where: {
      userId,
      periodKey,
      transactionType: 'CREDIT',
      sourceType: { in: [...MEDI_WORLD_ECONOMY_V2.activitySourceTypes] },
    },
  });
  const category = emptyEnergy();
  let worldXp = 0;
  for (const row of rows) {
    category[row.energyType] = (category[row.energyType] || 0) + (row.energyAmount || 0);
    worldXp += row.foundationXp || 0;
  }
  return { category, worldXp };
}

/** Read-only World progression. Does not award visit Bond. Used by movement finish. */
export async function getMediWorldProfileSnapshot(userId, options = {}) {
  if (!isMediWorldEnabled(options.flags)) throw mediWorldDisabledError();
  const db = dbOf(options);
  const row = await ensureMediWorldProfile(userId, options);
  const timezone = getEffectiveQuestTimezone(options.user || {}, {
    timezone: options.timezone,
    deviceTimezone: options.deviceTimezone,
  });
  const periodKey = dailyPeriodKey(options.now || new Date(), timezone);
  const usage = await todayUsage(db, userId, periodKey);
  const latest = await findLatestWorldLedger(db, userId, {
    sourceType: { in: [...MEDI_WORLD_ECONOMY_V2.activitySourceTypes, 'LEVEL_UP'] },
  });
  const category = {};
  for (const [type, used] of Object.entries(usage.category)) {
    category[type] = {
      used,
      cap: MEDI_WORLD_ECONOMY_V2.dailyCategoryEnergyCap,
      remaining: Math.max(0, MEDI_WORLD_ECONOMY_V2.dailyCategoryEnergyCap - used),
    };
  }
  return assertWorldPayloadSafe({
    enabled: true,
    awakening: true,
    unlocks: { ...PHASE38_UNLOCKS },
    profile: publicWorldProfile(row, { userId }),
    economy: {
      rulesetId: MEDI_WORLD_ECONOMY_V2.id,
      rulesetVersion: MEDI_WORLD_ECONOMY_V2.rulesetVersion,
    },
    today: {
      periodKey,
      timezone,
      category,
      worldXp: {
        used: usage.worldXp,
        cap: MEDI_WORLD_ECONOMY_V2.dailyWorldXpCap,
        remaining: Math.max(0, MEDI_WORLD_ECONOMY_V2.dailyWorldXpCap - usage.worldXp),
      },
    },
    latestReward: latest
      ? {
          reasonCode: latest.reasonCode || null,
          energyType: latest.energyType,
          energyAmount: latest.energyAmount,
          worldXp: latest.foundationXp,
          sourceType: latest.sourceType,
          createdAt: latest.createdAt instanceof Date ? latest.createdAt.toISOString() : latest.createdAt,
        }
      : null,
  });
}

export async function getMediWorldProfile(userId, options = {}) {
  const payload = await getMediWorldProfileSnapshot(userId, options);
  try {
    const { recordWorldVisitBond } = await import('./companion/service.js');
    await recordWorldVisitBond(userId, options);
  } catch (error) {
    if (!(error?.code === 'WORLD_UNAVAILABLE' || error?.code === 'P2021' || /does not exist/i.test(error?.message || ''))) {
      throw error;
    }
  }
  return payload;
}

export async function getMediWorldLedger(userId, options = {}) {
  if (!isMediWorldEnabled(options.flags)) throw mediWorldDisabledError();
  const db = dbOf(options);
  if (typeof db?.mediWorldLedger?.findMany !== 'function') {
    reportWorldSchemaMissing('ledger_read');
    throw worldSchemaUnavailableError();
  }
  const take = Math.min(50, Math.max(1, Number(options.take) || 20));
  const where = { userId };
  if (options.cursor) {
    const raw = String(options.cursor);
    const split = raw.lastIndexOf('_');
    const iso = split > 0 ? raw.slice(0, split) : raw;
    const id = split > 0 ? raw.slice(split + 1) : '';
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) {
      const error = new Error('Invalid ledger cursor.');
      error.status = 400;
      error.code = 'WORLD_LEDGER_CURSOR';
      throw error;
    }
    where.OR = id
      ? [
          { createdAt: { lt: at } },
          { createdAt: at, id: { lt: id } },
        ]
      : [{ createdAt: { lt: at } }];
  }
  const rows = await db.mediWorldLedger.findMany({
    where,
    orderBy: WORLD_LEDGER_ORDER,
    take: take + 1,
  }).catch((error) => {
    if (error?.code === 'P2021' || /does not exist/i.test(error?.message || '')) {
      reportWorldSchemaMissing('ledger_read', error);
      throw worldSchemaUnavailableError();
    }
    throw error;
  });
  const page = rows.slice(0, take);
  const next = rows[take];
  const last = page[page.length - 1];
  const created = last?.createdAt instanceof Date ? last.createdAt.toISOString() : last?.createdAt;
  return {
    items: page.map(publicWorldLedgerRow),
    nextCursor: next && last ? `${created}_${last.id}` : null,
  };
}

export async function processFoundationTestActivity(userId, body, options = {}) {
  if (!isMediWorldFoundationTestPathEnabled(options.flags)) throw mediWorldDisabledError();
  return processWorldActivity(
    userId,
    {
      sourceType: 'FOUNDATION_TEST',
      sourceId: String(body.sourceId || '').trim(),
      idempotencyKey: String(body.idempotencyKey || '').trim(),
      adapterId: String(body.adapterId || '').trim(),
      energyType: body.energyType,
      progressState: body.progressState,
      personalTarget: body.personalTarget,
      completedAmount: body.completedAmount,
      metadata: { origin: 'foundation_test' },
    },
    options,
  );
}

export { energyFromRow };
