import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SVG = 'C:/Users/User/Desktop/Medicard DESIGN/assets/Illustration.svg';
const OUT = 'mobile/assets/figma/illustrations/_previews';
mkdirSync(OUT, { recursive: true });

// lower half of organs section
await sharp(SVG, { density: 72 })
  .extract({ left: 257, top: 3628, width: 939, height: 383 })
  .png()
  .toFile(join(OUT, 'organs-lower.png'));
console.log('organs-lower');
