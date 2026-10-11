// Additive only; installs the Notification Brain admin control table (Push → Brain „მართვა“) on the configured main database.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { NOTIFICATION_BRAIN_CONFIG_SQL } from '../src/lib/notificationBrainConfig.js';

if (!/^CREATE TABLE IF NOT EXISTS "NotificationBrainConfig" \(/.test(NOTIFICATION_BRAIN_CONFIG_SQL.trim())) throw new Error('Unexpected non-additive statement');

const db = new PrismaClient();
try {
  await db.$executeRawUnsafe(NOTIFICATION_BRAIN_CONFIG_SQL);
  console.log('Notification Brain config table installed. Existing data was not modified.');
} finally {
  await db.$disconnect();
}
