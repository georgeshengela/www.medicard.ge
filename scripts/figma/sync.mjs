/**
 * Pull screen inventory + design tokens from the Nightingale Figma file.
 *
 * Usage:
 *   FIGMA_FILE_KEY=UvO6dfZRJH8SjUj8D0mB8N node scripts/figma/sync.mjs
 *   node scripts/figma/sync.mjs --export-auth   # PNG refs for Authentication frames
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(ROOT, 'mobile', 'src', 'design');
const REF_DIR = join(ROOT, 'mobile', 'design-references', 'figma');

const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY ?? 'UvO6dfZRJH8SjUj8D0mB8N';

/** Nightingale v3 — main mobile pages (Figma canvas node ids). */
const PAGES = {
  light: '8839:195620',
  dark: '5362:18323',
  foundations: '5358:6096',
  components: '5358:4030',
  appComponents: '5643:11300',
  icons: '5367:38988',
};

const exportAuth = process.argv.includes('--export-auth');

if (!TOKEN) {
  console.error('Missing FIGMA_TOKEN env var.');
  process.exit(1);
}

async function figma(path) {
  const res = await fetch(`https://api.figma.com/v1${path}`, {
    headers: { 'X-Figma-Token': TOKEN },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.err ?? body.message ?? `Figma HTTP ${res.status}`);
  }
  return body;
}

function rgbToHex({ r, g, b }) {
  const h = (v) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function collectScreens(node, acc = []) {
  if (!node) return acc;
  if (node.type === 'FRAME' && node.name && !node.name.startsWith('↳')) {
    const w = node.absoluteBoundingBox?.width ?? 0;
    const h = node.absoluteBoundingBox?.height ?? 0;
    if (w >= 360 && w <= 430 && h >= 700) {
      acc.push({ id: node.id, name: node.name, width: w, height: h });
    }
  }
  for (const child of node.children ?? []) collectScreens(child, acc);
  return acc;
}

function collectColorSwatches(node, acc = [], depth = 0) {
  if (!node || depth > 8) return acc;
  const name = (node.name ?? '').trim();
  const fill = node.fills?.find((f) => f.type === 'SOLID' && f.visible !== false);
  if (fill?.color && (name.includes('/') || /^#?[0-9A-Fa-f]{3,8}$/.test(name) || /primary|teal|brand/i.test(name))) {
    acc.push({ name, hex: rgbToHex(fill.color) });
  }
  for (const child of node.children ?? []) collectColorSwatches(child, acc, depth + 1);
  return acc;
}

async function exportImages(ids, destSubdir) {
  if (ids.length === 0) return {};
  const dest = join(REF_DIR, destSubdir);
  await mkdir(dest, { recursive: true });
  const chunkSize = 20;
  const urls = {};
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const q = chunk.map(encodeURIComponent).join(',');
    const data = await figma(`/images/${FILE_KEY}?ids=${q}&format=png&scale=2`);
    Object.assign(urls, data.images ?? {});
  }
  const manifest = {};
  for (const [id, url] of Object.entries(urls)) {
    if (!url) continue;
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const safe = id.replace(':', '-');
    const file = `${safe}.png`;
    await writeFile(join(dest, file), buf);
    manifest[id] = file;
  }
  return manifest;
}

async function main() {
  const meta = await figma(`/files/${FILE_KEY}?depth=1`);
  console.log(`Figma: ${meta.name}`);

  const light = await figma(`/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(PAGES.light)}&depth=4`);
  const lightDoc = light.nodes[PAGES.light].document;

  const sections = (lightDoc.children ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    screens: collectScreens(s),
  }));

  const foundations = await figma(`/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(PAGES.foundations)}&depth=5`);
  const foundationDoc = foundations.nodes[PAGES.foundations].document;
  const swatches = collectColorSwatches(foundationDoc);

  const manifest = {
    source: meta.name,
    fileKey: FILE_KEY,
    lastSynced: new Date().toISOString(),
    kitVersion: 'nightingale-v3',
    pages: Object.fromEntries(
      Object.entries(PAGES).map(([k, id]) => {
        const page = meta.document.children.find((c) => c.id === id);
        return [k, { id, name: page?.name ?? k }];
      }),
    ),
    lightSections: sections.map(({ id, name, screens }) => ({
      id,
      name,
      screenCount: screens.length,
      screens: screens.map(({ id: sid, name: sname, width, height }) => ({ id: sid, name: sname, width, height })),
    })),
    colors: swatches.filter((s, i, arr) => arr.findIndex((x) => x.hex === s.hex && x.name === s.name) === i).slice(0, 80),
    totalScreens: sections.reduce((n, s) => n + s.screens.length, 0),
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'figma-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Screens indexed: ${manifest.totalScreens}`);
  console.log(`Color swatches: ${manifest.colors.length}`);
  console.log(`Wrote mobile/src/design/figma-manifest.json`);

  if (exportAuth) {
    const auth = sections.find((s) => s.name === 'Authentication');
    const ids = auth?.screens?.map((s) => s.id) ?? [];
    const files = await exportImages(ids, 'authentication');
    await writeFile(join(REF_DIR, 'authentication', 'index.json'), JSON.stringify(files, null, 2));
    console.log(`Exported ${Object.keys(files).length} auth reference PNGs`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
