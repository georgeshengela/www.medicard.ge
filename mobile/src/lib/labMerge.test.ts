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

describe('labMerge: one record is one panel (2026-10-06)', () => {
  const at = (id: string, date: string, recordIds: string[], extra: Record<string, unknown> = {}) => ({ ...panel(date, ['mcv']), id, recordIds, ...extra });

  it('drops server-made copies of a record the app saved under another date', () => {
    const merged = mergeLabPanelLists(
      [at('lab-2026-10-06-rec1', '2026-10-06', ['rec1'], { auto: true }), at('lab-2026-09-30-rec1', '2026-09-30', ['rec1'])],
      [at('lab-2010-11-19-1759740000000', '2010-11-19', ['rec1'])],
    );
    assert.deepEqual(merged.map((row) => row.date), ['2010-11-19']);
  });

  it('keeps a server-made panel when the app has none for that record', () => {
    const merged = mergeLabPanelLists([], [at('lab-2026-10-06-rec9', '2026-10-06', ['rec9'], { auto: true })]);
    assert.equal(merged.length, 1);
  });

  it('the newer app date for the same record wins', () => {
    const merged = mergeLabPanelLists([at('lab-2026-10-01-1', '2026-10-01', ['rec1'])], [at('lab-2026-09-29-2', '2026-09-29', ['rec1'])]);
    assert.deepEqual(merged.map((row) => row.date), ['2026-09-29']);
  });

  it('same record and date: merged, and the app id replaces the server-made one', () => {
    const merged = mergeLabPanelLists([at('lab-2026-10-01-rec1', '2026-10-01', ['rec1'], { auto: true })], [at('lab-2026-10-01-1759740000000', '2026-10-01', ['rec1'])]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, 'lab-2026-10-01-1759740000000');
    assert.equal(merged[0].auto, undefined);
  });
});

describe('labMerge: document header lines', () => {
  it('a birth date or doctor line from OCR never stays as a lab value', () => {
    const bad = { ...panel('2010-11-19', ['mcv']) };
    bad.parameters.push({ ...bad.parameters[0], key: 'ლაბორატორიის_ექიმი', nameKa: 'ლაბორატორიის ექიმი', nameEn: 'ლაბორატორიის ექიმი' });
    const merged = mergeLabPanelLists([bad], []);
    assert.deepEqual(merged[0].parameters.map((row) => row.key), ['mcv']);
  });
});
