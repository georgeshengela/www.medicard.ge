import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SVG_PATH = 'C:/Users/User/Desktop/Medicard DESIGN/assets/body.svg';
const OUT_DIR = join(ROOT, 'mobile', 'assets', 'figma', 'body-types');

/** Dashed grid in body.svg — 6 cols × 2 rows (male / female). */
const GRID = { left: 0.5, top: 68.5, width: 939, height: 783 };
const COLS = 6;
const ROWS = 2;
const CELL_W = GRID.width / COLS;
const CELL_H = GRID.height / ROWS;
const PAD = 2;
const SLICE_W = Math.round(CELL_W - PAD * 2);
const SLICE_H = Math.round(CELL_H - PAD * 2);
/** Extra transparent margin so silhouettes never touch PNG edges in the carousel. */
const EXPORT_PAD = { top: 18, bottom: 20, left: 8, right: 8 };

const COL_X = Array.from({ length: COLS }, (_, i) =>
  Math.round(GRID.left + i * CELL_W + PAD),
);
const ROW_Y = {
  male: Math.round(GRID.top + PAD),
  female: Math.round(GRID.top + CELL_H + PAD),
};

const TYPES = [
  { type: 'ENDOMORPH', unselected: 0, selected: 3 },
  { type: 'ECTOMORPH', unselected: 1, selected: 4 },
  { type: 'MESOMORPH', unselected: 2, selected: 5 },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const sharp = (await import('sharp')).default;
  const rendered = await sharp(SVG_PATH, { density: 72 }).png().toBuffer();
  const manifest = {};

  for (const { key: gender, rowKey } of [
    { key: 'male', rowKey: 'male' },
    { key: 'female', rowKey: 'female' },
  ]) {
    const top = ROW_Y[rowKey];
    for (const { type, unselected, selected } of TYPES) {
      for (const [state, col] of [
        ['unselected', unselected],
        ['selected', selected],
      ]) {
        const assetKey = `${gender}-${type.toLowerCase()}-${state}`;
        const file = `${assetKey}.png`;
        await sharp(rendered)
          .extract({ left: COL_X[col], top, width: SLICE_W, height: SLICE_H })
          .extend({
            top: EXPORT_PAD.top,
            bottom: EXPORT_PAD.bottom,
            left: EXPORT_PAD.left,
            right: EXPORT_PAD.right,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toFile(join(OUT_DIR, file));
        manifest[assetKey] = file;
        console.log(file, `${SLICE_W}x${SLICE_H} @ (${COL_X[col]},${top})`);
      }
    }
  }

  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Done → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
