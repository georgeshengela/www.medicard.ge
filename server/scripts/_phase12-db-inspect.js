import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const migrations = await prisma.$queryRawUnsafe(
    "SELECT to_regclass('public._prisma_migrations')::text AS table",
  );
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CycleLog'
    ORDER BY ordinal_position
  `);
  const names = cols.map((c) => c.column_name);
  const hasObs = names.includes('observations');
  const hasVer = names.includes('observationSchemaVersion');
  const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "CycleLog"`);
  let sample = [];
  if (hasObs && hasVer) {
    sample = await prisma.$queryRawUnsafe(`
      SELECT id, date, flow,
             observations IS NULL AS obs_null,
             observations,
             "observationSchemaVersion"
      FROM "CycleLog"
      ORDER BY "createdAt" ASC
      LIMIT 3
    `);
  } else {
    sample = await prisma.$queryRawUnsafe(`
      SELECT id, date, flow, symptoms, "painEntries"
      FROM "CycleLog"
      ORDER BY "createdAt" ASC
      LIMIT 3
    `);
  }
  console.log(JSON.stringify({ migrations, hasObs, hasVer, names, cols, count, sample }, null, 2));
} finally {
  await prisma.$disconnect();
}
