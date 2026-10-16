// Additive only: installs the influencer referral program tables (server/prisma/20261016-influencers.sql) on the
// configured main database. Allowed: CREATE TABLE / INDEX / UNIQUE INDEX IF NOT EXISTS on Influencer* tables.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
try {
  const sql = await readFile(new URL('../prisma/20261016-influencers.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  const allowed = /^CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS "Influencer\w*"/;
  const bad = statements.find((s) => !allowed.test(s));
  if (bad) throw new Error(`Unexpected non-additive statement: ${bad.slice(0, 80)}`);
  await db.$transaction(async (tx) => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 60000 });
  console.log(`Influencer program: ${statements.length} statement(s) applied; existing data untouched.`);
} finally {
  await db.$disconnect();
}
