/** Figma 8845:313440 / 8910:69693 — 375×252 gauge frame. */
export const FIGMA_RESULT = {
  frameWidth: 375,
  frameHeight: 252,
  ellipseSize: 236,
  /** Figma: left calc(50% + 0.5px) − half of 236. */
  ellipseLeft: 375 / 2 + 0.5 - 236 / 2,
  ellipseTop: 35,
  scoreBlockTop: 87,
  scoreBlockWidth: 182,
  scoreBlockLeft: (375 - 182) / 2,
  scoreGap: 5,
  scaleZeroX: 89,
  scaleHundredX: 285,
  scaleY: 227,
  knobSize: 20,
} as const;

/** Exact Figma arc slices — paths + insets inside 236×236 ellipse (top, right, bottom, left %). */
export const FIGMA_GAUGE_ARC_LAYERS = [
  {
    id: 'low',
    inset: [13.15, 83.77, 21.61, -3.39] as const,
    d: 'M23.8091 145.957C11.3496 124.377 6.04179 99.4058 8.64655 74.6231C11.2513 49.8405 21.6349 26.5186 38.309 8.00007',
  },
  {
    id: 'medium-mid',
    inset: [-2.59, 55.52, 86.98, 17.11] as const,
    d: 'M8.00055 28.8436C22.4143 18.3094 39.0305 11.1831 56.5976 8.00138',
  },
  {
    id: 'medium-top',
    inset: [-3.39, 17.33, 86.98, 17.11] as const,
    d: 'M8.00055 30.7312C28.1193 16.0275 52.3766 8.07046 77.2956 8.00047C102.215 7.93047 126.516 15.7511 146.717 30.3416',
  },
  {
    id: 'high',
    inset: [13.15, -3.39, 21.61, 83.77] as const,
    d: 'M22.5 145.957C34.9595 124.377 40.2673 99.4058 37.6626 74.6231C35.0578 49.8405 24.6742 26.5186 8.00006 8.00007',
    reverse: true,
  },
] as const;

export const GAUGE_TRACK_COLOR = '#E5E7EB';
export const GAUGE_ACTIVE_COLOR = '#F59E0B';
export const GAUGE_STROKE_WIDTH = 16;

const ARC_TRAVERSAL_ORDER = ['low', 'medium-mid', 'medium-top', 'high'] as const;

export const FIGMA_SHADOW_COLLAPSED = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 1,
  elevation: 1,
} as const;

type Pt = { x: number; y: number };
type Layer = (typeof FIGMA_GAUGE_ARC_LAYERS)[number];

function insetOffset(
  [topPct, _rightPct, _bottomPct, leftPct]: readonly [number, number, number, number],
) {
  return {
    x: FIGMA_RESULT.ellipseLeft + (leftPct / 100) * FIGMA_RESULT.ellipseSize,
    y: FIGMA_RESULT.ellipseTop + (topPct / 100) * FIGMA_RESULT.ellipseSize,
  };
}

export function layerFrameTransform(layer: Layer) {
  return insetOffset(layer.inset);
}

function cubicAt(t: number, p0: Pt, p1: Pt, p2: Pt, p3: Pt): Pt {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  return {
    x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
    y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
  };
}

function parsePath(d: string): Pt[][] {
  const tokens = d.match(/[MC][^MC]*/g) ?? [];
  const segments: Pt[][] = [];
  let cursor: Pt = { x: 0, y: 0 };

  for (const token of tokens) {
    const nums = token
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (token[0] === 'M') {
      cursor = { x: nums[0], y: nums[1] };
    } else if (token[0] === 'C') {
      for (let i = 0; i < nums.length; i += 6) {
        const p0 = cursor;
        const p1 = { x: nums[i], y: nums[i + 1] };
        const p2 = { x: nums[i + 2], y: nums[i + 3] };
        const p3 = { x: nums[i + 4], y: nums[i + 5] };
        segments.push([p0, p1, p2, p3]);
        cursor = p3;
      }
    }
  }
  return segments;
}

function layerSegments(layer: Layer) {
  const segments = parsePath(layer.d);
  const reverse = 'reverse' in layer && layer.reverse === true;
  const list = reverse ? [...segments].reverse() : segments;
  return list.map((seg) => (reverse ? [seg[3], seg[2], seg[1], seg[0]] : seg) as [Pt, Pt, Pt, Pt]);
}

function sampleLayer(layer: Layer, steps: number): Pt[] {
  const { x, y } = insetOffset(layer.inset);
  const pts: Pt[] = [];

  for (const [p0, p1, p2, p3] of layerSegments(layer)) {
    for (let i = 0; i <= steps; i++) {
      const p = cubicAt(i / steps, p0, p1, p2, p3);
      pts.push({ x: x + p.x, y: y + p.y });
    }
  }
  return pts;
}

function buildArcSamples(): Pt[] {
  const all: Pt[] = [];
  for (const id of ARC_TRAVERSAL_ORDER) {
    const layer = FIGMA_GAUGE_ARC_LAYERS.find((l) => l.id === id)!;
    all.push(...sampleLayer(layer, 48));
  }
  return all;
}

const ARC_SAMPLES = buildArcSamples();

function dist(a: Pt, b: Pt) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function cumulativeLengths(pts: Pt[]) {
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) {
    lengths.push(lengths[i - 1] + dist(pts[i - 1], pts[i]));
  }
  return lengths;
}

const ARC_LENGTHS = cumulativeLengths(ARC_SAMPLES);
const ARC_TOTAL = ARC_LENGTHS[ARC_LENGTHS.length - 1] ?? 1;

/** Score 0–100 → arc length fraction (knob + fill stay in sync). */
export function scoreToPathT(score: number) {
  return Math.max(0, Math.min(100, score)) / 100;
}

function pointAtPathT(t: number): Pt {
  const target = t * ARC_TOTAL;
  for (let i = 1; i < ARC_LENGTHS.length; i++) {
    if (ARC_LENGTHS[i] >= target) {
      const span = ARC_LENGTHS[i] - ARC_LENGTHS[i - 1];
      const f = span > 0 ? (target - ARC_LENGTHS[i - 1]) / span : 0;
      const a = ARC_SAMPLES[i - 1];
      const b = ARC_SAMPLES[i];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
  }
  return ARC_SAMPLES[ARC_SAMPLES.length - 1] ?? { x: 187, y: 36 };
}

export const GAUGE_TRACK_LENGTH = ARC_TOTAL;

export function scoreKnobPoint(score: number): Pt {
  return pointAtPathT(scoreToPathT(score));
}

export function scoreKnobBox(score: number) {
  const c = scoreKnobPoint(score);
  const half = FIGMA_RESULT.knobSize / 2;
  return { left: c.x - half, top: c.y - half, center: c };
}

/** Wedge clip — reveals Figma orange arc layers up to score. */
export function gaugeProgressClipD(score: number): string {
  const tip = scoreKnobPoint(score);
  const targetLen = scoreToPathT(score) * ARC_TOTAL;
  const arcStart = ARC_SAMPLES[0];
  const arcNext = ARC_SAMPLES[1] ?? arcStart;

  // Extend past path start so round stroke cap is fully inside the clip.
  const sx = arcStart.x - arcNext.x;
  const sy = arcStart.y - arcNext.y;
  const slen = Math.hypot(sx, sy) || 1;
  const capLead = {
    x: arcStart.x + (sx / slen) * (GAUGE_STROKE_WIDTH / 2 + 4),
    y: arcStart.y + (sy / slen) * (GAUGE_STROKE_WIDTH / 2 + 4),
  };

  const arcPts: Pt[] = [capLead, arcStart];

  for (let i = 1; i < ARC_SAMPLES.length; i++) {
    if (ARC_LENGTHS[i] > targetLen) break;
    arcPts.push(ARC_SAMPLES[i]);
  }
  arcPts.push(tip);

  const cx = FIGMA_RESULT.frameWidth / 2;
  const cy = FIGMA_RESULT.frameHeight + 12;

  const expand = (p: Pt, amount: number) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * amount, y: p.y + (dy / len) * amount };
  };

  const expanded = arcPts.map((p, idx) => expand(p, idx <= 1 ? 34 : 24));

  const startCorner = {
    x: arcStart.x - 28,
    y: arcStart.y + 24,
  };

  let d = `M ${cx} ${cy} L ${startCorner.x} ${startCorner.y}`;
  for (const p of expanded) d += ` L ${p.x} ${p.y}`;
  return `${d} Z`;
}
