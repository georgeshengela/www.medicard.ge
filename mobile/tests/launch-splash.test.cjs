// The native launch screen and the JS launch curtain must stay one picture (owner 2026-10-17, train 1.0.0.26):
// app.json's expo-splash-screen colours are the velvet surfaces, its imageWidth is launchArt's SPLASH_ART, and the
// PNGs are the 3× renders from scripts/generate-launch-art.mjs (rerun it after changing the disc or the palette).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function velvet(mode, key) {
  const src = read('src/theme/velvet.ts');
  const block = new RegExp(`\\n\\s{2}${mode}: \\{([\\s\\S]*?)\\n\\s{2}\\}`).exec(src.slice(src.indexOf('export const VELVET')));
  return new RegExp(`\\b${key}: '(#[0-9A-Fa-f]{6})'`).exec(block[1])[1];
}

function constant(name) {
  return Number(new RegExp(`export const ${name} = (\\d+);`).exec(read('src/components/launch/launchArt.ts'))[1]);
}

function pngSize(file) {
  const buf = fs.readFileSync(path.join(root, file));
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const splash = JSON.parse(read('app.json')).expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];

test('splash backgrounds are the velvet surfaces', () => {
  assert.equal(splash.backgroundColor.toUpperCase(), velvet('light', 'surface').toUpperCase());
  assert.equal(splash.dark.backgroundColor.toUpperCase(), velvet('dark', 'surface').toUpperCase());
});

test('splash image width is SPLASH_ART and the art leaves room for the disc', () => {
  assert.equal(splash.imageWidth, constant('SPLASH_ART'));
  assert.ok(constant('SPLASH_ART') - constant('SPLASH_DISC') >= 120, 'the disc shadows need ~60 pt on each side');
});

test('light and dark art exist as square 3× renders', () => {
  for (const file of [splash.image, splash.dark.image]) {
    const size = pngSize(file.replace(/^\.\//, ''));
    assert.equal(size.width, constant('SPLASH_ART') * 3, file);
    assert.equal(size.height, size.width, file);
  }
});

test('the curtain shows the same files the native splash shows', () => {
  const curtain = read('src/components/launch/LaunchCurtain.tsx');
  assert.match(curtain, /assets\/splash\/launch-light\.png/);
  assert.match(curtain, /assets\/splash\/launch-dark\.png/);
  assert.equal(splash.image, './assets/splash/launch-light.png');
  assert.equal(splash.dark.image, './assets/splash/launch-dark.png');
});

test('the splash hides through launchHandoff only, also for the maintenance gate', () => {
  const layout = read('app/_layout.tsx');
  assert.doesNotMatch(layout, /SplashScreen\.hideAsync/);
  assert.match(layout, /if \(!ready\) return;\s*\n\s*\/\/[^\n]*\n\s*hideLaunchScreen\(\);\s*\n\s*if \(gate\.kind !== 'ok'\) return;/);
  assert.match(layout, /<LaunchCurtain \/>/);
});
