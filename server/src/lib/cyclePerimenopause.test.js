import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildCycleAiUserPrompt, buildCycleAlerts, buildPredictions, detectLatePeriod, inferCycleStats } from './cycle.js';
import { capabilitiesForProfileMode, isLiveProductMode, PRODUCT_MODES, profileModeForAiPrompt } from './cycleModes.js';
import { buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';
import { buildCycleExportPayload } from './cycleLifecycle.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { CYCLE_CANDIDATE_TYPES } from '../../../mobile/src/lib/cycleNotificationContract.js';
import {
  buildPerimenopauseContext,
  buildVariabilitySummary,
  completedCycleIntervals,
  perimenopauseContextHasSensitiveLeak,
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

  it('honors low confidence — no precise next-period override', () => {
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
    assert.equal(high.showPreciseNextPeriod, true);
    assert.equal(high.nextPeriodStart, '2026-05-20');
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
