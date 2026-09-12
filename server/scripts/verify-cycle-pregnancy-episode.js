import { prisma } from '../src/lib/prisma.js';

const table = await prisma.$queryRawUnsafe(
  `SELECT to_regclass('public."CyclePregnancyEpisode"')::text AS table_name`,
);
const indexes = await prisma.$queryRawUnsafe(
  `SELECT indexname FROM pg_indexes WHERE tablename = 'CyclePregnancyEpisode' ORDER BY indexname`,
);
const fk = await prisma.$queryRawUnsafe(
  `SELECT conname FROM pg_constraint WHERE conname = 'CyclePregnancyEpisode_userId_fkey'`,
);
console.log(JSON.stringify({ table, indexes, fk }, null, 2));
await prisma.$disconnect();
