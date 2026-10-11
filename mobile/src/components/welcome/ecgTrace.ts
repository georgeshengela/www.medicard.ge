/**
 * The heartbeat line of the welcome screen: a flat baseline with one P-QRS-T complex on each side of the
 * logo disc. Built from points so its length and the spot where the pulse reaches the disc are exact
 * (the disc beats at that moment). Units are screen points; the line sits in a box `ECG_BOX_H` tall.
 */
export const ECG_BOX_H = 120;
const BASE = ECG_BOX_H / 2;
const COMPLEX_W = 80;
// P wave, flat, Q dip, tall R, S, flat, rounded T (x across, y up = negative)
const COMPLEX: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [5, -5], [10, 0], [26, 0], [30, 8], [37, -38], [44, 16], [49, 0], [66, 0],
  [69.5, -3.75], [73, -5], [76.5, -3.75], [80, 0],
];

export type EcgTrace = {
  /** SVG path data. */
  d: string;
  /** Total length of the line. */
  length: number;
  /** Distance along the line where it passes under the disc's left edge. */
  hit: number;
};

export function ecgTrace(width: number, disc: number): EcgTrace {
  const edge = (width - disc) / 2;
  // narrow phones squeeze the complexes instead of pushing them under the disc
  const k = Math.min(1, Math.max(0.5, (edge - 6) / COMPLEX_W));
  const left = edge - 2 - COMPLEX_W * k;
  const right = width - edge + 4;
  const points: Array<readonly [number, number]> = [[-20, BASE]];
  for (const [x, y] of COMPLEX) points.push([left + x * k, BASE + y]);
  for (const [x, y] of COMPLEX) points.push([right + x * k, BASE + y]);
  points.push([width + 20, BASE]);

  let length = 0;
  let hit = -1;
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (hit < 0 && ax < edge && bx >= edge) hit = length + seg * ((edge - ax) / (bx - ax));
    length += seg;
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  const d = `M${points.map(([x, y]) => `${r(x)},${r(y)}`).join(' L')}`;
  return { d, length, hit: Math.max(0, hit) };
}

/**
 * A plain heartbeat line across a strip (MEDISCAN waiting, the heart-rate card): one complex every
 * `spacing` points, scaled to the strip height. `beatLength` is the distance along the line from one
 * complex to the next, so a pulse moving at `beatLength * bpm / 60` per second crosses one beat each
 * heartbeat.
 */
export function ecgStrip(width: number, height: number, spacing = 120): { d: string; length: number; beatLength: number } {
  const base = height / 2;
  const k = Math.min(1, (height / 2 - 2) / 38);
  const step = Math.max(COMPLEX_W + 16, spacing);
  const points: Array<readonly [number, number]> = [[0, base]];
  for (let start = (step - COMPLEX_W) / 2; start + COMPLEX_W <= width; start += step) {
    for (const [x, y] of COMPLEX) points.push([start + x, base + y * k]);
  }
  points.push([width, base]);
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  let one = 0;
  for (let i = 1; i < COMPLEX.length; i += 1) {
    one += Math.hypot(COMPLEX[i][0] - COMPLEX[i - 1][0], (COMPLEX[i][1] - COMPLEX[i - 1][1]) * k);
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  const d = `M${points.map(([x, y]) => `${r(x)},${r(y)}`).join(' L')}`;
  return { d, length, beatLength: one + (step - COMPLEX_W) };
}
