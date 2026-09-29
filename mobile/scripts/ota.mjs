#!/usr/bin/env node
/**
 * Over-the-air updates (EAS Update) without App Review — JS, copy, styles and images only.
 *
 *   npm run ota:baseline            after starting a store build: remember this train's native fingerprint
 *   npm run ota -- "რა შეიცვალა"     publish to the production channel (store builds of the same train)
 *   npm run ota -- --preview "…"    publish to the preview channel (internal/AdHoc builds)
 *   npm run ota -- --check          only verify that an update is allowed
 *
 * runtimeVersion is the store train `G.0.0.B` (app.config.js). An update is refused when the
 * native fingerprint differs from the train's store build — a new native module, plugin,
 * permission or SDK needs a store build (train + 1), never an OTA, or the app would crash.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createFingerprintAsync, SourceSkips } from '@expo/fingerprint';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINES = path.join(ROOT, 'ota-baselines.json');
const API = 'https://medicard.ge';

process.chdir(ROOT);
// Bundles must always talk to production, never a LAN/dev URL from .env.development.local.
process.env.EXPO_PUBLIC_API_URL = API;
process.env.NODE_ENV = 'production';

const args = process.argv.slice(2);
const mode = args[0] === 'baseline' ? 'baseline' : args.includes('--check') ? 'check' : 'publish';
const channel = args.includes('--preview') ? 'preview' : 'production';
const message = args.filter((a) => !a.startsWith('--') && a !== 'baseline').join(' ').trim();

const fail = (text) => {
  console.error(`\n✖ ${text}\n`);
  process.exit(1);
};

const version = JSON.parse(readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo.version;
const five = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!five) fail(`app.json expo.version must be G.0.0.B.R, got ${version}`);
const runtime = `${five[1]}.${five[2]}.${five[3]}.${five[4]}`;

/** Native-only fingerprint: version numbers, names and the JS-only `extra` section are ignored. */
async function nativeFingerprint() {
  process.env.MEDICARD_FINGERPRINT = '1';
  const fp = await createFingerprintAsync(ROOT, {
    sourceSkips:
      SourceSkips.ExpoConfigVersions |
      SourceSkips.ExpoConfigRuntimeVersionIfString |
      SourceSkips.ExpoConfigExtraSection |
      SourceSkips.PackageJsonScriptsAll |
      SourceSkips.GitIgnore,
    // Submit/build profiles do not change the binary; an ascAppId edit once blocked an OTA.
    ignorePaths: ['eas.json'],
  });
  delete process.env.MEDICARD_FINGERPRINT;
  return fp.hash;
}

const baselines = existsSync(BASELINES) ? JSON.parse(readFileSync(BASELINES, 'utf8')) : {};
const hash = await nativeFingerprint();

if (mode === 'baseline') {
  baselines[runtime] = { fingerprint: hash, version, recordedAt: new Date().toISOString() };
  writeFileSync(BASELINES, `${JSON.stringify(baselines, null, 2)}\n`);
  console.log(`✔ train ${runtime} (${version}) native fingerprint recorded. Commit ota-baselines.json.`);
  process.exit(0);
}

const base = baselines[runtime];
if (!base) {
  fail(`train ${runtime} has no store-build baseline. Updates reach only store builds of the same train.
  Run \`npm run ota:baseline\` right when you start that train's store build (EAS production).`);
}
if (base.fingerprint !== hash) {
  fail(`native code changed since the ${runtime} store build (fingerprint ${base.fingerprint.slice(0, 10)} → ${hash.slice(0, 10)}).
  This change needs a store build: bump the train in app.json (e.g. ${five[1]}.0.0.${Number(five[4]) + 1}.0),
  build with EAS and send it to review. OTA would crash on the old binary.`);
}
console.log(`✔ OTA allowed: ${version} → runtime ${runtime}, channel ${channel}. Native code unchanged.`);
if (mode === 'check') process.exit(0);

if (!message) fail('write what changed: npm run ota -- "კვების ეკრანის ტექსტი გასწორდა"');
const easArgs = ['eas-cli@latest', 'update', '--channel', channel, '--environment', channel, '--message', `${version} · ${message}`, '--non-interactive'];
// EAS env vars for this environment are empty on purpose; EXPO_PUBLIC_API_URL is pinned above.
// Windows runs npx through cmd.exe, which splits unquoted arguments on spaces — quote each one.
const quote = (arg) => (/^[\w@.:/=-]+$/.test(arg) ? arg : `"${arg.replace(/["%^&|<>]/g, '')}"`);
if (process.env.OTA_DRY_RUN === '1') {
  console.log(process.platform === 'win32' ? ['npx', ...easArgs].map(quote).join(' ') : easArgs);
  process.exit(0);
}
const run = process.platform === 'win32'
  ? spawnSync(['npx', ...easArgs].map(quote).join(' '), { stdio: 'inherit', shell: true, env: process.env })
  : spawnSync('npx', easArgs, { stdio: 'inherit', env: process.env });
process.exit(run.status ?? 1);
