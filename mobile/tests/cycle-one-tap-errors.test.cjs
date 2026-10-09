const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (rel) => readFileSync(join(root, ...rel.split('/')), 'utf8');

/** The body of `const name = async (…) => { … };` / `const name = useCallback(…)` up to the next handler. */
function handler(src, name) {
  const start = src.search(new RegExp(`const ${name} = (async \\(|useCallback\\()`));
  assert.ok(start >= 0, `${name} not found`);
  const rest = src.slice(start + 10);
  const next = rest.search(/\n  const [a-zA-Z]+ = (async \(|useCallback\()/);
  return next >= 0 ? rest.slice(0, next) : rest;
}

// CYC-05: a one-tap cycle action that stored nothing (device storage and the server both failed) says
// so, and never plays the success haptic, the funnel event or the toast.
const SCREEN = 'app/cycle/index.tsx';
const HOME = 'src/components/home/sections/useHomeCycleActions.ts';
const SCREEN_ACTIONS = ['startPeriodNow', 'undoPeriodStart', 'logSexNow', 'undoSex', 'endPeriod', 'undoPeriodEnd', 'stillBleedingNow'];
const HOME_ACTIONS = ['startPeriod', 'undoStart', 'endPeriod', 'stillBleeding', 'undoEnd', 'logSex', 'undoSex'];

for (const [file, actions] of [
  [SCREEN, SCREEN_ACTIONS],
  [HOME, HOME_ACTIONS],
]) {
  test(`CYC-05: ${file} checks every one-tap result before any success feedback`, () => {
    const src = read(file);
    assert.match(src, /cyclePersistFeedback\(result\) !== 'fail'/);
    assert.match(src, /setError\(ka\.cycle\.saveNotPersisted\)/);
    for (const name of actions) {
      const body = handler(src, name);
      const gate = body.indexOf('if (storedNothing(result)) return;');
      assert.ok(gate > 0, `${name} must stop when nothing was stored`);
      const awaited = body.search(/const result =\s/);
      assert.ok(awaited >= 0 && awaited < gate, `${name}: the gate follows the write`);
      // Success feedback after the write (clearing an older toast before it is fine).
      for (const after of ['Haptics.', 'trackCyclePeriodStarted(', 'setPeriodToast({', 'setSexToast(before)', 'setEndToast({', 'setToastDate(today)', 'setSexBefore(before)', 'showView(result.view)', 'handleSaved(result.view)']) {
        const at = body.indexOf(after, awaited);
        if (at >= 0) assert.ok(at > gate, `${name}: ${after} only after the gate`);
      }
    }
  });
}

test('CYC-05: /cycle shows a one-tap error while her cycle is on screen, and it fades', () => {
  const src = read(SCREEN);
  // Before the fix the only render was `error && !bundle` (the load-failure card).
  assert.match(src, /\{actionError && bundle \? \(/);
  assert.match(src, /accessibilityRole="alert"[^>]*>\s*\{actionError\}/);
  assert.match(src, /if \(!actionError\) return;\s*const t = setTimeout\(\(\) => setError\(null\), 6000\);/);
  // No native alert in cycle screens.
  assert.doesNotMatch(src, /Alert\.alert/);
});
