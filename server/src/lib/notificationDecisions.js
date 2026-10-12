import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { createdAtToTbilisiYmd, mondayOfWeek } from './adminAnalyticsRange.js';
import { upsertProductEvents } from './productEvents.js';

const RESULTS = new Set(['SEND', 'BLOCKED', 'CANCELLED', 'REVALIDATED']);

let tablesReady = false;

export async function ensureNotificationDecisionTable() {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NotificationDecision" (
      "id" TEXT NOT NULL,
      "decisionId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "candidate" TEXT NOT NULL,
      "family" TEXT NOT NULL,
      "score" INTEGER NOT NULL DEFAULT 0,
      "result" TEXT NOT NULL,
      "reason" TEXT,
      "templateKey" TEXT,
      "route" TEXT,
      "selectedFrequency" TEXT,
      "baseDailyCap" INTEGER,
      "adaptiveDailyCap" INTEGER,
      "ewma" DOUBLE PRECISION,
      "createdAt" TIMESTAMP(3) NOT NULL,
      "scheduledAt" TIMESTAMP(3),
      "revalidatedAt" TIMESTAMP(3),
      "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "NotificationDecision_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "NotificationDecision_decisionId_key"
    ON "NotificationDecision"("decisionId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "NotificationDecision_createdAt_idx"
    ON "NotificationDecision"("createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "NotificationDecision_result_createdAt_idx"
    ON "NotificationDecision"("result", "createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "NotificationDecision_family_createdAt_idx"
    ON "NotificationDecision"("family", "createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "NotificationDecision_userId_createdAt_idx"
    ON "NotificationDecision"("userId", "createdAt")
  `);
  tablesReady = true;
}

function clip(value, max) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeResult(raw, blocked) {
  const value = String(raw || '').toUpperCase();
  if (value === 'SKIP') return 'BLOCKED';
  if (RESULTS.has(value)) return value;
  if (blocked) return 'BLOCKED';
  return 'SEND';
}

/** Strip anything that could be a health measurement or chat excerpt. */
export function sanitizeDecisionInput(row, fatigue = null) {
  const decisionId = clip(row.decisionId || row.id, 80);
  if (!decisionId || !decisionId.startsWith('notif_dec_')) return null;
  const family = clip(row.family || row.candidate, 40) || 'unknown';
  const result = normalizeResult(row.result || row.decision, row.blocked || row.reason);
  return {
    decisionId,
    candidate: clip(row.candidate, 40) || family,
    family,
    score: Math.max(0, Math.min(999, Number(row.score) || 0)),
    result,
    reason: clip(row.reason || row.blocked, 120),
    templateKey: clip(row.templateKey || row.template, 80),
    route: clip(row.route, 120),
    selectedFrequency: clip(row.selectedFrequency || fatigue?.selectedFrequency, 24),
    baseDailyCap: Number.isFinite(Number(row.baseDailyCap ?? fatigue?.baseDailyCap))
      ? Number(row.baseDailyCap ?? fatigue.baseDailyCap)
      : null,
    adaptiveDailyCap: Number.isFinite(Number(row.adaptiveDailyCap ?? fatigue?.adaptiveDailyCap))
      ? Number(row.adaptiveDailyCap ?? fatigue.adaptiveDailyCap)
      : null,
    ewma: Number.isFinite(Number(row.ewma ?? fatigue?.ewma))
      ? Math.round(Number(row.ewma ?? fatigue.ewma) * 1000) / 1000
      : null,
    createdAt: toDate(row.createdAt) || new Date(),
    scheduledAt: toDate(row.scheduledAt || row.fireAt),
    revalidatedAt: toDate(row.revalidatedAt),
  };
}

export async function upsertNotificationDecisions(userId, rows, fatigue = null) {
  await ensureNotificationDecisionTable();
  const sanitized = (rows || []).map((row) => sanitizeDecisionInput(row, fatigue)).filter(Boolean);
  let upserted = 0;
  for (const row of sanitized.slice(0, 80)) {
    const id = crypto.randomUUID();
    try {
      await prisma.$executeRaw`
        INSERT INTO "NotificationDecision" (
          "id", "decisionId", "userId", "candidate", "family", "score", "result",
          "reason", "templateKey", "route", "selectedFrequency", "baseDailyCap",
          "adaptiveDailyCap", "ewma", "createdAt", "scheduledAt", "revalidatedAt", "syncedAt"
        ) VALUES (
          ${id}, ${row.decisionId}, ${userId}, ${row.candidate}, ${row.family}, ${row.score}, ${row.result},
          ${row.reason}, ${row.templateKey}, ${row.route}, ${row.selectedFrequency}, ${row.baseDailyCap},
          ${row.adaptiveDailyCap}, ${row.ewma}, ${row.createdAt}, ${row.scheduledAt}, ${row.revalidatedAt}, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("decisionId") DO UPDATE SET
          "result" = EXCLUDED."result",
          "reason" = EXCLUDED."reason",
          "candidate" = EXCLUDED."candidate",
          "templateKey" = COALESCE(EXCLUDED."templateKey", "NotificationDecision"."templateKey"),
          "route" = COALESCE(EXCLUDED."route", "NotificationDecision"."route"),
          "score" = EXCLUDED."score",
          "scheduledAt" = COALESCE(EXCLUDED."scheduledAt", "NotificationDecision"."scheduledAt"),
          "revalidatedAt" = COALESCE(EXCLUDED."revalidatedAt", "NotificationDecision"."revalidatedAt"),
          "selectedFrequency" = COALESCE(EXCLUDED."selectedFrequency", "NotificationDecision"."selectedFrequency"),
          "baseDailyCap" = COALESCE(EXCLUDED."baseDailyCap", "NotificationDecision"."baseDailyCap"),
          "adaptiveDailyCap" = COALESCE(EXCLUDED."adaptiveDailyCap", "NotificationDecision"."adaptiveDailyCap"),
          "ewma" = COALESCE(EXCLUDED."ewma", "NotificationDecision"."ewma"),
          "syncedAt" = CURRENT_TIMESTAMP
        WHERE "NotificationDecision"."userId" = EXCLUDED."userId"
      `;
      upserted += 1;
    } catch (error) {
      console.warn('[engage] decision upsert failed', error?.message);
    }
  }
  const weeklySends = sanitized.filter((row) => row.family === 'weekly' && row.result === 'SEND');
  if (weeklySends.length) {
    await upsertProductEvents(
      userId,
      weeklySends.map((row) => ({
        kind: 'weekly_report_generated',
        entityId: mondayOfWeek(createdAtToTbilisiYmd(row.createdAt) || new Date().toISOString().slice(0, 10)),
        source: 'notification',
        occurredAt: row.createdAt,
      })),
    );
  }
  return { upserted, received: sanitized.length };
}

function decisionWhereSql({ fromDt, toExclusiveDt, result, family, q, userId, reason }, alias = '') {
  const col = (name) => (alias ? `${alias}."${name}"` : `"${name}"`);
  const clauses = [`${col('createdAt')} >= $1`, `${col('createdAt')} < $2`];
  const params = [fromDt, toExclusiveDt];
  let i = 3;
  if (result && RESULTS.has(result)) {
    clauses.push(`${col('result')} = $${i}`);
    params.push(result);
    i += 1;
  }
  if (family) {
    clauses.push(`${col('family')} = $${i}`);
    params.push(family);
    i += 1;
  }
  if (userId) {
    clauses.push(`${col('userId')} = $${i}`);
    params.push(userId);
    i += 1;
  }
  if (reason) {
    clauses.push(`${col('reason')} = $${i}`);
    params.push(reason);
    i += 1;
  }
  if (q) {
    clauses.push(`(${col('decisionId')} ILIKE $${i} OR ${col('candidate')} ILIKE $${i} OR ${col('reason')} ILIKE $${i} OR ${col('templateKey')} ILIKE $${i} OR ${col('userId')} = $${i + 1})`);
    params.push(`%${q}%`, q);
    i += 2;
  }
  return { where: clauses.join(' AND '), params };
}

export async function listNotificationDecisions(opts = {}) {
  await ensureNotificationDecisionTable();
  const take = Math.min(Number(opts.limit) || 50, 200);
  const skip = Math.max(Number(opts.offset) || 0, 0);
  const count = decisionWhereSql(opts);
  const listed = decisionWhereSql(opts, 'd');
  try {
    const totalRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "NotificationDecision" WHERE ${count.where}`,
      ...count.params,
    );
    const rows = await prisma.$queryRawUnsafe(
      `SELECT d.*, u."fullName" AS "userName", u.email AS "userEmail"
       FROM "NotificationDecision" d
       LEFT JOIN "User" u ON u.id = d."userId"
       WHERE ${listed.where}
       ORDER BY d."createdAt" DESC
       LIMIT ${take} OFFSET ${skip}`,
      ...listed.params,
    );
    return {
      total: totalRows[0]?.count ?? 0,
      decisions: (rows || []).map(serializeDecision),
    };
  } catch (error) {
    if (isMissingTable(error)) return { total: 0, decisions: [] };
    throw error;
  }
}

export async function getNotificationDecision(decisionId) {
  await ensureNotificationDecisionTable();
  try {
    const rows = await prisma.$queryRaw`
      SELECT d.*, u."fullName" AS "userName", u.email AS "userEmail"
      FROM "NotificationDecision" d
      LEFT JOIN "User" u ON u.id = d."userId"
      WHERE d."decisionId" = ${decisionId}
      LIMIT 1
    `;
    return rows[0] ? serializeDecision(rows[0]) : null;
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

/**
 * Admin analytics only (funnel, plans, types, fatigue). Tens of thousands of rows a week are parsed on
 * the single web CPU, so only the columns those read are selected (2026-10-12 stalls).
 */
export async function loadDecisionRows(fromDt, toExclusiveDt) {
  await ensureNotificationDecisionTable();
  try {
    return await prisma.$queryRaw`
      SELECT "decisionId", "userId", "family", "result", "reason", "templateKey",
             "selectedFrequency", "baseDailyCap", "adaptiveDailyCap", "ewma",
             "createdAt", "scheduledAt", "syncedAt"
      FROM "NotificationDecision"
      WHERE "createdAt" >= ${fromDt} AND "createdAt" < ${toExclusiveDt}
    `;
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

/** Decisions outside the period that its outcomes belong to (a re-engagement planned two weeks ago firing today). */
export async function loadDecisionRowsByIds(decisionIds) {
  const ids = [...new Set((decisionIds || []).filter(Boolean))].slice(0, 5000);
  if (!ids.length) return [];
  await ensureNotificationDecisionTable();
  try {
    return await prisma.$queryRaw`
      SELECT "decisionId", "userId", "candidate", "family", "score", "result", "reason",
             "templateKey", "route", "createdAt", "scheduledAt", "revalidatedAt", "syncedAt"
      FROM "NotificationDecision"
      WHERE "decisionId" = ANY(${ids})
    `;
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

const PLAN_STATUSES = new Set(['delivered', 'opened', 'pending', 'blocked', 'cancelled', 'unconfirmed', 'replaced']);

/**
 * The decision log as plans: one row per person, template, result, reason and planned time (or day
 * for a skip). Phones before 1.0.0.21.39 sent a fresh row on every Brain run — the same plan up to
 * 60 times a day — and these collapse here; newer phones already send one row per plan. Each row
 * carries what happened to any of its ids (delivered, opened, acted on, cancelled at delivery).
 */
export async function listNotificationPlans(opts = {}) {
  await ensureNotificationDecisionTable();
  const take = Math.min(Number(opts.limit) || 50, Number(opts.maxLimit) || 200);
  const skip = Math.max(Number(opts.offset) || 0, 0);
  const filtered = decisionWhereSql(opts);
  const status = PLAN_STATUSES.has(opts.status) ? opts.status : '';
  const having = {
    delivered: `'delivered' = ANY(outcomes) OR 'opened' = ANY(outcomes) OR 'actioned' = ANY(outcomes) OR 'snoozed' = ANY(outcomes)`,
    opened: `'opened' = ANY(outcomes) OR 'actioned' = ANY(outcomes)`,
    pending: `result = 'SEND' AND NOT superseded AND "scheduledAt" > now() AND NOT ('cancelled_by_revalidation' = ANY(outcomes))`,
    blocked: `result = 'BLOCKED'`,
    cancelled: `result = 'CANCELLED' OR 'cancelled_by_revalidation' = ANY(outcomes)`,
    unconfirmed: `result = 'SEND' AND NOT superseded AND "scheduledAt" <= now() AND cardinality(outcomes) = 0`,
    replaced: `superseded`,
  }[status];
  const grouped = `
    WITH d AS (
      SELECT *, COALESCE(to_char("scheduledAt", 'YYYY-MM-DD"T"HH24:MI'), 'day:' || to_char("createdAt" AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM-DD')) AS "planSlot"
      FROM "NotificationDecision"
      WHERE ${filtered.where}
    ), g AS (
      SELECT "userId", "family", "templateKey", "result", "reason", "planSlot",
             (array_agg("decisionId" ORDER BY "createdAt" DESC))[1] AS "decisionId",
             array_agg("decisionId") AS ids,
             max("candidate") AS "candidate", max("score") AS "score", max("route") AS "route",
             min("createdAt") AS "createdAt", max("createdAt") AS "lastAt", max("syncedAt") AS "updatedAt", max("scheduledAt") AS "scheduledAt",
             max("revalidatedAt") AS "revalidatedAt", count(*)::int AS "runs",
             (array_agg("selectedFrequency" ORDER BY "createdAt" DESC))[1] AS "selectedFrequency",
             (array_agg("baseDailyCap" ORDER BY "createdAt" DESC))[1] AS "baseDailyCap",
             (array_agg("adaptiveDailyCap" ORDER BY "createdAt" DESC))[1] AS "adaptiveDailyCap",
             (array_agg("ewma" ORDER BY "createdAt" DESC))[1] AS "ewma"
      FROM d
      GROUP BY "userId", "family", "templateKey", "result", "reason", "planSlot"
    ), s AS (
      SELECT g.*, CASE WHEN g."family" IN ('reengage', 'insight', 'achievement') THEN g."family" || '|' || COALESCE(g."templateKey", '') ELSE g."family" END AS "slot"
      FROM g
    ), p AS (
      SELECT s.*,
             COALESCE((SELECT array_agg(DISTINCT o."outcome") FROM "NotificationOutcome" o WHERE o."decisionId" = ANY(s.ids)), ARRAY[]::text[]) AS outcomes,
             -- Old phones re-planned every run: a later plan in the same slot before the planned time replaced this one.
             (s."result" = 'SEND' AND s."scheduledAt" IS NOT NULL AND EXISTS (
               SELECT 1 FROM s s2
               WHERE s2."userId" = s."userId" AND s2."slot" = s."slot"
                 AND s2."createdAt" > s."lastAt" AND s2."createdAt" < s."scheduledAt"
             )) AS superseded
      FROM s
    )`;
  try {
    await ensureOutcomeTableForPlans();
    const where = having ? `WHERE ${having}` : '';
    const totalRows = await prisma.$queryRawUnsafe(`${grouped} SELECT COUNT(*)::int AS count FROM p ${where}`, ...filtered.params);
    const rows = await prisma.$queryRawUnsafe(
      `${grouped}
       SELECT p.*, u."fullName" AS "userName", u.email AS "userEmail"
       FROM p LEFT JOIN "User" u ON u.id = p."userId"
       ${where}
       ORDER BY p."updatedAt" DESC
       LIMIT ${take} OFFSET ${skip}`,
      ...filtered.params,
    );
    return {
      total: totalRows[0]?.count ?? 0,
      decisions: (rows || []).map((row) => ({ ...serializeDecision(row), runs: row.runs, superseded: Boolean(row.superseded), outcomeKinds: row.outcomes || [] })),
    };
  } catch (error) {
    if (isMissingTable(error)) return { total: 0, decisions: [] };
    throw error;
  }
}

async function ensureOutcomeTableForPlans() {
  const { ensureNotificationOutcomeTable } = await import('./notificationOutcomes.js');
  await ensureNotificationOutcomeTable();
}

function serializeDecision(row) {
  return {
    id: row.decisionId,
    decisionId: row.decisionId,
    userId: row.userId,
    userName: row.userName || null,
    userEmail: row.userEmail || null,
    candidate: row.candidate,
    family: row.family,
    score: row.score,
    result: row.result,
    reason: row.reason,
    templateKey: row.templateKey,
    route: row.route,
    selectedFrequency: row.selectedFrequency,
    baseDailyCap: row.baseDailyCap,
    adaptiveDailyCap: row.adaptiveDailyCap,
    ewma: row.ewma,
    createdAt: row.createdAt,
    scheduledAt: row.scheduledAt,
    revalidatedAt: row.revalidatedAt,
    updatedAt: row.updatedAt || row.syncedAt || null,
  };
}

function isMissingTable(error) {
  return error?.code === 'P2010' || /does not exist/i.test(error?.message || '');
}
