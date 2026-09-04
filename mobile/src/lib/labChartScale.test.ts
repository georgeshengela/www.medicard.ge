import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { downsampleLabPoints, LAB_CHART_INSET, LAB_CHART_PLOT_H, makeLabChartScale } from './labChartScale.ts';

describe('labChartScale', () => {
  it('puts a 73 CRP peak under a tick above 73, not 50', () => {
    const scale = makeLabChartScale([5, 12, 48, 73], { refLow: 0, refHigh: 5, normal: 2.5 });
    assert.ok(scale.top >= 73, `top tick ${scale.top} must cover 73`);
    assert.ok(scale.top > 73, 'peak must not sit on the top edge');
    assert.equal(scale.bottom, 0);
    assert.ok(scale.y(73) > LAB_CHART_INSET + 2, '73 must sit below the plot roof');
    assert.ok(scale.y(73) < LAB_CHART_PLOT_H - LAB_CHART_INSET, '73 must sit above the plot floor');
    assert.ok(Math.max(...scale.ticks) >= 73);
    assert.ok(!scale.ticks.includes(50) || scale.top > 50);
  });

  it('does not crush hemoglobin into a 0–50 axis', () => {
    const scale = makeLabChartScale([12.2, 13.4, 14.1], { refLow: 12, refHigh: 16, normal: 14 });
    assert.ok(scale.bottom >= 10, `bottom ${scale.bottom} should stay near the band`);
    assert.ok(scale.top >= 16);
    assert.ok(scale.y(14.1) > LAB_CHART_INSET);
    assert.ok(scale.y(12.2) < LAB_CHART_PLOT_H - LAB_CHART_INSET);
  });

  it('keeps the real min and max when thinning a long series', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({ v: i === 7 ? 73 : 8 + (i % 5) }));
    const kept = downsampleLabPoints(points, 12, (row) => row.v);
    assert.ok(kept.some((row) => row.v === 73));
    assert.ok(kept.length <= 14);
  });
});
