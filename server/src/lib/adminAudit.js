import crypto from 'node:crypto';
import { prisma } from './prisma.js';

let tablesReady = false;

export async function ensureAdminAuditTable() {
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
      "id" TEXT NOT NULL,
      "adminId" TEXT,
      "adminEmail" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetId" TEXT,
      "previousValue" JSONB,
      "newValue" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId")
  `);
  tablesReady = true;
}

const SECRET_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'jwt',
  'secret',
  'apiKey',
  'authorization',
]);

function scrub(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.slice(0, 40).map(scrub);
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEYS.has(key) || /password|secret|token|key/i.test(key)) {
      out[key] = '[redacted]';
    } else {
      out[key] = scrub(item);
    }
  }
  return out;
}

export async function writeAdminAudit({ admin, action, targetType, targetId, previousValue, newValue }) {
  try {
    await ensureAdminAuditTable();
    const id = crypto.randomUUID();
    const email = String(admin?.email || 'unknown').slice(0, 160);
    await prisma.$executeRaw`
      INSERT INTO "AdminAuditLog" (
        "id", "adminId", "adminEmail", "action", "targetType", "targetId",
        "previousValue", "newValue", "createdAt"
      ) VALUES (
        ${id},
        ${admin?.id || null},
        ${email},
        ${String(action).slice(0, 80)},
        ${String(targetType).slice(0, 80)},
        ${targetId ? String(targetId).slice(0, 80) : null},
        ${JSON.stringify(scrub(previousValue))}::jsonb,
        ${JSON.stringify(scrub(newValue))}::jsonb,
        CURRENT_TIMESTAMP
      )
    `;
  } catch (error) {
    console.warn('[admin-audit] write failed', error?.message);
  }
}

export async function listAdminAudit({ limit = 50, offset = 0, action, q, targetId } = {}) {
  await ensureAdminAuditTable();
  const take = Math.min(Number(limit) || 50, 200);
  const skip = Math.max(Number(offset) || 0, 0);
  const clauses = ['1=1'];
  const params = [];
  let i = 1;
  if (action) {
    clauses.push(`"action" = $${i}`);
    params.push(action);
    i += 1;
  }
  if (targetId) {
    clauses.push(`"targetId" = $${i}`);
    params.push(String(targetId));
    i += 1;
  }
  if (q) {
    clauses.push(`("adminEmail" ILIKE $${i} OR "targetId" ILIKE $${i} OR "action" ILIKE $${i})`);
    params.push(`%${q}%`);
    i += 1;
  }
  const where = clauses.join(' AND ');
  try {
    const totalRows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "AdminAuditLog" WHERE ${where}`,
      ...params,
    );
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "AdminAuditLog" WHERE ${where} ORDER BY "createdAt" DESC LIMIT ${take} OFFSET ${skip}`,
      ...params,
    );
    return { total: totalRows[0]?.count ?? 0, entries: rows || [] };
  } catch (error) {
    if (/does not exist/i.test(error?.message || '')) return { total: 0, entries: [] };
    throw error;
  }
}
