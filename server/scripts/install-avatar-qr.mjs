// Additive only; installs photo avatars and personal QR tables. Runs after install-trainer (adds a
// TrainerLink column). Never resets data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
try {
  const sql = await readFile(new URL('../prisma/20260928-avatar-qr.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  const ok = (s) => /^CREATE (TABLE|UNIQUE INDEX|INDEX) IF NOT EXISTS "(UserAvatar|UserQr)/.test(s) || /^ALTER TABLE "TrainerLink" ADD COLUMN IF NOT EXISTS initiator TEXT NOT NULL DEFAULT 'CLIENT'$/.test(s);
  if (statements.some((s) => !ok(s))) throw new Error('Unexpected non-additive statement');
  await db.$transaction(async (tx) => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 30000 });
  console.log('Avatar and QR tables installed. Existing data was not modified.');
} finally {
  await db.$disconnect();
}
