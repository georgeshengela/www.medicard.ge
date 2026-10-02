import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysKey,
  cycleCenter,
  cycleHeroActions,
  cycleHeroVariant,
  cycleRingModel,
  cycleStatsModel,
  cycleTipsAllowed,
  cycleWeekStrip,
  daysBetweenKeys,
  fertileDaysInCycle,
  homeTipCards,
  recordedPeriodDaysInCycle,
  startLeads,
  weekdayIndex,
} from './homeCycle.ts';

test('civil date math crosses months and years without timezone drift', () => {
  assert.equal(addDaysKey('2026-09-29', 3), '2026-10-02');
  assert.equal(addDaysKey('2026-01-01', -1), '2025-12-31');
  assert.equal(daysBetweenKeys('2026-10-02', '2026-10-05'), 3);
  assert.equal(daysBetweenKeys('2026-10-05', '2026-10-02'), -3);
  assert.equal(weekdayIndex('2026-10-02'), 4); // Friday (Mon = 0)
  assert.equal(weekdayIndex('2026-10-05'), 0); // Monday
});

test('ring: period → follicular → fertile → luteal cover the cycle in order, lived part up to today', () => {
  const ring = cycleRingModel({ day: 26, cycleLength: 28, periodLength: 5, fertileDays: { from: 12, to: 17 } });
  assert.equal(ring.count, 28);
  assert.deepEqual(ring.arcs.map((a) => a.kind), ['period', 'follicular', 'fertile', 'luteal']);
  const slot = 360 / 28;
  assert.ok(Math.abs(ring.arcs[0].from - 0) < 1e-9);
  assert.ok(Math.abs(ring.arcs[0].to - 5 * slot) < 1e-9);
  assert.ok(Math.abs(ring.arcs[3].to - 360) < 1e-9);
  // Day 26: earlier phases fully lived, luteal lived up to the end of day 26.
  assert.equal(ring.arcs[0].livedTo, ring.arcs[0].to);
  assert.equal(ring.arcs[2].livedTo, ring.arcs[2].to);
  assert.ok(Math.abs((ring.arcs[3].livedTo ?? 0) - 26 * slot) < 1e-9);
  assert.ok(Math.abs((ring.todayDeg ?? 0) - 25.5 * slot) < 1e-9);
});

test('ring: arcs never overlap and keep the cap gap', () => {
  const ring = cycleRingModel({ day: 8, cycleLength: 30, fertileDays: { from: 13, to: 18 }, capDeg: 4 });
  for (let i = 1; i < ring.arcs.length; i += 1) {
    assert.ok(ring.arcs[i].from - ring.arcs[i - 1].to >= 8 - 1e-9);
  }
  // Future phases have no lived part.
  assert.equal(ring.arcs.find((a) => a.kind === 'fertile')?.livedTo, null);
  assert.equal(ring.arcs.find((a) => a.kind === 'luteal')?.livedTo, null);
});

test('ring: without a visible fertile window everything after bleeding is follicular (as the dial)', () => {
  const ring = cycleRingModel({ day: 20, cycleLength: 28, fertileDays: null });
  assert.deepEqual(ring.arcs.map((a) => a.kind), ['period', 'follicular']);
});

test('ring: logged bleeding sets the rose arc; a late cycle grows the ring', () => {
  const logged = cycleRingModel({ day: 10, cycleLength: 28, periodLength: 5, recordedPeriodDays: [1, 2, 3, 4, 5, 6, 7] });
  assert.ok(Math.abs(logged.arcs[0].to - (7 / 28) * 360) < 1e-9);
  const late = cycleRingModel({ day: 33, cycleLength: 28 });
  assert.equal(late.count, 33);
  assert.ok(Math.abs((late.todayDeg ?? 0) - (32.5 / 33) * 360) < 1e-9);
});

test('ring: hidden cycle length (postpartum learning) draws no arcs and no today marker', () => {
  const ring = cycleRingModel({ day: 12, cycleLength: 28, hideLengthChrome: true });
  assert.deepEqual(ring.arcs, []);
  assert.equal(ring.todayDeg, null);
});

test('fertile window is clipped to this cycle; logged bleeding maps to cycle days', () => {
  assert.deepEqual(
    fertileDaysInCycle({ today: '2026-10-02', day: 26, cycleLength: 28, window: { start: '2026-09-18', end: '2026-09-23' } }),
    { from: 12, to: 17 },
  );
  assert.deepEqual(
    fertileDaysInCycle({ today: '2026-10-02', day: 26, cycleLength: 28, window: { start: '2026-10-10', end: '2026-10-16' } }),
    null,
  );
  assert.equal(fertileDaysInCycle({ today: '2026-10-02', day: 26, cycleLength: 28, window: null }), null);
  assert.deepEqual(
    recordedPeriodDaysInCycle({ today: '2026-10-02', day: 26, cycleLength: 28, bleedDates: ['2026-09-07', '2026-09-08', '2026-08-30'] }),
    [1, 2],
  );
});

test('centre number follows the hero grammar', () => {
  const base = { hideLengthChrome: false, hidePredicted: false, onPeriod: false, predictedToday: false, forecastOn: true, inDays: 3, day: 26, cycleLength: 28 };
  assert.deepEqual(cycleCenter(base), { kind: 'countdown', days: 3 });
  assert.deepEqual(cycleCenter({ ...base, onPeriod: true, day: 2 }), { kind: 'periodDay', day: 2 });
  assert.deepEqual(cycleCenter({ ...base, inDays: 0 }), { kind: 'periodToday' });
  assert.deepEqual(cycleCenter({ ...base, inDays: 9, predictedToday: true }), { kind: 'periodToday' });
  assert.deepEqual(cycleCenter({ ...base, inDays: -4, day: 32 }), { kind: 'late', day: 32, lateBy: 4 });
  assert.deepEqual(cycleCenter({ ...base, forecastOn: false }), { kind: 'cycleDay', day: 26, length: 28 });
  assert.deepEqual(cycleCenter({ ...base, hideLengthChrome: true }), { kind: 'none' });
  // Estimates hidden: an estimated "today" is never shown.
  assert.deepEqual(cycleCenter({ ...base, hidePredicted: true, forecastOn: false, predictedToday: true }), { kind: 'cycleDay', day: 26, length: 28 });
});

test('buttons mirror the cycle screen: start leads near the estimate, end leads on the period after day 1', () => {
  assert.equal(startLeads({ onPeriod: false, forecastOn: true, predictedToday: false, inDays: 3 }), true);
  assert.equal(startLeads({ onPeriod: false, forecastOn: true, predictedToday: false, inDays: 12 }), false);
  assert.equal(startLeads({ onPeriod: false, forecastOn: false, predictedToday: false, inDays: null }), true);
  assert.equal(startLeads({ onPeriod: false, forecastOn: true, predictedToday: false, inDays: -2 }), true);
  assert.equal(startLeads({ onPeriod: true, forecastOn: true, predictedToday: true, inDays: 0 }), false);

  assert.deepEqual(cycleHeroActions({ onPeriod: false, dayOne: false, leadsWithStart: true }), { primary: 'start', secondary: 'log' });
  assert.deepEqual(cycleHeroActions({ onPeriod: false, dayOne: false, leadsWithStart: false }), { primary: 'log', secondary: 'start' });
  assert.deepEqual(cycleHeroActions({ onPeriod: true, dayOne: false, leadsWithStart: false }), { primary: 'end', secondary: 'log' });
  assert.deepEqual(cycleHeroActions({ onPeriod: true, dayOne: true, leadsWithStart: false }), { primary: 'logFlow', secondary: null });
});

test('hero variant: the privacy lock wins and fails closed while unknown', () => {
  const base = { locked: false as boolean | null, hasView: true, failed: false, setupNeeded: false, pregnancy: false, postpartum: false, peri: false };
  assert.equal(cycleHeroVariant({ ...base, locked: null }), 'lockUnknown');
  assert.equal(cycleHeroVariant({ ...base, locked: true, pregnancy: true }), 'locked');
  assert.equal(cycleHeroVariant({ ...base, hasView: false }), 'loading');
  assert.equal(cycleHeroVariant({ ...base, hasView: false, failed: true }), 'failed');
  assert.equal(cycleHeroVariant({ ...base, setupNeeded: true }), 'setup');
  assert.equal(cycleHeroVariant({ ...base, pregnancy: true }), 'pregnancy');
  assert.equal(cycleHeroVariant({ ...base, postpartum: true }), 'postpartum');
  assert.equal(cycleHeroVariant({ ...base, peri: true }), 'peri');
  assert.equal(cycleHeroVariant(base), 'cycle');
});

const calendar = {
  '2026-09-29': { phase: 'luteal' },
  '2026-10-01': { phase: 'luteal', fertile: true },
  '2026-10-03': { fertile: true, ovulation: true },
  '2026-10-05': { period: true, predicted: true, hasSex: true, hasBbt: true, ovulationTest: 'positive', logged: true },
} as never;

test('strip: −3…+3 around today, logged bleeding solid even when estimates are hidden', () => {
  const days = cycleWeekStrip({
    today: '2026-10-02',
    calendar,
    bleedLogs: [{ date: '2026-09-30', flow: 'medium' }, { date: '2026-09-29', flow: 'spotting' }],
    showFertility: true,
    showOvulation: true,
    showPredicted: false,
  });
  assert.deepEqual(days.map((d) => d.key), ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
  assert.equal(days[3].today, true);
  assert.equal(days[1].loggedPeriod, true);
  assert.equal(days[0].spotting, true);
  // Estimates hidden → no dashed period and no fertile marks.
  assert.equal(days[6].predictedPeriod, false);
  assert.equal(days[2].fertile, false);
  assert.equal(days[4].ovulation, false);
});

test('strip: fertile / ovulation only when the fertility UI is allowed; private marks never leak', () => {
  const shown = cycleWeekStrip({ today: '2026-10-02', calendar, bleedLogs: [], showFertility: true, showOvulation: true, showPredicted: true });
  assert.equal(shown[2].fertile, true);
  assert.equal(shown[4].ovulation, true);
  assert.equal(shown[6].predictedPeriod, true);
  const contraception = cycleWeekStrip({ today: '2026-10-02', calendar, bleedLogs: [], showFertility: false, showOvulation: false, showPredicted: true });
  assert.equal(contraception.some((d) => d.fertile || d.ovulation), false);
  assert.equal(contraception[6].predictedPeriod, true);
  const noOvulationDate = cycleWeekStrip({ today: '2026-10-02', calendar, bleedLogs: [], showFertility: true, showOvulation: false, showPredicted: true });
  assert.equal(noOvulationDate[4].ovulation, false);
  assert.equal(noOvulationDate[4].fertile, true);
  for (const day of shown) {
    assert.deepEqual(Object.keys(day).sort(), ['dayOfMonth', 'fertile', 'key', 'loggedPeriod', 'ovulation', 'predictedPeriod', 'spotting', 'today', 'weekday']);
  }
});

test('stats: only an inferred pattern of 2+ cycles, same ranges as the cycle screen', () => {
  const averages = { usedCycleLength: 28, usedPeriodLength: 5, source: 'inferred' as const, cycleCount: 4 };
  const lengths = [{ length: 27 }, { length: 30 }, { length: 28 }];
  const stats = cycleStatsModel({ eligible: true, averages, cycleLengths: lengths });
  assert.deepEqual(stats, {
    cycleCount: 4,
    cycle: { value: 28, tone: 'typical' },
    period: { value: 5, tone: 'typical' },
    variation: { value: 3, tone: 'typical' },
  });
  // A new user's settings defaults are never filler.
  assert.equal(cycleStatsModel({ eligible: true, averages: { ...averages, source: 'user' }, cycleLengths: lengths }), null);
  assert.equal(cycleStatsModel({ eligible: true, averages: { ...averages, source: 'default' }, cycleLengths: lengths }), null);
  assert.equal(cycleStatsModel({ eligible: true, averages: { ...averages, cycleCount: 1 }, cycleLengths: lengths }), null);
  // Mode / suppressed length gate.
  assert.equal(cycleStatsModel({ eligible: false, averages, cycleLengths: lengths }), null);

  const outside = cycleStatsModel({
    eligible: true,
    averages: { usedCycleLength: 38, usedPeriodLength: 1, source: 'inferred', cycleCount: 3 },
    cycleLengths: [{ length: 24 }, { length: 38 }],
  });
  assert.equal(outside?.cycle.tone, 'longer');
  assert.equal(outside?.period.tone, 'shorter');
  assert.deepEqual(outside?.variation, { value: 14, tone: 'variable' });
  const noTrend = cycleStatsModel({ eligible: true, averages, cycleLengths: [] });
  assert.deepEqual(noTrend?.variation, { value: null, tone: 'unknown' });
});

test('tips: daily tips only, and only where the cycle screen would show them', () => {
  const cards = [{ id: 'advice_luteal' }, { id: 'advice_pcos' }, { id: 'tip_luteal_1' }, { id: 'tip_luteal_2' }, { id: 'tip_luteal_3' }, { id: 'advice_mood' }];
  assert.deepEqual(homeTipCards(cards).map((c) => c.id), ['tip_luteal_1', 'tip_luteal_2', 'tip_luteal_3']);
  assert.deepEqual(homeTipCards([{ id: 'advice_pregnancy' }]), []);

  const ok = { locked: false as boolean | null, classicOverview: true, forecastAllowed: true, phaseBiological: true, setupNeeded: false, phase: 'luteal' };
  assert.equal(cycleTipsAllowed(ok), true);
  assert.equal(cycleTipsAllowed({ ...ok, locked: null }), false);
  assert.equal(cycleTipsAllowed({ ...ok, locked: true }), false);
  assert.equal(cycleTipsAllowed({ ...ok, classicOverview: false }), false); // pregnancy, postpartum, perimenopause
  assert.equal(cycleTipsAllowed({ ...ok, forecastAllowed: false }), false);
  assert.equal(cycleTipsAllowed({ ...ok, phaseBiological: false }), false); // hormonal contraception
  assert.equal(cycleTipsAllowed({ ...ok, setupNeeded: true }), false);
  assert.equal(cycleTipsAllowed({ ...ok, phase: 'unknown' }), false);
});

test('women Home sections never mount the AI tips panel, the stories row or sex logging', async () => {
  const { readFileSync } = await import('node:fs');
  const dir = new URL('../../components/home/sections/', import.meta.url);
  for (const file of ['HomeCycleHero.tsx', 'HomeCycleTips.tsx', 'HomeCycleStats.tsx', 'useHomeCycleActions.ts']) {
    const src = readFileSync(new URL(file, dir), 'utf8');
    assert.doesNotMatch(src, /CycleInsights|CycleStoriesRow|CycleSexSheet|api\.cycle\.insights|persistCycleLog|hasSex|sexualActivity/, file);
  }
});
