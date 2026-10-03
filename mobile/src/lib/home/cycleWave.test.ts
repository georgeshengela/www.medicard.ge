import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycleWaveModel, waveDayAt, waveHeightAt } from './cycleWave.ts';

test('no wave without a cycle day', () => {
  assert.equal(cycleWaveModel({ day: null, cycleLength: 28 }), null);
  assert.equal(cycleWaveModel({ day: 0, cycleLength: 28 }), null);
});

test('day 22 of 28, period in 7 days: today, drop at the end, phases in dial order', () => {
  const m = cycleWaveModel({ day: 22, cycleLength: 28, fertileDays: { from: 10, to: 15 }, nextInDays: 7 })!;
  assert.equal(m.span, 28);
  assert.equal(m.todayT, 21.5);
  assert.equal(m.dropT, 28);
  assert.deepEqual(m.phases.map((p) => p.kind), ['period', 'follicular', 'fertile', 'luteal']);
  assert.equal(m.dots.length, 28);
  assert.equal(m.dots.filter((d) => d.state === 'ahead').length, 6);
  assert.equal(m.dots[21].state, 'today');
});

test('heights stay within 0…1 and peak inside the fertile window', () => {
  const m = cycleWaveModel({ day: 5, cycleLength: 28, fertileDays: { from: 10, to: 15 }, nextInDays: 24 })!;
  for (const p of m.points) assert.ok(p.v >= 0 && p.v <= 1);
  const peak = m.points.reduce((a, b) => (b.v > a.v ? b : a));
  assert.ok(peak.t >= 9 && peak.t <= 15, `peak at ${peak.t}`);
});

test('without a fertile window the wave is one neutral hill (no ovulation-like spike)', () => {
  const m = cycleWaveModel({ day: 12, cycleLength: 28, nextInDays: 17 })!;
  assert.deepEqual(m.phases.map((p) => p.kind), ['period', 'follicular']);
  const peak = m.points.reduce((a, b) => (b.v > a.v ? b : a));
  assert.ok(Math.abs(peak.t - 28 * 0.55) < 1);
  assert.ok(waveHeightAt(m, 1) < 0.5);
});

test('a forecast window past the cycle end grows the axis with a „next“ run', () => {
  const m = cycleWaveModel({ day: 25, cycleLength: 28, nextInDays: 4, window: { from: 2, to: 7 } })!;
  assert.deepEqual(m.windowT, { from: 26, to: 32 });
  assert.equal(m.span, 32);
  assert.equal(m.phases.at(-1)!.kind, 'next');
  assert.equal(m.maxDay, 28);
});

test('a late cycle grows to today and has no drop', () => {
  const m = cycleWaveModel({ day: 33, cycleLength: 28, nextInDays: -5 })!;
  assert.equal(m.span, 33);
  assert.equal(m.dropT, null);
  assert.equal(m.todayT, 32.5);
});

test('logged bleeding marks only lived days; finger positions clamp to this cycle', () => {
  const m = cycleWaveModel({ day: 3, cycleLength: 28, recordedPeriodDays: [1, 2, 3], nextInDays: 26 })!;
  assert.deepEqual(m.dots.filter((d) => d.bleed).map((d) => d.day), [1, 2, 3]);
  assert.equal(waveDayAt(m, -2), 1);
  assert.equal(waveDayAt(m, 4.2), 5);
  assert.equal(waveDayAt(m, 99), 28);
});
