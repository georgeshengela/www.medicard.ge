import { readFileSync } from 'node:fs';

const svg = readFileSync('C:/Users/User/Desktop/Medicard DESIGN/assets/Illustration.svg', 'utf8');

const sectionRe =
  /rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*stroke="#9747FF"/g;
const sections = [];
for (const m of svg.matchAll(sectionRe)) {
  sections.push({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] });
}

console.log(`Found ${sections.length} Figma sections`);
for (const s of sections) console.log(s);

// Title paths often near y positions - sample large horizontal bands
const titleRe = /path d="M[\d.]+ ([\d.]+)L/g;
const ys = [...svg.matchAll(titleRe)].map((m) => +m[1]).filter((y) => y > 400 && y < 12000);
ys.sort((a, b) => a - b);
const uniqueYs = [...new Set(ys.map((y) => Math.round(y / 50) * 50))];
console.log('Title band Y samples:', uniqueYs.slice(0, 30));
