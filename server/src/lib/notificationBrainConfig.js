/**
 * Admin control over Medi's companion notifications — the Notification Brain that plans check-ins,
 * water and walk nudges, the weekly report push, re-engagement and the rest on each phone
 * (owner 2026-10-11: „სრულად ვმართო“). Admin Push → Brain → „მართვა“:
 *   paused     — no Medi companion notification on any phone (scheduled ones are cancelled on the next run)
 *   off        — families switched off for everyone
 *   maxPerDay  — a ceiling per person per day (1–4), never above the person's own choice
 * Phones read it from /api/app/status `brain`. Medication, visit, cycle and pet reminders the person
 * set are not Brain notifications and are never touched by this.
 * One row, raw SQL (install-notification-brain.mjs; also created lazily).
 */
import { prisma } from './prisma.js';

/** Families the Brain on the phone can plan (mobile/src/lib/mediNotificationBrain.shared.ts ENGAGE_FAMILIES). */
export const BRAIN_FAMILIES = Object.freeze([
  'checkin',
  'morning',
  'sleep',
  'hydration',
  'stepsQuiet',
  'weatherWellness',
  'questSmart',
  'weekly',
  'feature',
  'insight',
  'achievement',
  'chat',
  'question',
  'unfinished',
  'visitFollowup',
  'reengage',
  'birthday',
]);

export const NOTIFICATION_BRAIN_CONFIG_SQL = `CREATE TABLE IF NOT EXISTS "NotificationBrainConfig" (
  "id" TEXT PRIMARY KEY,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "off" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "maxPerDay" INTEGER,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT
)`;

const TTL_MS = 15_000;
const DEFAULT = Object.freeze({ paused: false, off: [], maxPerDay: null, updatedAt: null, updatedBy: null });
let cache = { at: 0, row: null };
let ensured = false;

async function ensureTable(db) {
  if (ensured) return;
  await db.$executeRawUnsafe(NOTIFICATION_BRAIN_CONFIG_SQL);
  ensured = true;
}

export function sanitizeBrainConfig(raw) {
  const off = Array.isArray(raw?.off) ? raw.off.filter((family) => BRAIN_FAMILIES.includes(family)) : [];
  const max = Number(raw?.maxPerDay);
  return {
    paused: raw?.paused === true,
    off: [...new Set(off)].sort(),
    maxPerDay: Number.isInteger(max) && max >= 1 && max <= 4 ? max : null,
  };
}

/** Current config (cached 15 s); never throws — a broken table means „nothing switched off“. */
export async function getNotificationBrainConfig(db = prisma) {
  if (cache.row && Date.now() - cache.at < TTL_MS) return cache.row;
  try {
    await ensureTable(db);
    const rows = await db.$queryRaw`SELECT "paused", "off", "maxPerDay", "updatedAt", "updatedBy" FROM "NotificationBrainConfig" WHERE "id" = 'default'`;
    const row = rows[0] ? { ...sanitizeBrainConfig(rows[0]), updatedAt: rows[0].updatedAt, updatedBy: rows[0].updatedBy } : { ...DEFAULT };
    cache = { at: Date.now(), row };
    return row;
  } catch {
    return { ...DEFAULT };
  }
}

/** What phones get in /api/app/status. */
export function publicBrainConfig(config) {
  const clean = sanitizeBrainConfig(config);
  return { paused: clean.paused, off: clean.off, maxPerDay: clean.maxPerDay };
}

/** Admin: change any of paused / off / maxPerDay (missing fields keep their value). */
export async function setNotificationBrainConfig(patch, adminId, db = prisma) {
  await ensureTable(db);
  cache = { at: 0, row: null };
  const current = await getNotificationBrainConfig(db);
  const next = sanitizeBrainConfig({
    paused: patch.paused === undefined ? current.paused : patch.paused,
    off: patch.off === undefined ? current.off : patch.off,
    maxPerDay: patch.maxPerDay === undefined ? current.maxPerDay : patch.maxPerDay,
  });
  const offJson = JSON.stringify(next.off);
  await db.$executeRaw`INSERT INTO "NotificationBrainConfig" ("id", "paused", "off", "maxPerDay", "updatedAt", "updatedBy")
    VALUES ('default', ${next.paused}, ${offJson}::jsonb, ${next.maxPerDay}, CURRENT_TIMESTAMP, ${adminId ?? null})
    ON CONFLICT ("id") DO UPDATE SET "paused" = EXCLUDED."paused", "off" = EXCLUDED."off", "maxPerDay" = EXCLUDED."maxPerDay",
      "updatedAt" = EXCLUDED."updatedAt", "updatedBy" = EXCLUDED."updatedBy"`;
  cache = { at: 0, row: null };
  return getNotificationBrainConfig(db);
}

export function resetNotificationBrainConfigCacheForTests() {
  cache = { at: 0, row: null };
  ensured = false;
}
