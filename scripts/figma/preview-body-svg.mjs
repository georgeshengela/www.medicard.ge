import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SVG = 'C:/Users/User/Desktop/Medicard DESIGN/assets/body.svg';
const OUT = 'mobile/assets/figma/illustrations/_previews';
mkdirSync(OUT, { recursive: true });

await sharp(SVG, { density: 72 }).png().toFile(join(OUT, 'body-full.png'));
console.log('full exported');

// try horizontal bands
for (const [name, y, h] of [
  ['top', 69, 260],
  ['mid', 329, 260],
  ['bot', 589, 260],
]) {
  await sharp(SVG, { density: 72 }).extract({ left: 1, top: y, width: 939, height: h }).png().toFile(join(OUT, `body-${name}.png`));
  console.log(name);
}
