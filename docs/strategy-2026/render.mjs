// Renders a deck HTML to a 1600×900 PDF with the bundled Chromium.
// node docs/strategy-2026/render.mjs [deck.html] [out.pdf]
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const here = dirname(fileURLToPath(import.meta.url));
const input = resolve(here, process.argv[2] || 'deck.html');
const output = resolve(here, process.argv[3] || 'MEDICARD-strategy-2026.pdf');

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(pathToFileURL(input).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const missing = await page.evaluate(() => [...document.fonts].filter(f => f.status !== 'loaded').map(f => `${f.family} ${f.weight} ${f.status}`));
if (missing.length) console.warn('fonts not loaded:', missing.join(', '));
const overflow = await page.evaluate(() => [...document.querySelectorAll('.slide')].map((s, i) => {
  const r = s.getBoundingClientRect();
  const bad = [...s.querySelectorAll('*')].filter(el => {
    const b = el.getBoundingClientRect();
    return b.width > 0 && (b.right > r.right + 1 || b.bottom > r.bottom + 1) && !el.closest('.mark-bg') && !el.classList.contains('mark-bg') && !el.closest('.bleed');
  });
  return bad.length ? `slide ${i + 1}: ${bad.slice(0, 3).map(e => e.tagName.toLowerCase() + '.' + [...e.classList].join('.')).join(', ')}` : null;
}).filter(Boolean));
if (overflow.length) console.warn('overflow:\n' + overflow.join('\n'));
await page.pdf({ path: output, width: '1600px', height: '900px', printBackground: true, preferCSSPageSize: true });
const count = await page.evaluate(() => document.querySelectorAll('.slide').length);
console.log(`${count} slides → ${output}`);
await browser.close();
