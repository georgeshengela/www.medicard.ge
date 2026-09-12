/**
 * Curiosity / engagement posters (1080×1080).
 * Run: node scripts/generate-social-hooks.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, 'brand');

const POSTS = [
  ['apps', 'social-hook-apps.png', 1080],
  ['lab', 'social-hook-lab.png', 1080],
  ['medi', 'social-hook-medi.png', 1080],
  ['one', 'social-hook-one.png', 1080],
  ['apps-45', 'social-hook-apps-4x5.png', 1350],
  ['lab-45', 'social-hook-lab-4x5.png', 1350],
  ['medi-45', 'social-hook-medi-4x5.png', 1350],
  ['one-45', 'social-hook-one-4x5.png', 1350],
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1080, height: 9720 },
  deviceScaleFactor: 2,
});

await page.goto(pathToFileURL(path.join(root, 'brand', 'social-hooks.html')).href, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelectorAll('[data-mark] path').length >= 24);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(250);
await mkdir(outDir, { recursive: true });

for (const [id, file, height] of POSTS) {
  const buf = await page.locator(`#${id}`).screenshot({ type: 'png' });
  await sharp(buf).resize(1080, height).png({ compressionLevel: 9 }).toFile(path.join(outDir, file));
  console.log('wrote', file);
}

await browser.close();
