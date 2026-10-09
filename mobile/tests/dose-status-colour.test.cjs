const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const repo = join(root, '..');
const read = (...parts) => readFileSync(join(...parts), 'utf8');

// Owner 2026-10-08: a skipped or missed dose is amber („look here“), never red. Red stays for
// deleting and real alerts (the delete row on the dose screen keeps it).

test('MEDIPILL draws skipped doses in amber, not red', () => {
  const kit = read(root, 'src/components/medications/MedsHubUI.tsx');
  const skippedCase = kit.match(/case 'skipped':\s*\n\s*return ([^;]+);/);
  assert.ok(skippedCase, 'doseStatusColor has a skipped case');
  assert.equal(skippedCase[1].trim(), 'doseAttentionInk(dark)');
  assert.match(kit, /export function doseAttentionInk\(dark: boolean\): string \{\s*return hubInk\('amber', dark\);/);

  for (const file of ['app/medications/reminders/index.tsx', 'app/medications/reminders/calendar.tsx']) {
    assert.doesNotMatch(read(root, file), /c\.danger|dangerBg/, `${file} uses red`);
  }

  const doseScreen = read(root, 'src/components/medications/MedicationDoseScreen.tsx');
  const skipAction = doseScreen.split('\n').find((line) => line.includes("markDose('skipped')"));
  assert.ok(skipAction, 'dose screen has a skip action');
  assert.doesNotMatch(skipAction, /danger/);
  assert.match(doseScreen, /icon=\{Trash2\}[^\n]*\bdanger\b/, 'deleting stays red');
});

test('web /app draws skipped and missed doses in amber, not red', () => {
  const page = read(repo, 'server/public/app/js/pages/medications.js');
  assert.match(page, /skipped: \{ label: [^}]*tone: 'amber' \}/);
  assert.match(page, /missed: \{ label: [^}]*tone: 'amber' \}/);
  assert.doesNotMatch(page, /'danger'|var\(--danger\)/);
  assert.match(page, /danger: true/, 'the delete confirmation stays red');

  const css = read(repo, 'server/public/app/css/medications.css');
  assert.doesNotMatch(css, /\.med-dot\.missed \{[^}]*danger/);
  assert.match(read(repo, 'server/public/app/app.css'), /\.badge-amber \{[^}]*var\(--ink-amber\)/);
});
