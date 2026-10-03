import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { medicalSources, sourcesFor } from './medicalSources.ts';

const ALLOWED_HOSTS =
  /^https:\/\/(www\.)?(who\.int|cdc\.gov|acog\.org|pubmed\.ncbi\.nlm\.nih\.gov|journals\.plos\.org|nhs\.uk|heart\.org|efsa\.europa\.eu|airindex\.eea\.europa\.eu|niddk\.nih\.gov|nia\.nih\.gov|medlineplus\.gov|canada\.ca)\//;

describe('medical citations', () => {
  it('exposes a working https source for every cited calculation', () => {
    const ids = Object.keys(medicalSources);
    assert.ok(ids.includes('bmi'));
    assert.ok(ids.includes('menstrualCycle'));
    assert.ok(ids.includes('pregnancyDueDate'));
    for (const [key, source] of Object.entries(medicalSources)) {
      assert.equal(source.id, key);
      assert.equal(typeof source.organization, 'string');
      assert.ok(source.title.length > 8);
      assert.ok(source.titleKa.length > 4);
      assert.ok(source.description.length > 40);
      assert.ok(source.descriptionKa.length > 20);
      assert.match(source.url, ALLOWED_HOSTS);
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

  it('every new citation states the number the app shows, in both languages', () => {
    /** id → [key number in the description, expected URL fragment] */
    const expected = {
      bloodPressure: ['130–139', 'heart.org'],
      restingHeartRate: ['60', 'heart.org'],
      sleepAdults: ['7 or more hours', 'cdc.gov/sleep'],
      waterIntake: ['2.0 L', 'efsa.europa.eu'],
      bodyFatDeurenberg: ['1.2 × BMI + 0.23 × age − 10.8', 'pubmed.ncbi.nlm.nih.gov/2043597'],
      energyTarget: ['− 161', 'pubmed.ncbi.nlm.nih.gov/2305711'],
      macroRanges: ['45–65%', 'canada.ca'],
      bodyWeightPlanner: ['28', 'niddk.nih.gov'],
      mealQuality: ['10%', 'who.int'],
      activityMet: ['3.5', 'pubmed.ncbi.nlm.nih.gov/21681120'],
      intermittentFasting: ['10–20 hours', 'nia.nih.gov'],
      physicalActivity: ['150–300', 'who.int'],
      dailySteps: ['10,000', 'pubmed.ncbi.nlm.nih.gov/35247352'],
      labResults: ['printed', 'medlineplus.gov'],
      symptomsGeneral: ['not a diagnosis', 'nhs.uk'],
      medicationInteractions: ['AI', 'medlineplus.gov'],
      airQualityIndex: ['60–79', 'eea.europa.eu'],
      uvIndex: ['6–7', 'who.int'],
      heavyMenstrualBleeding: ['7 days', 'acog.org/womens-health/faqs/heavy-menstrual-bleeding'],
    };
    for (const [id, [needle, host]] of Object.entries(expected)) {
      const source = medicalSources[id];
      assert.ok(source, `missing source ${id}`);
      assert.ok(source.description.includes(needle), `${id} description must state ${needle}`);
      assert.ok(source.url.includes(host), `${id} must link to ${host}`);
      const digits = needle.match(/\d+(?:[.,]\d+)?/);
      if (digits) assert.ok(source.descriptionKa.includes(digits[0]), `${id} Georgian description must state ${digits[0]}`);
    }
  });

  it('descriptions match the thresholds in code', async () => {
    const { PACE_KG } = await import('../lib/weightGoal.shared.ts');
    for (const kg of Object.values(PACE_KG)) assert.ok(medicalSources.weightPace.description.includes(String(kg)));
    // nutritionProgram.ts imports the API client, so read MACRO_BOUNDS from source text.
    const { readFileSync } = await import('node:fs');
    const program = readFileSync(new URL('../lib/nutritionProgram.ts', import.meta.url), 'utf8');
    const bounds = program.match(/MACRO_BOUNDS[^=]*=\s*\{\s*protein:\s*\[(\d+),\s*(\d+)\],\s*carbs:\s*\[(\d+),\s*(\d+)\],\s*fat:\s*\[(\d+),\s*(\d+)\]/);
    assert.ok(bounds, 'MACRO_BOUNDS not found');
    const d = medicalSources.macroRanges.description;
    assert.ok(d.includes(`protein ${bounds[1]}–${bounds[2]}%`));
    assert.ok(d.includes(`carbohydrate ${bounds[3]}–${bounds[4]}%`));
    assert.ok(d.includes(`fat ${bounds[5]}–${bounds[6]}%`));
    const shared = readFileSync(new URL('../lib/healthMetrics.shared.ts', import.meta.url), 'utf8');
    assert.match(shared, /sys < 130 && dia < 80\) return ka\.healthMetrics\.bpElevated/);
    assert.match(shared, /value >= 60 && value <= 100/);
    const steps = readFileSync(new URL('./figmaStepsLayout.ts', import.meta.url), 'utf8');
    assert.match(steps, /DEFAULT_STEPS_GOAL = 10_000/);
  });
});
