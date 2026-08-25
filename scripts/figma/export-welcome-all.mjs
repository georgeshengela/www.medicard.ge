/**
 * Export all Welcome Screen frames from Nightingale Figma (812px phone screens only).
 * Usage: FIGMA_TOKEN=... node scripts/figma/export-welcome-all.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REF_DIR = join(ROOT, 'mobile', 'design-references', 'figma', 'welcome');
const ASSET_DIR = join(ROOT, 'mobile', 'assets', 'figma', 'welcome');

const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY ?? 'UvO6dfZRJH8SjUj8D0mB8N';

/** All 812×375 Welcome Screen frames from figma-manifest.json (order preserved). */
const WELCOME_SCREENS = [
  { id: '9217:161540', key: '01-landing' },
  { id: '9217:161680', key: '02-health-score' },
  { id: '9217:161767', key: '03-metrics' },
  { id: '11331:164794', key: '04-assessment' },
  { id: '9217:161791', key: '05-doctor' },
  { id: '11331:165057', key: '06-pharmacy' },
  { id: '9217:161816', key: '07-medications' },
  { id: '11331:165357', key: '08-lab' },
  { id: '9217:161998', key: '09-wellness' },
  { id: '9217:162053', key: '10-family' },
  { id: '11331:165501', key: '11-insights' },
  { id: '9217:162120', key: '12-achievements' },
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

  const ids = WELCOME_SCREENS.map((s) => s.id);
  console.log(`Batch export ${ids.length} welcome frames...`);
  const q = ids.map(encodeURIComponent).join(',');
  const data = await figma(`/images/${FILE_KEY}?ids=${q}&format=png&scale=2`);
  const urls = data.images ?? {};

  const manifest = {};
  for (const screen of WELCOME_SCREENS) {
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
    manifest[screen.key] = { id: screen.id, file };
  }

  await writeFile(join(ASSET_DIR, 'index.json'), JSON.stringify(manifest, null, 2));
  await writeFile(join(REF_DIR, 'index.json'), JSON.stringify(manifest, null, 2));
  console.log(`Done: ${Object.keys(manifest).length}/${WELCOME_SCREENS.length} screens`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
