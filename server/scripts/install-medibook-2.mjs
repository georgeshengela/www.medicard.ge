// Additive only: installs the second-wave MEDIBOOK tables (server/prisma/20261016-medibook-2.sql) on the
// configured main database. Only CREATE … IF NOT EXISTS and ALTER TABLE … ADD COLUMN IF NOT EXISTS on
// Book* tables are allowed, so a re-run never touches existing rows.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
try {
  const sql = await readFile(new URL('../prisma/20261016-medibook-2.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  const allowed = /^(CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS "Book\w+"|ALTER TABLE "Book\w+" ADD COLUMN IF NOT EXISTS)/;
  const bad = statements.find((s) => !allowed.test(s));
  if (bad) throw new Error(`Unexpected non-additive statement: ${bad.slice(0, 80)}`);
  await db.$transaction(async (tx) => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 60000 });
  console.log(`MEDIBOOK wave 2: ${statements.length} statement(s) applied; existing data untouched.`);
} finally {
  await db.$disconnect();
}
