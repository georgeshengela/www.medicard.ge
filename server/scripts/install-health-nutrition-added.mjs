// Additive only; adds HealthMetricDaily.nutritionKcalAdded on the configured main database. Never resets data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

export const NUTRITION_ADDED_SQL_URL = new URL('../prisma/20261011-health-nutrition-added.sql', import.meta.url);

/** The only allowed statement adds the nullable "nutritionKcalAdded" column to "HealthMetricDaily". */
export function nutritionAddedStatements(sql) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  if (statements.some((s) => !/^ALTER TABLE "HealthMetricDaily" ADD COLUMN IF NOT EXISTS "nutritionKcalAdded" DOUBLE PRECISION$/.test(s))) {
    throw new Error('Unexpected non-additive statement');
  }
  return statements;
}

if (/install-health-nutrition-added.mjs$/.test(process.argv[1] || '')) {
  const db = new PrismaClient();
  try {
    const statements = nutritionAddedStatements(await readFile(NUTRITION_ADDED_SQL_URL, 'utf8'));
    for (const statement of statements) await db.$executeRawUnsafe(statement);
    console.log('HealthMetricDaily.nutritionKcalAdded installed. Existing data was not modified.');
  } finally {
    await db.$disconnect();
  }
}
