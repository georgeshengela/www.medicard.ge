// Additive only; installs the app icon table (admin #/app-icons „აპის აიქონები“) on the configured main database.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { APP_ICON_SQL } from '../src/lib/appIcons.js';

if (!/^CREATE TABLE IF NOT EXISTS "AppIconChoice" \(/.test(APP_ICON_SQL.trim())) throw new Error('Unexpected non-additive statement');

const db = new PrismaClient();
try {
  await db.$executeRawUnsafe(APP_ICON_SQL);
  console.log('App icon table installed. Existing data was not modified.');
} finally {
  await db.$disconnect();
}
