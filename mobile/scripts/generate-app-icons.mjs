/**
 * Generates Medicard app icon assets from the official mark.
 * Run: npm run icons:generate
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, '../assets');

const BRAND = '#14B8A6';
const BRAND_DARK = '#0F766E';

/** Logo size inside the canvas — ~76% leaves a balanced inset on all sides. */
const ICON_FILL = 0.76;
const ANDROID_FILL = 0.66;
const SPLASH_FILL = 0.78;

/** Geometric center of the mark in logo.svg coordinates. */
const MARK_CX = 102.75;
const MARK_CY = 66.75;

const MARK_PATH =
  'M102.75 30.75C111.787 30.75 119.114 38.0762 119.114 47.1136V50.3864H122.386C131.424 50.3864 138.75 57.7126 138.75 66.75C138.75 75.7874 131.424 83.1136 122.386 83.1136H119.114V86.3864C119.114 95.4238 111.787 102.75 102.75 102.75C93.7126 102.75 86.3864 95.4238 86.3864 86.3864V83.1136H83.1136C74.0762 83.1136 66.75 75.7874 66.75 66.75C66.75 57.7126 74.0762 50.3864 83.1136 50.3864H86.3864V47.1136C86.3864 38.0762 93.7126 30.75 102.75 30.75ZM118.931 56.9318C117.422 70.5842 106.584 81.4221 92.9318 82.9315V86.3864C92.9318 91.8088 97.3276 96.2045 102.75 96.2045C108.172 96.2045 112.568 91.8088 112.568 86.3864V79.8409C112.568 78.0334 114.033 76.5682 115.841 76.5682H122.386C127.809 76.5682 132.205 72.1724 132.205 66.75C132.205 61.3276 127.809 56.9318 122.386 56.9318H118.931ZM102.75 37.2955C97.3276 37.2955 92.9318 41.6912 92.9318 47.1136V53.6591C92.9318 55.4666 91.4666 56.9318 89.6591 56.9318H83.1136C77.6912 56.9318 73.2955 61.3276 73.2955 66.75C73.2955 72.1724 77.6912 76.5682 83.1136 76.5682H86.5685C88.0779 62.9158 98.9157 52.0762 112.568 50.5669V47.1136C112.568 41.6912 108.172 37.2955 102.75 37.2955ZM112.295 57.2035C102.482 58.7282 94.7282 66.482 93.2035 76.2949C103.018 74.7706 110.771 67.0175 112.295 57.2035Z';

function iconSvg(size, { fillRatio = 0.82, bg = true, fill = '#FFFFFF' } = {}) {
  const half = size / 2;
  // Mark spans ~72 units; scale so it fills fillRatio of the canvas.
  const scale = (size * fillRatio) / 72;
  const bgLayer = bg
    ? `<defs>
        <linearGradient id="bg" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${BRAND}"/>
          <stop offset="100%" stop-color="${BRAND_DARK}"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)"/>`
    : '';

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${bgLayer}
    <g transform="translate(${half} ${half}) scale(${scale}) translate(${-MARK_CX} ${-MARK_CY})">
      <path fill-rule="evenodd" clip-rule="evenodd" d="${MARK_PATH}" fill="${fill}"/>
    </g>
  </svg>`;
}

async function renderSvg(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

async function writePng(filePath, buffer) {
  await writeFile(filePath, buffer);
  console.log('wrote', path.relative(assetsDir, filePath));
}

async function main() {
  await mkdir(assetsDir, { recursive: true });

  // Store / iOS icon — centered with comfortable inset
  await writePng(path.join(assetsDir, 'icon.png'), await renderSvg(iconSvg(1024, { fillRatio: ICON_FILL }), 1024));

  // Android adaptive foreground — slightly smaller for mask safe zone
  await writePng(
    path.join(assetsDir, 'android-icon-foreground.png'),
    await renderSvg(iconSvg(1024, { fillRatio: ANDROID_FILL, bg: false }), 1024),
  );
  await writePng(
    path.join(assetsDir, 'android-icon-monochrome.png'),
    await renderSvg(iconSvg(1024, { fillRatio: ANDROID_FILL, bg: false }), 1024),
  );

  await writePng(
    path.join(assetsDir, 'android-icon-background.png'),
    await renderSvg(
      `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="${BRAND}"/>
            <stop offset="100%" stop-color="${BRAND_DARK}"/>
          </linearGradient>
        </defs>
        <rect width="1024" height="1024" fill="url(#bg)"/>
      </svg>`,
      1024,
    ),
  );

  await writePng(
    path.join(assetsDir, 'splash-icon.png'),
    await renderSvg(iconSvg(512, { fillRatio: SPLASH_FILL, bg: false }), 512),
  );

  await writePng(path.join(assetsDir, 'favicon.png'), await renderSvg(iconSvg(192, { fillRatio: ICON_FILL }), 192));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
