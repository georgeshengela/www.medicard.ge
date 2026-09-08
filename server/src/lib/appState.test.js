import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeLabPanelLists, mergeAppState, publicExtraAnswers, reconstructLabPanels, sanitizeLabPanel } from './appState.js';

function panel(date, keys, extras = {}) {
  return {
    id: `lab-${date}`,
    date,
    createdAt: `${date}T00:00:00.000Z`,
    recordIds: extras.recordIds ?? [`rec-${date}`],
    analysis: extras.analysis ?? '',
    parameters: keys.map((key) => ({
      key,
      nameKa: key,
      nameEn: key,
      value: 1,
      display: '1',
      unit: 'g/L',
      refLow: 0,
      refHigh: 2,
      flag: 'N',
    })),
  };
}

describe('appState', () => {
  it('unions lab panels by date and keeps extra analytes', () => {
    const merged = mergeLabPanelLists(
      [panel('2026-01-01', ['hemoglobin'])],
      [panel('2026-01-01', ['wbc']), panel('2026-02-01', ['glucose'])],
    );
    assert.equal(merged.length, 2);
    const jan = merged.find((row) => row.date === '2026-01-01');
    assert.deepEqual(jan.parameters.map((row) => row.key).sort(), ['hemoglobin', 'wbc']);
    assert.equal(merged[0].date, '2026-02-01');
  });

  it('rejects a panel without numeric parameters', () => {
    assert.equal(sanitizeLabPanel({ id: 'x', date: '2026-01-01', parameters: [] }), null);
  });

  it('reconstructs structured panels from OCR notes', () => {
    const records = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        createdAt: new Date('2026-03-12T10:00:00.000Z'),
        aiAnalysis: 'Hemoglobin (ჰემოგლობინი) | 11.2 | g/dL | 12-16 | L',
      },
    ];
    const panels = reconstructLabPanels(records);
    assert.equal(panels.length, 1);
    assert.equal(panels[0].date, '2026-03-12');
    assert.equal(panels[0].parameters[0].key, 'hemoglobin');
  });

  it('merges device blobs without dropping either side', () => {
    const merged = mergeAppState(
      { weightGoal: { id: 'a', startedYmd: '2026-01-01', targetKg: 70 }, doseLogs: [{ medicationId: 'm1', date: '2026-01-02', time: '09:00', status: 'taken', updatedAt: '2026-01-02T09:00:00.000Z' }] },
      { weightGoal: { id: 'b', startedYmd: '2026-02-01', targetKg: 68 }, doseLogs: [{ medicationId: 'm1', date: '2026-01-02', time: '09:00', status: 'skipped', updatedAt: '2026-01-02T10:00:00.000Z' }] },
    );
    assert.equal(merged.weightGoal.id, 'b');
    assert.equal(merged.doseLogs[0].status, 'skipped');
  });

  it('strips bulky blobs from the public profile extra', () => {
    const extra = publicExtraAnswers({ avatarId: 'fox', labPanels: [{ id: 'x' }], appState: { labPanels: [] } });
    assert.equal(extra.avatarId, 'fox');
    assert.equal(extra.labPanels, undefined);
    assert.equal(extra.appState, undefined);
  });
});
