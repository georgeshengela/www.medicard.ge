const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx|ts|jsx|js)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

// On iOS the tab pill lives in a FullWindowOverlay above every RN Modal. Only the
// app Modal (components/ui/appModal) hides that chrome while it is open.
test('screens use the chrome-aware Modal, never react-native Modal', () => {
  const offenders = [...sources(join(root, 'app')), ...sources(join(root, 'src'))]
    .filter((file) => !file.endsWith(join('ui', 'appModal.tsx')))
    .filter((file) => /import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*['"]react-native['"]/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);
});
