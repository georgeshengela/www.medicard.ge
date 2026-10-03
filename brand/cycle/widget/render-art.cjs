// Renders the cycle widget's logo art (variant A, owner pick 2026-10-04) from the same SVG path and the
// same placement as widget-variants.html, into mobile/assets/widget/cycle/*.png.
// The ornament PNGs cover the whole widget (170×170 small, 364×170 medium at 3×) with the opacity
// baked into the alpha, so on the card colour they look exactly like the board.
//   node brand/cycle/widget/render-art.cjs
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../../server/node_modules/playwright');

const root = path.resolve(__dirname, '../../..');
const out = path.join(root, 'mobile/assets/widget/cycle');
const svg = fs.readFileSync(path.join(root, 'mobile/assets/logo.svg'), 'utf8');
const D = svg.match(/ d="([^"]+)"/)[1];

const GRAD = {
  'rose-light': [[0, '#F4B8C8'], [1, '#C92A55']],
  'rose-dark': [[0, '#FFC2D0'], [1, '#E0567C']],
  teal: [[0.2, '#0D9488'], [0.4, '#14B8A6'], [1, '#5EEAD4']],
};
const ORNAMENT_OPACITY = { 'rose-light': 0.17, 'rose-dark': 0.28, 'teal-light': 0.12, 'teal-dark': 0.2 };
// Widget point size, logo size and offsets from the widget edges — the board's numbers.
const PLACE = {
  s: { w: 170, h: 170, size: 118, css: 'right:-26px;bottom:-28px' },
  m: { w: 364, h: 170, size: 184, css: 'right:-30px;top:-22px' },
};

const logoSvg = (size, stops, opacity = 1) => {
  const id = `g${Math.random().toString(36).slice(2)}`;
  const fill = stops.length === 1 ? stops[0][1] : `url(#${id})`;
  return `<svg width="${size}" height="${size}" viewBox="24.75 12.75 36 36" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient></defs>
    <path fill-rule="evenodd" d="${D}" fill="${fill}" opacity="${opacity}"/></svg>`;
};

const JOBS = [];
for (const [fam, p] of Object.entries(PLACE)) {
  for (const kind of ['rose-light', 'rose-dark', 'teal-light', 'teal-dark']) {
    const stops = kind.startsWith('teal') ? GRAD.teal : GRAD[kind];
    JOBS.push({
      file: `ornament-${fam}-${kind}.png`,
      w: p.w,
      h: p.h,
      html: `<div style="position:absolute;${p.css};transform:rotate(-14deg)">${logoSvg(p.size, stops, ORNAMENT_OPACITY[kind])}</div>`,
    });
  }
}
// Header logo (13 pt) and the neutral tile's centre logo (34 pt), drawn at 4×.
JOBS.push({ file: 'logo-rose-light.png', w: 13, h: 13, scale: 4, html: logoSvg(13, [[0, '#C92A55']]) });
JOBS.push({ file: 'logo-rose-dark.png', w: 13, h: 13, scale: 4, html: logoSvg(13, [[0, '#FF8FA8']]) });
JOBS.push({ file: 'logo-teal.png', w: 34, h: 34, scale: 4, html: logoSvg(34, GRAD.teal) });

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  for (const job of JOBS) {
    const page = await browser.newPage({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: job.scale ?? 3 });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent"><div style="position:relative;width:${job.w}px;height:${job.h}px;overflow:hidden">${job.html}</div></body></html>`,
    );
    await page.screenshot({ path: path.join(out, job.file), omitBackground: true });
    await page.close();
  }
  await browser.close();
  console.log(`${JOBS.length} files → ${path.relative(root, out)}`);
})();
