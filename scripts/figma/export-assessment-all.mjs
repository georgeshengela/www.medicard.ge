/**
 * Export Comprehensive Health Assessment frames from Nightingale Figma.
 * Usage: FIGMA_TOKEN=... node scripts/figma/export-assessment-all.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REF_DIR = join(ROOT, 'mobile', 'design-references', 'figma', 'assessment');
const ASSET_DIR = join(ROOT, 'mobile', 'assets', 'figma', 'assessment');

const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY ?? 'UvO6dfZRJH8SjUj8D0mB8N';

/** Section 11369:92319 — skips Voice AI frames. */
const ASSESSMENT_SCREENS = [
  { id: '9217:164373', key: '01-intro' },
  { id: '9217:164410', key: '02-overview' },
  { id: '9217:164425', key: '03-age' },
  { id: '9217:164441', key: '04-gender' },
  { id: '9217:164456', key: '05-height' },
  { id: '9217:164472', key: '06-weight' },
  { id: '9217:164488', key: '07-bmi' },
  { id: '9217:164506', key: '08-activity' },
  { id: '9217:164526', key: '09-exercise' },
  { id: '9217:164587', key: '10-sleep-quality' },
  { id: '9217:164607', key: '11-sleep-hours' },
  { id: '9217:164626', key: '12-stress' },
  { id: '9217:164657', key: '13-smoking' },
  { id: '11332:64167', key: '14-alcohol' },
  { id: '9217:164703', key: '15-diet' },
  { id: '9217:164726', key: '16-water' },
  { id: '9217:164789', key: '17-conditions' },
  { id: '9217:164803', key: '18-medications' },
  { id: '9217:164822', key: '19-allergies' },
  { id: '9217:164840', key: '20-family' },
  { id: '9217:164855', key: '21-blood-type' },
  { id: '9217:164958', key: '26-bp' },
  { id: '9217:164974', key: '27-hr' },
  { id: '9217:164995', key: '28-goals' },
  { id: '9217:165014', key: '29-privacy' },
  { id: '9217:165041', key: '30-summary' },
  { id: '9217:165096', key: '31-complete' },
];

if (!TOKEN) {
  console.error('Missing FIGMA_TOKEN');
  process.exit(1);
}

async function figma(path, retries = 5) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`https://api.figma.com/v1${path}`, {
      headers: { 'X-Figma-Token': TOKEN },
    });
    const body = await res.json();
    if (res.status === 429) {
      const wait = 8000 * (i + 1);
      console.log(`Rate limited, waiting ${wait}ms...`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(body.err ?? body.message ?? `HTTP ${res.status}`);
    return body;
  }
  throw new Error('Rate limit retries exhausted');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await mkdir(REF_DIR, { recursive: true });
  await mkdir(ASSET_DIR, { recursive: true });

  const ids = ASSESSMENT_SCREENS.map((s) => s.id);
  console.log(`Batch export ${ids.length} assessment frames...`);
  const q = ids.map(encodeURIComponent).join(',');
  const data = await figma(`/images/${FILE_KEY}?ids=${q}&format=png&scale=2`);
  const urls = data.images ?? {};

  const manifest = {};
  for (const screen of ASSESSMENT_SCREENS) {
    const url = urls[screen.id];
    const file = `${screen.key}.png`;
    if (!url) {
      console.warn(`  Missing URL: ${screen.key} (${screen.id})`);
      continue;
    }
    console.log(`  Saving ${file}...`);
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(join(REF_DIR, file), buf);
    await writeFile(join(ASSET_DIR, file), buf);
    manifest[screen.key] = { figmaId: screen.id, file };
    await sleep(300);
  }

  await writeFile(join(ASSET_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Done — ${Object.keys(manifest).length}/${ASSESSMENT_SCREENS.length} frames saved.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
