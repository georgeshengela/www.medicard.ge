// Additive only; installs the support inbox tables (SupportThread, SupportMessage, SupportSnippet)
// on the configured main database. Never changes or resets existing data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

export const SUPPORT_SQL_URL = new URL('../prisma/20260928-support.sql', import.meta.url);

const squash = (s) => s.replace(/\s+/g, ' ').trim();

/** Every statement must be CREATE TABLE / INDEX IF NOT EXISTS on a "Support*" table; no destructive keyword. */
export function supportStatements(sql) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map(squash).filter(Boolean);
  const ok = (s) => (/^CREATE TABLE IF NOT EXISTS "Support[A-Za-z]*" \(/.test(s)
      || /^CREATE (UNIQUE )?INDEX IF NOT EXISTS "Support[A-Za-z_]*" ON "Support[A-Za-z]*" ?\(/.test(s))
    && !/\b(DROP|DELETE|TRUNCATE|ALTER|UPDATE|INSERT|GRANT|REVOKE)\b/i.test(s.replace(/ ON DELETE (SET NULL|CASCADE)/g, ''));
  if (statements.some((s) => !ok(s))) throw new Error('Unexpected non-additive statement');
  return statements;
}

if (/install-support.mjs$/.test(process.argv[1] || '')) {
  const db = new PrismaClient();
  try {
    const statements = supportStatements(await readFile(SUPPORT_SQL_URL, 'utf8'));
    await db.$transaction(async (tx) => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
    }, { timeout: 30000 });
    console.log('Support inbox tables installed. Existing data was not modified.');
  } finally {
    await db.$disconnect();
  }
}
