// node sheet.mjs <out.jpg> <height> <img…> — images side by side at one height, 24px gaps, dark backdrop.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/User/Desktop/www.medicard/server/package.json');
const sharp = require('sharp');
const [out, hArg, ...files] = process.argv.slice(2);
const h = Number(hArg), gap = 24;
const imgs = await Promise.all(files.map(async (f) => { const b = await sharp(f).resize({ height: h }).toBuffer({ resolveWithObject: true }); return b; }));
const width = imgs.reduce((s, i) => s + i.info.width, 0) + gap * (imgs.length + 1);
let x = gap;
const comp = imgs.map((i) => { const c = { input: i.data, left: x, top: gap }; x += i.info.width + gap; return c; });
await sharp({ create: { width, height: h + gap * 2, channels: 3, background: '#111' } }).composite(comp).jpeg({ quality: 88 }).toFile(out);
console.log('sheet', out, width);
