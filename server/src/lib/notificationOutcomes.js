import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { clipClientField } from './appVersion.js';

export const OUTCOME_TYPES = new Set([
  'delivered',
  'opened',
  'actioned',
  'snoozed',
  'dismissed',
  'cancelled_by_revalidation',
]);

export const ACTION_KEYS = new Set([
  'medication_taken',
  'hydration_logged',
  'snooze',
  'checkin_ok',
  'open_chat',
  'open',
]);

export const DIRECT_ACTION_KEYS = new Set(['medication_taken', 'hydration_logged', 'checkin_ok']);

const ACTION_FROM_NOTIF = {
  TAKE: 'medication_taken',
  DRANK: 'hydration_logged',
  SNOOZE: 'snooze',
  OK: 'checkin_ok',
  CHAT: 'open_chat',
  OPEN: 'open',
  open: 'open',
};

let tableReady = false;

export async function ensureNotificationOutcomeTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NotificationOutcome" (
      "id" TEXT NOT NULL,
      "decisionId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "outcome" TEXT NOT NULL,
      "actionKey" TEXT,
      "occurredAt" TIMESTAMP(3) NOT NULL,
      "appVersion" TEXT,
      "platform" TEXT,
      "implied" BOOLEAN NOT NULL DEFAULT false,
      "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "NotificationOutcome_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "NotificationOutcome_decision_outcome_action_key"
    ON "NotificationOutcome"("decisionId", "outcome", "actionKey")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "NotificationOutcome_occurredAt_idx"
    ON "NotificationOutcome"("occurredAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "NotificationOutcome_userId_occurredAt_idx"
    ON "NotificationOutcome"("userId", "occurredAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "NotificationOutcome_outcome_occurredAt_idx"
    ON "NotificationOutcome"("outcome", "occurredAt")
  `);
  tableReady = true;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function mapNotificationActionKey(raw) {
  if (raw == null || raw === '') return null;
  const text = String(raw).trim();
  if (ACTION_KEYS.has(text)) return text;
  if (ACTION_FROM_NOTIF[text]) return ACTION_FROM_NOTIF[text];
  if (ACTION_FROM_NOTIF[text.toUpperCase()]) return ACTION_FROM_NOTIF[text.toUpperCase()];
  return null;
}

export function outcomeFromActionKey(actionKey, explicitOutcome) {
  if (explicitOutcome && OUTCOME_TYPES.has(explicitOutcome)) return explicitOutcome;
  if (actionKey === 'snooze') return 'snoozed';
  if (actionKey && DIRECT_ACTION_KEYS.has(actionKey)) return 'actioned';
  if (actionKey === 'open' || actionKey === 'open_chat') return 'opened';
  return explicitOutcome && OUTCOME_TYPES.has(explicitOutcome) ? explicitOutcome : null;
}

/** Never keeps title, body, health values, chat, or template vars. */
export function sanitizeOutcomeInput(row, userId, meta = {}) {
  const decisionId = clipClientField(row.decisionId || row.id, 80);
  if (!decisionId || !decisionId.startsWith('notif_dec_')) return null;
  const actionKey = mapNotificationActionKey(row.actionKey || row.action);
  let outcome = String(row.outcome || '').trim().toLowerCase();
  if (outcome === 'canceled_by_revalidation') outcome = 'cancelled_by_revalidation';
  if (!OUTCOME_TYPES.has(outcome)) {
    outcome = outcomeFromActionKey(actionKey, null);
  }
  if (!outcome) return null;
  if (outcome === 'actioned' && !actionKey) return null;
  if (outcome === 'snoozed' && actionKey && actionKey !== 'snooze') return null;
  const occurredAt = toDate(row.occurredAt) || new Date();
  if (occurredAt.getTime() > Date.now() + 120_000) return null;
  return {
    decisionId,
    userId,
    outcome,
    actionKey: actionKey || '',
    occurredAt,
    appVersion: clipClientField(row.appVersion || meta.appVersion, 24),
    platform: ['ios', 'android', 'web'].includes(row.platform || meta.platform)
      ? (row.platform || meta.platform)
      : null,
  };
}

export async function upsertNotificationOutcomes(userId, rows, meta = {}) {
  await ensureNotificationOutcomeTable();
  const sanitized = (rows || []).map((row) => sanitizeOutcomeInput(row, userId, meta)).filter(Boolean);
  let upserted = 0;
  let duplicates = 0;
  for (const row of sanitized.slice(0, 80)) {
    const id = crypto.randomUUID();
    try {
      const existing = await prisma.$queryRaw`
        SELECT "id", "occurredAt" FROM "NotificationOutcome"
        WHERE "decisionId" = ${row.decisionId}
          AND "outcome" = ${row.outcome}
          AND "actionKey" = ${row.actionKey}
        LIMIT 1
      `;
      if (existing[0]) {
        duplicates += 1;
        const prev = new Date(existing[0].occurredAt);
        if (row.occurredAt < prev) {
          await prisma.$executeRaw`
            UPDATE "NotificationOutcome"
            SET "occurredAt" = ${row.occurredAt}, "syncedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${existing[0].id}
          `;
        }
        continue;
      }
      await prisma.$executeRaw`
        INSERT INTO "NotificationOutcome" (
          "id", "decisionId", "userId", "outcome", "actionKey", "occurredAt",
          "appVersion", "platform", "implied", "syncedAt"
        ) VALUES (
          ${id}, ${row.decisionId}, ${userId}, ${row.outcome}, ${row.actionKey}, ${row.occurredAt},
          ${row.appVersion}, ${row.platform}, false, CURRENT_TIMESTAMP
        )
      `;
      upserted += 1;
    } catch (error) {
      console.warn('[engage] outcome upsert failed', error?.message);
    }
  }
  return { upserted, received: sanitized.length, duplicates };
}

export async function loadOutcomeRows(fromDt, toExclusiveDt) {
  await ensureNotificationOutcomeTable();
  try {
    return await prisma.$queryRaw`
      SELECT "decisionId", "userId", "outcome", "actionKey", "occurredAt", "appVersion", "platform", "implied"
      FROM "NotificationOutcome"
      WHERE "occurredAt" >= ${fromDt} AND "occurredAt" < ${toExclusiveDt}
    `;
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

export async function listNotificationOutcomes(opts = {}) {
  await ensureNotificationOutcomeTable();
  const take = Math.min(Number(opts.limit) || 50, 200);
  const skip = Math.max(Number(opts.offset) || 0, 0);
  const fromDt = opts.fromDt || new Date(0);
  const toExclusiveDt = opts.toExclusiveDt || new Date(Date.now() + 86_400_000);
  try {
    const clauses = [`o."occurredAt" >= $1`, `o."occurredAt" < $2`];
    const params = [fromDt, toExclusiveDt];
    let i = 3;
    if (opts.outcome && OUTCOME_TYPES.has(opts.outcome)) {
      clauses.push(`o."outcome" = $${i}`);
      params.push(opts.outcome);
      i += 1;
    }
    if (opts.actionKey) {
      clauses.push(`o."actionKey" = $${i}`);
      params.push(opts.actionKey);
      i += 1;
    }
    if (opts.decisionId) {
      clauses.push(`o."decisionId" = $${i}`);
      params.push(opts.decisionId);
      i += 1;
    }
    if (opts.userId) {
      clauses.push(`o."userId" = $${i}`);
      params.push(opts.userId);
      i += 1;
    }
    if (opts.q) {
      clauses.push(`(o."decisionId" ILIKE $${i} OR o."actionKey" ILIKE $${i} OR o."userId" = $${i + 1})`);
      params.push(`%${opts.q}%`, opts.q);
      i += 2;
    }
    const where = clauses.join(' AND ');
    const totalRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "NotificationOutcome" o WHERE ${where}`,
      ...params,
    );
    const rows = await prisma.$queryRawUnsafe(
      `SELECT o.*, u."fullName" AS "userName", u.email AS "userEmail"
       FROM "NotificationOutcome" o
       LEFT JOIN "User" u ON u.id = o."userId"
       WHERE ${where}
       ORDER BY o."occurredAt" DESC
       LIMIT ${take} OFFSET ${skip}`,
      ...params,
    );
    return { total: totalRows[0]?.count ?? 0, outcomes: rows || [] };
  } catch (error) {
    if (isMissingTable(error)) return { total: 0, outcomes: [] };
    throw error;
  }
}

export function medianMs(values) {
  const nums = values.filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : Math.round((nums[mid - 1] + nums[mid]) / 2);
}

function isMissingTable(error) {
  return error?.code === 'P2010' || /does not exist/i.test(error?.message || '');
}
