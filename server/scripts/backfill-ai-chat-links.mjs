#!/usr/bin/env node
/**
 * One-time fix (2026-10-08): the first question of a new Medi chat was logged without its chat id,
 * because the chat is created only after the answer. Links those AiInteraction rows to the chat
 * that was created with them (same person and mode, created within 10 s, first message = the question).
 *
 *   node scripts/backfill-ai-chat-links.mjs          # dry run: prints what would be linked
 *   node scripts/backfill-ai-chat-links.mjs --apply  # writes chatSessionId (only where it is empty)
 */
import { fileURLToPath } from 'node:url';

const dotenv = await import('dotenv');
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const { prisma } = await import('../src/lib/prisma.js');

const apply = process.argv.includes('--apply');

const rows = await prisma.$queryRawUnsafe(`
  SELECT a.id, s.id AS "sessionId"
  FROM "AiInteraction" a
  JOIN LATERAL (
    SELECT s.id FROM "ChatSession" s
    WHERE s."userId" = a."userId" AND s.mode = a.mode
      AND s."createdAt" BETWEEN a."createdAt" - interval '10 seconds' AND a."createdAt" + interval '10 seconds'
      AND jsonb_typeof(s.messages::jsonb) = 'array'
      AND s.messages::jsonb -> 0 ->> 'content' = a."userPrompt"
    ORDER BY abs(extract(epoch FROM s."createdAt" - a."createdAt")) LIMIT 1
  ) s ON true
  WHERE a."chatSessionId" IS NULL AND a.status = 'OK' AND a."userPrompt" IS NOT NULL`);

console.log(`${rows.length} first questions can be linked to their chat${apply ? '' : ' (dry run)'}`);
if (apply) {
  let linked = 0;
  for (const r of rows) {
    const { count } = await prisma.aiInteraction.updateMany({
      where: { id: r.id, chatSessionId: null },
      data: { chatSessionId: r.sessionId },
    });
    linked += count;
  }
  console.log(`linked ${linked}`);
}
await prisma.$disconnect();
