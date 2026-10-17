#!/usr/bin/env node
/**
 * Native launch screen art: the welcome screen's velvet heartbeat disc (HeartbeatDisc's resting frame, no
 * line, no ripple), drawn in headless Chromium and saved as transparent PNGs for light and dark.
 *
 *   npm run splash:generate   → assets/splash/launch-light.png, assets/splash/launch-dark.png
 *
 * Colours come from src/theme/velvet.ts and geometry from src/components/launch/launchArt.ts, so the native
 * splash, the JS launch curtain (which shows these PNGs first) and the live disc stay one picture.
 * Transparent pixels let the shadows sit on app.json's backgroundColor without a visible box edge.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCALE = 3;

function constant(name) {
  const src = readFileSync(path.join(ROOT, 'src/components/launch/launchArt.ts'), 'utf8');
  const m = new RegExp(`export const ${name} = (\\d+);`).exec(src);
  if (!m) throw new Error(`launchArt.ts: ${name} not found`);
  return Number(m[1]);
}

function palette(mode) {
  const src = readFileSync(path.join(ROOT, 'src/theme/velvet.ts'), 'utf8');
  const block = new RegExp(`\\n\\s{2}${mode}: \\{([\\s\\S]*?)\\n\\s{2}\\}`).exec(src.slice(src.indexOf('export const VELVET')));
  if (!block) throw new Error(`velvet.ts: VELVET.${mode} not found`);
  const pick = (key) => {
    const m = new RegExp(`\\b${key}: '(#[0-9A-Fa-f]{6})'`).exec(block[1]);
    if (!m) throw new Error(`velvet.ts: VELVET.${mode}.${key} not found`);
    return m[1];
  };
  return { surface: pick('surface'), light: pick('light'), shade: pick('shade'), pulse: pick('pulse'), discTop: pick('discTop') };
}

const MARK_PATH =
  'M42.75 12.75C47.2687 12.75 50.9318 16.4131 50.9318 20.9318V22.5682H52.5682C57.0869 22.5682 60.75 26.2313 60.75 30.75C60.75 35.2687 57.0869 38.9318 52.5682 38.9318H50.9318V40.5682C50.9318 45.0869 47.2687 48.75 42.75 48.75C38.2313 48.75 34.5682 45.0869 34.5682 40.5682V38.9318H32.9318C28.4131 38.9318 24.75 35.2687 24.75 30.75C24.75 26.2313 28.4131 22.5682 32.9318 22.5682H34.5682V20.9318C34.5682 16.4131 38.2313 12.75 42.75 12.75ZM50.8407 25.8409C50.0861 32.6671 44.6671 38.0861 37.8409 38.8407V40.5682C37.8409 43.2794 40.0388 45.4773 42.75 45.4773C45.4612 45.4773 47.6591 43.2794 47.6591 40.5682V37.2955C47.6591 36.3917 48.3917 35.6591 49.2955 35.6591H52.5682C55.2794 35.6591 57.4773 33.4612 57.4773 30.75C57.4773 28.0388 55.2794 25.8409 52.5682 25.8409H50.8407ZM42.75 16.0227C40.0388 16.0227 37.8409 18.2206 37.8409 20.9318V24.2045C37.8409 25.1083 37.1083 25.8409 36.2045 25.8409H32.9318C30.2206 25.8409 28.0227 28.0388 28.0227 30.75C28.0227 33.4612 30.2206 35.6591 32.9318 35.6591H34.6593C35.4139 28.8329 40.8329 23.4131 47.6591 22.6585V20.9318C47.6591 18.2206 45.4612 16.0227 42.75 16.0227ZM47.5225 25.9767C42.616 26.7391 38.7391 30.616 37.9767 35.5225C42.8838 34.7603 46.7603 30.8838 47.5225 25.9767Z';

/** HeartbeatDisc's resting frame as HTML (same sizes, shadows, gradient and logo as the component). */
function html(p, dark, art, disc) {
  const well = Math.round(disc * 0.69);
  const logo = Math.round(disc * 0.38);
  const halo = Math.round(logo * 1.9);
  const off = (art - disc) / 2;
  return `<!doctype html><html><head><style>
    html, body { margin: 0; background: transparent; }
    .disc { position: absolute; left: ${off}px; top: ${off}px; width: ${disc}px; height: ${disc}px; border-radius: 50%;
      background: ${p.surface}; box-shadow: 18px 18px 36px ${p.shade}, -14px -14px 30px ${p.light}; }
    .disc > svg.sheen { position: absolute; inset: 0; border-radius: 50%; }
    .well { position: absolute; left: ${(disc - well) / 2}px; top: ${(disc - well) / 2}px; width: ${well}px; height: ${well}px;
      border-radius: 50%; background: ${p.surface}; box-shadow: inset 8px 8px 16px ${p.shade}, inset -8px -8px 16px ${p.light};
      display: flex; align-items: center; justify-content: center; }
    .halo { position: absolute; width: ${halo}px; height: ${halo}px; opacity: ${dark ? 0.55 : 0}; }
  </style></head><body style="width:${art}px;height:${art}px">
    <div class="disc">
      <svg class="sheen" width="${disc}" height="${disc}" viewBox="0 0 1 1" preserveAspectRatio="none">
        <defs><linearGradient id="g" x1="0.21" y1="0.09" x2="0.79" y2="0.91">
          <stop offset="0" stop-color="${p.discTop}"/><stop offset="0.55" stop-color="${p.surface}"/>
        </linearGradient></defs>
        <circle cx="0.5" cy="0.5" r="0.5" fill="url(#g)"/>
      </svg>
      <div class="well">
        <svg class="halo" viewBox="0 0 ${halo} ${halo}">
          <defs><radialGradient id="h" cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="${p.pulse}" stop-opacity="0.45"/><stop offset="1" stop-color="${p.pulse}" stop-opacity="0"/>
          </radialGradient></defs>
          <circle cx="${halo / 2}" cy="${halo / 2}" r="${halo / 2}" fill="url(#h)"/>
        </svg>
        <svg width="${logo}" height="${logo}" viewBox="24.75 12.75 36 36" style="position:relative">
          <defs><linearGradient id="m" x1="24.75" y1="12.75" x2="60.75" y2="48.75" gradientUnits="userSpaceOnUse">
            <stop offset="0.2" stop-color="#0D9488"/><stop offset="0.4" stop-color="#14B8A6"/><stop offset="1" stop-color="#5EEAD4"/>
          </linearGradient></defs>
          <path fill-rule="evenodd" clip-rule="evenodd" d="${MARK_PATH}" fill="url(#m)"/>
        </svg>
      </div>
    </div>
  </body></html>`;
}

async function main() {
  const art = constant('SPLASH_ART');
  const disc = constant('SPLASH_DISC');
  const out = path.join(ROOT, 'assets', 'splash');
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: art, height: art }, deviceScaleFactor: SCALE });
    for (const mode of ['light', 'dark']) {
      await page.setContent(html(palette(mode), mode === 'dark', art, disc));
      const file = path.join(out, `launch-${mode}.png`);
      await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: art, height: art } });
      console.log(`✔ ${path.relative(ROOT, file)} (${art * SCALE}px, disc ${disc}pt)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
