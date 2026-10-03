const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');

const root = join(__dirname, '..');

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(tsx|ts)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

// Brief §6 weakness 6 / §8.2 item 8: the cycle module explains and confirms in its own bottom sheet
// (`CycleExplainSheet`) or an undo toast — never a native `Alert.alert`.
const CYCLE_DIRS = [join(root, 'app', 'cycle'), join(root, 'src', 'components', 'cycle'), join(root, 'src', 'components', 'home', 'sections')];

test('cycle screens never use the native Alert', () => {
  const offenders = CYCLE_DIRS.flatMap(sources)
    .filter((file) => {
      const src = readFileSync(file, 'utf8');
      return /\bAlert\.alert\s*\(/.test(src) || /import\s*\{[^}]*\bAlert\b[^}]*\}\s*from\s*['"]react-native['"]/.test(src);
    })
    .map((file) => relative(root, file));
  assert.deepEqual(offenders, []);
});

test('every cycle explanation / confirmation goes through CycleExplainSheet or an undo toast', () => {
  const sheet = readFileSync(join(root, 'src', 'components', 'cycle', 'CycleExplainSheet.tsx'), 'utf8');
  assert.match(sheet, /from '@\/components\/ui\/appModal'/, 'the sheet is the chrome-aware app Modal');
  assert.match(sheet, /APP_MODAL_PROPS/);
  assert.match(sheet, /MedicalSourcesLink/);
  assert.match(sheet, /accessibilityViewIsModal/);
  assert.match(sheet, /accessibilityRole="header"/);

  const users = {
    'app/cycle/index.tsx': [/CycleExplainSheet/, /howCalculated\b/, /periodEndedToast/, /undoPeriodEnd/],
    'app/cycle/log.tsx': [/CycleExplainSheet/, /deleteLogConfirm/, /positivePregBody/],
    'src/components/cycle/settings/CycleDataSettings.tsx': [/CycleExplainSheet/, /deleteCycleAgain/],
    'src/components/cycle/CyclePeriodHistory.tsx': [/CycleExplainSheet/, /periodDeleteDay/, /missedPeriodFillConfirm/],
    'src/components/cycle/CycleOfflineBanner.tsx': [/CycleExplainSheet/, /discardPendingConfirm/],
    'src/components/home/sections/useHomeCycleActions.ts': [/'periodEnd'/, /undoEnd/, /saveCycleObservation/],
    'src/components/home/sections/HomeCycleHero.tsx': [/periodEndedToast/, /periodEndedToastHint/],
  };
  for (const [rel, patterns] of Object.entries(users)) {
    const src = readFileSync(join(root, ...rel.split('/')), 'utf8');
    for (const pattern of patterns) assert.match(src, pattern, `${rel} should match ${pattern}`);
  }
});

test('the end-period toast undo restores exactly the bleeding that was logged', () => {
  for (const rel of ['app/cycle/index.tsx', 'src/components/home/sections/useHomeCycleActions.ts']) {
    const src = readFileSync(join(root, ...rel.split('/')), 'utf8');
    // One shared rule (periodEndUndo): a logged bleeding intensity is restored, an empty flow is cleared
    // again, a day the end created is removed — an unlogged day never gets a synthesized flow on undo.
    assert.match(src, /periodEndUndo\(before \? \{ flow: before\.flow \} : null\)/, rel);
    assert.match(src, /undo\.kind === 'restoreFlow'\s*\? await saveCycleObservation\([^)]*\{ flow: undo\.flow \}\)/, rel);
    assert.match(src, /queueRemoveCycleLog\(/, rel);
  }
  const helper = readFileSync(join(root, 'src', 'lib', 'cyclePeriodStatus.ts'), 'utf8');
  assert.match(helper, /if \(before && isBleed\(before\.flow\)\) return \{ kind: 'restoreFlow', flow: before\.flow \};/);
});

test('period copy says „სისხლდენა“, never the discharge word, and the toast copy exists in both languages', () => {
  const ka = readFileSync(join(root, 'src', 'i18n', 'ka.ts'), 'utf8');
  const en = readFileSync(join(root, 'src', 'i18n', 'en', 'cycle.ts'), 'utf8');
  for (const key of ['periodEndHint', 'periodEndedToast', 'periodEndedToastHint', 'periodDaySheetHint']) {
    assert.match(ka, new RegExp(`\\b${key}:`), `ka.cycle.${key}`);
    assert.match(en, new RegExp(`\\b${key}:`), `en.cycle.${key}`);
  }
  const hint = ka.match(/periodEndHint: '([^']+)'/)?.[1] ?? '';
  assert.ok(hint.includes('სისხლდენა'), hint);
  assert.ok(!hint.includes('გამონადენი'), hint);
});
