// Additive only: installs the MEDIBOOK group-classes schema (server/prisma/20261016-medibook-6.sql) on the configured
// main database. Allowed: CREATE … IF NOT EXISTS, ALTER TABLE … ADD COLUMN IF NOT EXISTS on Book* tables.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
try {
  const sql = await readFile(new URL('../prisma/20261016-medibook-6.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  const allowed = /^(CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS "Book\w+"|ALTER TABLE "Book\w+" ADD COLUMN IF NOT EXISTS)/;
  const bad = statements.find((s) => !allowed.test(s));
  if (bad) throw new Error(`Unexpected non-additive statement: ${bad.slice(0, 80)}`);
  await db.$transaction(async (tx) => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 60000 });
  console.log(`MEDIBOOK wave 6 (group classes): ${statements.length} statement(s) applied; existing data untouched.`);
} finally {
  await db.$disconnect();
}
