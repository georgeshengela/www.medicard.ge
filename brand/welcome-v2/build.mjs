// Builds the self-contained concept board: inlines the Medi flat mascot modules (+ traced parts) and the
// MediFont brand face into board.src.html → board.html (one file, publishable as an artifact).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const flat = join(repo, 'brand', 'medi-character', 'flat');
const read = (p) => readFileSync(p, 'utf8');
const strip = (src) => src.replace(/^import .*$/gm, '').replace(/^export /gm, '');

const neutral = read(join(flat, 'medi-flat.js')).match(/export const NEUTRAL = \{[\s\S]*?\n\};/)[0].replace('export ', '');
const medi = `
window.MediKit = (() => {
  const BP = (() => { ${strip(read(join(flat, 'body-parts.js')))}; return { bodyParts, PIVOTS }; })();
  const MO = (() => { ${neutral}\n${strip(read(join(flat, 'motion.js')))}; return { CLIPS, Animator }; })();
  const MT = ((bodyParts, PIVOTS) => { ${strip(read(join(flat, 'medi-traced.js')))}; return { createMedi }; })(BP.bodyParts, BP.PIVOTS);
  return { createMedi: MT.createMedi, Animator: MO.Animator, CLIPS: MO.CLIPS, PARTS: ${read(join(flat, 'medi-parts.json')).trim()} };
})();`;

const font = readFileSync(join(repo, 'mobile', 'assets', 'fonts', 'medifontbold.otf')).toString('base64');
const out = read(join(here, 'board.src.html')).replace('@@MEDIFONT@@', font).replace('/*@@MEDI@@*/', () => medi);
writeFileSync(join(here, 'board.html'), out);
console.log('board.html', (out.length / 1024).toFixed(0), 'KB');
