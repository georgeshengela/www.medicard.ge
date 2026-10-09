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

// IR-6: the one-tap „მენსტრუაცია დაიწყო“ (Home hero, /cycle hero, the widget through /cycle) stores the
// start outside persistCycleLog, so it never reached Apple Health / Health Connect as a cycle start. Both
// callers now write day 1 themselves — after the „stored nothing“ gate, fire-and-forget, through the
// sync that is gated on the Health switch and never asks for access.
for (const [file, name] of [
  ['src/components/home/sections/useHomeCycleActions.ts', 'startPeriod'],
  ['app/cycle/index.tsx', 'startPeriodNow'],
]) {
  test(`IR-6: ${file} ${name} writes the one-tap start to Health`, () => {
    const body = handler(read(file), name);
    const gate = body.indexOf('if (storedNothing(result)) return;');
    assert.ok(gate > 0, 'the start is checked before anything else');
    const plan = body.indexOf('periodStartTapHealthWrite(today, beforeRow)');
    assert.ok(plan > gate, 'Health only after something was stored');
    assert.match(body, /const beforeRow = [^\n]*logs\.find\(\(l\) => l\.date === today\) \?\? null;/);
    assert.match(body, /periodStartUndo\(beforeRow,/);
    assert.match(body, /if \(health\) void syncCycleLogToHealth\(health\)\.catch\(\(\) => undefined\);/);
    assert.doesNotMatch(body, /await\s+syncCycleLogToHealth|connectHealth|requestPermission|requestAuthorization/);
  });
}

test('IR-6: the shared queue write never touches Health (the month editor adds past period days through it)', () => {
  const offline = read('src/lib/cycleOffline.ts');
  assert.doesNotMatch(offline, /healthSync|syncCycleLogToHealth|periodStartTapHealthWrite/);
  assert.doesNotMatch(read('src/components/cycle/CyclePeriodHistory.tsx'), /periodStartTapHealthWrite/);
  // The Health sync itself is the switch-gated one.
  assert.match(read('src/lib/healthSync.ts'), /export async function syncCycleLogToHealth\(payload: CycleHealthPayload\): Promise<void> \{\n  if \(!\(await isHealthSyncEnabled\(\)\)\) return;/);
});
