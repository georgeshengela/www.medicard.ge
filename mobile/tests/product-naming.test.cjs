// Product freeze 2026-09-26: the user-visible name is MEDIRUN everywhere. Commit c876f56 brought a bare
// "RUN" label back on the tab bar; this keeps it from returning. Only the MediRunLogo (MEDI + RUN pair)
// may render "RUN" as its own text node. Internal identifiers (medipulsi*, 'RUN' enums) are not checked.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
// Owner decision 2026-09-30 (final): the bottom tab's center button reads RUN.
const ALLOWED_BARE_RUN = new Set([
  path.join('src', 'components', 'run', 'PulseIdentity.tsx'),
  path.join('src', 'components', 'navigation', 'FloatingTabBar.tsx'),
]);

function files(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) files(abs, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(abs);
  }
  return out;
}

test('user-facing copy never names the product RUN / MEDI RUN / Medi Run / MEDIPULSI', () => {
  const offenders = [];
  for (const abs of [...files(path.join(root, 'app')), ...files(path.join(root, 'src'))]) {
    const rel = path.relative(root, abs);
    const src = fs.readFileSync(abs, 'utf8');
    if (!ALLOWED_BARE_RUN.has(rel) && />\s*RUN\s*</.test(src)) offenders.push(`${rel}: bare RUN text`);
    if (/['"`>][^'"`<\n]*\b(MEDI RUN|Medi Run|MEDI PULSI|MEDIPULSI|MediPulsi)\b/.test(src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''))) {
      offenders.push(`${rel}: old product name in a string`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('store-facing permission texts in app.json use MEDIRUN', () => {
  const appJson = fs.readFileSync(path.join(root, 'app.json'), 'utf8');
  assert.doesNotMatch(appJson, /\b(MEDI RUN|Medi Run|MEDI PULSI|MEDIPULSI|MediPulsi)\b/);
});
