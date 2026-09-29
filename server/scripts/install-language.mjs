// Additive only; adds User.language on the configured main database. Never resets data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

export const LANGUAGE_SQL_URL = new URL('../prisma/20260929-language.sql', import.meta.url);

/** The only allowed statement adds the nullable "language" column to "User". */
export function languageStatements(sql) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.some((s) => !/^ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT$/.test(s))) {
    throw new Error('Unexpected non-additive statement');
  }
  return statements;
}

if (/install-language.mjs$/.test(process.argv[1] || '')) {
  const db = new PrismaClient();
  try {
    const statements = languageStatements(await readFile(LANGUAGE_SQL_URL, 'utf8'));
    for (const statement of statements) await db.$executeRawUnsafe(statement);
    console.log('User.language installed. Existing data was not modified.');
  } finally {
    await db.$disconnect();
  }
}
