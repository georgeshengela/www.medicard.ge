import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { disclosureCopy, isGeorgianLocale } from './aiDisclosureCopy.js';

const manifest = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../config/aiDisclosure.json'), 'utf8'));

describe('AI disclosure copy for App Review', () => {
  it('uses English on US/EU review devices and Georgian for ka', () => {
    assert.equal(isGeorgianLocale('ka-GE'), true);
    assert.equal(isGeorgianLocale('en-US'), false);
    const en = disclosureCopy(manifest, 'en-US');
    assert.match(en.title, /Share your data with AI/);
    assert.match(en.agree, /I agree to share with AI/);
    assert.equal(en.recipients[0].name, 'OpenRouter, Inc.');
    assert.ok(en.categories.some((row) => /Vertex AI/i.test(row)));
    const ka = disclosureCopy(manifest, 'ka-GE');
    assert.equal(ka.title, manifest.title);
    assert.match(ka.agree, /ვეთანხმები/);
  });

  it('names every recipient and data category in both languages', () => {
    for (const locale of ['en-US', 'ka']) {
      const copy = disclosureCopy(manifest, locale);
      assert.ok(copy.recipients.length >= 5);
      assert.ok(copy.categories.length >= 6);
      assert.match(copy.recipients.map((row) => row.name).join(' '), /OpenRouter/);
      assert.match(copy.recipients.map((row) => row.name).join(' '), /Vertex AI/);
      assert.match(copy.recipients.map((row) => row.name).join(' '), /Azure/);
      assert.match(copy.recipients.map((row) => row.name).join(' '), /EvidenceMD/);
    }
  });
});
