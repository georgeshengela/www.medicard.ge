import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareLabTests, groupLabBySystem, labBounds, labPlainName, labRuler, labStatusWord, labSystemOf } from './labBody.ts';
import type { LabParameter } from '../types/lab.ts';

function p(key: string, value: number, refLow: number | null, refHigh: number | null, flag: LabParameter['flag']): LabParameter {
  return { key, nameKa: key, nameEn: key, value, display: String(value), unit: '', refLow, refHigh, flag };
}

describe('labBody', () => {
  it('maps keys to systems and plain names', () => {
    assert.equal(labSystemOf('ferritin'), 'blood');
    assert.equal(labSystemOf('ldl'), 'heart');
    assert.equal(labSystemOf('unknown_thing'), 'other');
    assert.equal(labPlainName('ferritin'), 'რკინის მარაგი');
    assert.equal(labPlainName('unknown_thing'), null);
  });

  it('says how far outside the range a value is', () => {
    assert.equal(labStatusWord(p('hemoglobin', 11.6, 12, 15.5, 'L')), 'ოდნავ დაბალი');
    assert.equal(labStatusWord(p('ferritin', 9, 15, 150, 'L')), 'დაბალი');
    assert.equal(labStatusWord(p('cholesterol', 5.9, 0, 5.2, 'H')), 'ოდნავ მაღალი');
    assert.equal(labStatusWord(p('ldl', 3.8, 0, 3, 'H')), 'მაღალი');
    assert.equal(labStatusWord(p('tsh', 2.1, 0.4, 4, 'N')), 'ნორმაში');
  });

  it('treats a 0 lower bound as an upper limit only', () => {
    assert.deepEqual(labBounds({ refLow: 0, refHigh: 3 }), { low: null, high: 3 });
    assert.equal(labBounds({ refLow: null, refHigh: null }), null);
    const r = labRuler(3.8, { low: null, high: 3 });
    assert.equal(r.lowZone, 0);
    assert.ok(r.at > 0.78);
    const two = labRuler(13, { low: 12, high: 15.5 });
    assert.ok(two.at > 0.22 && two.at < 0.78);
    assert.equal(labRuler(-50, { low: 12, high: 15.5 }).at, 0.03);
  });

  it('compares with the previous test toward the range', () => {
    const now = [p('ferritin', 9, 15, 150, 'L'), p('ldl', 3.8, 0, 3, 'H'), p('tsh', 2.1, 0.4, 4, 'N'), p('glucose', 5.4, 3.9, 5.6, 'N')];
    const before = [p('ferritin', 14, 15, 150, 'L'), p('ldl', 4.1, 0, 3, 'H'), p('tsh', 2.3, 0.4, 4, 'N'), p('glucose', 6.1, 3.9, 5.6, 'H')];
    const c = compareLabTests(now, before, '2026-04-12')!;
    assert.equal(c.better, 2);
    assert.equal(c.worse, 1);
    assert.equal(c.steady, 1);
    assert.deepEqual(c.changes.map((x) => [x.key, x.kind]), [['ferritin', 'further'], ['glucose', 'back-in-range'], ['ldl', 'closer']]);
    assert.equal(compareLabTests(now, [p('crp', 1, 0, 5, 'N')], '2026-04-12'), null);
  });

  it('groups systems with something outside first', () => {
    const groups = groupLabBySystem([p('tsh', 2.1, 0.4, 4, 'N'), p('ferritin', 9, 15, 150, 'L'), p('hemoglobin', 13, 12, 15.5, 'N')]);
    assert.deepEqual(groups.map((g) => g.id), ['blood', 'thyroid']);
    assert.equal(groups[0].rows[0].key, 'ferritin');
    assert.equal(groups[0].tone, 'warn');
  });
});
