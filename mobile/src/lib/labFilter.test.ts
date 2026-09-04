import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { labFlagCounts, labParamMatches } from './labFilter.ts';
import type { LabParameter } from '../types/lab.ts';

function row(partial: Partial<LabParameter> & Pick<LabParameter, 'flag' | 'nameKa'>): LabParameter {
  return {
    key: partial.key ?? 'crp',
    nameKa: partial.nameKa,
    nameEn: partial.nameEn ?? 'CRP',
    value: partial.value ?? 73,
    display: partial.display ?? '73',
    unit: partial.unit ?? 'mg/L',
    refLow: 0,
    refHigh: 5,
    flag: partial.flag,
  };
}

describe('labFilter', () => {
  const crp = row({ nameKa: 'CRP', flag: 'H' });
  const hgb = row({ key: 'hemoglobin', nameKa: 'ჰემოგლობინი', nameEn: 'Hemoglobin', value: 11, display: '11', unit: 'g/dL', flag: 'L' });
  const wbc = row({ key: 'wbc', nameKa: 'ლეიკოციტები', nameEn: 'WBC', value: 7, display: '7', flag: 'N' });

  it('keeps only high and low for საყურადღებო', () => {
    assert.equal(labParamMatches(crp, '', 'watch'), true);
    assert.equal(labParamMatches(hgb, '', 'watch'), true);
    assert.equal(labParamMatches(wbc, '', 'watch'), false);
  });

  it('finds a parameter by Georgian or English name', () => {
    assert.equal(labParamMatches(hgb, 'ჰემო', 'all'), true);
    assert.equal(labParamMatches(hgb, 'hemo', 'all'), true);
    assert.equal(labParamMatches(crp, 'ჰემო', 'all'), false);
  });

  it('finds high or low by typed words', () => {
    assert.equal(labParamMatches(crp, 'მაღალი', 'all'), true);
    assert.equal(labParamMatches(hgb, 'დაბალი', 'all'), true);
    assert.equal(labParamMatches(wbc, 'high', 'all'), false);
  });

  it('counts flags', () => {
    assert.deepEqual(labFlagCounts([crp, hgb, wbc]), { all: 3, watch: 2, H: 1, L: 1, N: 1 });
  });
});
