// The weekly Medi mission reaches only app JS that says it can show it (X-Medicard-Caps), because
// OTA version numbers are reused across branches. App and server must name the same capability.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const read = (rel) => readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

test('every app request declares the weekly-medi capability the server checks', () => {
  const api = read('mobile/src/lib/api.ts');
  const quest = read('server/src/lib/quest.js');
  const appCaps = api.match(/const CLIENT_CAPS = '([^']+)'/)?.[1] ?? '';
  const serverCap = quest.match(/export const WEEKLY_MEDI_CAP = '([^']+)'/)?.[1];
  assert.ok(serverCap, 'server capability constant');
  assert.ok(appCaps.split(',').map((c) => c.trim()).includes(serverCap));
  assert.match(api, /'X-Medicard-Caps': CLIENT_CAPS/);
});
