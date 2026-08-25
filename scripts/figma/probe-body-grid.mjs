import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PNG = 'mobile/assets/figma/illustrations/_previews/body-full.png';
const OUT = 'mobile/assets/figma/illustrations/_previews';
mkdirSync(OUT, { recursive: true });

for (const [name, x] of [
  ['m-ecto-s', 625],
  ['m-meso-s', 780],
  ['f-meso-u', 315],
]) {
  await sharp(PNG).extract({ left: x, top: 460, width: 145, height: 350 }).png().toFile(join(OUT, `try-${name}.png`));
}
console.log('done');
