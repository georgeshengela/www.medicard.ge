#!/usr/bin/env node
// Renders film.html. node render-film.mjs preview <feed|story> [t1,t2,…]  → out/film-preview-<fmt>.jpg (contact sheet)
//                   node render-film.mjs video <feed|story>                → out/medihoroscope-film-20s-<fmt>.mp4
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/User/Desktop/www.medicard/server/package.json');
const { chromium } = require('playwright');
const sharp = require('sharp');
const here = dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([\/])+/, '');
  const file = join(here, p);
  if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(0);
const port = server.address().port;
const [mode = 'preview', fmt = 'feed', list] = process.argv.slice(2);
const H = fmt === 'story' ? 1920 : 1350, FPS = 30, T = 20;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`http://localhost:${port}/film.html?fmt=${fmt}`);
await page.waitForSelector('body[data-ready="1"]', { timeout: 60_000 });
if (mode === 'preview') {
  const times = (list || '0.8,3.2,5.2,7.5,10.3,13.5,15.6,16.6,17.6,19.5').split(',').map(Number);
  const shots = [];
  for (const t of times) { await page.evaluate((x) => window.seek(x), t); shots.push(await page.screenshot({ type: 'jpeg', quality: 85 })); }
  const h = 540, w = Math.round(1080 * h / H), gap = 16;
  const comp = await Promise.all(shots.map(async (b, i) => ({ input: await sharp(b).resize({ height: h }).toBuffer(), left: gap + i * (w + gap), top: gap })));
  await sharp({ create: { width: gap + times.length * (w + gap), height: h + 2 * gap, channels: 3, background: '#111' } }).composite(comp).jpeg({ quality: 86 }).toFile(join(here, 'out', `film-preview-${fmt}.jpg`));
  console.log('preview', times.join(' '));
} else {
  const dir = join(here, 'out', `frames-${fmt}`);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const n = FPS * T;
  for (let i = 0; i < n; i++) {
    await page.evaluate((x) => window.seek(x), i / FPS);
    writeFileSync(join(dir, `${String(i).padStart(4, '0')}.jpg`), await page.screenshot({ type: 'jpeg', quality: 92 }));
    if (i % 60 === 0) console.log('frame', i);
  }
  const outFile = join(here, 'out', `medihoroscope-film-20s-${fmt === 'story' ? '9x16' : '4x5'}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, '%04d.jpg'), '-i', join(here, 'out', 'music_1.mp3'),
    '-filter_complex', `[1:a]atrim=0:${T},afade=t=in:st=0:d=0.05,afade=t=out:st=${T - 1.3}:d=1.3,loudnorm=I=-14:TP=-1.5:LRA=11[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', outFile]);
  console.log('wrote', outFile);
}
await browser.close();
server.close();
