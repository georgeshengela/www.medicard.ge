import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandHex, roseHex, setBrandTone, toned } from './brandTone.ts';

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
