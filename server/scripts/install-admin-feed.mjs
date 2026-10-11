// Additive only: time-column indexes for the admin live feed (prisma/20261011-admin-feed.sql). Never changes data.
// A table this database does not have yet (raw-SQL modules install themselves later) is skipped, not an error.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

export const ADMIN_FEED_SQL_URL = new URL('../prisma/20261011-admin-feed.sql', import.meta.url);

/** Every statement must be CREATE INDEX IF NOT EXISTS "…_feed_idx". */
export function adminFeedStatements(sql) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.some((s) => !/^CREATE INDEX IF NOT EXISTS "[A-Za-z]+_[A-Za-z]+_feed_idx" ON "[A-Za-z]+" \("[A-Za-z]+"\)$/.test(s))) {
    throw new Error('Unexpected non-additive statement');
  }
  return statements;
}

if (/install-admin-feed.mjs$/.test(process.argv[1] || '')) {
  const db = new PrismaClient();
  try {
    let made = 0;
    for (const statement of adminFeedStatements(await readFile(ADMIN_FEED_SQL_URL, 'utf8'))) {
      try {
        await db.$executeRawUnsafe(statement);
        made += 1;
      } catch (error) {
        if (!/does not exist|42P01/.test(String(error?.message || ''))) throw error;
        console.log(`Skipped (table not installed yet): ${statement.match(/ON "([^"]+)"/)?.[1]}`);
      }
    }
    console.log(`Admin feed indexes ready (${made}). Existing data was not modified.`);
  } finally {
    await db.$disconnect();
  }
}
