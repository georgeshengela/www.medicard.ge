import { readFileSync } from 'node:fs';

const svg = readFileSync('C:/Users/User/Desktop/Medicard DESIGN/assets/Illustration.svg', 'utf8');

const rects = [];
for (const m of svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
  const w = +m[3],
    h = +m[4];
  if (w >= 30 && h >= 30) {
    rects.push({ x: +m[1], y: +m[2], w, h, cx: +m[1] + w / 2, cy: +m[2] + h / 2 });
  }
}

for (const [name, y0, y1] of [
  ['5800-6200', 5800, 6200],
  ['6200-6600', 6200, 6600],
  ['6600-7000', 6600, 7000],
]) {
  const band = rects.filter((r) => r.cy >= y0 && r.cy <= y1).sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  console.log(`\n${name} (${band.length}):`);
  const seen = new Set();
  for (const r of band) {
    const key = `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  x=${Math.round(r.x)} y=${Math.round(r.y)} ${Math.round(r.w)}×${Math.round(r.h)}`);
  }
}
