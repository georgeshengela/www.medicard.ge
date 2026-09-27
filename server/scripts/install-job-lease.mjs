// Additive only; installs the background-job lease table on the configured main database. Never resets data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
try {
  const sql = await readFile(new URL('../prisma/20260927-job-lease.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.some((s) => !/^CREATE TABLE IF NOT EXISTS "JobLease"/.test(s))) {
    throw new Error('Unexpected non-additive statement');
  }
  for (const statement of statements) await db.$executeRawUnsafe(statement);
  console.log('Job lease table installed. Existing data was not modified.');
} finally {
  await db.$disconnect();
}
