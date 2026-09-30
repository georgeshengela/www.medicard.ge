// 2026-09-30 crash (1.0.0.17.31): the week strip read `mark.hasSex` for days with no mark
// ("Cannot read property 'hasSex' of undefined" on the cycle screen). Marks are sparse —
// most days have none — so the strip must only read them through optional chaining.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('CycleDayStrip never dereferences a possibly missing day mark', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'cycle', 'CycleDayStrip.tsx'), 'utf8');
  const unsafe = src.split('\n').filter((line) => /\bmark\.[A-Za-z]/.test(line));
  assert.deepEqual(unsafe, []);
});
