// Records the social-media campaign in the main database (tables "SocialPost" / "SocialPostEvent" only,
// additive writes). This is how the operator logs what it scheduled in Metricool; admin #/social reads it.
//
//   node server/scripts/social-log.mjs upsert <posts.json>    create/update posts by slot
//   node server/scripts/social-log.mjs status <status.json>   record SCHEDULED / PUBLISHED / FAILED / CANCELED
//   add --check to validate the file without touching the database.
//
// The file holds one object, an array, or { "posts": [...] }. See src/lib/socialPosts.js for fields.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseSocialLogFile(text) {
  let data;
  try {
    data = JSON.parse(String(text).replace(/^﻿/, ''));
  } catch (error) {
    throw new Error(`file is not valid JSON: ${error.message}`);
  }
  const items = Array.isArray(data) ? data : Array.isArray(data?.posts) ? data.posts : [data];
  if (!items.length || items.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('file is empty or holds something other than objects');
  }
  return items;
}

async function main(argv) {
  const [mode, file] = argv.filter((a) => !a.startsWith('--'));
  const check = argv.includes('--check');
  if (!['upsert', 'status'].includes(mode) || !file) {
    console.error('usage: node server/scripts/social-log.mjs upsert|status <file.json> [--check]');
    return 2;
  }
  const items = parseSocialLogFile(await readFile(resolve(process.cwd(), file), 'utf8'));
  const lib = await import('../src/lib/socialPosts.js');

  if (check) {
    let bad = 0;
    for (const [i, item] of items.entries()) {
      try {
        if (mode === 'upsert') lib.normalizePostInput(item, { create: true });
        else {
          lib.normalizeSlot(item.slot);
          if (!lib.SOCIAL_STATUSES.includes(String(item.status || '').toUpperCase())) throw new Error(`status must be one of ${lib.SOCIAL_STATUSES.join(', ')}`);
        }
        console.log(`ok     #${i + 1} ${item.slot}`);
      } catch (error) {
        bad += 1;
        console.error(`error  #${i + 1} ${item?.slot ?? '?'}: ${error.message}`);
      }
    }
    console.log(`${items.length - bad}/${items.length} valid (nothing written).`);
    return bad ? 1 : 0;
  }

  const dotenv = await import('dotenv');
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();
  let failed = 0;
  try {
    for (const [i, item] of items.entries()) {
      try {
        if (mode === 'upsert') {
          const r = await lib.upsertSocialPost(item, { db });
          console.log(`${r.action.padEnd(9)} ${r.slot}${r.changes.length ? ` (${r.changes.join(', ')})` : ''}`);
        } else {
          const { slot, status, ...extra } = item;
          const r = await lib.setSocialPostStatus(slot, status, extra, { db });
          console.log(`${r.type.padEnd(9)} ${r.slot} → ${r.status}`);
        }
      } catch (error) {
        failed += 1;
        console.error(`error     #${i + 1} ${item?.slot ?? '?'}: ${error.message}`);
      }
    }
  } finally {
    await db.$disconnect();
  }
  console.log(`${items.length - failed}/${items.length} recorded.`);
  return failed ? 1 : 0;
}

if (/social-log.mjs$/.test(process.argv[1] || '')) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
