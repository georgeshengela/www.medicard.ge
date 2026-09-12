/**
 * Square (ads + feed) and 4:5 (Instagram) promotional posts.
 * Run: node scripts/generate-social-post.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const htmlPath = path.join(root, 'brand', 'social-post.html');
const outDir = path.join(root, 'brand');

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1080, height: 2430 },
  deviceScaleFactor: 2,
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(250);

await mkdir(outDir, { recursive: true });

const sq = await page.locator('#sq').screenshot({ type: 'png' });
await sharp(sq).resize(1080, 1080).png({ compressionLevel: 9 }).toFile(path.join(outDir, 'social-post-1080.png'));

const p45 = await page.locator('#p45').screenshot({ type: 'png' });
await sharp(p45).resize(1080, 1350).png({ compressionLevel: 9 }).toFile(path.join(outDir, 'social-post-4x5.png'));

await browser.close();
console.log('wrote social-post-1080.png and social-post-4x5.png');
