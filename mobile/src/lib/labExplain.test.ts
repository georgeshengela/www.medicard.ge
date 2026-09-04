import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { explainLabParam, resolveLabExplainKey } from './labExplain.ts';
import type { LabParameter } from '../types/lab.ts';

function param(partial: Partial<LabParameter> & Pick<LabParameter, 'key' | 'nameEn'>): LabParameter {
  return {
    nameKa: partial.nameKa ?? partial.nameEn,
    value: 1,
    display: '1',
    unit: 'mmol/L',
    refLow: 0,
    refHigh: 5,
    flag: 'N',
    ...partial,
  };
}

describe('labExplain', () => {
  it('explains cholesterol total instead of the generic blurb', () => {
    const copy = explainLabParam(param({ key: 'cholesterol_total', nameEn: 'Cholesterol total', nameKa: 'საერთო ქოლესტერინი' }));
    assert.equal(resolveLabExplainKey({ key: 'cholesterol_total', nameEn: 'Cholesterol total', nameKa: 'საერთო ქოლესტერინი' }), 'cholesterol');
    assert.match(copy.what, /ქოლესტერინი|ცხიმოვანი/);
    assert.doesNotMatch(copy.what, /ლაბორატორიული მაჩვენებელია/);
  });

  it('does not treat LDL as total cholesterol', () => {
    assert.equal(resolveLabExplainKey({ key: 'ldl_cholesterol', nameEn: 'LDL cholesterol', nameKa: 'LDL' }), 'ldl');
  });

  it('still explains CRP by key', () => {
    const copy = explainLabParam(param({ key: 'crp', nameEn: 'CRP', nameKa: 'CRP', unit: 'mg/L' }));
    assert.match(copy.what, /ანთება/);
  });
});
