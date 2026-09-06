import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEALTH_SCORE_BANDS,
  bandForScore,
  displayConfidencePercent,
  healthScoreLabelKa,
} from './healthScore.ts';

describe('healthScore', () => {
  it('keeps four contiguous monotonic bands', () => {
    assert.equal(HEALTH_SCORE_BANDS.length, 4);
    for (let i = 1; i < HEALTH_SCORE_BANDS.length; i++) {
      assert.equal(HEALTH_SCORE_BANDS[i].min, HEALTH_SCORE_BANDS[i - 1].max + 1);
    }
  });

  it('maps 78 to ნორმალური', () => {
    assert.equal(healthScoreLabelKa(78), 'ნორმალური');
    assert.equal(bandForScore(71).labelKa, 'ნორმალური');
    assert.equal(bandForScore(51).labelKa, 'მსუბუქი რისკი');
    assert.equal(bandForScore(21).labelKa, 'არაოპტიმალური');
    assert.equal(bandForScore(0).labelKa, 'კრიტიკული');
  });

  it('hides junk confidence and treats 0–1 as a fraction', () => {
    assert.equal(displayConfidencePercent(0.8), 80);
    assert.equal(displayConfidencePercent(0.008), null);
    assert.equal(displayConfidencePercent(94.5), 94.5);
    assert.equal(displayConfidencePercent(0), null);
  });
});
