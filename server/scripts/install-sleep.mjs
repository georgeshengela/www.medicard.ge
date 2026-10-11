// Additive only; installs the MEDISLEEP tables on the configured main database and adds missing starter advice.
// Never resets data: a tip the admin edited, hid or archived stays as it is.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

export const SLEEP_SQL_URL = new URL('../prisma/20261012-sleep.sql', import.meta.url);

/** Every statement must be CREATE TABLE / INDEX IF NOT EXISTS on a "Sleep*" table. */
export function sleepStatements(sql) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.some((s) => !/^CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS "Sleep[A-Za-z_]*"/.test(s))) {
    throw new Error('Unexpected non-additive statement');
  }
  return statements;
}

if (/install-sleep.mjs$/.test(process.argv[1] || '')) {
  const db = new PrismaClient();
  try {
    const statements = sleepStatements(await readFile(SLEEP_SQL_URL, 'utf8'));
    await db.$transaction(async (tx) => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
    }, { timeout: 30000 });
    const { seedSleepTips } = await import('../src/lib/sleepStore.js');
    const added = await seedSleepTips(db);
    console.log(`MEDISLEEP tables installed; ${added} starter tips added. Existing data was not modified.`);
  } finally {
    await db.$disconnect();
  }
}
