import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SVG_PATH = 'C:/Users/User/Desktop/Medicard DESIGN/assets/Illustration.svg';
const MOOD_FRAME = join(ROOT, 'mobile/assets/figma/assessment/15-diet.png');
const OUT_DIR = join(ROOT, 'mobile', 'assets', 'figma', 'illustrations');

const SVG_SECTIONS = [
  {
    name: 'body-types',
    left: 257,
    top: 505,
    width: 1443,
    height: 431,
    crops: [
      { key: 'body-type-ectomorph', left: 43, top: 34, width: 89, height: 119 },
      { key: 'body-type-mesomorph', left: 434, top: 32, width: 178, height: 238 },
      { key: 'body-type-endomorph', left: 1094, top: 37, width: 267, height: 357 },
    ],
  },
  {
    name: 'smoking',
    left: 257,
    top: 5714,
    width: 470,
    height: 175,
    crops: [
      { key: 'smoking-current', left: 243, top: 19, width: 64, height: 64 },
      { key: 'smoking-former', left: 319, top: 19, width: 64, height: 64 },
      { key: 'smoking-never', left: 395, top: 19, width: 64, height: 64 },
    ],
  },
];

/** Mood faces from Figma assessment mood screen (15-diet.png). */
const MOOD_CROPS = [
  { key: 'mood-sad', left: 24, top: 368, width: 88, height: 88 },
  { key: 'mood-neutral', left: 138, top: 348, width: 100, height: 100 },
  { key: 'mood-happy', left: 252, top: 368, width: 88, height: 88 },
  { key: 'mood-great', left: 265, top: 368, width: 95, height: 88 },
];

async function exportSection(sharp, section, manifest) {
  console.log(`Section ${section.name}…`);
  const buffer = await sharp(SVG_PATH, { density: 72 })
    .extract({
      left: section.left,
      top: section.top,
      width: section.width,
      height: section.height,
    })
    .png()
    .toBuffer();

  for (const crop of section.crops) {
    const file = `${crop.key}.png`;
    await sharp(buffer)
      .extract({
        left: Math.round(crop.left),
        top: Math.round(crop.top),
        width: Math.round(crop.width),
        height: Math.round(crop.height),
      })
      .png()
      .toFile(join(OUT_DIR, file));
    manifest[crop.key] = file;
    console.log(`  ${file}`);
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const sharp = (await import('sharp')).default;
  const manifest = {};
  const t0 = Date.now();

  for (const section of SVG_SECTIONS) {
    await exportSection(sharp, section, manifest);
  }

  console.log('Moods from assessment frame…');
  for (const crop of MOOD_CROPS) {
    const file = `${crop.key}.png`;
    await sharp(MOOD_FRAME)
      .extract({
        left: crop.left,
        top: crop.top,
        width: crop.width,
        height: crop.height,
      })
      .png()
      .toFile(join(OUT_DIR, file));
    manifest[crop.key] = file;
    console.log(`  ${file}`);
  }

  // Body scan preview uses mesomorph silhouette
  await sharp(join(OUT_DIR, 'body-type-mesomorph.png'))
    .resize(280, 280, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(OUT_DIR, 'body-scan.png'));
  manifest['body-scan'] = 'body-scan.png';
  console.log('  body-scan.png (from mesomorph)');

  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Done in ${Math.round((Date.now() - t0) / 1000)}s → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
