// Uploads the MEDISLEEP starter library (brand/sleep: library.json + rendered sounds + cover art) into the
// "SleepSound" / "SleepFile" tables. Adds what is missing only: a sound the admin edited keeps its words, status
// and files; a slot (audio / tail / art) is filled only when it is empty. Dry run unless --apply.
//
//   node server/scripts/sleep-library-sync.mjs            # what would change
//   node server/scripts/sleep-library-sync.mjs --apply    # write (main DB from server/.env)
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const here = dirname(fileURLToPath(import.meta.url));
const BRAND = process.argv.find((a) => a.startsWith('--dir='))?.slice(6) || join(here, '..', '..', 'brand', 'sleep');
const APPLY = process.argv.includes('--apply');

function durationMs(path) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], { encoding: 'utf8' });
  const seconds = Number(String(probe.stdout || '').trim());
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : null;
}

const library = JSON.parse(readFileSync(join(BRAND, 'library.json'), 'utf8'));
const db = new PrismaClient();
const { readSleepSound, createSleepSound, saveSleepFile, updateSleepSound } = await import('../src/lib/sleepStore.js');

try {
  for (const [index, item] of library.sounds.entries()) {
    const paths = {
      audioFileId: join(BRAND, 'sounds', 'out', `${item.id}.m4a`),
      tailFileId: join(BRAND, 'sounds', 'out', `${item.id}-tail.m4a`),
      artFileId: join(BRAND, 'art', 'out', `${item.id}.jpg`),
    };
    let row = await readSleepSound(item.id, db);
    const plan = [];
    if (!row) plan.push('create');
    for (const [slot, path] of Object.entries(paths)) {
      if (existsSync(path) && !row?.[slot]) plan.push(slot);
    }
    if (!plan.length) {
      console.log(`= ${item.id}`);
      continue;
    }
    console.log(`${APPLY ? '+' : '?'} ${item.id}: ${plan.join(', ')}`);
    if (!APPLY) continue;
    if (!row) {
      row = await createSleepSound({
        id: item.id, category: item.category, titleKa: item.title.ka, titleEn: item.title.en,
        subtitleKa: item.subtitle?.ka || '', subtitleEn: item.subtitle?.en || '', tint: item.tint,
        loop: item.loop !== false, featured: !!item.featured, status: 'DRAFT', sortOrder: index * 10,
      }, db);
    }
    const patch = {};
    for (const slot of plan.filter((p) => p !== 'create')) {
      const path = paths[slot];
      const kind = slot === 'artFileId' ? 'image' : 'audio';
      const file = await saveSleepFile({
        kind, mime: kind === 'image' ? 'image/jpeg' : 'audio/mp4', bytes: readFileSync(path),
        durationMs: kind === 'audio' ? durationMs(path) : null, createdBy: 'library-sync',
      }, db);
      patch[slot] = file.id;
      if (slot === 'audioFileId') patch.durationMs = durationMs(path);
    }
    // A new sound goes live once its audio is in; an existing one keeps the status the admin chose.
    if (plan.includes('create') && patch.audioFileId) patch.status = 'LIVE';
    await updateSleepSound(item.id, patch, db);
  }
  if (!APPLY) console.log('\nDry run. Add --apply to write.');
} finally {
  await db.$disconnect();
}
