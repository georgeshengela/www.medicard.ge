import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SVG_PATH = 'C:/Users/User/Desktop/Medicard DESIGN/assets/Comprehensive Health Assessment.svg';
const OUT_DIR = join(ROOT, 'mobile', 'assets', 'figma', 'assessment');

/** Figma section order — 32 frames (11369:92319). */
export const FIGMA_ASSESSMENT_FRAMES = [
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
  { id: '9217:164868', key: '22-voice-a' },
  { id: '9217:164897', key: '23-voice-b' },
  { id: '9217:164921', key: '24-voice-recording' },
  { id: '9217:164946', key: '25-voice-processing' },
  { id: '9217:164958', key: '26-bp' },
  { id: '9217:164974', key: '27-hr' },
  { id: '9217:164995', key: '28-goals' },
  { id: '9217:165014', key: '29-privacy' },
  { id: '9217:165041', key: '30-summary' },
  { id: '9217:165096', key: '31-complete' },
];

const PHONE_W = 375;
const PHONE_H = 812;
const PHONE_Y = 360;

function uniqueScreenXs(svg) {
  const xs = [];
  const re = /transform="translate\((\d+) 360\)"/g;
  for (const m of svg.matchAll(re)) xs.push(Number(m[1]));
  return [...new Set(xs)].sort((a, b) => a - b);
}

async function main() {
  const svg = readFileSync(SVG_PATH, 'utf8');
  const xs = uniqueScreenXs(svg);
  if (xs.length !== FIGMA_ASSESSMENT_FRAMES.length) {
    console.warn(`Expected ${FIGMA_ASSESSMENT_FRAMES.length} screens, found ${xs.length} unique X positions`);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('Install sharp first: npm install sharp --no-save');
    process.exit(1);
  }

  const manifest = {};
  const count = Math.min(xs.length, FIGMA_ASSESSMENT_FRAMES.length);

  for (let i = 0; i < count; i++) {
    const frame = FIGMA_ASSESSMENT_FRAMES[i];
    const x = xs[i];
    const file = `${frame.key}.png`;

    await sharp(SVG_PATH)
      .extract({ left: x, top: PHONE_Y, width: PHONE_W, height: PHONE_H })
      .png()
      .toFile(join(OUT_DIR, file));

    manifest[frame.key] = { figmaId: frame.id, file };
    console.log(`  ${file} @ x=${x}`);
  }

  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Done — ${count} frames → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
