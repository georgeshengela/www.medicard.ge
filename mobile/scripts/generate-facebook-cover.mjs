/**
 * Facebook page cover from Medicard landing type, mark, and home screen.
 * 1640×624 — official 2× of Facebook's 820×312 desktop cover.
 * Run: node scripts/generate-facebook-cover.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const htmlPath = path.join(root, 'brand', 'facebook-cover.html');
const outDir = path.join(root, 'brand');

const WIDTH = 1640;
const HEIGHT = 624;
const MOBILE_W = Math.round(HEIGHT * (640 / 360));

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((resolve) => { img.onload = img.onerror = resolve; })))));
await page.waitForTimeout(200);

const shot = await page.screenshot({ type: 'png', omitBackground: false });
await browser.close();

await mkdir(outDir, { recursive: true });

const cover = await sharp(shot).resize(WIDTH, HEIGHT).png({ compressionLevel: 9 }).toBuffer();
await sharp(cover).toFile(path.join(outDir, 'facebook-cover.png'));

const sideCrop = Math.round((WIDTH - MOBILE_W) / 2);
await sharp(cover)
  .extract({ left: sideCrop, top: 0, width: MOBILE_W, height: HEIGHT })
  .png({ compressionLevel: 9 })
  .toFile(path.join(outDir, 'facebook-cover-mobile-preview.png'));

console.log(
  JSON.stringify(
    {
      cover: path.join(outDir, 'facebook-cover.png'),
      mobilePreview: path.join(outDir, 'facebook-cover-mobile-preview.png'),
      size: `${WIDTH}×${HEIGHT}`,
      mobileCrop: `${MOBILE_W}×${HEIGHT}`,
    },
    null,
    2,
  ),
);
