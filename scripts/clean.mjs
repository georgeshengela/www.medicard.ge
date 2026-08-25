/**
 * Remove local-only artefacts: scrape probes, Expo cache, export checks, screenshots.
 * Does not remove node_modules (run npm run install:all after a deep clean if needed).
 */
import { existsSync, readdirSync, rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

for (const name of readdirSync(root)) {
  if (/^(tmp-|pd-).*\.js$/i.test(name) || name === 'gpc.html') {
    unlinkSync(join(root, name));
    console.log(`removed ${name}`);
  }
}

const paths = [
  'mobile/.expo',
  'mobile/.expo-tmp-check',
  'mobile/.expo-export-check',
  'mobile/screenshots',
  'mobile/dist',
  'mobile/web-build',
  'server/uploads',
  'server/generated',
  'server/psp-test.html',
  'mobile/LICENSE',
];

for (const rel of paths) {
  const target = join(root, rel);
  if (!existsSync(target)) continue;
  rmSync(target, { recursive: true, force: true });
  console.log(`removed ${rel}`);
}

console.log('clean done');
