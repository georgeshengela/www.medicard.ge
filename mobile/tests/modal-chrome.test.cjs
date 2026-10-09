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

// iOS (2026-10-09): a Modal nested in a Modal, closed together with its parent, left an invisible
// layer that froze the diary after „search → portion → add → save“. The portion sheet inside the
// food search must be the inline overlay, and the diary must wait before presenting the next sheet.
test('food search draws its portion sheet inline, the diary hands off between modals', () => {
  const search = readFileSync(join(root, 'src', 'components', 'nutrition', 'FoodSearchModal.tsx'), 'utf8');
  assert.match(search, /<PortionSheet\s+inline\b/);
  const diary = readFileSync(join(root, 'app', 'nutrition', 'diary.tsx'), 'utf8');
  assert.match(diary, /MODAL_HANDOFF_MS/);
  assert.doesNotMatch(diary, /visible=\{sheet === "barcode" && !product\}/);
});
