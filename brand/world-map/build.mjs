// Front-page world map: a dotted land grid + one label point per country.
// Source: Natural Earth 1:50m admin-0 countries (public domain), downloaded next to this file:
//   curl -sL -o ne_50m_countries.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
// Run: node brand/world-map/build.mjs  →  server/public/world/land.svg + countries.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../server/public/world');
const geo = JSON.parse(readFileSync(join(here, 'ne_50m_countries.geojson'), 'utf8'));

// Equirectangular, Antarctica and the far north cut off
const LON0 = -180, LON1 = 180, LAT0 = 80, LAT1 = -58;
const STEP = 2;            // degrees per dot
const CELL = 10;           // viewBox units per dot
const COLS = (LON1 - LON0) / STEP;
const ROWS = (LAT0 - LAT1) / STEP;
const W = COLS * CELL, H = ROWS * CELL;
const xOf = (lon) => ((lon - LON0) / (LON1 - LON0)) * W;
const yOf = (lat) => ((LAT0 - lat) / (LAT0 - LAT1)) * H;

const polys = [];
for (const f of geo.features) {
  const g = f.geometry;
  const list = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const rings of list) {
    let minX = 180, maxX = -180, minY = 90, maxY = -90;
    for (const [x, y] of rings[0]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    polys.push({ rings, minX, maxX, minY, maxY });
  }
}
function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function onLand(lon, lat) {
  for (const p of polys) {
    if (lon < p.minX || lon > p.maxX || lat < p.minY || lat > p.maxY) continue;
    if (inRing(p.rings[0], lon, lat) && !p.rings.slice(1).some((h) => inRing(h, lon, lat))) return true;
  }
  return false;
}

// Hex-staggered rows read calmer than a square grid
let d = '';
let dots = 0;
for (let r = 0; r < ROWS; r++) {
  const shift = r % 2 ? STEP / 2 : 0;
  for (let c = 0; c < COLS; c++) {
    const lon = LON0 + (c + 0.5) * STEP + shift;
    const lat = LAT0 - (r + 0.5) * STEP;
    if (lon > LON1 || !onLand(lon, lat)) continue;
    d += `M${Math.round(xOf(lon))} ${Math.round(yOf(lat))}h0`;
    dots++;
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><path d="${d}" fill="none" stroke="#0B2B2E" stroke-width="4.2" stroke-linecap="round"/></svg>\n`;

// One label point per country (ISO 3166-1 alpha-2), in the same viewBox units
const countries = {};
for (const f of geo.features) {
  const p = f.properties;
  const iso = [p.ISO_A2, p.ISO_A2_EH].find((v) => /^[A-Z]{2}$/.test(v || ''));
  if (!iso || countries[iso] || !Number.isFinite(p.LABEL_X)) continue;
  countries[iso] = [Math.round(xOf(p.LABEL_X) * 10) / 10, Math.round(yOf(p.LABEL_Y) * 10) / 10];
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'land.svg'), svg);
writeFileSync(join(out, 'countries.json'), JSON.stringify({ w: W, h: H, c: countries }) + '\n');
console.log(`land.svg ${dots} dots (${(svg.length / 1024).toFixed(1)} KB), countries.json ${Object.keys(countries).length} countries`);
