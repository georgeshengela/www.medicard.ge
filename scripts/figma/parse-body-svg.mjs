import { readFileSync } from 'node:fs';

const svg = readFileSync('C:/Users/User/Desktop/Medicard DESIGN/assets/body.svg', 'utf8');

console.log('size', svg.length);
const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
const width = svg.match(/\bwidth="([\d.]+)"/)?.[1];
const height = svg.match(/\bheight="([\d.]+)"/)?.[1];
console.log({ viewBox, width, height });

// Figma section rects
const sectionRe = /rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*stroke="#9747FF"/g;
for (const m of svg.matchAll(sectionRe)) {
  console.log('section', { x: +m[1], y: +m[2], w: +m[3], h: +m[4] });
}

// Large rects
const rects = [];
for (const m of svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
  const w = +m[3], h = +m[4];
  if (w >= 50 && h >= 80) rects.push({ x: +m[1], y: +m[2], w, h });
}
rects.sort((a, b) => a.y - b.y || a.x - b.x);
console.log('\nlarge rects:', rects.length);
for (const r of rects.slice(0, 40)) {
  console.log(`  x=${Math.round(r.x)} y=${Math.round(r.y)} ${Math.round(r.w)}×${Math.round(r.h)}`);
}

// Text labels / ids
for (const m of svg.matchAll(/id="([^"]*(?:male|female|men|women|ecto|meso|endo|body)[^"]*)"/gi)) {
  console.log('id', m[1]);
}
