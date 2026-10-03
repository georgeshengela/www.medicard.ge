// Additive only; adds CycleProfile."hiddenCycles" (JSONB, default '[]' = nothing hidden) on the configured
// main database. Never resets data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

export const CYCLE_HIDDEN_CYCLES_SQL_URL = new URL('../prisma/20261004-cycle-hidden-cycles.sql', import.meta.url);

const ALLOWED = [
  /^ALTER TABLE "CycleProfile" ADD COLUMN IF NOT EXISTS "hiddenCycles" JSONB NOT NULL DEFAULT '\[\]'::jsonb$/,
];

/** The only allowed statement adds the defaulted column to "CycleProfile". */
export function cycleHiddenCyclesStatements(sql) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.some((s) => !ALLOWED.some((re) => re.test(s)))) {
    throw new Error('Unexpected non-additive statement');
  }
  return statements;
}

if (/install-cycle-hidden-cycles.mjs$/.test(process.argv[1] || '')) {
  const db = new PrismaClient();
  try {
    const statements = cycleHiddenCyclesStatements(await readFile(CYCLE_HIDDEN_CYCLES_SQL_URL, 'utf8'));
    for (const statement of statements) await db.$executeRawUnsafe(statement);
    console.log('CycleProfile hidden cycles installed. Existing data was not modified.');
  } finally {
    await db.$disconnect();
  }
}
