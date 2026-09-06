import { prisma } from './prisma.js';
import { clipClientField } from './appVersion.js';
import { upsertProductEvents } from './productEvents.js';

export const PERMISSION_STATES = new Set(['enabled', 'disabled', 'provisional', 'unknown']);

let tableReady = false;

export async function ensureNotificationPermissionTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NotificationPermission" (
      "userId" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "platform" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "NotificationPermission_pkey" PRIMARY KEY ("userId")
    )
  `);
  tableReady = true;
}

export function sanitizePermissionStatus(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'granted' || value === 'authorized') return 'enabled';
  if (value === 'denied' || value === 'blocked') return 'disabled';
  if (value === 'limited' || value === 'provisional' || value === 'ephemeral') return 'provisional';
  if (PERMISSION_STATES.has(value)) return value;
  return null;
}

export async function upsertNotificationPermission(userId, body = {}, meta = {}) {
  await ensureNotificationPermissionTable();
  const status = sanitizePermissionStatus(body.status);
  if (!status) return { ok: false, changed: false };
  const platform = ['ios', 'android', 'web'].includes(body.platform || meta.platform)
    ? (body.platform || meta.platform)
    : null;
  const now = new Date();
  let previous = null;
  try {
    const rows = await prisma.$queryRaw`
      SELECT "status" FROM "NotificationPermission" WHERE "userId" = ${userId} LIMIT 1
    `;
    previous = rows[0]?.status || null;
    await prisma.$executeRaw`
      INSERT INTO "NotificationPermission" ("userId", "status", "platform", "updatedAt")
      VALUES (${userId}, ${status}, ${platform}, ${now})
      ON CONFLICT ("userId") DO UPDATE SET
        "status" = EXCLUDED."status",
        "platform" = COALESCE(EXCLUDED."platform", "NotificationPermission"."platform"),
        "updatedAt" = EXCLUDED."updatedAt"
    `;
  } catch (error) {
    console.warn('[permission] upsert failed', error?.message);
    return { ok: false, changed: false };
  }
  const changed = previous !== status;
  if (changed) {
    await upsertProductEvents(userId, [{
      kind: 'notification_permission',
      category: status,
      entityId: `${userId}:${now.toISOString().slice(0, 16)}`,
      occurredAt: now.toISOString(),
    }], meta);
  }
  return { ok: true, changed, status, previous };
}

export async function loadPermissionRows() {
  await ensureNotificationPermissionTable();
  try {
    return await prisma.$queryRaw`
      SELECT "userId", "status", "platform", "updatedAt" FROM "NotificationPermission"
    `;
  } catch (error) {
    if (error?.code === 'P2010' || /does not exist/i.test(error?.message || '')) return [];
    return [];
  }
}

export async function loadPermissionForUser(userId) {
  await ensureNotificationPermissionTable();
  try {
    const rows = await prisma.$queryRaw`
      SELECT "status", "platform", "updatedAt" FROM "NotificationPermission"
      WHERE "userId" = ${userId} LIMIT 1
    `;
    return rows[0] || null;
  } catch {
    return null;
  }
}

export function clipPermissionNote(value) {
  return clipClientField(value, 40);
}
