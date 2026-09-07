import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { clipClientField } from './appVersion.js';

export const PRODUCT_EVENT_KINDS = new Set([
  'weekly_report_generated',
  'weekly_report_opened',
  'insight_generated',
  'insight_opened',
  'insight_actioned',
  'insight_dismissed',
  'notification_permission',
  'quest_hub_opened',
  'quest_claim_tapped',
  'quest_history_opened',
  'quest_wallet_opened',
  'step_setup_opened',
  'hydration_setup_opened',
  // Phase 4 achievements
  'achievements_opened',
  'achievements_opened_from_hub',
  'achievement_claim_tapped',
  // Phase 5 smart quest ("why this goal?" sheet)
  'quest_why_target_opened',
  // Phase 9 — Medi Companion (no health quantities)
  'medi_companion_opened',
  'medi_journey_opened',
  'medi_journey_milestone_viewed',
  'medi_cosmetic_equipped',
  'medi_talk_tapped',
]);

/** Server-authored only — never accepted from the client upsert path. */
export const SERVER_QUEST_EVENT_KINDS = Object.freeze([
  'quest_assigned',
  'quest_completed',
  'quest_claimed',
  // Phase 5 — category carries buckets only (targetSource:difficulty:vN:cb0/1),
  // never the exact personalized target.
  'smart_quest_assigned',
  'medi_journey_milestone_unlocked',
]);

let tableReady = false;

export async function ensureProductEventTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductEvent" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "kind" TEXT NOT NULL,
      "category" TEXT,
      "entityId" TEXT,
      "source" TEXT,
      "occurredAt" TIMESTAMP(3) NOT NULL,
      "appVersion" TEXT,
      "platform" TEXT,
      CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ProductEvent_user_kind_entity_key"
    ON "ProductEvent"("userId", "kind", "entityId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ProductEvent_kind_occurredAt_idx"
    ON "ProductEvent"("kind", "occurredAt")
  `);
  tableReady = true;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function sanitizeProductEventInput(row, userId, meta = {}) {
  const kind = clipClientField(row.kind, 40);
  if (!PRODUCT_EVENT_KINDS.has(kind)) return null;
  const entityId = clipClientField(row.entityId || row.weekKey || row.insightId || kind, 80) || kind;
  const occurredAt = toDate(row.occurredAt) || new Date();
  if (occurredAt.getTime() > Date.now() + 120_000) return null;
  return {
    userId,
    kind,
    category: clipClientField(row.category, 40),
    entityId,
    source: clipClientField(row.source, 24),
    occurredAt,
    appVersion: clipClientField(row.appVersion || meta.appVersion, 24),
    platform: ['ios', 'android', 'web'].includes(row.platform || meta.platform)
      ? (row.platform || meta.platform)
      : null,
  };
}

export async function upsertProductEvents(userId, rows, meta = {}) {
  await ensureProductEventTable();
  const sanitized = (rows || []).map((row) => sanitizeProductEventInput(row, userId, meta)).filter(Boolean);
  let upserted = 0;
  for (const row of sanitized.slice(0, 40)) {
    const id = crypto.randomUUID();
    try {
      await prisma.$executeRaw`
        INSERT INTO "ProductEvent" (
          "id", "userId", "kind", "category", "entityId", "source", "occurredAt", "appVersion", "platform"
        ) VALUES (
          ${id}, ${userId}, ${row.kind}, ${row.category}, ${row.entityId}, ${row.source},
          ${row.occurredAt}, ${row.appVersion}, ${row.platform}
        )
        ON CONFLICT ("userId", "kind", "entityId") DO UPDATE SET
          "occurredAt" = LEAST("ProductEvent"."occurredAt", EXCLUDED."occurredAt"),
          "source" = COALESCE(EXCLUDED."source", "ProductEvent"."source")
      `;
      upserted += 1;
    } catch (error) {
      console.warn('[product-event] upsert failed', error?.message);
    }
  }
  return { upserted, received: sanitized.length };
}

export async function recordServerProductEvent({ userId, kind, category, entityId, source = 'quest' }) {
  if (!SERVER_QUEST_EVENT_KINDS.includes(kind) || !userId) return null;
  await ensureProductEventTable();
  const id = crypto.randomUUID();
  try {
    await prisma.$executeRaw`
      INSERT INTO "ProductEvent" (
        "id", "userId", "kind", "category", "entityId", "source", "occurredAt"
      ) VALUES (
        ${id}, ${userId}, ${kind}, ${category || null}, ${entityId || kind}, ${source}, NOW()
      )
      ON CONFLICT ("userId", "kind", "entityId") DO NOTHING
    `;
    return id;
  } catch (error) {
    console.warn('[product-event] server quest event failed', error?.message);
    return null;
  }
}

export async function loadProductEvents(fromDt, toExclusiveDt, kinds = null) {
  await ensureProductEventTable();
  try {
    if (kinds?.length) {
      return await prisma.$queryRaw`
        SELECT "userId", "kind", "category", "entityId", "source", "occurredAt"
        FROM "ProductEvent"
        WHERE "occurredAt" >= ${fromDt} AND "occurredAt" < ${toExclusiveDt}
          AND "kind" = ANY(${kinds})
      `;
    }
    return await prisma.$queryRaw`
      SELECT "userId", "kind", "category", "entityId", "source", "occurredAt"
      FROM "ProductEvent"
      WHERE "occurredAt" >= ${fromDt} AND "occurredAt" < ${toExclusiveDt}
    `;
  } catch (error) {
    if (error?.code === 'P2010' || /does not exist/i.test(error?.message || '')) return [];
    throw error;
  }
}
