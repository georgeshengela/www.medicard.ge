// Additive only; installs the MEDICOACH tables on the configured main database and adds any gym from
// server/src/data/gyms-ge.json that is not there yet. Existing rows (including admin edits) are never
// changed or deleted.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { gymRowsFromDirectory } from '../src/lib/gyms.js';

const TABLES = 'Gym|TrainerProfile|TrainerLink|TrainerSession|TrainerMealPlan|ProgressPhoto|WorkoutLog';
const db = new PrismaClient();
try {
  const sql = await readFile(new URL('../prisma/20260928-trainer.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  const allowed = new RegExp(`^CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS "(${TABLES})`);
  if (statements.some((s) => !allowed.test(s))) throw new Error('Unexpected non-additive statement');
  const directory = JSON.parse(await readFile(new URL('../src/data/gyms-ge.json', import.meta.url), 'utf8'));
  const gyms = gymRowsFromDirectory(directory);
  let added = 0;
  await db.$transaction(async (tx) => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
    for (const g of gyms) {
      added += await tx.$executeRaw`INSERT INTO "Gym" (id, brand, "brandKa", name, "nameKa", city, district, address, website, instagram, source, status)
        VALUES (${g.id}, ${g.brand}, ${g.brandKa}, ${g.name}, ${g.nameKa}, ${g.city}, ${g.district}, ${g.address}, ${g.website}, ${g.instagram}, ${g.source}, ${g.status})
        ON CONFLICT (id) DO NOTHING`;
    }
  }, { timeout: 60000 });
  console.log(`Trainer tables installed; ${added} new gym(s) added of ${gyms.length}. Existing data was not modified.`);
} finally {
  await db.$disconnect();
}
