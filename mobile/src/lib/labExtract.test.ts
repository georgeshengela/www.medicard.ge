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

  it('normalizes EU and ISO dates and strips the machine block', () => {
    assert.equal(normalizeLooseDate('2026/9/4'), '2026-09-04');
    assert.equal(normalizeLooseDate('4.9.2026'), '2026-09-04');
    assert.equal(slugLabKey('Hgb'), 'hemoglobin');
    assert.match(stripLabJson('hello\n```labjson\n{"parameters":[]}\n```'), /hello/);
  });
});
