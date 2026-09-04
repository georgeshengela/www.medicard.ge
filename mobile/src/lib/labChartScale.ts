export const LAB_CHART_PLOT_H = 196;
export const LAB_CHART_INSET = 12;

export type LabChartScale = {
  y: (v: number) => number;
  ticks: number[];
  top: number;
  bottom: number;
};

type LabChartRefs = {
  normal?: number | null;
  refLow?: number | null;
  refHigh?: number | null;
};

/** Domain + ticks that always cover every value, with room above the peak. */
export function makeLabChartScale(
  values: number[],
  refs: LabChartRefs = {},
  plotH = LAB_CHART_PLOT_H,
  inset = LAB_CHART_INSET,
): LabChartScale {
  const nums = values.filter((n) => Number.isFinite(n));
  if (refs.normal != null && Number.isFinite(refs.normal)) nums.push(refs.normal);
  if (refs.refLow != null && Number.isFinite(refs.refLow)) nums.push(refs.refLow);
  if (refs.refHigh != null && Number.isFinite(refs.refHigh)) nums.push(refs.refHigh);

  const dataLo = nums.length ? Math.min(...nums) : 0;
  const dataHi = nums.length ? Math.max(...nums) : 1;
  const allNonNegative = nums.length === 0 || nums.every((n) => n >= 0);

  let bottom = dataLo;
  let top = dataHi;
  if (top === bottom) {
    const pad = Math.abs(top) * 0.25 || 1;
    bottom -= pad;
    top += pad;
  }

  const span = top - bottom;
  if (allNonNegative && dataLo <= dataHi * 0.35) bottom = 0;
  else bottom -= span * 0.08;

  if (allNonNegative) bottom = Math.max(0, bottom);

  const headroom = Math.max(span * 0.08, Math.abs(dataHi) * 0.03, 0.15);
  const targetTop = dataHi + headroom;
  const ticks = coveringTicks(bottom, targetTop, dataHi);
  const domainBottom = ticks[0];
  const domainTop = ticks[ticks.length - 1];
  const inner = plotH - inset * 2;

  return {
    ticks: [...ticks].reverse(),
    top: domainTop,
    bottom: domainBottom,
    y: (v) => inset + inner * (1 - (v - domainBottom) / Math.max(domainTop - domainBottom, 1e-6)),
  };
}

export function coveringTicks(min: number, targetMax: number, dataMax: number): number[] {
  const span = Math.max(targetMax - min, Math.abs(dataMax - min), 1e-6);
  const rough = span / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / mag;
  const step = (residual <= 1.5 ? 1 : residual <= 3 ? 2 : residual <= 7 ? 5 : 10) * mag;
  let start = Math.floor(min / step) * step;
  if (min >= 0 && start < 0) start = 0;
  let end = Math.ceil(Math.max(targetMax, dataMax) / step) * step;
  if (end <= dataMax + step * 0.02) end += step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step * 1e-6; v += step) {
    ticks.push(Number(v.toFixed(6)));
    if (ticks.length > 8) break;
  }
  if ((ticks[ticks.length - 1] ?? start) < dataMax) {
    ticks.push(Number(((ticks[ticks.length - 1] ?? start) + step).toFixed(6)));
  }
  return ticks.length >= 2 ? ticks : [start, end || start + step];
}

export function downsampleLabPoints<T>(points: T[], max: number, valueOf: (row: T) => number): T[] {
  if (points.length <= max) return points;
  const keep = new Map<number, T>();
  for (let i = 0; i < max; i += 1) {
    const idx = Math.round((i / (max - 1)) * (points.length - 1));
    keep.set(idx, points[idx]);
  }
  let minI = 0;
  let maxI = 0;
  points.forEach((row, i) => {
    const value = valueOf(row);
    if (value < valueOf(points[minI])) minI = i;
    if (value > valueOf(points[maxI])) maxI = i;
  });
  keep.set(minI, points[minI]);
  keep.set(maxI, points[maxI]);
  return [...keep.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row);
}
