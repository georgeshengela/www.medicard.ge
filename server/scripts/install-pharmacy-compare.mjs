// Additive only; adds the pharmacy-compare v2 columns on the configured main database. Never resets data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
try {
  const sql = await readFile(new URL('../prisma/20261013-pharmacy-compare.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  const allowed = /^(ALTER TABLE "(PharmacyOffer|CatalogProduct)" ADD COLUMN IF NOT EXISTS |CREATE INDEX IF NOT EXISTS "CatalogProduct_)/;
  if (statements.some((s) => !allowed.test(s))) throw new Error('Unexpected non-additive statement');
  await db.$transaction(async (tx) => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 60000 });
  console.log('Pharmacy compare columns installed. Existing data was not modified.');
} finally {
  await db.$disconnect();
}
