// Additive only; adds SupportMessage.smtpMessageId (+ index) on the configured main database. Never resets data.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

export const SUPPORT_SMTP_ID_SQL_URL = new URL('../prisma/20261012-support-smtp-id.sql', import.meta.url);

const ALLOWED = [
  /^ALTER TABLE "SupportMessage" ADD COLUMN IF NOT EXISTS "smtpMessageId" TEXT$/,
  /^CREATE INDEX IF NOT EXISTS "SupportMessage_smtpMessageId_idx" ON "SupportMessage"\("smtpMessageId"\)$/,
];

/** Only the nullable "smtpMessageId" column on "SupportMessage" and its index. */
export function supportSmtpIdStatements(sql) {
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!statements.length || statements.some((s) => !ALLOWED.some((re) => re.test(s)))) throw new Error('Unexpected non-additive statement');
  return statements;
}

if (/install-support-smtp-id.mjs$/.test(process.argv[1] || '')) {
  const db = new PrismaClient();
  try {
    const statements = supportSmtpIdStatements(await readFile(SUPPORT_SMTP_ID_SQL_URL, 'utf8'));
    for (const statement of statements) await db.$executeRawUnsafe(statement);
    console.log('SupportMessage.smtpMessageId installed. Existing data was not modified.');
  } finally {
    await db.$disconnect();
  }
}
