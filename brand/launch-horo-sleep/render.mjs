#!/usr/bin/env node
// Renders poster.html variants to JPGs: out/feed/<v>.jpg (1080×1350) and out/story/<v>.jpg (1080×1920).
//   node render.mjs [v1,v2,…] [--fmt feed|story]
// Needs playwright + sharp (NODE_PATH=…/www.medicard/server/node_modules).
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/User/Desktop/www.medicard/server/package.json');
const { chromium } = require('playwright');
const sharp = require('sharp');
const here = dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([\\/])+/, '');
  const file = join(here, p || 'poster.html');
  if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(0);
const port = server.address().port;

const args = process.argv.slice(2);
const list = (args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--fmt') || 'h1,h2,h3,h4,s1,s2,s3,s4').split(',');
const fmts = args.includes('--fmt') ? [args[args.indexOf('--fmt') + 1]] : ['feed', 'story'];
const browser = await chromium.launch();
for (const fmt of fmts) {
  mkdirSync(join(here, 'out', fmt), { recursive: true });
  const page = await browser.newPage({ viewport: { width: fmt === 'og' ? 1200 : 1080, height: fmt === 'story' ? 1920 : fmt === 'og' ? 630 : 1350 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  for (const v of list) {
    errors.length = 0;
    await page.goto(`http://localhost:${port}/poster.html?v=${v}&fmt=${fmt}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 30_000 }).catch(() => errors.push('not ready'));
    await page.waitForTimeout(300);
    const png = await page.screenshot({ type: 'png' });
    const out = join(here, 'out', fmt, `${v}.jpg`);
    await sharp(png).jpeg({ quality: 93, chromaSubsampling: '4:4:4' }).toFile(out);
    console.log(fmt, v, errors.length ? `ERR ${errors.join(' | ')}` : 'ok');
  }
  await page.close();
}
await browser.close();
server.close();
