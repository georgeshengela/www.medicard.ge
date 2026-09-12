import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('observation explainability copy is non-coaching', () => {
  const src = readFileSync(join(here, '../i18n/ka.ts'), 'utf8');
  const start = src.indexOf('explainWhatItMeans:');
  const end = src.indexOf('explainRecordedOnly:');
  const block = src.slice(start, end + 80);
  const forbidden = [
    'log more',
    'track more',
    'answer every day',
    'complete more',
    'unlock',
    'streak',
    'coverage target',
    'improving',
    'worsening',
    'progressing',
    'hormonal',
    'statistically',
    'no change',
    'გთხოვთ',
    'შეავსოთ მეტი',
    'სტრიკ',
    'გაუმჯობეს',
    'გაუარეს',
    'ჰორმონ',
    'პროგრესირ',
    'სტატისტიკურ',
    'ცვლილება არ არის',
    'მსგავსი',
  ];
  for (const word of forbidden) {
    it(`does not contain "${word}"`, () => {
      assert.equal(block.includes(word), false);
    });
  }

  it('does not tell the user to log more in Georgian', () => {
    assert.equal(block.includes('ყოველ დღე უპასუხე'), false);
    assert.equal(block.includes('მეტი დღე'), false);
  });
});
