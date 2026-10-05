// Bundles the city decor for the app's map WebView:
//   node brand/medirun/glow/decor/build.mjs  →  server/public/medirun/glow/decor/decor.js (global MedirunDecor)
// plus decor.json (truck loop, landmarks, partner venues) and the compressed models next to it.
// three.js is NOT bundled again: every `import … from 'three'` resolves to a shim that reads the engine's own copy
// from globalThis.__MEDIRUN_THREE__ (mapHtml.ts sets it from glow.debug.THREE before loading this script), so the
// decor's meshes, loaders and materials are the same three.js instance the engine renders with.
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const engineModules = path.resolve(here, '../engine/node_modules');
const { build } = createRequire(path.join(engineModules, '..', 'package.json'))('esbuild');   // the engine's own esbuild
const out = path.resolve(here, '../../../../server/public/medirun/glow/decor');
mkdirSync(out, { recursive: true });

const three = await import(pathToFileURL(path.join(engineModules, 'three/build/three.module.js')).href);
const shim = path.join(os.tmpdir(), 'medirun-decor-three-shim.js');
writeFileSync(shim, 'const T = globalThis.__MEDIRUN_THREE__;\n' + Object.keys(three).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k)).map((k) => `export const ${k} = T.${k};`).join('\n') + '\n');

await build({
  entryPoints: [path.join(here, 'runtime.js')],
  bundle: true, minify: true, format: 'iife', globalName: 'MedirunDecor', target: ['es2020', 'safari15'],
  outfile: path.join(out, 'decor.js'), legalComments: 'none', nodePaths: [engineModules],
  plugins: [{ name: 'engine-three', setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: shim }));
    // the lab imports with ?v= cache stamps; the bundle has none
    b.onResolve({ filter: /^\.\.?\/.*\?/ }, (a) => ({ path: path.resolve(a.resolveDir, a.path.replace(/\?.*$/, '')) }));
  } }],
});

const venues = JSON.parse(readFileSync(path.join(here, 'venues.json'), 'utf8'));
const route = JSON.parse(readFileSync(path.join(here, 'rustaveli-loop.json'), 'utf8'));
writeFileSync(path.join(out, 'decor.json'), JSON.stringify({
  source: 'OpenStreetMap contributors (ODbL)', trucks: 4, route: route.coords,
  landmarks: venues.landmarks || [], venues: venues.venues || [],
}));
for (const [from, to] of [['assets/truck/truck.glb', 'truck/truck.glb'], ['assets/mcdonalds/mcdonalds.glb', 'mcdonalds/mcdonalds.glb']]) {
  mkdirSync(path.dirname(path.join(out, to)), { recursive: true });
  try { copyFileSync(path.join(here, from), path.join(out, to)); }   // the models are not in git: the published copies are
  catch { console.warn(`${from} missing — keeping the published ${to}`); }
}
const kb = (f) => Math.round(statSync(path.join(out, f)).size / 1024);
console.log('decor.js', kb('decor.js'), 'KB · decor.json', kb('decor.json'), 'KB · truck', kb('truck/truck.glb'), 'KB · mcdonalds', kb('mcdonalds/mcdonalds.glb'), 'KB →', out);
