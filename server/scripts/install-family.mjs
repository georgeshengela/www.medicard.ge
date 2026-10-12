// Additive only; installs the MEDIFAMILY tables on the configured main database. Existing rows are never
// changed or deleted.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const TABLES = 'FamilyMember|FamilyAccess|FamilyHealthItem|FamilyVaccineDose|FamilyMeasurement|FamilyLog|FamilyFoodIntro|FamilyMilestone|FamilyChatSession|FamilyChatMessage';
const db = new PrismaClient();
try {
  const sql = await readFile(new URL('../prisma/20261012-family.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  const allowed = new RegExp(`^CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS "(${TABLES})`);
  if (statements.some((s) => !allowed.test(s))) throw new Error('Unexpected non-additive statement');
  await db.$transaction(async (tx) => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 60000 });
  console.log(`MEDIFAMILY tables installed (${statements.length} statements). Existing data was not modified.`);
} finally {
  await db.$disconnect();
}
