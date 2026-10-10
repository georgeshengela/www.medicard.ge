// Additive only; installs the soft update prompt table (admin „სთხოვე განახლება“) on the configured main database.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { UPDATE_PROMPT_SQL } from '../src/lib/updatePrompt.js';

if (!/^CREATE TABLE IF NOT EXISTS "UpdatePrompt" \(/.test(UPDATE_PROMPT_SQL.trim())) throw new Error('Unexpected non-additive statement');

const db = new PrismaClient();
try {
  await db.$executeRawUnsafe(UPDATE_PROMPT_SQL);
  console.log('Update prompt table installed. Existing data was not modified.');
} finally {
  await db.$disconnect();
}
