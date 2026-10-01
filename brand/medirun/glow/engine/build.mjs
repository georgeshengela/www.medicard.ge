// Bundles glow-engine.js (+ three.js, GLTFLoader, pbf, vector-tile) into one classic script for the app's map WebView:
//   node brand/medirun/glow/engine/build.mjs  →  server/public/medirun/glow/engine.js  (global MedirunGlow)
// and copies the runner models next to it. Served with CORS by medicard.ge; mapHtml.ts loads it by URL.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../../../server/public/medirun/glow');
mkdirSync(out, { recursive: true });
await build({
  entryPoints: [path.join(here, 'glow-engine.js')],
  bundle: true, minify: true, format: 'iife', globalName: 'MedirunGlow', target: ['es2020', 'safari15'],
  outfile: path.join(out, 'engine.js'), legalComments: 'none',
});
for (const key of ['m', 'f']) {
  try { copyFileSync(path.join(here, '..', 'assets', `runner-${key}.glb`), path.join(out, `runner-${key}.glb`)); } catch { console.warn(`runner-${key}.glb missing`); }
}
console.log('engine.js', Math.round(statSync(path.join(out, 'engine.js')).size / 1024), 'KB →', out);
