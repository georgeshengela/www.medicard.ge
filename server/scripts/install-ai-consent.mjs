// Additive, idempotent release migration. Does not grant consent or change accounts.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
const prisma = new PrismaClient();
try {
  const sql = readFileSync(new URL('../prisma/20260920-ai-consent.sql', import.meta.url), 'utf8');
  const statements = sql.split(/;\s*(?=\r?\n|$)/).map(s => s.replace(/^--[^\n]*\n/gm, '').trim()).filter(s => s && s !== 'BEGIN' && s !== 'COMMIT');
  await prisma.$transaction(async tx => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 60000 });
  console.log('AI consent schema ready; existing decisions preserved.');
} finally { await prisma.$disconnect(); }
