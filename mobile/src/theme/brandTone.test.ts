import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brandHex, roseCssVars, roseHex, setBrandTone, tealCssVars, toned } from './brandTone.ts';

test('teal maps to rose only while the rose tone is on', () => {
  setBrandTone('teal');
  assert.equal(brandHex('#14B8A6'), '#14B8A6');
  setBrandTone('rose');
  assert.equal(brandHex('#14B8A6'), '#D6406A');
  assert.equal(brandHex('#14b8a633'), '#D6406A33');
  assert.equal(roseHex('rgba(20, 184, 166, 0.2)'), 'rgba(214,64,106, 0.2)');
  assert.equal(brandHex('#3B82F6'), '#3B82F6');
  setBrandTone('teal');
});

test('a frozen toned object never throws (React Native freezes style props in dev)', () => {
  setBrandTone('rose');
  const t = toned({ brand: '#14B8A6', size: 4 });
  assert.equal(t.brand, '#D6406A');
  Object.freeze(t);
  assert.doesNotThrow(() => t.brand);
  assert.equal(t.brand, '#14B8A6');
  assert.deepEqual({ ...t }, { brand: '#14B8A6', size: 4 });
  setBrandTone('teal');
});

test('the root view always carries the brand variables, and teal matches global.css', () => {
  const css = readFileSync(new URL('../../global.css', import.meta.url), 'utf8');
  const [light, dark] = css.split(/\.dark,/);
  for (const [block, isDark] of [[light, false], [dark, true]] as const) {
    const teal = tealCssVars(isDark);
    assert.deepEqual(Object.keys(teal), Object.keys(roseCssVars(isDark)));
    for (const [name, value] of Object.entries(teal)) {
      assert.match(block, new RegExp(`${name}: ${value};`), `${name} (${isDark ? 'dark' : 'light'})`);
    }
  }
});
