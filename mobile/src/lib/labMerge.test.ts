import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeLabPanelLists } from './labMerge.ts';

function panel(date: string, keys: string[]) {
  return {
    id: `lab-${date}`,
    date,
    createdAt: `${date}T00:00:00.000Z`,
    recordIds: [`rec-${date}`],
    analysis: '',
    parameters: keys.map((key) => ({
      key,
      nameKa: key,
      nameEn: key,
      value: 1,
      display: '1',
      unit: '',
      refLow: null,
      refHigh: null,
      flag: 'N' as const,
    })),
  };
}

describe('labMerge', () => {
  it('keeps analytes from both devices for the same day', () => {
    const merged = mergeLabPanelLists([panel('2026-01-01', ['hemoglobin'])], [panel('2026-01-01', ['psa'])]);
    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0].parameters.map((row) => row.key).sort(), ['hemoglobin', 'psa']);
  });
});
