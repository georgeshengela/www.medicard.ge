/**
 * Editorial social posters — square + 4:5.
 * Run: node scripts/generate-social-editorial.mjs
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
  ['manifesto', 'social-editorial-manifesto.png', 1080],
  ['day', 'social-editorial-day.png', 1080],
  ['labstory', 'social-editorial-lab.png', 1080],
  ['manifesto-45', 'social-editorial-manifesto-4x5.png', 1350],
  ['day-45', 'social-editorial-day-4x5.png', 1350],
  ['labstory-45', 'social-editorial-lab-4x5.png', 1350],
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1080, height: 7290 },
  deviceScaleFactor: 2,
});

await page.goto(pathToFileURL(path.join(root, 'brand', 'social-editorial.html')).href, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelectorAll('[data-mark] path').length >= 18);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await mkdir(outDir, { recursive: true });

for (const [id, file, height] of POSTS) {
  const buf = await page.locator(`#${id}`).screenshot({ type: 'png' });
  await sharp(buf).resize(1080, height).png({ compressionLevel: 9 }).toFile(path.join(outDir, file));
  console.log('wrote', file);
}

await browser.close();
