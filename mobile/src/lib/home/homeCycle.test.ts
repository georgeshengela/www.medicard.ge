import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysKey,
  cycleAheadModel,
  cycleBarsModel,
  cycleCenter,
  cycleHeroActions,
  cycleHeroVariant,
  cycleRingModel,
  cycleSpreadModel,
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

test('variable cycles: the spread comes from her own last cycles, never narrower than a day or wider than a week', () => {
  // Regular cycles keep the single estimate.
  assert.equal(cycleSpreadModel({ isIrregular: false, usedCycleLength: 28, cycleLengths: [{ length: 24 }, { length: 33 }] }), null);
  assert.equal(cycleSpreadModel({ isIrregular: null, usedCycleLength: 28, cycleLengths: [] }), null);
  // No history yet → ± 3 days.
  assert.deepEqual(cycleSpreadModel({ isIrregular: true, usedCycleLength: 28, cycleLengths: [] }), { before: 3, after: 3 });
  assert.deepEqual(cycleSpreadModel({ isIrregular: true, usedCycleLength: null, cycleLengths: [{ length: 30 }] }), { before: 3, after: 3 });
  // Shortest 25 / longest 34 around an average of 29 → 4 days before, 5 after.
  assert.deepEqual(
    cycleSpreadModel({ isIrregular: true, usedCycleLength: 29, cycleLengths: [{ length: 25 }, { length: 34 }, { length: 28 }, { length: 29 }] }),
    { before: 4, after: 5 },
  );
  // Identical cycles still never collapse to one date; a huge spread is capped at a week; nulls and old cycles are ignored.
  assert.deepEqual(cycleSpreadModel({ isIrregular: true, usedCycleLength: 28, cycleLengths: [{ length: 28 }, { length: 28 }] }), { before: 1, after: 1 });
  const wide = [{ length: 12 }, { length: 60 }, { length: null }, { length: 28 }];
  assert.deepEqual(cycleSpreadModel({ isIrregular: true, usedCycleLength: 28, cycleLengths: wide }), { before: 7, after: 7 });
  const old = [{ length: 10 }, { length: 27 }, { length: 28 }, { length: 29 }, { length: 27 }, { length: 28 }, { length: 29 }];
  assert.deepEqual(cycleSpreadModel({ isIrregular: true, usedCycleLength: 28, cycleLengths: old }), { before: 1, after: 1 });
  // The server's window wins (also for a spread ≥ 8 days without the irregular flag).
  assert.deepEqual(
    cycleSpreadModel({ isIrregular: false, usedCycleLength: 30, cycleLengths: [], nextPeriodStart: '2026-10-01', serverRange: { from: '2026-09-26', to: '2026-10-05' } }),
    { before: 5, after: 4 },
  );
  assert.deepEqual(
    cycleSpreadModel({ isIrregular: true, usedCycleLength: 28, cycleLengths: [], nextPeriodStart: '2026-10-01', serverRange: null }),
    { before: 3, after: 3 },
  );
});

test('variable cycles: the centre shows a window, then „today or soon“, and is late only after the window', () => {
  const base = { hideLengthChrome: false, hidePredicted: false, onPeriod: false, predictedToday: false, forecastOn: true, inDays: 5, day: 24, cycleLength: 28 };
  const spread = { before: 2, after: 3 };
  assert.deepEqual(cycleCenter({ ...base, spread }), { kind: 'countdownRange', from: 3, to: 8 });
  assert.deepEqual(cycleCenter({ ...base, spread, inDays: 2 }), { kind: 'windowOpen', to: 5 });
  assert.deepEqual(cycleCenter({ ...base, spread, inDays: 0 }), { kind: 'windowOpen', to: 3 });
  assert.deepEqual(cycleCenter({ ...base, spread, inDays: -3, day: 32 }), { kind: 'windowOpen', to: 0 });
  assert.deepEqual(cycleCenter({ ...base, spread, inDays: -4, day: 33 }), { kind: 'late', day: 33, lateBy: 4 });
  // The calendar painting today as expected bleeding opens the window at once.
  assert.deepEqual(cycleCenter({ ...base, spread, inDays: 9, predictedToday: true }), { kind: 'windowOpen', to: 12 });
  // Bleeding, hidden estimates and no forecast are untouched by the spread.
  assert.deepEqual(cycleCenter({ ...base, spread, onPeriod: true, day: 1 }), { kind: 'periodDay', day: 1 });
  assert.deepEqual(cycleCenter({ ...base, spread, hidePredicted: true, forecastOn: false }), { kind: 'cycleDay', day: 24, length: 28 });
  assert.deepEqual(cycleCenter({ ...base, spread, forecastOn: false }), { kind: 'cycleDay', day: 24, length: 28 });
  // Without a spread nothing changes.
  assert.deepEqual(cycleCenter({ ...base, spread: null }), { kind: 'countdown', days: 5 });
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

test('stats: two cycles show numbers and „ვსწავლობთ · 2/3“, verdicts from the third', () => {
  const two = cycleStatsModel({
    eligible: true,
    averages: { usedCycleLength: 38, usedPeriodLength: 5, source: 'inferred', cycleCount: 2 },
    cycleLengths: [{ length: 24 }, { length: 38 }],
  });
  assert.deepEqual(two, {
    cycleCount: 2,
    cycle: { value: 38, tone: 'learning' },
    period: { value: 5, tone: 'learning' },
    variation: { value: 14, tone: 'learning' },
    learning: { done: 2, required: 3 },
  });
  const three = cycleStatsModel({
    eligible: true,
    averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'inferred', cycleCount: 3 },
    cycleLengths: [{ length: 28 }, { length: 27 }, { length: 29 }],
  });
  assert.equal(three?.cycle.tone, 'typical');
  assert.equal(three?.learning, undefined);
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

test('women Home sections never mount the AI tips panel or the stories row; sex is the hero\u2019s one-tap only', async () => {
  const { readFileSync } = await import('node:fs');
  const dir = new URL('../../components/home/sections/', import.meta.url);
  const read = (file: string) => readFileSync(new URL(file, dir), 'utf8');
  const all = ['HomeCycleHero.tsx', 'HomeCycleAhead.tsx', 'HomeCycleTips.tsx', 'HomeCycleStats.tsx', 'useHomeCycleActions.ts'];
  // No AI insights, no stories row, and never the calendar's private marks (sex, BBT, tests).
  for (const file of all) {
    assert.doesNotMatch(read(file), /CycleInsights|CycleStoriesRow|api\.cycle\.insights|hasSex|hasBbt|ovulationTest|pregnancyTest/, file);
  }
  // Owner 2026-10-03: „♥ სექსი“ on Home like on the cycle screen — in the hero and its actions only.
  for (const file of all.filter((f) => f !== 'HomeCycleHero.tsx' && f !== 'useHomeCycleActions.ts')) {
    assert.doesNotMatch(read(file), /CycleSexSheet|persistCycleLog|sexualActivity|sexual\b/, file);
  }
  const hero = read('HomeCycleHero.tsx');
  // The private sheet mounts only for a signed-in user whose cycle is not locked.
  assert.match(hero, /userId && locked === false \? \(\s*<CycleSexSheet/);
  // The hero reads the day's sex flag from the unlocked view only (`view` is null while locked).
  assert.match(hero, /const view = locked === false \? cycle\.view : null;/);
});

const PHASES = [
  { periodStart: '2026-09-08', periodEnd: '2026-09-12', ovulation: '2026-09-22', fertileStart: '2026-09-17', fertileEnd: '2026-09-23' },
  { periodStart: '2026-10-06', periodEnd: '2026-10-10', ovulation: '2026-10-20', fertileStart: '2026-10-15', fertileEnd: '2026-10-21' },
  { periodStart: '2026-11-03', periodEnd: '2026-11-07', ovulation: '2026-11-17', fertileStart: '2026-11-12', fertileEnd: '2026-11-18' },
];
const AHEAD = { phases: PHASES, nextPeriodStart: '2026-10-06', nextPeriodEnd: '2026-10-10', onPeriod: false, showPeriod: true, showFertility: true, showOvulation: true };

test('ahead: next period, fertile days and ovulation, soonest first', () => {
  const events = cycleAheadModel({ today: '2026-10-03', ...AHEAD });
  assert.deepEqual(events.map((e) => [e.kind, e.start, e.end, e.inDays, e.ongoing]), [
    ['period', '2026-10-06', '2026-10-10', 3, false],
    ['fertile', '2026-10-15', '2026-10-21', 12, false],
    // Ovulation as a 3-day band (brief §8.2 item 5), never one day.
    ['ovulation', '2026-10-19', '2026-10-21', 16, false],
  ]);
});

test('ahead: inside the fertile window it is ongoing and leads; ovulation day counts down to 0', () => {
  const events = cycleAheadModel({ today: '2026-09-21', ...AHEAD });
  assert.deepEqual(events.map((e) => [e.kind, e.inDays, e.ongoing]), [
    ['fertile', 0, true],
    ['ovulation', 0, true],
    ['period', 15, false],
  ]);
  const onDay = cycleAheadModel({ today: '2026-09-22', ...AHEAD }).find((e) => e.kind === 'ovulation');
  assert.equal(onDay?.inDays, 0);
  assert.equal(onDay?.ongoing, true);
  // The day after the band the next cycle's band is shown.
  const after = cycleAheadModel({ today: '2026-09-24', ...AHEAD }).find((e) => e.kind === 'ovulation');
  assert.equal(after?.start, '2026-10-19');
});

test('ahead: the server band wins; gated cycles (null) are skipped; the TTC window is marked wide', () => {
  const band = [{ ...PHASES[1], ovulationStart: '2026-10-21', ovulationEnd: '2026-10-23' }];
  assert.deepEqual(
    cycleAheadModel({ today: '2026-10-03', ...AHEAD, phases: band }).find((e) => e.kind === 'ovulation'),
    { kind: 'ovulation', start: '2026-10-21', end: '2026-10-23', inDays: 18, ongoing: false },
  );
  const learning = PHASES.map((p) => ({ ...p, ovulation: null, fertileStart: null, fertileEnd: null }));
  assert.deepEqual(cycleAheadModel({ today: '2026-10-03', ...AHEAD, phases: learning }).map((e) => e.kind), ['period']);
  const wide = PHASES.map((p) => ({ ...p, ovulation: null, fertileStart: '2026-10-11', fertileEnd: '2026-10-24', fertileWindowKind: 'wide' as const }));
  const events = cycleAheadModel({ today: '2026-10-03', ...AHEAD, phases: wide });
  assert.deepEqual(events.map((e) => [e.kind, e.wide ?? false]), [['period', false], ['fertile', true]]);
});

test('ahead: a variable cycle\u2019s period row spans the server window and is not late inside it', () => {
  const range = { from: '2026-10-03', to: '2026-10-10' };
  const before = cycleAheadModel({ today: '2026-10-01', ...AHEAD, nextPeriodRange: range });
  assert.deepEqual(before.find((e) => e.kind === 'period'), { kind: 'period', start: '2026-10-03', end: '2026-10-10', inDays: 2, ongoing: false });
  // Past the single estimate (10-06) but inside the window: still „ახლა“, never dropped as late.
  const open = cycleAheadModel({ today: '2026-10-08', ...AHEAD, nextPeriodRange: range });
  assert.deepEqual(open.find((e) => e.kind === 'period'), { kind: 'period', start: '2026-10-03', end: '2026-10-10', inDays: 0, ongoing: true });
  assert.equal(cycleAheadModel({ today: '2026-10-11', ...AHEAD, nextPeriodRange: range }).some((e) => e.kind === 'period'), false);
});

test('ahead: every gate hides its own rows; ovulation never shows without fertility', () => {
  assert.deepEqual(cycleAheadModel({ today: '2026-10-03', ...AHEAD, showPeriod: false }).map((e) => e.kind), ['fertile', 'ovulation']);
  assert.deepEqual(cycleAheadModel({ today: '2026-10-03', ...AHEAD, showFertility: false }).map((e) => e.kind), ['period']);
  assert.deepEqual(cycleAheadModel({ today: '2026-10-03', ...AHEAD, showOvulation: false }).map((e) => e.kind), ['period', 'fertile']);
  assert.deepEqual(cycleAheadModel({ today: '2026-10-03', ...AHEAD, showPeriod: false, showFertility: false }), []);
  assert.deepEqual(cycleAheadModel({ today: '2026-10-03', ...AHEAD, phases: null, nextPeriodStart: null }), []);
});

test('ahead: a late period is not replaced by the next cycle; while bleeding the next period is the one after', () => {
  const late = cycleAheadModel({ today: '2026-10-09', ...AHEAD });
  assert.ok(!late.some((e) => e.kind === 'period'));
  const bleeding = cycleAheadModel({ today: '2026-10-06', ...AHEAD, onPeriod: true, nextPeriodStart: '2026-11-03', nextPeriodEnd: '2026-11-07' });
  assert.deepEqual(bleeding.find((e) => e.kind === 'period'), { kind: 'period', start: '2026-11-03', end: '2026-11-07', inDays: 28, ongoing: false });
  // Predictions not refreshed yet (next still says today): fall back to the following cycle.
  const stale = cycleAheadModel({ today: '2026-10-06', ...AHEAD, onPeriod: true });
  assert.equal(stale.find((e) => e.kind === 'period')?.start, '2026-11-03');
});

test('ahead: nothing beyond the horizon', () => {
  const events = cycleAheadModel({ today: '2026-10-03', ...AHEAD, horizonDays: 10 });
  assert.deepEqual(events.map((e) => e.kind), ['period']);
});

test('bars: last six completed cycles, newest last and marked, heights between the floor and full', () => {
  const rows = [30, 29, 27, 28, 29, 27, 28].map((length, i) => ({ start: `2026-0${i + 2}-10`, length }));
  const bars = cycleBarsModel(rows);
  assert.equal(bars.length, 6);
  assert.deepEqual(bars.map((b) => b.length), [29, 27, 28, 29, 27, 28]);
  assert.deepEqual(bars.map((b) => b.latest), [false, false, false, false, false, true]);
  assert.equal(Math.max(...bars.map((b) => b.ratio)), 1);
  assert.equal(Math.min(...bars.map((b) => b.ratio)), 0.55);
  assert.equal(bars[5].start, '2026-08-10');
});

test('bars: one cycle is not a chart; equal cycles draw equal bars', () => {
  assert.deepEqual(cycleBarsModel([{ start: '2026-09-08', length: 28 }]), []);
  assert.deepEqual(cycleBarsModel(null), []);
  const flat = cycleBarsModel([{ length: 28 }, { length: 28 }, { length: 28 }]);
  assert.deepEqual(flat.map((b) => b.ratio), [0.8, 0.8, 0.8]);
});
