import { PrismaClient } from '@prisma/client';

const url = process.env.PHASE38_TEST_DATABASE_URL;
if (!url) {
  console.error('BLOCKED: PHASE38_TEST_DATABASE_URL is not set');
  process.exit(2);
}

const prisma = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
try {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('MediWorldProfile','MediWorldLedger')
    ORDER BY table_name
  `);
  const checks = await prisma.$queryRawUnsafe(`
    SELECT conrelid::regclass::text AS table, conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid::regclass::text IN ('"MediWorldProfile"','"MediWorldLedger"')
      AND contype IN ('c','f','u','p')
    ORDER BY 1, 2
  `);
  const indexes = await prisma.$queryRawUnsafe(`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE schemaname='public' AND tablename IN ('MediWorldProfile','MediWorldLedger')
    ORDER BY tablename, indexname
  `);
  const cols = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('MediWorldProfile','MediWorldLedger')
    ORDER BY table_name, ordinal_position
  `);
  console.log(JSON.stringify({
    hostCategory: 'localhost',
    databaseName: 'medicard_phase38',
    schema: 'public',
    environmentMode: 'disposable-local-cluster',
    tables: tables.map((r) => r.table_name),
    columns: cols.map((r) => `${r.table_name}.${r.column_name}:${r.data_type}`),
    constraints: checks,
    indexes,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
