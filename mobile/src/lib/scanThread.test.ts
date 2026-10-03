import test from 'node:test';
import assert from 'node:assert/strict';
import { canAskAboutResult, latestResultContext, scanHref, scanKindFromParam, type ScanTurn } from './scanThread.ts';

test('the choice comes from ?type= in any spelling, and back', () => {
  assert.equal(scanKindFromParam('lab'), 'LAB');
  assert.equal(scanKindFromParam(['IMAGING']), 'IMAGING');
  assert.equal(scanKindFromParam(' Skin '), 'SKIN');
  assert.equal(scanKindFromParam('xray'), null);
  assert.equal(scanKindFromParam(undefined), null);
  assert.equal(scanHref('IMAGING'), '/scan?type=imaging');
  assert.equal(scanHref(null), '/scan');
});

test('a follow-up question carries only the latest result, bounded', () => {
  const turns: ScanTurn[] = [
    { id: '1', kind: 'upload', scan: 'SKIN', files: [], note: '' },
    { id: '2', kind: 'result', scan: 'SKIN', text: 'ხალი სიმეტრიულია', recordId: 'r1' },
    { id: '3', kind: 'lab', recordId: 'r2', note: '', savedDate: '2026-10-01', extract: { date: '2026-10-01', parameters: [
      { key: 'hgb', nameKa: 'ჰემოგლობინი', nameEn: 'Hemoglobin', value: 11, display: '11', unit: 'g/dL', refLow: 12, refHigh: 16, flag: 'L' },
    ] } },
  ];
  const context = latestResultContext(turns)!;
  assert.match(context, /Lab results from 2026-10-01/);
  assert.match(context, /Hemoglobin: 11 g\/dL \(norm 12–16\) \[low\]/);
  assert.doesNotMatch(context, /ხალი/);
  assert.equal(latestResultContext(turns.slice(0, 2))!.startsWith('Skin photo review'), true);
  const long: ScanTurn[] = [{ id: 'x', kind: 'result', scan: 'IMAGING', text: 'ა'.repeat(9000), recordId: 'r' }];
  assert.ok(latestResultContext(long)!.length <= 3800);
  assert.equal(canAskAboutResult([{ id: '1', kind: 'upload', scan: 'LAB', files: [], note: '' }]), false);
  assert.equal(canAskAboutResult(turns), true);
});
