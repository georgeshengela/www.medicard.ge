/**
 * Find approximate Medi companion chip: small circular teal near "Medi Quest" title row.
 * Scans PNG for teal pixels in upper-mid right band.
 */
const fs = require('fs');
const zlib = require('zlib');
const path = process.argv[2];
const buf = fs.readFileSync(path);
if (buf.toString('ascii', 1, 4) !== 'PNG') throw new Error('not png');
const w = buf.readUInt32BE(16);
const h = buf.readUInt32BE(20);
// Use sharp if available, else skip
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.log('NO_SHARP', w, h);
  process.exit(0);
}
sharp(path)
  .raw()
  .ensureAlpha()
  .toBuffer({ resolveWithObject: true })
  .then(({ data, info }) => {
    const hits = [];
    for (y = Math.floor(h * 0.22); y < Math.floor(h * 0.42); y++) {
      for (x = Math.floor(w * 0.75); x < w - 20; x++) {
        const i = (y * info.width + x) * 4;
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        // teal-ish QUEST wash / primary
        if (r < 120 && g > 140 && b > 130 && g - r > 40) {
          hits.push({ x, y });
        }
      }
    }
    if (!hits.length) {
      console.log('NO_TEAL_HITS');
      return;
    }
    const cx = Math.round(hits.reduce((s, p) => s + p.x, 0) / hits.length);
    const cy = Math.round(hits.reduce((s, p) => s + p.y, 0) / hits.length);
    console.log(JSON.stringify({ w, h, hits: hits.length, cx, cy }));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
