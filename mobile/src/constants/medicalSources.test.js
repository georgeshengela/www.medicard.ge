import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { medicalSources, sourcesFor } from './medicalSources.ts';

describe('medical citations', () => {
  it('exposes a working https source for every cited calculation', () => {
    const ids = Object.keys(medicalSources);
    assert.ok(ids.includes('bmi'));
    assert.ok(ids.includes('menstrualCycle'));
    assert.ok(ids.includes('pregnancyDueDate'));
    for (const source of Object.values(medicalSources)) {
      assert.equal(typeof source.organization, 'string');
      assert.ok(source.title.length > 8);
      assert.ok(source.descriptionKa.length > 20);
      assert.match(source.url, /^https:\/\/(www\.)?(who\.int|cdc\.gov|acog\.org|pubmed\.ncbi\.nlm\.nih\.gov|journals\.plos\.org|nhs\.uk)\//);
      assert.doesNotMatch(source.url, /example\.com|placeholder|todo/i);
    }
  });

  it('BMI and pregnancy links are the authorities behind the formulas', () => {
    assert.match(sourcesFor(['bmi'])[0].url, /who\.int/);
    assert.match(medicalSources.bmi.description, /18\.5/);
    assert.match(medicalSources.pregnancyDueDate.description, /280/);
    assert.match(medicalSources.menstrualCycle.description, /14/);
    assert.match(medicalSources.fetalLength.url, /pubmed\.ncbi\.nlm\.nih\.gov\/1732970/);
  });
});
