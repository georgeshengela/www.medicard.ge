// Additive only; installs the Home sections table (admin #/home) on the configured main database.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { HOME_SECTIONS_SQL } from '../src/lib/homeSections.js';

if (!/^CREATE TABLE IF NOT EXISTS "HomeSectionConfig" \(/.test(HOME_SECTIONS_SQL.trim())) throw new Error('Unexpected non-additive statement');

const db = new PrismaClient();
try {
  await db.$executeRawUnsafe(HOME_SECTIONS_SQL);
  console.log('Home sections table installed. Existing data was not modified.');
} finally {
  await db.$disconnect();
}
