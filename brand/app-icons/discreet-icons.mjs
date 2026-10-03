// Discreet alternate app icons „კალენდარი“ and „ყვავილი“ (train 1.0.0.20, cycle brief [კ-32]).
// Neutral on purpose: no cycle symbols (no drops, hearts, moons, rose), no brand text, no numbers.
// Same pipeline as the five icons of feat/app-icons: SVG → Playwright (1024 PNG) → flattened RGB.
//   node brand/app-icons/discreet-icons.mjs [previewDir]
// Writes mobile/assets/app-icons/<name>.png (iOS, full bleed), <name>-android.png (adaptive foreground
// with the background baked in, motif inside the safe zone) and thumb/<name>.png (192 px, picker).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'mobile/assets/app-icons');
const requireServer = createRequire(path.join(ROOT, 'server/package.json'));
const requireMobile = createRequire(path.join(ROOT, 'mobile/package.json'));
const { chromium } = requireServer('playwright');
const sharp = requireMobile('sharp');

const scaleAround = (k) => `translate(512 512) scale(${k}) translate(-512 -512)`;

// Calendar: a plain month page — teal binding, grey day squares, one teal „today“. Nothing else.
const calendarCells = () => {
  const cells = [];
  const cols = 4;
  const rows = 3;
  const x0 = 318;
  const y0 = 486;
  const step = 104;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const today = r === 1 && c === 2;
      cells.push(
        `<rect x="${x0 + c * step}" y="${y0 + r * step}" width="76" height="76" rx="20" fill="${today ? 'url(#teal)' : '#D9E3E8'}"/>`,
      );
    }
  }
  return cells.join('');
};

const ICONS = {
  calendar: {
    ka: 'კალენდარი',
    androidBg: '#EEF3F6',
    defs: `
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7FAFB"/><stop offset="1" stop-color="#E3ECF0"/></linearGradient>
      <linearGradient id="teal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2DD4BF"/><stop offset="1" stop-color="#0D9488"/></linearGradient>
      <filter id="card" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#0F3B45" flood-opacity=".16"/></filter>`,
    bg: `<rect width="1024" height="1024" fill="url(#bg)"/>`,
    motif: `
      <g filter="url(#card)">
        <rect x="262" y="262" width="500" height="520" rx="72" fill="#FFFFFF"/>
      </g>
      <path d="M262 334a72 72 0 0 1 72-72h356a72 72 0 0 1 72 72v86H262z" fill="url(#teal)"/>
      <rect x="370" y="214" width="40" height="108" rx="20" fill="#0F766E"/>
      <rect x="614" y="214" width="40" height="108" rx="20" fill="#0F766E"/>
      ${calendarCells()}`,
  },
  flower: {
    ka: 'ყვავილი',
    androidBg: '#DCE8DC',
    defs: `
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EEF5EC"/><stop offset="1" stop-color="#C7DBC9"/></linearGradient>
      <radialGradient id="petal" cx="50%" cy="80%" r="80%"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F3EEE2"/></radialGradient>
      <radialGradient id="heart" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFE08A"/><stop offset="1" stop-color="#E9A93A"/></radialGradient>
      <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FB58A"/><stop offset="1" stop-color="#3F7F55"/></linearGradient>
      <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#2F5D3A" flood-opacity=".18"/></filter>`,
    bg: `<rect width="1024" height="1024" fill="url(#bg)"/>`,
    motif: `
      <path d="M512 640 C 516 720, 522 790, 530 856" stroke="#3F7F55" stroke-width="22" stroke-linecap="round" fill="none"/>
      <path d="M524 772 C 580 724, 650 712, 706 734 C 664 790, 592 808, 524 772 Z" fill="url(#leaf)"/>
      <g filter="url(#soft)">
        ${[0, 60, 120, 180, 240, 300]
          .map((a) => `<ellipse cx="512" cy="300" rx="86" ry="132" fill="url(#petal)" transform="rotate(${a} 512 424)"/>`)
          .join('')}
      </g>
      <circle cx="512" cy="424" r="80" fill="url(#heart)"/>
      <circle cx="488" cy="400" r="15" fill="#FFF3C4" opacity=".7"/>`,
  },
};

const svg = (icon, k) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${icon.defs}</defs>${icon.bg}<g transform="${scaleAround(k)}">${icon.motif}</g></svg>`;

const preview = process.argv[2] ? path.resolve(process.argv[2]) : null;
fs.mkdirSync(path.join(OUT, 'thumb'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
async function render(markup) {
  await page.setContent(`<!doctype html><html><body style="margin:0">${markup}</body></html>`);
  return page.locator('svg').screenshot({ type: 'png' });
}
const flat = (buf) => sharp(buf).flatten({ background: '#FFFFFF' }).removeAlpha();
for (const [name, icon] of Object.entries(ICONS)) {
  // iOS: full square (the system rounds it), motif at the size of the classic mark.
  const ios = await render(svg(icon, 1));
  await flat(ios).png().toFile(path.join(OUT, `${name}.png`));
  await flat(ios).resize(192, 192).png().toFile(path.join(OUT, 'thumb', `${name}.png`));
  // Android adaptive foreground: background baked in, motif inside the 66 % safe zone.
  const android = await render(svg(icon, 0.62));
  await flat(android).png().toFile(path.join(OUT, `${name}-android.png`));
}
if (preview) {
  fs.mkdirSync(preview, { recursive: true });
  const tile = (file, label) => `<figure style="margin:0;display:flex;flex-direction:column;align-items:center;gap:14px">
    <img src="file:///${file.replace(/\\/g, '/')}" style="width:200px;height:200px;border-radius:46px;box-shadow:0 18px 40px rgba(0,0,0,.35)">
    <figcaption style="font:600 28px sans-serif;color:#fff">${label}</figcaption></figure>`;
  const names = ['classic', 'rose', 'midnight', 'pearl', 'gold', 'calendar', 'flower'];
  const html = `<!doctype html><html><body style="margin:0;width:1900px;height:560px;background:linear-gradient(135deg,#3b4a6b,#7a5a8c 55%,#c97b8a);display:flex;align-items:center;justify-content:center;gap:48px">
    ${names
      .map((n) => tile(n === 'classic' ? path.join(ROOT, 'mobile/assets/icon.png') : path.join(OUT, `${n}.png`), n))
      .join('')}</body></html>`;
  const file = path.join(preview, 'icons-sheet.html');
  fs.writeFileSync(file, html);
  await page.setViewportSize({ width: 1900, height: 560 });
  await page.goto(`file:///${file.replace(/\\/g, '/')}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(preview, 'w3-n1-icons-sheet.png') });
}
await browser.close();
console.log('icons written:', Object.keys(ICONS).join(', '));
