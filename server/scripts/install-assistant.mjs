// Additive and idempotent. Never changes accounts, health records or existing receipts.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
const prisma = new PrismaClient();
try {
  const sql = readFileSync(new URL('../prisma/migrations/20260920010000_medi_assistant_operations/migration.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/^--[^\n]*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
  if (statements.length !== 2 || !/^CREATE TABLE IF NOT EXISTS "AssistantOperation"/.test(statements[0]) || !/^CREATE INDEX IF NOT EXISTS "AssistantOperation_userId_createdAt_idx"/.test(statements[1])) throw new Error('Unexpected assistant migration; review before deployment.');
  await prisma.$transaction(async tx => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 60000 });
  console.log('Assistant operation schema ready; existing receipts preserved.');
} finally { await prisma.$disconnect(); }
