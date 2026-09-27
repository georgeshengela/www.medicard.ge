// Additive only; installs the email tables and the two User consent columns on the configured
// main database. Never resets data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

export const EMAIL_SQL_URL = new URL('../prisma/20260928-email.sql', import.meta.url);

/** The only statements allowed outside the Email* tables — exactly these two columns. */
export const ALLOWED_USER_COLUMNS = Object.freeze([
  'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailMarketingOptIn" BOOLEAN NOT NULL DEFAULT false',
  'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailMarketingOptInAt" TIMESTAMP(3)',
]);

const squash = (s) => s.replace(/\s+/g, ' ').trim();

/** Every statement must be CREATE TABLE / INDEX IF NOT EXISTS on an "Email*" name, or one of ALLOWED_USER_COLUMNS. */
export function emailStatements(sql) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map(squash).filter(Boolean);
  const ok = (s) => /^CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS "Email[A-Za-z_]*"/.test(s)
    || ALLOWED_USER_COLUMNS.includes(s);
  if (statements.some((s) => !ok(s))) throw new Error('Unexpected non-additive statement');
  return statements;
}

if (/install-email.mjs$/.test(process.argv[1] || '')) {
  const db = new PrismaClient();
  try {
    const statements = emailStatements(await readFile(EMAIL_SQL_URL, 'utf8'));
    await db.$transaction(async (tx) => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
    }, { timeout: 30000 });
    console.log('Email tables installed. Existing data was not modified.');
  } finally {
    await db.$disconnect();
  }
}
