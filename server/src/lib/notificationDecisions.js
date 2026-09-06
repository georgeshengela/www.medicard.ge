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
          "scheduledAt" = EXCLUDED."scheduledAt",
          "revalidatedAt" = EXCLUDED."revalidatedAt",
          "selectedFrequency" = COALESCE(EXCLUDED."selectedFrequency", "NotificationDecision"."selectedFrequency"),
          "baseDailyCap" = COALESCE(EXCLUDED."baseDailyCap", "NotificationDecision"."baseDailyCap"),
          "adaptiveDailyCap" = COALESCE(EXCLUDED."adaptiveDailyCap", "NotificationDecision"."adaptiveDailyCap"),
          "ewma" = COALESCE(EXCLUDED."ewma", "NotificationDecision"."ewma"),
          "syncedAt" = CURRENT_TIMESTAMP
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

export async function loadDecisionRows(fromDt, toExclusiveDt) {
  await ensureNotificationDecisionTable();
  try {
    return await prisma.$queryRaw`
      SELECT "decisionId", "userId", "candidate", "family", "score", "result", "reason",
             "templateKey", "route", "selectedFrequency", "baseDailyCap", "adaptiveDailyCap",
             "ewma", "createdAt", "scheduledAt", "revalidatedAt"
      FROM "NotificationDecision"
      WHERE "createdAt" >= ${fromDt} AND "createdAt" < ${toExclusiveDt}
    `;
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
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
  };
}

function isMissingTable(error) {
  return error?.code === 'P2010' || /does not exist/i.test(error?.message || '');
}
