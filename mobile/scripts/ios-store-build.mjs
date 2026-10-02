#!/usr/bin/env node
/**
 * iOS store build (EAS production) with auto-submit to App Store Connect.
 *
 *   npm run build:ios                     → eas build -p ios --profile production --auto-submit
 *   npm run build:ios -- --non-interactive  (extra arguments go to eas build)
 *
 * The MEDIRUN Live Activity extension (expo-widgets) takes its CFBundleVersion from app.json
 * `ios.buildNumber` at prebuild, while EAS gives the app the remote counter + 1 (appVersionSource: remote).
 * Apple refuses an extension whose build number differs from its app, so app.json is aligned with the
 * remote counter first. Commit the app.json change afterwards.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const isWin = process.platform === 'win32';
const quote = (arg) => (/^[\w@.:/=-]+$/.test(arg) ? arg : `"${arg.replace(/["%^&|<>]/g, '')}"`);
function eas(args, capture) {
  const full = ['eas-cli@latest', ...args];
  return isWin
    ? spawnSync(['npx', ...full].map(quote).join(' '), { shell: true, encoding: 'utf8', stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit' })
    : spawnSync('npx', full, { encoding: 'utf8', stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit' });
}

const read = eas(['build:version:get', '--platform', 'ios', '--profile', 'production', '--json', '--non-interactive'], true);
const match = /"buildNumber"\s*:\s*"(\d+)"/.exec(read.stdout || '');
if (read.status !== 0 || !match) {
  console.error('\n✖ Could not read the remote iOS build number (eas build:version:get).\n');
  process.exit(1);
}
const next = String(Number(match[1]) + 1);

const appPath = path.join(ROOT, 'app.json');
const raw = readFileSync(appPath, 'utf8');
const app = JSON.parse(raw);
if (app.expo.ios.buildNumber !== next) {
  app.expo.ios.buildNumber = next;
  writeFileSync(appPath, `${JSON.stringify(app, null, 2)}\n`);
  console.log(`✔ app.json ios.buildNumber → ${next} (EAS remote ${match[1]} + 1, matches the widget extension)`);
} else {
  console.log(`✔ app.json ios.buildNumber already ${next}`);
}

const build = eas(['build', '--platform', 'ios', '--profile', 'production', '--auto-submit', ...process.argv.slice(2)], false);
process.exit(build.status ?? 1);
