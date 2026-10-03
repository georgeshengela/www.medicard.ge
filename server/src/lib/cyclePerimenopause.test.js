import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildCycleAiUserPrompt, buildCycleAlerts, buildPredictions, detectLatePeriod, inferCycleStats, stampCalendarPhases } from './cycle.js';
import { capabilitiesForProfileMode, isLiveProductMode, PRODUCT_MODES, profileModeForAiPrompt } from './cycleModes.js';
import { buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';
import { buildCycleExportPayload } from './cycleLifecycle.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { CYCLE_CANDIDATE_TYPES } from '../../../mobile/src/lib/cycleNotificationContract.js';
import {
  applyPerimenopauseForecast,
  buildPerimenopauseContext,
  buildVariabilitySummary,
  completedCycleIntervals,
  PERI_FORECAST_STATUS,
  perimenopauseContextHasSensitiveLeak,
  perimenopauseForecast,
  perimenopauseRangeDays,
  percentileOf,
  presentPerimenopauseForecast,
} from './cyclePerimenopause.js';

const TODAY = '2026-05-11';

function bleed(start, days = 4) {
  const rows = [];
  for (let i = 0; i < days; i += 1) {
    rows.push({ date: addDays(start, i), flow: i === 0 ? 'medium' : 'light' });
  }
  return rows;
}

describe('Perimenopause mode capabilities', () => {
  it('marks Perimenopause live on the canonical enum', () => {
    assert.equal(isLiveProductMode(PRODUCT_MODES.PERIMENOPAUSE), true);
    assert.equal(isLiveProductMode(PRODUCT_MODES.CYCLE_TRACKING), true);
    assert.equal(isLiveProductMode(PRODUCT_MODES.TRYING_TO_CONCEIVE), true);
    assert.equal(isLiveProductMode(PRODUCT_MODES.PREGNANCY), true);
    const cap = capabilitiesForProfileMode('PERIMENOPAUSE');
    assert.equal(cap.showPerimenopauseTracking, true);
    assert.equal(cap.showVariabilityContext, true);
    assert.equal(cap.showLatePeriod, false);
    assert.equal(cap.showFertileEstimates, false);
    assert.equal(cap.showFertilityShortcuts, false);
    assert.equal(cap.showTtcOverview, false);
    assert.equal(cap.showPregnancyOverview, false);
    assert.equal(cap.showNextPeriodForecast, true);
    assert.deepEqual(cap.engineUsesObservations, ['flow']);
    assert.ok(cap.futureOnly.includes('perimenopauseDiagnosis'));
    assert.equal(capabilitiesForProfileMode('TRACK_PERIOD').showPerimenopauseTracking, false);
  });

  it('does not create a duplicate mode boolean on the capability map', () => {
    const cap = capabilitiesForProfileMode('PERIMENOPAUSE');
    assert.equal(Object.hasOwn(cap, 'isPerimenopause'), false);
    assert.equal(Object.hasOwn(cap, 'menopauseMode'), false);
    assert.equal(Object.hasOwn(cap, 'isMenopausal'), false);
  });
});

describe('Cycle variability (unclamped intervals)', () => {
  it('summarizes 24, 31, 46, 29 without calling them irregular', () => {
    const s0 = '2025-01-01';
    const s1 = addDays(s0, 24);
    const s2 = addDays(s1, 31);
    const s3 = addDays(s2, 46);
    const s4 = addDays(s3, 29);
    const intervals = completedCycleIntervals([s0, s1, s2, s3, s4], { today: s4 });
    const summary = buildVariabilitySummary(intervals);
    assert.equal(summary.intervalCount, 4);
    assert.equal(summary.shortestDays, 24);
    assert.equal(summary.longestDays, 46);
    const blob = JSON.stringify(summary);
    assert.equal(blob.includes('irregular'), false);
    assert.equal(blob.includes('worsening'), false);
    assert.equal(blob.includes('menopausal'), false);
  });

  it('engine clamp still drops 46 from cycleGaps while peri range keeps it', () => {
    const s0 = '2025-01-01';
    const starts = [s0, addDays(s0, 24), addDays(s0, 24 + 31), addDays(s0, 24 + 31 + 46), addDays(s0, 24 + 31 + 46 + 29)];
    const logs = starts.flatMap((d) => bleed(d, 3));
    const inferred = inferCycleStats(logs);
    assert.equal(inferred.cycleGaps.includes(46), false);
    const intervals = completedCycleIntervals(inferred.periodStarts, { today: starts[starts.length - 1] });
    const summary = buildVariabilitySummary(intervals);
    assert.equal(summary.longestDays, 46);
  });

  it('one interval is not a range', () => {
    const intervals = completedCycleIntervals(['2026-03-01', '2026-04-01'], { today: '2026-04-01' });
    const summary = buildVariabilitySummary(intervals);
    assert.equal(summary.intervalCount, 1);
    assert.equal(summary.shortestDays, null);
    assert.equal(summary.longestDays, null);
    assert.equal(summary.recentIntervalDays, 31);
  });

  it('zero intervals stay insufficient', () => {
    const summary = buildVariabilitySummary([]);
    assert.equal(summary.intervalCount, 0);
    assert.equal(summary.shortestDays, null);
    assert.equal(summary.longestDays, null);
  });
});

describe('Perimenopause read model', () => {
  it('is null outside PERIMENOPAUSE and factual inside', () => {
    const logs = [...bleed('2026-03-01'), ...bleed('2026-04-01')];
    const inferred = inferCycleStats(logs);
    assert.equal(
      buildPerimenopauseContext({
        mode: 'TRACK_PERIOD',
        inferred,
        logs,
        predictions: { confidence: 'low' },
        today: TODAY,
      }),
      null,
    );
    const ctx = buildPerimenopauseContext({
      mode: 'PERIMENOPAUSE',
      inferred,
      logs,
      predictions: { confidence: 'low', nextPeriodStart: '2026-05-20' },
      today: TODAY,
    });
    assert.equal(ctx.mode, 'PERIMENOPAUSE');
    assert.equal(ctx.forecast.showPreciseNextPeriod, false);
    assert.equal(ctx.forecast.nextPeriodStart, null);
    assert.equal(perimenopauseContextHasSensitiveLeak(ctx), false);
  });

  it('excludes vaginal dryness from overview recents', () => {
    const logs = [
      ...bleed('2026-04-20'),
      {
        date: TODAY,
        symptoms: ['hot_flashes', 'night_sweats', 'vaginal_dryness', 'palpitations'],
        moods: ['irritable'],
      },
    ];
    const inferred = inferCycleStats(logs);
    const ctx = buildPerimenopauseContext({
      mode: 'PERIMENOPAUSE',
      inferred,
      logs,
      predictions: { confidence: 'low' },
      today: TODAY,
    });
    const blob = JSON.stringify(ctx.recentObservations);
    assert.equal(blob.includes('hot_flashes'), true);
    assert.equal(blob.includes('night_sweats'), true);
    assert.equal(blob.includes('vaginal_dryness'), false);
    assert.equal(blob.includes('palpitations'), false);
  });

  it('does not label a long gap as a skipped period', () => {
    const logs = bleed('2026-01-01');
    const inferred = inferCycleStats(logs);
    const ctx = buildPerimenopauseContext({
      mode: 'PERIMENOPAUSE',
      inferred,
      logs,
      predictions: { confidence: 'low' },
      today: TODAY,
    });
    const blob = JSON.stringify({
      episodes: ctx.recentBleedingEpisodes,
      variability: ctx.variabilitySummary,
      last: ctx.lastRecordedBleeding,
    });
    assert.doesNotMatch(blob, /skipped|missed period|entered menopause|confirmed menopause/i);
    assert.equal(ctx.recentBleedingEpisodes.length, 1);
  });

  it('never presents a precise single next-period date, whatever the confidence', () => {
    const forecast = presentPerimenopauseForecast({
      confidence: 'low',
      nextPeriodStart: '2026-05-20',
      nextPeriodEnd: '2026-05-25',
    });
    assert.equal(forecast.showPreciseNextPeriod, false);
    assert.equal(forecast.nextPeriodStart, null);
    const high = presentPerimenopauseForecast({
      confidence: 'high',
      nextPeriodStart: '2026-05-20',
      nextPeriodEnd: '2026-05-25',
    });
    assert.equal(high.showPreciseNextPeriod, false);
    assert.equal(high.nextPeriodStart, null);
    assert.equal(high.confidence, 'low');
    assert.equal(high.status, PERI_FORECAST_STATUS.LEARNING);
    assert.equal(high.range, null);
  });
});

/** Logged period starts from a first start + cycle lengths. */
function startsFrom(first, lengths) {
  const starts = [first];
  for (const n of lengths) starts.push(addDays(starts[starts.length - 1], n));
  return starts;
}

describe('Perimenopause range forecast (brief §9 „მერე“ item 7)', () => {
  it('percentile interpolates between neighbours', () => {
    assert.equal(percentileOf([10, 20], 0.5), 15);
    assert.equal(percentileOf([24, 29, 31, 46], 0.1), 24 + 0.3 * 5);
    assert.equal(percentileOf([30], 0.9), 30);
    assert.equal(percentileOf([], 0.5), null);
  });

  it('10th–90th percentile of the recent lengths, widened ± 3 days', () => {
    // sorted 24 29 31 46 → p10 25.5 → 25 − 3 = 22; p90 41.5 → 42 + 3 = 45; median 30
    assert.deepEqual(perimenopauseRangeDays([24, 31, 46, 29]), { minDays: 22, maxDays: 45, medianDays: 30, basedOn: 4 });
  });

  it('uses only the last 6 cycles', () => {
    const r = perimenopauseRangeDays([90, 90, 28, 28, 28, 28, 28, 28]);
    assert.equal(r.basedOn, 6);
    assert.deepEqual([r.minDays, r.maxDays], [25, 31]);
  });

  it('is never narrower than 7 days (identical cycles)', () => {
    const r = perimenopauseRangeDays([28, 28]);
    assert.equal(r.maxDays - r.minDays + 1, 7);
    assert.equal(r.medianDays, 28);
  });

  it('is never wider than 60 days and keeps the part around her median', () => {
    const r = perimenopauseRangeDays([25, 30, 90, 100, 120, 26]);
    assert.equal(r.maxDays - r.minDays + 1, 60);
    assert.ok(r.minDays <= r.medianDays && r.medianDays <= r.maxDays);
    assert.deepEqual([r.minDays, r.maxDays, r.medianDays], [31, 90, 60]);
  });

  it('never opens in the first days after a period started', () => {
    const r = perimenopauseRangeDays([8, 9]);
    assert.equal(r.minDays, 10);
    assert.ok(r.maxDays - r.minDays + 1 >= 7);
  });

  it('fewer than 2 cycles: no range at all', () => {
    assert.equal(perimenopauseRangeDays([]), null);
    assert.equal(perimenopauseRangeDays([31]), null);
    const f = perimenopauseForecast({ intervals: [{ from: '2026-03-01', to: '2026-04-01', days: 31 }], lastPeriodStart: '2026-04-01', logs: bleed('2026-04-01'), today: '2026-04-20' });
    assert.equal(f.range, null);
    assert.equal(f.status, PERI_FORECAST_STATUS.LEARNING);
  });

  it('dates the window from the last period start', () => {
    const starts = startsFrom('2026-01-01', [24, 31, 46, 29]);
    const last = starts[starts.length - 1];
    const intervals = completedCycleIntervals(starts, { today: addDays(last, 5) });
    const f = perimenopauseForecast({ intervals, lastPeriodStart: last, logs: bleed(last), today: addDays(last, 5) });
    assert.equal(f.status, PERI_FORECAST_STATUS.RANGE);
    assert.equal(f.range.from, addDays(last, 22));
    assert.equal(f.range.to, addDays(last, 45));
    assert.equal(f.range.estimate, addDays(last, 30));
    assert.equal(f.range.basedOn, 4);
  });

  it('leaves hidden cycles out of the window', () => {
    const starts = startsFrom('2026-01-01', [28, 90, 30, 29]);
    const last = starts[starts.length - 1];
    const today = addDays(last, 3);
    const all = perimenopauseForecast({ intervals: completedCycleIntervals(starts, { today }), lastPeriodStart: last, today });
    const hidden = perimenopauseForecast({
      intervals: completedCycleIntervals(starts, { today, hiddenStarts: [starts[1]] }),
      lastPeriodStart: last,
      today,
    });
    assert.equal(all.range.basedOn, 4);
    assert.equal(hidden.range.basedOn, 3);
    assert.ok(hidden.range.to < all.range.to);
    // 28 / 30 / 29 → 25 … 33
    assert.equal(hidden.range.to, addDays(last, 33));
  });

  it('a gap over 60 days with the window passed is the calm long-gap state', () => {
    const starts = startsFrom('2025-10-01', [28, 30, 29]);
    const last = starts[starts.length - 1];
    const today = addDays(last, 70);
    const f = perimenopauseForecast({ intervals: completedCycleIntervals(starts, { today }), lastPeriodStart: last, logs: bleed(last), today });
    assert.equal(f.status, PERI_FORECAST_STATUS.LONG_GAP);
    assert.equal(f.daysSinceBleeding, 70 - 3);
    assert.ok(f.range, 'the window itself is still reported');
  });

  it('a long gap inside her own (long) window stays a range', () => {
    const starts = startsFrom('2025-06-01', [60, 75, 80]);
    const last = starts[starts.length - 1];
    const today = addDays(last, 70);
    const f = perimenopauseForecast({ intervals: completedCycleIntervals(starts, { today }), lastPeriodStart: last, logs: bleed(last, 1), today });
    assert.equal(f.status, PERI_FORECAST_STATUS.RANGE);
    assert.ok(today >= f.range.from && today <= f.range.to);
  });

  it('a long gap without enough cycles is still the long-gap state, not „learning“', () => {
    const f = perimenopauseForecast({ intervals: [], lastPeriodStart: '2026-01-01', logs: bleed('2026-01-01'), today: '2026-04-01' });
    assert.equal(f.status, PERI_FORECAST_STATUS.LONG_GAP);
    assert.equal(f.range, null);
  });

  it('12 months without bleeding → the doctor note state (spotting counts as bleeding)', () => {
    const f = perimenopauseForecast({ intervals: [], lastPeriodStart: '2025-04-01', logs: bleed('2025-04-01'), today: '2026-04-10' });
    assert.equal(f.status, PERI_FORECAST_STATUS.NO_BLEEDING_12M);
    const spotted = perimenopauseForecast({
      intervals: [],
      lastPeriodStart: '2025-04-01',
      logs: [...bleed('2025-04-01'), { date: '2026-01-15', flow: 'spotting' }],
      today: '2026-04-10',
    });
    assert.equal(spotted.status, PERI_FORECAST_STATUS.LONG_GAP);
  });

  it('the bundle predictions: a window only, no single date shown, no fertile days, never late', () => {
    const starts = startsFrom('2026-01-01', [24, 31, 46, 29]);
    const logs = starts.flatMap((d) => bleed(d, 4));
    const inferred = inferCycleStats(logs);
    const last = starts[starts.length - 1];
    const today = addDays(last, 10);
    const engine = buildPredictions({
      lastPeriodStart: last,
      avgCycleLength: 28,
      avgPeriodLength: 4,
      cycleCount: 6,
      cycleLengths: [28, 28, 28, 28, 28, 28],
      logs,
      today,
    });
    assert.ok(engine.fertileWindow, 'the engine alone would draw fertile days');
    // History stamps (as loadBundle does before the peri step) carry fertile words for past days.
    engine.calendar = stampCalendarPhases(engine.calendar, {
      lastPeriodStart: last,
      avgCycleLength: 28,
      avgPeriodLength: 4,
      fromKey: starts[0],
      toKey: last,
      fertility: engine.fertility,
    });
    assert.ok(Object.values(engine.calendar).some((m) => m.phase === 'fertile' || m.phase === 'ovulation'));
    const forecast = perimenopauseForecast({ intervals: completedCycleIntervals(inferred.periodStarts, { today }), lastPeriodStart: last, logs, today });
    const p = applyPerimenopauseForecast(engine, forecast, { lastPeriodStart: last, avgPeriodLength: 4, avgCycleLength: 28, today });
    assert.deepEqual(p.nextPeriodRange, { from: addDays(last, 22), to: addDays(last, 45) });
    assert.equal(p.confidence, 'low');
    assert.equal(p.late, false);
    assert.equal(p.fertileWindow, null);
    assert.equal(p.ovulationDate, null);
    assert.equal(p.ovulationRange, null);
    for (const [key, mark] of Object.entries(p.calendar)) {
      assert.equal(Boolean(mark.fertile || mark.ovulation), false, key);
      assert.notEqual(mark.phase, 'fertile', key);
      assert.notEqual(mark.phase, 'ovulation', key);
      if (key > today && mark.predicted) {
        assert.ok(key >= p.nextPeriodRange.from && key <= p.nextPeriodRange.to, `projected ${key} outside the window`);
      }
    }
    // Every day of the window is drawn, nothing after it.
    assert.equal(p.calendar[p.nextPeriodRange.from]?.periodRange, true);
    assert.equal(p.calendar[p.nextPeriodRange.to]?.periodRange, true);
    assert.equal(p.calendar[addDays(p.nextPeriodRange.to, 1)], undefined);
    // Logged days stay.
    assert.equal(p.calendar[last]?.predicted, false);
    // Older readers keep a median estimate inside the window; it is never shown alone.
    assert.ok(p.nextPeriodStart >= p.nextPeriodRange.from && p.nextPeriodStart <= p.nextPeriodRange.to);
    assert.equal(p.phases.length, 1);
    assert.equal(p.phases[0].fertileStart, null);
  });

  it('the bundle predictions with < 2 cycles: no date, no window, no projected days', () => {
    const logs = bleed('2026-04-01', 4);
    const engine = buildPredictions({ lastPeriodStart: '2026-04-01', avgCycleLength: 28, avgPeriodLength: 4, logs, today: '2026-04-10' });
    const forecast = perimenopauseForecast({ intervals: [], lastPeriodStart: '2026-04-01', logs, today: '2026-04-10' });
    const p = applyPerimenopauseForecast(engine, forecast, { lastPeriodStart: '2026-04-01', avgPeriodLength: 4, today: '2026-04-10' });
    assert.equal(p.nextPeriodStart, null);
    assert.equal(p.nextPeriodRange, null);
    assert.deepEqual(p.phases, []);
    assert.equal(Object.entries(p.calendar).some(([key, m]) => key > '2026-04-10' && m.predicted), false);
  });

  it('an open window is painted from today, never over past days that did not bleed', () => {
    const starts = startsFrom('2026-01-01', [28, 30, 29]);
    const last = starts[starts.length - 1];
    const forecast = perimenopauseForecast({ intervals: completedCycleIntervals(starts, { today: addDays(last, 29) }), lastPeriodStart: last, today: addDays(last, 29) });
    const today = addDays(last, 29);
    assert.ok(forecast.range.from < today && forecast.range.to > today);
    const p = applyPerimenopauseForecast({ calendar: {}, phases: [] }, forecast, { lastPeriodStart: last, avgPeriodLength: 4, today });
    assert.equal(p.calendar[forecast.range.from], undefined);
    assert.equal(p.calendar[today]?.periodRange, true);
  });

  it('the read model carries the range and the status, and stays free of diagnosis words', () => {
    const starts = startsFrom('2025-12-01', [24, 31, 46, 29]);
    const logs = starts.flatMap((d) => bleed(d, 4));
    const inferred = inferCycleStats(logs);
    const today = addDays(starts[starts.length - 1], 8);
    const ctx = buildPerimenopauseContext({ mode: 'PERIMENOPAUSE', inferred, logs, predictions: {}, today });
    assert.equal(ctx.forecast.status, PERI_FORECAST_STATUS.RANGE);
    assert.equal(ctx.forecast.showPreciseNextPeriod, false);
    assert.equal(ctx.forecast.range.basedOn, 4);
    assert.equal(perimenopauseContextHasSensitiveLeak(ctx), false);
  });
});

describe('Perimenopause late / alerts presentation safety', () => {
  it('suppresses late status in PERIMENOPAUSE without changing TRACK arithmetic', () => {
    const logs = [];
    let d = '2026-03-01';
    for (let i = 0; i < 6; i += 1) {
      logs.push(...bleed(d));
      d = addDays(d, 28);
    }
    const inferred = inferCycleStats(logs);
    const predictions = buildPredictions({
      lastPeriodStart: inferred.lastPeriodStart,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: inferred.cycleCount,
      cycleLengths: inferred.cycleGaps,
      logs,
    });
    const track = detectLatePeriod({
      today: addDays(inferred.lastPeriodStart, 35),
      profile: { mode: 'TRACK_PERIOD' },
      logs,
      predictions,
      inferred,
    });
    const peri = detectLatePeriod({
      today: addDays(inferred.lastPeriodStart, 35),
      profile: { mode: 'PERIMENOPAUSE' },
      logs,
      predictions,
      inferred,
    });
    assert.equal(track.status, 'late');
    assert.equal(peri.status, 'unknown');
    assert.equal(peri.reason, 'perimenopause_mode');
  });

  it('does not emit late or 21–35 gap alerts in PERIMENOPAUSE; keeps 8-day heavy safety', () => {
    const logs = [];
    for (let i = 0; i < 8; i += 1) {
      logs.push({ date: addDays(TODAY, -i), flow: 'heavy' });
    }
    logs.push({ date: '2026-03-01', flow: 'medium' });
    logs.push({ date: '2026-04-20', flow: 'medium' });
    const inferred = inferCycleStats(logs);
    const alerts = buildCycleAlerts({
      profile: { mode: 'PERIMENOPAUSE', isIrregular: false, conditions: [] },
      logs,
      predictions: { confidence: 'low', nextPeriodStart: '2026-05-01' },
      inferred,
      today: TODAY,
    });
    assert.equal(alerts.some((row) => row.late), false);
    assert.equal(alerts.some((row) => /გვიანია/.test(row.messageKa || '')), false);
    assert.ok(alerts.some((row) => row.level === 'urgent'));
  });
});

describe('Perimenopause privacy firewalls', () => {
  it('AI prompt maps PERIMENOPAUSE to TRACK_PERIOD and does not add night sweats', () => {
    assert.equal(profileModeForAiPrompt('PERIMENOPAUSE'), 'TRACK_PERIOD');
    const prompt = buildCycleAiUserPrompt({
      profile: { mode: 'PERIMENOPAUSE', lastPeriodStart: '2026-04-01', avgCycleLength: 28, avgPeriodLength: 5, isIrregular: false, conditions: [] },
      logs: [
        {
          date: TODAY,
          flow: 'spotting',
          symptoms: ['hot_flashes', 'night_sweats', 'vaginal_dryness'],
          notes: 'secret',
        },
      ],
      predictions: { confidence: 'low', nextPeriodStart: '2026-05-20', ovulationDate: '2026-05-06' },
      pregnancy: null,
      user: { age: 48 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
      today: TODAY,
    });
    assert.match(prompt, /რეჟიმი: TRACK_PERIOD/);
    assert.equal(prompt.includes('PERIMENOPAUSE'), false);
    assert.equal(prompt.includes('night_sweats'), false);
    assert.equal(prompt.includes('vaginal_dryness'), false);
    assert.equal(prompt.includes('secret'), false);
  });

  it('partner payload does not gain mode or peri symptoms', () => {
    const logs = [
      ...bleed('2026-04-01'),
      { date: TODAY, symptoms: ['hot_flashes', 'night_sweats', 'vaginal_dryness'] },
    ];
    const partner = buildPartnerPayload({
      today: TODAY,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { mode: 'PERIMENOPAUSE', lastPeriodStart: '2026-04-01', avgCycleLength: 28, avgPeriodLength: 5 },
      logs,
    });
    assert.equal(partnerPayloadHasLeak(partner), false);
    assert.equal(Object.hasOwn(partner, 'mode'), false);
    assert.equal(JSON.stringify(partner).includes('PERIMENOPAUSE'), false);
    assert.equal(JSON.stringify(partner).includes('night_sweats'), false);
    assert.equal(JSON.stringify(partner).includes('vaginal_dryness'), false);
  });

  it('doctor summary tracking context is not a diagnosis', () => {
    const logs = [...bleed('2026-04-01'), { date: TODAY, symptoms: ['hot_flashes'] }];
    const doctor = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE', avgCycleLength: 28, avgPeriodLength: 5 },
      logs,
    });
    assert.equal(doctor.pregnancyContext, null);
    assert.equal(doctor.perimenopauseContext.current, true);
    assert.equal(doctor.perimenopauseContext.userSelected, true);
    const blob = JSON.stringify(doctor);
    assert.equal(blob.includes('patient is perimenopausal'), false);
    assert.equal(blob.includes('perimenopauseDiagnosis'), false);
    assert.equal(blob.includes('entered menopause'), false);
  });

  it('personal export keeps owner logs and current mode', () => {
    const logs = [{ date: TODAY, symptoms: ['hot_flashes', 'night_sweats'] }];
    const personal = buildCycleExportPayload({
      profile: { mode: 'PERIMENOPAUSE' },
      logs,
    });
    assert.equal(personal.profile.mode, 'PERIMENOPAUSE');
    assert.equal(personal.logs.some((row) => (row.symptoms || []).includes('hot_flashes')), true);
  });

  it('Notification Brain catalog has no peri/menopause candidate type', () => {
    assert.equal(CYCLE_CANDIDATE_TYPES.includes('perimenopause'), false);
    assert.equal(CYCLE_CANDIDATE_TYPES.includes('menopause'), false);
    assert.equal(CYCLE_CANDIDATE_TYPES.includes('hot_flash'), false);
  });
});
