// Render runs `npm run db:install` as the Pre-Deploy Command. An install script that is not in
// that chain never reaches production (2026-09-28: funnel, email and community tables were
// missing because the service ignored render.yaml's preDeployCommand).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

test('every server/scripts/install-*.mjs runs in db:install', () => {
  const scripts = readdirSync(new URL('server/scripts/', root)).filter((f) => /^install-.*\.mjs$/.test(f)).sort();
  const chain = String(pkg.scripts['db:install'] || '')
    .split('&&')
    .map((part) => part.trim().split('/').pop())
    .sort();
  assert.deepEqual(chain, scripts);
});

test('db:install never seeds and release still installs before seeding', () => {
  assert.doesNotMatch(pkg.scripts['db:install'], /seed/);
  assert.match(pkg.scripts.release, /npm run db:install && npm --prefix server run seed/);
});
