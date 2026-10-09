// Additive only; adds User.passwordChangedAt on the configured main database. Never resets data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

export const PASSWORD_CHANGED_SQL_URL = new URL('../prisma/20261008-password-changed.sql', import.meta.url);

/** The only allowed statement adds the nullable "passwordChangedAt" column to "User". */
export function passwordChangedStatements(sql) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.some((s) => !/^ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMPTZ$/.test(s))) {
    throw new Error('Unexpected non-additive statement');
  }
  return statements;
}

if (/install-password-changed.mjs$/.test(process.argv[1] || '')) {
  const db = new PrismaClient();
  try {
    const statements = passwordChangedStatements(await readFile(PASSWORD_CHANGED_SQL_URL, 'utf8'));
    for (const statement of statements) await db.$executeRawUnsafe(statement);
    console.log('User.passwordChangedAt installed. Existing data was not modified.');
  } finally {
    await db.$disconnect();
  }
}
