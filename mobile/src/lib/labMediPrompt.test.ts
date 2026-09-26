import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { labMediPrompt } from './labMediPrompt.ts';
import type { LabPanel, LabParameter } from '../types/lab.ts';

const param = (nameKa: string, flag: LabParameter['flag'], extra: Partial<LabParameter> = {}): LabParameter => ({
  key: nameKa, nameKa, nameEn: nameKa, value: 1, display: '1', unit: 'mg/L', refLow: 0, refHigh: 5, flag, ...extra,
});
const panel = (date: string, parameters: LabParameter[]): LabPanel => ({ id: date, date, createdAt: date, recordIds: [], analysis: '', parameters });

describe('labMediPrompt', () => {
  it('returns null without saved results', () => {
    assert.equal(labMediPrompt([]), null);
    assert.equal(labMediPrompt([panel('2026-09-01', [])]), null);
  });

  it('uses only the newest day and lists out-of-range values first', () => {
    const text = labMediPrompt([
      panel('2026-08-01', [param('ძველი', 'H')]),
      panel('2026-09-20', [param('ჰემოგლობინი', 'N'), param('CRP', 'H', { display: '73' })]),
    ])!;
    assert.ok(text.includes('2026-09-20'));
    assert.ok(!text.includes('ძველი'));
    assert.ok(text.indexOf('CRP') < text.indexOf('ჰემოგლობინი'));
    assert.ok(text.includes('CRP: 73 mg/L (ნორმა 0–5) — მაღალი'));
  });

  it('caps long panels and says how many were left out', () => {
    const many = Array.from({ length: 30 }, (_, i) => param('p' + i, 'N'));
    const text = labMediPrompt([panel('2026-09-20', many)])!;
    assert.ok(text.includes('კიდევ 5 მაჩვენებელი'));
    assert.ok(!text.includes('p29:'));
  });
});
