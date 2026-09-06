import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyLabMaps } from './labAlign.ts';
import { collapseLabParameters, resolveCanonicalLabKey, titledLabParam } from './labNames.ts';

function row(partial: { key: string; nameKa?: string; nameEn?: string; unit?: string }) {
  return {
    key: partial.key,
    nameKa: partial.nameKa ?? partial.key,
    nameEn: partial.nameEn ?? partial.key,
    value: 12,
    display: '12',
    unit: partial.unit ?? '',
    refLow: 10,
    refHigh: 16,
    flag: 'N' as const,
  };
}

describe('labNames', () => {
  it('joins French OCR keys onto the imported catalog key', () => {
    assert.equal(resolveCanonicalLabKey(row({ key: 'hemoglobine', nameKa: 'Hémoglobine' })), 'hemoglobin');
    assert.equal(resolveCanonicalLabKey(row({ key: 'leucocytes', nameEn: 'Leucocytes' })), 'wbc');
    assert.equal(resolveCanonicalLabKey(row({ key: 'vgm', nameEn: 'Volume globulaire moyen' })), 'mcv');
    assert.equal(titledLabParam(row({ key: 'hemoglobine', nameKa: 'Hémoglobine' })).nameKa, 'ჰემოგლობინი');
  });

  it('collapses a French row and an imported row into one parameter', () => {
    const merged = collapseLabParameters([
      row({ key: 'hemoglobine', nameKa: 'Hémoglobine' }),
      row({ key: 'hemoglobin', nameKa: 'ჰემოგლობინი' }),
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].key, 'hemoglobin');
    assert.equal(merged[0].key, 'hemoglobin');
    assert.equal(merged[0].nameKa, 'ჰემოგლობინი');
  });

  it('applies Medi align maps so a French key joins the catalog', () => {
    const next = applyLabMaps(
      [
        {
          id: 'p1',
          date: '2026-09-05',
          createdAt: '2026-09-05T00:00:00.000Z',
          recordIds: [],
          analysis: '',
          parameters: [row({ key: 'hemoglobine', nameKa: 'Hémoglobine' })],
        },
      ],
      [{ from: 'hemoglobine', to: 'hemoglobin', nameKa: 'ჰემოგლობინი', nameEn: 'Hemoglobin' }],
    );
    assert.equal(next[0].parameters[0].key, 'hemoglobin');
    assert.equal(next[0].parameters[0].nameKa, 'ჰემოგლობინი');
  });
});
