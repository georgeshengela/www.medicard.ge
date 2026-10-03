/**
 * „ციკლის ტალღა“ — the women's Home hero draws the whole cycle as one soft wave (owner 2026-10-03:
 * the plain glow answer felt lifeless). Pure geometry only; `CycleWaveStage` paints it.
 *
 * The axis is in day units: day `d` occupies [d − 1, d]. Phase runs come from `cycleRingModel` (the
 * same runs as the /cycle dial), so the colours never disagree with the dial. The shape is a calm
 * illustration, not a measurement: with a visible fertile window it rises towards that window and
 * keeps a gentle second hill after it; without one (fertility hidden, contraception, learning) it is
 * one neutral hill with no peak that could read as ovulation.
 */
import { cycleRingModel, type RingPhaseKind } from './homeCycle.ts';

export type WavePhase = { kind: RingPhaseKind | 'next'; from: number; to: number };
export type WaveDot = { day: number; state: 'lived' | 'today' | 'ahead'; bleed: boolean };
export type WavePoint = { t: number; v: number };

export type CycleWaveModel = {
  /** Axis length in days (the cycle, grown for a late cycle or a forecast window past its end). */
  span: number;
  /** Cycle days that can be previewed with a finger (never the next cycle). */
  maxDay: number;
  phases: WavePhase[];
  /** 0…1 heights sampled every quarter day from 0 to `span`. */
  points: WavePoint[];
  /** Centre of today's day; null when the day is unknown. */
  todayT: number | null;
  /** Where the next period is expected to begin (axis units); null without a forecast. */
  dropT: number | null;
  /** A variable cycle's whole start window (axis units), shown instead of one drop. */
  windowT: { from: number; to: number } | null;
  dots: WaveDot[];
};

const STEP = 0.25;
const gauss = (t: number, mu: number, sigma: number) => Math.exp(-((t - mu) ** 2) / (2 * sigma * sigma));

export function cycleWaveModel({
  day,
  cycleLength,
  periodLength = 5,
  recordedPeriodDays = [],
  fertileDays = null,
  nextInDays = null,
  window = null,
}: {
  day: number | null;
  cycleLength: number;
  periodLength?: number;
  recordedPeriodDays?: number[];
  fertileDays?: { from: number; to: number } | null;
  /** Days from today to the expected next period (null = no forecast shown). */
  nextInDays?: number | null;
  /** A variable cycle's window as days from today (`from` may be ≤ 0 once it is open). */
  window?: { from: number; to: number } | null;
}): CycleWaveModel | null {
  if (day == null || day <= 0) return null;
  const ring = cycleRingModel({ day, cycleLength, periodLength, recordedPeriodDays, fertileDays });
  const count = ring.count;
  const unit = count / 360;
  const phases: WavePhase[] = ring.arcs.map((a) => ({ kind: a.kind, from: a.from * unit, to: a.to * unit }));

  const todayT = day - 0.5;
  // The next period starts at the beginning of day (day + n): axis position day + n − 1.
  const dropT = nextInDays != null && nextInDays > 0 ? day + nextInDays - 1 : null;
  const windowT = window ? { from: Math.max(day, day + window.from - 1), to: day + window.to } : null;
  const span = Math.max(count, dropT ?? 0, windowT?.to ?? 0);
  if (span > count) phases.push({ kind: 'next', from: count, to: span });

  const fStart = fertileDays ? Math.min(fertileDays.from, fertileDays.to) : null;
  const fEnd = fertileDays ? Math.max(fertileDays.from, fertileDays.to) : null;
  const shape =
    fStart != null && fEnd != null
      ? (t: number) => {
          const o = fEnd - 1.5;
          return 0.06 + 0.4 * gauss(t, o - 3.5, 3.2) + 0.85 * gauss(t, o, 1.7) + 0.5 * gauss(t, o + 7, 3.6);
        }
      : (t: number) => 0.1 + 0.6 * gauss(t, count * 0.55, count * 0.22);
  const raw: WavePoint[] = [];
  for (let t = 0; t <= span + 1e-9; t += STEP) raw.push({ t, v: t > count ? 0.06 : shape(t) });
  const max = Math.max(...raw.map((p) => p.v)) || 1;
  const points = raw.map((p) => ({ t: p.t, v: p.v / max }));

  const bleed = new Set(recordedPeriodDays);
  const dots: WaveDot[] = [];
  for (let d = 1; d <= count; d += 1) {
    dots.push({ day: d, state: d < day ? 'lived' : d === day ? 'today' : 'ahead', bleed: bleed.has(d) && d <= day });
  }

  return { span, maxDay: count, phases, points, todayT, dropT, windowT, dots };
}

/** The wave's height (0…1) at axis position `t`, linear between samples. */
export function waveHeightAt(model: CycleWaveModel, t: number): number {
  const i = Math.max(0, Math.min(model.points.length - 1, t / STEP));
  const lo = Math.floor(i);
  const hi = Math.min(model.points.length - 1, lo + 1);
  const f = i - lo;
  return model.points[lo].v * (1 - f) + model.points[hi].v * f;
}

/** The cycle day under a finger at axis position `t` (clamped to this cycle). */
export function waveDayAt(model: CycleWaveModel, t: number): number {
  return Math.max(1, Math.min(model.maxDay, Math.floor(t) + 1));
}
