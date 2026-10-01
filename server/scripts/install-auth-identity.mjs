// Additive only; installs the Apple / Google sign-in table on the configured main database. Never resets data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

export const AUTH_IDENTITY_SQL_URL = new URL('../prisma/20261001-auth-identity.sql', import.meta.url);

/** Every statement must be CREATE TABLE / INDEX IF NOT EXISTS on "AuthIdentity". */
export function authIdentityStatements(sql) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.some((s) => !/^CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS "AuthIdentity[A-Za-z_]*"/.test(s))) {
    throw new Error('Unexpected non-additive statement');
  }
  return statements;
}

if (/install-auth-identity.mjs$/.test(process.argv[1] || '')) {
  const db = new PrismaClient();
  try {
    const statements = authIdentityStatements(await readFile(AUTH_IDENTITY_SQL_URL, 'utf8'));
    await db.$transaction(async (tx) => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
    }, { timeout: 30000 });
    console.log('Sign-in identity table installed. Existing data was not modified.');
  } finally {
    await db.$disconnect();
  }
}
