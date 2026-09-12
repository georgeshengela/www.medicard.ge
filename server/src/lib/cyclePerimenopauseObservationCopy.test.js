import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../mobile/src/i18n/ka.ts');

describe('Perimenopause summary Georgian copy', () => {
  it('does not use directional, hormonal, or diagnostic wording', () => {
    const src = fs.readFileSync(kaPath, 'utf8');
    const start = src.indexOf('periTrendsTitle:');
    const end = src.indexOf('periPainHeadache:');
    const block = src.slice(start, end);
    assert.ok(block.includes('ბოლო ჩანაწერების შეჯამება'));
    assert.ok(block.includes('ბოლო 30 დღის ჩანაწერები'));
    for (const word of [
      'გახშირდა',
      'გაუარესდა',
      'გაუმჯობესდა',
      'ჰორმონალური',
      'მენოპაუზაზე მიუთითებს',
      'პერიმენოპაუზისთვის დამახასიათებელია',
    ]) {
      assert.equal(block.includes(word), false, word);
    }
  });
});
