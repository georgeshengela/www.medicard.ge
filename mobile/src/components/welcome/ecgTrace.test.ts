import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ECG_BOX_H, ecgTrace } from './ecgTrace.ts';

const points = (d: string) =>
  d.slice(1).split(' L').map((pair) => pair.split(',').map(Number) as [number, number]);

describe('welcome heartbeat line', () => {
  it('runs edge to edge inside its box', () => {
    for (const [width, disc] of [[390, 200], [430, 200], [320, 166]]) {
      const pts = points(ecgTrace(width, disc).d);
      assert.ok(pts[0][0] < 0 && pts.at(-1)![0] > width);
      for (const [, y] of pts) assert.ok(y >= 0 && y <= ECG_BOX_H, `y ${y} in box`);
    }
  });

  it('keeps both heartbeats out from under the disc', () => {
    const width = 390;
    const disc = 200;
    const edge = (width - disc) / 2;
    const bumps = points(ecgTrace(width, disc).d).filter(([, y]) => y !== ECG_BOX_H / 2);
    for (const [x] of bumps) assert.ok(x < edge || x > width - edge, `bump at ${x} is visible`);
    assert.ok(bumps.some(([x]) => x < edge) && bumps.some(([x]) => x > width - edge));
  });

  it('marks where the pulse reaches the disc', () => {
    const t = ecgTrace(390, 200);
    assert.ok(t.hit > 0 && t.hit < t.length);
    // the left complex is longer than its 80 pt width, so the hit lies past the straight-line distance
    assert.ok(t.hit > 20 + 95);
  });
});
