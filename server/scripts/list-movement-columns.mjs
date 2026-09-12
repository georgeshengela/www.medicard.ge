import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL;
const db = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
const rows = await db.$queryRawUnsafe(`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('WorldMovementSession', 'WorldMovementPreference')
  ORDER BY table_name, ordinal_position
`);
const names = rows.map((row) => `${row.table_name}.${row.column_name}`);
const leaked = names.filter((name) => /lat|lng|long|coord|route|polyline|token|sample/i.test(name));
console.log(names.join('\n'));
console.log('LEAKS', leaked.length ? leaked.join(',') : 'none');
await db.$disconnect();
