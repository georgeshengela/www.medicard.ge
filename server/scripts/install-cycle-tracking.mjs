// Additive only; adds CycleProfile."expectsBleeding" and CycleProfile."fertilityDisplay" on the configured
// main database (defaults = today's behaviour). Never resets data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

export const CYCLE_TRACKING_SQL_URL = new URL('../prisma/20261003-cycle-tracking.sql', import.meta.url);

const ALLOWED = [
  /^ALTER TABLE "CycleProfile" ADD COLUMN IF NOT EXISTS "expectsBleeding" BOOLEAN NOT NULL DEFAULT true$/,
  /^ALTER TABLE "CycleProfile" ADD COLUMN IF NOT EXISTS "fertilityDisplay" TEXT NOT NULL DEFAULT 'auto'$/,
];

/** The only allowed statements add the two defaulted columns to "CycleProfile". */
export function cycleTrackingStatements(sql) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.some((s) => !ALLOWED.some((re) => re.test(s)))) {
    throw new Error('Unexpected non-additive statement');
  }
  return statements;
}

if (/install-cycle-tracking.mjs$/.test(process.argv[1] || '')) {
  const db = new PrismaClient();
  try {
    const statements = cycleTrackingStatements(await readFile(CYCLE_TRACKING_SQL_URL, 'utf8'));
    for (const statement of statements) await db.$executeRawUnsafe(statement);
    console.log('CycleProfile tracking preferences installed. Existing data was not modified.');
  } finally {
    await db.$disconnect();
  }
}
