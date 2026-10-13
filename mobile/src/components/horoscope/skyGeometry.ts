/** Pure geometry for the MEDIHOROSCOPE wheels (same maths as brand/horoscope/board.html). Node-testable. */

const DEG = Math.PI / 180;

/** The lit part of the Moon as an SVG path (phase angle 0 = new, 180 = full; waxing lights the right side). */
export function moonPath(cx: number, cy: number, r: number, angle: number): string {
  const waxing = angle < 180;
  const k = (1 - Math.cos(angle * DEG)) / 2;
  const rx = Math.max(0.01, r * Math.abs(1 - 2 * k));
  const limb = waxing ? 1 : 0;
  const term = waxing ? (k > 0.5 ? 1 : 0) : (k > 0.5 ? 0 : 1);
  return `M${cx} ${cy - r}A${r} ${r} 0 0 ${limb} ${cx} ${cy + r}A${rx} ${r} 0 0 ${term} ${cx} ${cy - r}Z`;
}

/**
 * Spreads points around a circle so neighbours keep at least `minGap` degrees, keeping their order.
 * Returns { ...item, disp } where disp is the display longitude.
 */
export function spreadAround<T extends { lon: number }>(items: T[], minGap: number): (T & { disp: number })[] {
  const a = items.map((p) => ({ ...p, disp: p.lon })).sort((x, y) => x.lon - y.lon);
  if (a.length < 2) return a;
  for (let it = 0; it < 80; it++) {
    let moved = false;
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      const q = a[(i + 1) % a.length];
      const gap = (((q.disp - p.disp) % 360) + 360) % 360;
      if (gap < minGap) {
        const push = (minGap - gap) / 2;
        p.disp -= push;
        q.disp += push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return a;
}

/** Screen point for an ecliptic longitude: `rot` maps longitude → screen angle (degrees, counter-clockwise). */
export function pointAt(c: number, r: number, screenDeg: number): [number, number] {
  const t = screenDeg * DEG;
  return [c + r * Math.cos(t), c - r * Math.sin(t)];
}

/** Arc band path between two longitudes on an annulus (used to light a sign's sector). */
export function sectorPath(c: number, rOut: number, rIn: number, a0: number, a1: number): string {
  const [x0, y0] = pointAt(c, rOut, a0);
  const [x1, y1] = pointAt(c, rOut, a1);
  const [x2, y2] = pointAt(c, rIn, a1);
  const [x3, y3] = pointAt(c, rIn, a0);
  return `M${x0} ${y0}A${rOut} ${rOut} 0 0 0 ${x1} ${y1}L${x2} ${y2}A${rIn} ${rIn} 0 0 1 ${x3} ${y3}Z`;
}
