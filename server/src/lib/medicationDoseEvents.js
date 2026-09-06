import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { clipClientField } from './appVersion.js';

const STATUSES = new Set(['taken', 'skipped']);
const SOURCES = new Set(['app', 'notification']);

let tableReady = false;

/** Domain dose completion — no medication names. */
export async function ensureMedicationDoseEventTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MedicationDoseEvent" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "medicationId" TEXT NOT NULL,
      "date" TEXT NOT NULL,
      "time" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "source" TEXT NOT NULL,
      "occurredAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "MedicationDoseEvent_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "MedicationDoseEvent_user_med_date_time_key"
    ON "MedicationDoseEvent"("userId", "medicationId", "date", "time")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "MedicationDoseEvent_date_idx" ON "MedicationDoseEvent"("date")
  `);
  tableReady = true;
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function sanitizeDoseEventInput(row, userId) {
  const medicationId = clipClientField(row.medicationId, 80);
  const date = clipClientField(row.date, 10);
  const time = clipClientField(row.time, 8);
  const status = String(row.status || '').toLowerCase();
  const source = String(row.source || 'app').toLowerCase();
  if (!medicationId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!time || !/^\d{2}:\d{2}/.test(time)) return null;
  if (!STATUSES.has(status) || !SOURCES.has(source)) return null;
  return {
    userId,
    medicationId,
    date,
    time: time.slice(0, 5),
    status,
    source,
    occurredAt: toDate(row.occurredAt || row.updatedAt) || new Date(),
  };
}

export async function upsertMedicationDoseEvents(userId, rows) {
  await ensureMedicationDoseEventTable();
  const sanitized = (rows || []).map((row) => sanitizeDoseEventInput(row, userId)).filter(Boolean);
  let upserted = 0;
  for (const row of sanitized.slice(0, 40)) {
    const id = crypto.randomUUID();
    try {
      await prisma.$executeRaw`
        INSERT INTO "MedicationDoseEvent" (
          "id", "userId", "medicationId", "date", "time", "status", "source", "occurredAt"
        ) VALUES (
          ${id}, ${userId}, ${row.medicationId}, ${row.date}, ${row.time}, ${row.status}, ${row.source}, ${row.occurredAt}
        )
        ON CONFLICT ("userId", "medicationId", "date", "time") DO UPDATE SET
          "status" = EXCLUDED."status",
          "source" = EXCLUDED."source",
          "occurredAt" = EXCLUDED."occurredAt"
      `;
      upserted += 1;
    } catch (error) {
      console.warn('[dose-event] upsert failed', error?.message);
    }
  }
  return { upserted, received: sanitized.length };
}

export async function loadDoseEvents(fromYmd, toYmd) {
  await ensureMedicationDoseEventTable();
  try {
    return await prisma.$queryRaw`
      SELECT "userId", "date", "time", "status", "source", "occurredAt"
      FROM "MedicationDoseEvent"
      WHERE "date" >= ${fromYmd} AND "date" <= ${toYmd}
    `;
  } catch (error) {
    if (error?.code === 'P2010' || /does not exist/i.test(error?.message || '')) return [];
    throw error;
  }
}
