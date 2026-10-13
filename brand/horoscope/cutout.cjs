// Cuts a flat-vector picture off its plain white background (alpha from distance to white, colour un-blended),
// trims it and writes a PNG. Used for the Oracle's hat (oracle/hat_only_witch.png → mobile assets).
//   node brand/horoscope/cutout.cjs <in.png> <out.png> [width]
const sharp = require('sharp');

async function main() {
  const [input, output, widthArg] = process.argv.slice(2);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // alpha = how far the pixel is from white (white → 0); strong colours reach 255 quickly
    const dist = 255 - Math.min(r, g, b);
    let a = Math.min(255, Math.max(0, (dist - 6) * 3.2));
    if (a <= 0) { out[i + 3] = 0; continue; }
    const af = a / 255;
    const un = (c) => Math.max(0, Math.min(255, Math.round((c - 255 * (1 - af)) / af)));
    out[i] = un(r); out[i + 1] = un(g); out[i + 2] = un(b); out[i + 3] = Math.round(a);
  }
  let img = sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png();
  const trimmed = await img.toBuffer();
  img = sharp(trimmed).trim({ threshold: 1 });
  if (widthArg) img = img.resize({ width: Number(widthArg) });
  const meta = await img.png({ compressionLevel: 9 }).toFile(output);
  console.log('wrote', output, meta.width, meta.height, meta.size);
}
main().catch((e) => { console.error(e); process.exit(1); });
