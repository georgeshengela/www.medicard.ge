'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const namesPath = path.join(__dirname, 'cosmeticNames.ts');
const visualsPath = path.join(__dirname, 'cosmeticVisuals.ts');

function extractLocaleBlocks(src) {
  const titles = { ka: [], en: [], fr: [], ru: [] };
  const re = /title:\s*\{\s*ka:\s*'((?:\\'|[^'])*)'\s*,\s*en:\s*'((?:\\'|[^'])*)'\s*,\s*fr:\s*'((?:\\'|[^'])*)'\s*,\s*ru:\s*'((?:\\'|[^'])*)'\s*\}/g;
  let m;
  while ((m = re.exec(src))) {
    titles.ka.push(m[1]);
    titles.en.push(m[2]);
    titles.fr.push(m[3]);
    titles.ru.push(m[4]);
  }
  return titles;
}

describe('companion cosmetic names', () => {
  it('has 25 unique titles per locale', () => {
    const src = fs.readFileSync(namesPath, 'utf8');
    const titles = extractLocaleBlocks(src);
    for (const locale of ['ka', 'en', 'fr', 'ru']) {
      assert.equal(titles[locale].length, 25, `${locale} title count`);
      const unique = new Set(titles[locale]);
      assert.equal(unique.size, 25, `${locale} titles must be unique`);
      for (const t of titles[locale]) {
        assert.ok(t.trim().length >= 2, `${locale} title too short: ${t}`);
        assert.ok(!/#\d+|Cosmetic|Decoration \d/i.test(t), `awkward title: ${t}`);
      }
    }
  });

  it('renders 27 active visual keys', () => {
    const src = fs.readFileSync(visualsPath, 'utf8');
    const keys = [...src.matchAll(/'(accent|pose|accessory|bg|decor)\.[a-z0-9_]+'/g)].map((m) => m[0].slice(1, -1));
    const unique = [...new Set(keys)];
    assert.ok(unique.length >= 27, `expected >=27 visual keys, got ${unique.length}`);
  });
});
