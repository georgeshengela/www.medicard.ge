// English dictionary must mirror the Georgian one: same keys, same kinds of values, no Georgian text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kaDictionary } from './ka.ts';
import { en } from './en.ts';

const GEORGIAN = /[ა-ჿ]/;

function kind(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function walk(ka: unknown, eng: unknown, path: string, out: string[]) {
  if (kind(ka) !== kind(eng)) {
    out.push(`${path}: ${kind(ka)} vs ${kind(eng)}`);
    return;
  }
  if (typeof ka === 'string') {
    if (GEORGIAN.test(eng as string)) out.push(`${path}: Georgian text in English`);
    return;
  }
  if (typeof ka === 'function') {
    const fn = eng as (...args: unknown[]) => unknown;
    const args = Array.from({ length: (ka as (...a: unknown[]) => unknown).length }, (_, i) => (i % 2 === 0 ? 3 : 'X'));
    try {
      const result = fn(...args);
      if (typeof result === 'string' && GEORGIAN.test(result)) out.push(`${path}(): Georgian text in English`);
    } catch {
      /* argument shapes vary; key presence is what matters here */
    }
    return;
  }
  if (Array.isArray(ka)) {
    if ((ka as unknown[]).length !== (eng as unknown[]).length) out.push(`${path}: length ${(ka as unknown[]).length} vs ${(eng as unknown[]).length}`);
    (ka as unknown[]).forEach((item, i) => walk(item, (eng as unknown[])[i], `${path}[${i}]`, out));
    return;
  }
  if (ka && typeof ka === 'object') {
    const a = Object.keys(ka as object).sort();
    const b = Object.keys(eng as object).sort();
    for (const key of a) if (!b.includes(key)) out.push(`${path}.${key}: missing in English`);
    for (const key of b) if (!a.includes(key)) out.push(`${path}.${key}: extra in English`);
    for (const key of a) {
      if (b.includes(key)) walk((ka as Record<string, unknown>)[key], (eng as Record<string, unknown>)[key], `${path}.${key}`, out);
    }
  }
}

test('English dictionary mirrors the Georgian one and contains no Georgian text', () => {
  const problems: string[] = [];
  walk(kaDictionary, en, 'ka', problems);
  assert.deepEqual(problems, []);
});
