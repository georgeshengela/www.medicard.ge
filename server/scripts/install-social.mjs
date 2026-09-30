// Additive only; installs the social-media campaign log tables on the configured main database. Never resets data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

export const SOCIAL_SQL_URL = new URL('../prisma/20261001-social.sql', import.meta.url);

/** Every statement must be CREATE TABLE / INDEX IF NOT EXISTS on "SocialPost…". */
export function socialStatements(sql) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.some((s) => !/^CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS "SocialPost[A-Za-z_]*"/.test(s))) {
    throw new Error('Unexpected non-additive statement');
  }
  return statements;
}

if (/install-social.mjs$/.test(process.argv[1] || '')) {
  const db = new PrismaClient();
  try {
    const statements = socialStatements(await readFile(SOCIAL_SQL_URL, 'utf8'));
    await db.$transaction(async (tx) => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
    }, { timeout: 30000 });
    console.log('Social campaign tables installed. Existing data was not modified.');
  } finally {
    await db.$disconnect();
  }
}
