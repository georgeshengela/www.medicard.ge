// Additive only; installs the price-drop alert tables on the configured main database. Never resets data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
try {
  const sql = await readFile(new URL('../prisma/20260927-price-drop.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.some((s) => !/^CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS "(CatalogPriceHistory|PriceDropAlert)/.test(s))) {
    throw new Error('Unexpected non-additive statement');
  }
  await db.$transaction(async (tx) => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 30000 });
  console.log('Price-drop tables installed. Existing data was not modified.');
} finally {
  await db.$disconnect();
}
