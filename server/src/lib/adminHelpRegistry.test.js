import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminDir = path.resolve(__dirname, '../../admin');

function loadHelpRegistry() {
  const code = fs.readFileSync(path.join(adminDir, 'admin-help-content.js'), 'utf8');
  const sandbox = { window: {}, console };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);
  return sandbox.AdminHelp;
}

function collectReferencedHelpKeys() {
  const files = [
    'admin-v3.js',
    'admin-users-v3.js',
    'command-center-v3.js',
    'admin-help-content.js',
  ];
  const keys = new Set();
  const re = /(?:helpKey:\s*['"]([a-z0-9.]+)['"]|infoButton\(\s*['"]([a-z0-9.]+)['"])/gi;
  for (const file of files) {
    const text = fs.readFileSync(path.join(adminDir, file), 'utf8');
    let m;
    while ((m = re.exec(text))) {
      keys.add(m[1] || m[2]);
    }
  }
  return [...keys].sort();
}

describe('Admin help registry', () => {
  it('resolves every referenced helpKey', () => {
    const AdminHelp = loadHelpRegistry();
    assert.ok(AdminHelp?.get);
    const refs = collectReferencedHelpKeys();
    assert.ok(refs.length >= 10, `expected help keys, got ${refs.length}`);
    const missing = refs.filter((k) => !AdminHelp.get(k));
    assert.deepEqual(missing, [], `missing help entries: ${missing.join(', ')}`);
  });

  it('entries expose title + summary for operators', () => {
    const AdminHelp = loadHelpRegistry();
    for (const key of AdminHelp.keys()) {
      const entry = AdminHelp.get(key);
      assert.ok(entry.title, key);
      assert.ok(entry.summary, key);
      assert.doesNotMatch(entry.summary, /undefined|ADMIN_HELP|helpKey/i);
    }
  });
});
