import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { tbilisiYmd } from './checkIn.js';
import { clientMetaFromRequest } from './appVersion.js';

let tableReady = false;

/**
 * One row per user per Tbilisi calendar day.
 * Written on GET /api/auth/me and POST /api/check-in/session (screen / heartbeat / resume).
 * This is the DAU/WAU/MAU and last-active source — not DailyCheckIn (login bonus).
 */
export async function ensureAppActivityTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AppActivity" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "date" DATE NOT NULL,
      "firstAt" TIMESTAMP(3) NOT NULL,
      "lastAt" TIMESTAMP(3) NOT NULL,
      "platform" TEXT,
      "appVersion" TEXT,
      "activityType" TEXT NOT NULL DEFAULT 'open',
      CONSTRAINT "AppActivity_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "AppActivity_userId_date_key"
    ON "AppActivity"("userId", "date")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AppActivity_date_idx" ON "AppActivity"("date")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AppActivity_lastAt_idx" ON "AppActivity"("lastAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AppActivity_appVersion_idx" ON "AppActivity"("appVersion")
  `);
  tableReady = true;
}

export async function recordAppActivity(userId, meta = {}, now = new Date()) {
  if (!userId) return null;
  await ensureAppActivityTable();
  const ymd = tbilisiYmd(now);
  const date = new Date(`${ymd}T00:00:00.000Z`);
  const id = crypto.randomUUID();
  const platform = meta.platform || null;
  const appVersion = meta.appVersion || null;
  const activityType = meta.activityType === 'open' || !meta.activityType ? 'open' : String(meta.activityType).slice(0, 24);
  try {
    await prisma.$executeRaw`
      INSERT INTO "AppActivity" ("id", "userId", "date", "firstAt", "lastAt", "platform", "appVersion", "activityType")
      VALUES (${id}, ${userId}, ${date}, ${now}, ${now}, ${platform}, ${appVersion}, ${activityType})
      ON CONFLICT ("userId", "date") DO UPDATE SET
        "lastAt" = EXCLUDED."lastAt",
        "activityType" = EXCLUDED."activityType",
        "platform" = COALESCE(EXCLUDED."platform", "AppActivity"."platform"),
        "appVersion" = COALESCE(EXCLUDED."appVersion", "AppActivity"."appVersion")
    `;
    void prisma.pushToken.updateMany({
      where: { userId, active: true },
      data: { lastSeenAt: now },
    }).catch(() => undefined);
    const row = { userId, date: ymd, platform, appVersion, activityType };
    import('./adminRealtime.js').then((mod) => mod.notifyOpsActivity(row)).catch(() => undefined);
    return row;
  } catch (error) {
    if (isMissingTable(error)) {
      tableReady = false;
      return null;
    }
    console.warn('[activity] upsert failed', error?.message);
    return null;
  }
}

export async function recordAppActivityFromRequest(req) {
  if (!req?.user?.id) return null;
  const body = req.body || {};
  return recordAppActivity(req.user.id, {
    ...clientMetaFromRequest(req, body),
    activityType: typeof body.activityType === 'string' ? body.activityType : undefined,
  });
}

export async function loadAppActivityRows(fromYmd, toYmd) {
  await ensureAppActivityTable();
  try {
    return await prisma.$queryRaw`
      SELECT "userId", "date", "firstAt", "lastAt", "platform", "appVersion", "activityType"
      FROM "AppActivity"
      WHERE "date" >= ${new Date(`${fromYmd}T00:00:00.000Z`)}
        AND "date" <= ${new Date(`${toYmd}T00:00:00.000Z`)}
    `;
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

export async function loadActiveUserIds(fromYmd, toYmd) {
  const rows = await loadAppActivityRows(fromYmd, toYmd);
  return [...new Set(rows.map((row) => row.userId))];
}

export async function loadLatestActivityMap(userIds) {
  const map = new Map();
  if (!userIds?.length) return map;
  await ensureAppActivityTable();
  try {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT ON ("userId") "userId", "date", "lastAt", "platform", "appVersion"
      FROM "AppActivity"
      WHERE "userId" = ANY(${userIds})
      ORDER BY "userId", "lastAt" DESC
    `;
    for (const row of rows) map.set(row.userId, row);
    return map;
  } catch (error) {
    if (isMissingTable(error)) return map;
    throw error;
  }
}

export async function loadLatestAppActivity(userId) {
  await ensureAppActivityTable();
  try {
    const rows = await prisma.$queryRaw`
      SELECT "date", "lastAt", "platform", "appVersion"
      FROM "AppActivity"
      WHERE "userId" = ${userId}
      ORDER BY "lastAt" DESC
      LIMIT 1
    `;
    return rows[0] || null;
  } catch (error) {
    if (isMissingTable(error)) return null;
    throw error;
  }
}

function isMissingTable(error) {
  return error?.code === 'P2010' || /does not exist/i.test(error?.message || '');
}
