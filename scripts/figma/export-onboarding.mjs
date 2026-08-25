/**
 * Export Nightingale onboarding screens + reusable assets from Figma.
 *
 * Usage:
 *   FIGMA_TOKEN=... node scripts/figma/export-onboarding.mjs
 *   FIGMA_TOKEN=... node scripts/figma/export-onboarding.mjs --section welcome
 */
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REF_DIR = join(ROOT, 'mobile', 'design-references', 'figma');
const ASSET_DIR = join(ROOT, 'mobile', 'assets', 'figma');

const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY ?? 'UvO6dfZRJH8SjUj8D0mB8N';

const SECTIONS = {
  splash: {
    name: 'Splash & Loading',
    /** Primary light splash + loading variant */
    screenIds: ['8840:196693', '8840:200273', '8840:200402'],
  },
  welcome: {
    name: 'Welcome Screen',
    /** First 3 onboarding slides + last slide */
    screenIds: ['9217:161540', '9217:161680', '9217:161767', '9217:162120'],
  },
  auth: {
    name: 'Authentication',
    screenIds: [
      '11396:82867', // sign in light
      '11396:84529', // sign up light
      '11396:84795', // forgot password options
      '11396:84999', // forgot password email
      '11396:85159', // reset sent
    ],
  },
};

const onlySection = process.argv.find((a) => a.startsWith('--section='))?.split('=')[1];

if (!TOKEN) {
  console.error('Missing FIGMA_TOKEN env var.');
  process.exit(1);
}

async function figma(path) {
  const res = await fetch(`https://api.figma.com/v1${path}`, {
    headers: { 'X-Figma-Token': TOKEN },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.err ?? body.message ?? `Figma HTTP ${res.status}`);
  return body;
}

function slug(name) {
  return (name ?? 'asset')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

/** Large illustration / hero artwork inside a screen frame. */
function collectHeroAssets(node, acc = [], depth = 0) {
  if (!node || depth > 12) return acc;
  const box = node.absoluteBoundingBox;
  const w = box?.width ?? 0;
  const h = box?.height ?? 0;
  const name = (node.name ?? '').toLowerCase();

  const isHero =
    (node.type === 'GROUP' || node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
    w >= 180 &&
    h >= 180 &&
    (name.includes('illustration') ||
      name.includes('image') ||
      name.includes('hero') ||
      name.includes('artwork') ||
      name.includes('3d') ||
      name.includes('envelope') ||
      name.includes('welcome'));

  if (isHero) {
    acc.push({ id: node.id, name: node.name, width: w, height: h });
  }

  for (const child of node.children ?? []) collectHeroAssets(child, acc, depth + 1);
  return acc;
}

async function exportPngs(entries, destSubdir, scale = 2) {
  if (entries.length === 0) return {};
  const dest = join(REF_DIR, destSubdir);
  const assetsDest = join(ASSET_DIR, destSubdir);
  await mkdir(dest, { recursive: true });
  await mkdir(assetsDest, { recursive: true });

  const ids = entries.map((e) => (typeof e === 'string' ? e : e.id));
  const urls = {};
  for (let i = 0; i < ids.length; i += 15) {
    const chunk = ids.slice(i, i + 15);
    const q = chunk.map(encodeURIComponent).join(',');
    const data = await figma(`/images/${FILE_KEY}?ids=${q}&format=png&scale=${scale}`);
    Object.assign(urls, data.images ?? {});
    await sleep(350);
  }

  const manifest = {};
  for (const entry of entries) {
    const id = typeof entry === 'string' ? entry : entry.id;
    const url = urls[id];
    if (!url) continue;
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const label = typeof entry === 'string' ? id.replace(':', '-') : slug(entry.name) || id.replace(':', '-');
    const file = `${label}.png`;
    const refPath = join(dest, file);
    const assetPath = join(assetsDest, file);
    await writeFile(refPath, buf);
    await writeFile(assetPath, buf);
    manifest[id] = { file, label, section: destSubdir };
  }
  return manifest;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function exportSection(key, cfg) {
  console.log(`\n— ${cfg.name} (${key})`);
  const screens = await exportPngs(cfg.screenIds, key, 2);
  console.log(`  screens: ${Object.keys(screens).length}`);

  const heroManifest = {};
  for (const screenId of cfg.screenIds) {
    const data = await figma(`/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(screenId)}&depth=8`);
    const doc = data.nodes?.[screenId]?.document;
    if (!doc) continue;
    const heroes = collectHeroAssets(doc).slice(0, 3);
    if (heroes.length === 0) continue;
    const exported = await exportPngs(
      heroes.map((h) => ({ ...h, name: `${key}-${slug(h.name)}-${screenId.replace(':', '-')}` })),
      `${key}/assets`,
      2,
    );
    Object.assign(heroManifest, exported);
    await sleep(400);
  }
  console.log(`  hero assets: ${Object.keys(heroManifest).length}`);

  await writeFile(join(REF_DIR, key, 'index.json'), JSON.stringify({ screens, heroes: heroManifest }, null, 2));
  return { screens, heroes: heroManifest };
}

async function main() {
  console.log(`Figma export → ${ASSET_DIR}`);
  await mkdir(ASSET_DIR, { recursive: true });

  const keys = onlySection ? [onlySection] : Object.keys(SECTIONS);
  const all = {};
  for (const key of keys) {
    const cfg = SECTIONS[key];
    if (!cfg) {
      console.warn(`Unknown section: ${key}`);
      continue;
    }
    all[key] = await exportSection(key, cfg);
  }

  await writeFile(join(ASSET_DIR, 'manifest.json'), JSON.stringify(all, null, 2));
  console.log('\nDone. App assets in mobile/assets/figma/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
