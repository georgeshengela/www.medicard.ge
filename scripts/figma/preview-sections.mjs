import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SVG = 'C:/Users/User/Desktop/Medicard DESIGN/assets/Illustration.svg';
const OUT = 'mobile/assets/figma/illustrations/_previews';
mkdirSync(OUT, { recursive: true });

const sections = [
  ['row-1132', 257, 1132, 319, 103],
  ['row-1432', 257, 1432, 487, 127],
  ['row-1756', 257, 1756, 263, 103],
  ['body-types-full', 257, 505, 1443, 431],
  ['water', 257, 6363, 287, 287],
];

for (const [name, x, y, w, h] of sections) {
  await sharp(SVG, { density: 72 }).extract({ left: x, top: y, width: w, height: h }).png().toFile(join(OUT, `${name}.png`));
  console.log(name);
}
