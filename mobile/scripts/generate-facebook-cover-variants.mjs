/**
 * Render four Facebook cover layout variants.
 * Run: node scripts/generate-facebook-cover-variants.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const htmlPath = path.join(root, 'brand', 'facebook-cover-next.html');
const outDir = path.join(root, 'brand');

const VARIANTS = [
  ['v5', 'facebook-cover-v5-monument.png'],
  ['v6', 'facebook-cover-v6-type.png'],
  ['v7', 'facebook-cover-v7-bento.png'],
  ['v8', 'facebook-cover-v8-slab.png'],
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1640, height: 2496 },
  deviceScaleFactor: 2,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() =>
  Promise.all(
    [...document.images].map((img) =>
      img.complete ? null : new Promise((resolve) => {
        img.onload = img.onerror = resolve;
      }),
    ),
  ),
);
await page.waitForTimeout(250);

await mkdir(outDir, { recursive: true });

for (const [id, file] of VARIANTS) {
  const buf = await page.locator(`#${id}`).screenshot({ type: 'png' });
  await sharp(buf).resize(1640, 624).png({ compressionLevel: 9 }).toFile(path.join(outDir, file));
  console.log('wrote', file);
}

await browser.close();
