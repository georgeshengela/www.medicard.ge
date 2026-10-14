// Additive only; installs the App Store chart history table (admin home „ახლა აპში“ card) on the configured main database.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { APP_STORE_RANK_SQL } from '../src/lib/appStoreRank.js';

if (!/^CREATE TABLE IF NOT EXISTS "AppStoreRankSample" \(/.test(APP_STORE_RANK_SQL.trim())) throw new Error('Unexpected non-additive statement');

const db = new PrismaClient();
try {
  await db.$executeRawUnsafe(APP_STORE_RANK_SQL);
  console.log('App Store chart history table installed. Existing data was not modified.');
} finally {
  await db.$disconnect();
}
