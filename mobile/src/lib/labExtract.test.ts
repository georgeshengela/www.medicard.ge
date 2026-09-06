import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeLabExtracts, normalizeLooseDate, parseLabExtract, slugLabKey, stripLabJson } from './labExtract.ts';

describe('labExtract', () => {
  it('parses a pipe table and flags from range', () => {
    const text = [
      'Hemoglobin (ჰემოგლობინი) | 11.2 | g/dL | 12-16 | L',
      'WBC | 7.1 | 10^9/L | 4.0-10.0 | N',
      'DOCUMENT META date: 12.03.2026',
    ].join('\n');
    const extracted = parseLabExtract(text);
    assert.equal(extracted.date, '2026-03-12');
    assert.equal(extracted.parameters.length, 2);
    const hgb = extracted.parameters.find((row) => row.key === 'hemoglobin');
    assert.ok(hgb);
    assert.equal(hgb.flag, 'L');
    assert.equal(hgb.refLow, 12);
  });

  it('reads labjson and merges pages', () => {
    const page = parseLabExtract('```labjson\n{"date":"2026-01-02","parameters":[{"key":"glucose","nameKa":"გლუკოზა","nameEn":"Glucose","value":6.2,"display":"6.2","unit":"mmol/L","refLow":3.9,"refHigh":5.6,"flag":"H"}]}\n```');
    const extra = parseLabExtract('Glucose | 6.2 | mmol/L | 3.9-5.6 | H');
    const merged = mergeLabExtracts([page, extra]);
    assert.equal(merged.date, '2026-01-02');
    assert.equal(merged.parameters.length, 1);
    assert.equal(merged.parameters[0].flag, 'H');
  });

  it('asks for a date when none is printed', () => {
    const extracted = parseLabExtract('Hemoglobin | 13.4 | g/dL | 12-16 | N');
    assert.equal(extracted.date, null);
    assert.equal(extracted.parameters[0].flag, 'N');
  });

  it('reads a French dotted lab PDF table', () => {
    const text = [
      'Date de la biologie :.2024-06-18.08:15:26',
      '......Hémoglobine. -. 12.6. g/dlg/dL. 13.0 - 16.5',
      '......Hématocrite.. 42.1. %%. 40.0 - 50.0',
      '......CRP. +. 73.2. mg/lmg/L. - 5.0',
    ].join('\n');
    const extracted = parseLabExtract(text);
    assert.equal(extracted.date, '2024-06-18');
    assert.equal(extracted.parameters.length, 3);
    const hgb = extracted.parameters.find((row) => row.key === 'hemoglobin');
    const crp = extracted.parameters.find((row) => row.key === 'crp');
    assert.ok(hgb);
    assert.equal(hgb.nameKa, 'ჰემოგლობინი');
    assert.equal(hgb.flag, 'L');
    assert.equal(hgb.unit, 'g/dL');
    assert.ok(crp);
    assert.equal(crp.flag, 'H');
    assert.equal(crp.refHigh, 5);
    const mcvText = parseLabExtract('Volume globulaire moyen (MCV). -. 79. fL. 83 - 98');
    assert.equal(mcvText.parameters[0]?.key, 'mcv');
    assert.equal(mcvText.parameters[0]?.nameKa, 'საშუალო ერითროციტული მოცულობა');
  });

  it('maps French vision keys onto Georgian titles and the same chart key', () => {
    const french = parseLabExtract(
      '```labjson\n{"date":"2026-09-05","parameters":[{"key":"hemoglobine","nameKa":"Hémoglobine","nameEn":"Hémoglobine","value":12.6,"display":"12.6","unit":"g/dL","refLow":13,"refHigh":16.5,"flag":"L"}]}\n```',
    );
    const english = parseLabExtract('Hemoglobin | 13.4 | g/dL | 12-16 | N');
    const merged = mergeLabExtracts([french, english]);
    assert.equal(french.parameters[0]?.key, 'hemoglobin');
    assert.equal(french.parameters[0]?.nameKa, 'ჰემოგლობინი');
    assert.equal(slugLabKey('Leucocytes'), 'wbc');
    assert.equal(slugLabKey('Volume globulaire moyen'), 'mcv');
    assert.equal(merged.parameters.length, 1);
    assert.equal(merged.parameters[0].key, 'hemoglobin');
    assert.equal(slugLabKey('GB'), 'wbc');
    assert.equal(slugLabKey('GR'), 'rbc');
    assert.equal(slugLabKey('PNN'), 'neutrophils_pct');
    assert.equal(slugLabKey('Coefficient de saturation de la transferrine'), 'tsat');
    assert.equal(slugLabKey('Lymphocytes', '%'), 'lymphocytes_pct');
    assert.equal(slugLabKey('Lymphocytes abs', 'G/L'), 'lymphocytes');
  });

  it('normalizes EU and ISO dates and strips the machine block', () => {
    assert.equal(normalizeLooseDate('2026/9/4'), '2026-09-04');
    assert.equal(normalizeLooseDate('4.9.2026'), '2026-09-04');
    assert.equal(slugLabKey('Hgb'), 'hemoglobin');
    assert.match(stripLabJson('hello\n```labjson\n{"parameters":[]}\n```'), /hello/);
  });
});
