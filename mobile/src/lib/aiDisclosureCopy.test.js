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
    assert.match(en.agree, /Allow AI Processing/);
    assert.equal(en.decline, 'Not Now');
    assert.equal(en.screenTitle, 'AI & Privacy');
    assert.equal(en.recipients[0].name, 'OpenRouter, Inc.');
    assert.ok(en.categories.some((row) => /Vertex AI/i.test(row)));
    const ka = disclosureCopy(manifest, 'ka-GE');
    assert.equal(ka.title, manifest.title);
    assert.match(ka.agree, /AI დამუშავების ნებართვა/);
    assert.equal(ka.decline, 'ახლა არა');
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

  // W2-8 (brief §7 pillar 2 [კ-10]): Medi opened from a cycle screen sends the cycle day, phase estimate,
  // what is ahead and today's pain / moods. That is this already-named category, so the consent version
  // stays as it is; if these sentences ever go, the cycle context must stop too (cycleMediContext.ts).
  it('still names cycle information and keeps intimate / locked cycle fields out (cycle context needs no new consent)', () => {
    assert.ok(manifest.summaryCategories.includes('ციკლის ან ორსულობის ინფორმაცია, როცა ამ ფუნქციას იყენებ'));
    assert.ok(manifest.categories.some((row) => row.includes('ნებადართული ციკლის ჩანაწერები') && row.includes('დაცული ციკლი და ინტიმური ველები ზოგად კონტექსტში არ შედის')));
    assert.ok(manifest.en.categories.some((row) => /cycle records you have permitted/i.test(row) && /intimate fields are not included/i.test(row)));
    assert.ok(manifest.en.summaryCategories.some((row) => /cycle or pregnancy/i.test(row)));
  });
});
