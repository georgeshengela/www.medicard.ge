// Additive only: installs the MEDIBOOK stock-room schema (server/prisma/20261016-medibook-3.sql) on the configured
// main database. Allowed: CREATE … IF NOT EXISTS, ALTER TABLE … ADD COLUMN IF NOT EXISTS on Book* tables, and the
// one widened CHECK on BookStockMove.reason (dropped and re-added by its name, so a re-run is a no-op for rows).
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
try {
  const sql = await readFile(new URL('../prisma/20261016-medibook-3.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  const allowed = /^(CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS "Book\w+"|ALTER TABLE "Book\w+" ADD COLUMN IF NOT EXISTS|ALTER TABLE "BookStockMove" DROP CONSTRAINT IF EXISTS "BookStockMove_reason_check"$|ALTER TABLE "BookStockMove" ADD CONSTRAINT "BookStockMove_reason_check" CHECK \(reason IN \()/;
  const bad = statements.find((s) => !allowed.test(s));
  if (bad) throw new Error(`Unexpected non-additive statement: ${bad.slice(0, 80)}`);
  await db.$transaction(async (tx) => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 60000 });
  console.log(`MEDIBOOK wave 3 (stock room): ${statements.length} statement(s) applied; existing data untouched.`);
} finally {
  await db.$disconnect();
}
