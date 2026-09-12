import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildCycleAiUserPrompt } from './cycle.js';
import { getObservationDef, isExposureComparisonEligible } from './cycleObservationRegistry.js';
import { buildPartnerPayload } from './cycleShare.js';
import { buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';
import { buildPregnancyObservationTrends } from './cyclePregnancyObservationTrends.js';
import { buildPerimenopauseObservationSummaries } from './cyclePerimenopauseObservationTrends.js';
import { buildObservationExposure, listCivilDates } from './cycleObservationExposureRates.js';
import {
  EXPOSURE_COMPARISON_MAX_COVERAGE_RATIO,
  EXPOSURE_COMPARISON_MAX_ROWS,
  EXPOSURE_COMPARISON_MIN_ABS_POINTS,
  EXPOSURE_COMPARISON_MIN_ASSESSED_DAYS,
  EXPOSURE_COMPARISON_MIN_AVAILABLE_DAYS,
  EXPOSURE_COMPARISON_MIN_COVERAGE,
  EXPOSURE_COMPARISON_MIN_RELATIVE_RATIO,
  EXPOSURE_COMPARISON_WINDOW_DAYS,
  attachExposureComparisons,
  buildObservationExposureComparison,
  comparisonWindowsOverlap,
  qualifyObservationExposureComparison,
  splitExposureComparisonWindows,
} from './cycleObservationExposureComparison.js';

const TODAY = '2026-09-10';

function log(date, extra = {}) {
  return {
    date,
    symptoms: extra.symptoms || [],
    observationAssessments: extra.observationAssessments || {},
    observations: extra.observations || {},
    ...extra,
  };
}

function presentDays(key, offsets) {
  return offsets.map((offset) => log(addDays(TODAY, offset), { symptoms: [key] }));
}

function absentDays(key, offsets) {
  return offsets.map((offset) =>
    log(addDays(TODAY, offset), { observationAssessments: { [key]: 'ABSENT' } }),
  );
}

function window(present, assessed, available = 14) {
  return {
    presentDays: present,
    absentDays: assessed - present,
    assessedDays: assessed,
    availableDays: available,
  };
}

function compare(logs, key = 'nausea', extra = {}) {
  return buildObservationExposureComparison(logs, key, { today: TODAY, ...extra });
}

const PREG_EP = {
  id: 'ep-b',
  status: 'ACTIVE',
  referenceDate: '2026-05-14',
  referenceType: 'LMP',
  startedAt: new Date(`${addDays(TODAY, -40)}T10:00:00.000Z`),
};

describe('exposure comparison registry', () => {
  it('defaults exposureComparisonEligible false and requires rate + assessment', () => {
    assert.equal(getObservationDef('heartburn').exposureComparisonEligible, false);
    assert.equal(getObservationDef('swelling').exposureComparisonEligible, false);
    assert.equal(getObservationDef('migraine').exposureComparisonEligible, false);
    assert.equal(getObservationDef('energy').exposureComparisonEligible, false);
    assert.equal(getObservationDef('sleepQuality').exposureComparisonEligible, false);
    assert.equal(getObservationDef('notes').exposureComparisonEligible, false);
    assert.equal(getObservationDef('bbt').exposureComparisonEligible, false);
    assert.equal(getObservationDef('libido').exposureComparisonEligible, false);
    assert.equal(getObservationDef('vaginal_dryness').exposureComparisonEligible, false);
    assert.equal(isExposureComparisonEligible('pain'), false);
    assert.equal(isExposureComparisonEligible('flow'), false);
    assert.equal(isExposureComparisonEligible('mystery'), false);
  });

  it('opts in only Phase 29 binary keys that are also rate-eligible', () => {
    for (const key of ['nausea', 'vomiting', 'fatigue', 'hot_flashes', 'night_sweats']) {
      assert.equal(getObservationDef(key).assessmentEligible, true);
      assert.equal(getObservationDef(key).exposureRateEligible, true);
      assert.equal(getObservationDef(key).exposureComparisonEligible, true);
      assert.equal(isExposureComparisonEligible(key), true);
    }
  });
});

describe('two non-overlapping 14-day windows', () => {
  it('uses 14 + 14 adjacent civil days ending today', () => {
    assert.equal(EXPOSURE_COMPARISON_WINDOW_DAYS, 14);
    const split = splitExposureComparisonWindows(TODAY);
    assert.equal(split.recent.length, 14);
    assert.equal(split.earlier.length, 14);
    assert.equal(split.recentTo, TODAY);
    assert.equal(split.recentFrom, addDays(TODAY, -13));
    assert.equal(split.earlierTo, addDays(TODAY, -14));
    assert.equal(split.earlierFrom, addDays(TODAY, -27));
    assert.equal(comparisonWindowsOverlap(split.earlier, split.recent), false);
    assert.ok(split.earlier.every((date) => date < split.recentFrom));
  });

  it('does not use overlapping last-14 vs last-30 windows', () => {
    const split = splitExposureComparisonWindows(TODAY);
    const last30 = listCivilDates(addDays(TODAY, -29), TODAY);
    const last14 = listCivilDates(addDays(TODAY, -13), TODAY);
    const overlap = last14.filter((date) => last30.includes(date));
    assert.equal(overlap.length, 14);
    assert.equal(comparisonWindowsOverlap(split.earlier, split.recent), false);
  });
});

describe('qualification math', () => {
  it('A — both windows qualify, 40 points, HIGHER', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(2, 10),
      recent: window(6, 10),
    });
    assert.equal(result.numbersEligible, true);
    assert.equal(result.directionEligible, true);
    assert.equal(result.direction, 'HIGHER');
    assert.equal(EXPOSURE_COMPARISON_MIN_ABS_POINTS, 20);
    assert.equal(EXPOSURE_COMPARISON_MIN_RELATIVE_RATIO, 1.5);
  });

  it('B — small difference shows numbers, no direction', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(4, 10),
      recent: window(5, 10),
    });
    assert.equal(result.numbersEligible, true);
    assert.equal(result.direction, null);
    assert.equal(result.directionEligible, false);
  });

  it('C — relative only 5% vs 10% has no direction', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(1, 20, 20),
      recent: window(2, 20, 20),
    });
    assert.equal(result.direction, null);
  });

  it('D — 20 points but ratio 1.29 has no direction', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(7, 10),
      recent: window(9, 10),
    });
    assert.equal(result.numbersEligible, true);
    assert.equal(result.direction, null);
    const ratio = 0.9 / 0.7;
    assert.ok(ratio < EXPOSURE_COMPARISON_MIN_RELATIVE_RATIO);
  });

  it('E — zero baseline 0/10 vs 4/10 is HIGHER', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(0, 10),
      recent: window(4, 10),
    });
    assert.equal(result.numbersEligible, true);
    assert.equal(result.direction, 'HIGHER');
  });

  it('E2 — zero baseline 0/10 vs 2/10 has numbers, no direction', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(0, 10),
      recent: window(2, 10),
    });
    assert.equal(result.numbersEligible, true);
    assert.equal(result.direction, null);
  });

  it('F — zero vs zero is not numbers-eligible', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(0, 10),
      recent: window(0, 11),
    });
    assert.equal(result.numbersEligible, false);
    assert.equal(result.direction, null);
  });

  it('G — one vs zero has numbers, no direction', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(0, 10),
      recent: window(1, 10),
    });
    assert.equal(result.numbersEligible, true);
    assert.equal(result.direction, null);
  });

  it('H — sparse earlier assessedDays 4 has no numbers', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(2, 4),
      recent: window(6, 10),
    });
    assert.equal(result.numbersEligible, false);
    assert.equal(EXPOSURE_COMPARISON_MIN_ASSESSED_DAYS, 5);
  });

  it('I — low coverage fails numbers', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(5, 5, 20),
      recent: window(6, 10, 14),
    });
    assert.equal(result.numbersEligible, false);
    assert.equal(EXPOSURE_COMPARISON_MIN_COVERAGE, 0.35);
  });

  it('J — coverage imbalance allows numbers, not direction', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(2, 5, 14),
      recent: window(12, 14, 14),
    });
    assert.equal(result.numbersEligible, true);
    assert.equal(result.direction, null);
    const ratio = 1 / (5 / 14);
    assert.ok(ratio > EXPOSURE_COMPARISON_MAX_COVERAGE_RATIO);
  });

  it('uses unrounded ratios, not rounded percents', () => {
    const result = qualifyObservationExposureComparison({
      earlier: { presentDays: 2, absentDays: 5, assessedDays: 7, availableDays: 14 },
      recent: { presentDays: 4, absentDays: 4, assessedDays: 8, availableDays: 14 },
    });
    // 2/7 ≈ 28.57% displays 29; 4/8 = 50%. Abs ≈ 21.4 points, ratio ≈ 1.75.
    assert.equal(result.direction, 'HIGHER');
  });

  it('LOWER is symmetric when recent is materially smaller', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(6, 10),
      recent: window(2, 10),
    });
    assert.equal(result.direction, 'LOWER');
  });

  it('does not emit SIMILAR', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(5, 10),
      recent: window(5, 10),
    });
    assert.equal(result.direction, null);
    assert.equal(JSON.stringify(result).includes('SIMILAR'), false);
    assert.equal(JSON.stringify(result).includes('IMPROVING'), false);
    assert.equal(JSON.stringify(result).includes('WORSENING'), false);
  });

  it('tiny 3-day available window cannot compare even if fully assessed', () => {
    const result = qualifyObservationExposureComparison({
      earlier: window(3, 3, 3),
      recent: window(5, 5, 5),
    });
    assert.equal(result.numbersEligible, false);
    assert.equal(EXPOSURE_COMPARISON_MIN_AVAILABLE_DAYS, 7);
  });
});

describe('log-backed comparison', () => {
  it('A — 2/10 vs 6/10 attaches HIGHER', () => {
    const logs = [
      ...presentDays('nausea', [-15, -26]),
      ...absentDays('nausea', [-14, -16, -17, -18, -19, -20, -21, -22]),
      ...presentDays('nausea', [-1, -3, -5, -7, -9, -11]),
      ...absentDays('nausea', [0, -2, -4, -6]),
    ];
    const comparison = compare(logs);
    assert.equal(comparison.earlier.presentDays, 2);
    assert.equal(comparison.earlier.assessedDays, 10);
    assert.equal(comparison.recent.presentDays, 6);
    assert.equal(comparison.recent.assessedDays, 10);
    assert.equal(comparison.earlier.ratePercent, 20);
    assert.equal(comparison.recent.ratePercent, 60);
    assert.equal(comparison.direction, 'HIGHER');
  });

  it('H — sparse earlier does not attach', () => {
    const logs = [
      ...presentDays('nausea', [-15, -26]),
      ...absentDays('nausea', [-14, -16]),
      ...presentDays('nausea', [-1, -3, -5, -7, -9, -11]),
      ...absentDays('nausea', [0, -2, -4, -6]),
    ];
    assert.equal(compare(logs), null);
  });

  it('P — legacy false is never denominator', () => {
    const logs = [
      ...presentDays('nausea', [-1, -3, -5, -7, -9, -11]),
      ...absentDays('nausea', [0, -2, -4, -6]),
      log(addDays(TODAY, -15), { observations: { nausea: false } }),
      log(addDays(TODAY, -16), { observations: { nausea: false } }),
      log(addDays(TODAY, -17), { observations: { nausea: false } }),
      log(addDays(TODAY, -18), { observations: { nausea: false } }),
      log(addDays(TODAY, -19), { observations: { nausea: false } }),
      log(addDays(TODAY, -20), { observations: { nausea: false } }),
    ];
    assert.equal(compare(logs), null);
  });

  it('Q — field-specific denominators; vomiting does not inherit nausea', () => {
    const logs = [
      ...presentDays('nausea', [-15, -26]),
      ...absentDays('nausea', [-14, -16, -17, -18, -19, -20, -21, -22]),
      ...presentDays('nausea', [-1, -3, -5, -7, -9, -11]),
      ...absentDays('nausea', [0, -2, -4, -6]),
      ...presentDays('vomiting', [-8, -10]),
    ];
    const nausea = compare(logs, 'nausea');
    const vomiting = compare(logs, 'vomiting');
    assert.equal(nausea.recent.assessedDays, 10);
    assert.equal(vomiting, null);
  });

  it('R–V — excluded fields never compare', () => {
    for (const key of ['notes', 'bbt', 'pain', 'flow', 'energy', 'sleepQuality', 'libido']) {
      assert.equal(isExposureComparisonEligible(key), false);
      assert.equal(compare([], key), null);
    }
  });

  it('N — PRESENT to ABSENT recomputes direction', () => {
    const before = [
      ...presentDays('nausea', [-15, -26]),
      ...absentDays('nausea', [-14, -16, -17, -18, -19, -20, -21, -22]),
      ...presentDays('nausea', [-1, -3, -5, -7, -9, -11]),
      ...absentDays('nausea', [0, -2, -4, -6]),
    ];
    const after = [
      ...presentDays('nausea', [-15, -26]),
      ...absentDays('nausea', [-14, -16, -17, -18, -19, -20, -21, -22]),
      ...presentDays('nausea', [-1, -3]),
      ...absentDays('nausea', [0, -2, -4, -6, -5, -7, -9, -11]),
    ];
    assert.equal(compare(before).direction, 'HIGHER');
    const next = compare(after);
    assert.equal(next.recent.presentDays, 2);
    assert.equal(next.direction, null);
  });

  it('O — clear to UNKNOWN can drop numbers eligibility', () => {
    const before = [
      ...presentDays('nausea', [-15, -26]),
      ...absentDays('nausea', [-14, -16, -17, -18, -19, -20, -21, -22]),
      ...presentDays('nausea', [-1, -3, -5, -7, -9, -11]),
      ...absentDays('nausea', [0, -2, -4, -6]),
    ];
    const after = [
      ...presentDays('nausea', [-15, -26]),
      ...absentDays('nausea', [-14, -16, -17, -18, -19, -20, -21, -22]),
      ...presentDays('nausea', [-1, -3]),
    ];
    assert.equal(compare(before).earlier.assessedDays, 10);
    assert.equal(compare(after), null);
  });
});

describe('Pregnancy / Perimenopause attachment', () => {
  it('K — previous pregnancy episode data is excluded', () => {
    const current = {
      ...PREG_EP,
      id: 'ep-current',
      startedAt: new Date(`${addDays(TODAY, -10)}T10:00:00.000Z`),
    };
    const logs = [
      ...presentDays('nausea', [-40, -39, -38, -37, -26, -25, -24, -23, -22, -21]),
      ...absentDays('nausea', [-36, -35, -34, -33, -32, -31]),
      ...presentDays('nausea', [-1, -3, -5, -7]),
      ...absentDays('nausea', [-2, -4, -6, -8, -9]),
    ];
    const data = buildPregnancyObservationTrends({
      logs,
      today: TODAY,
      episode: current,
      pregnancyActive: true,
    });
    const nausea = data.trends.find((row) => row.key === 'nausea');
    assert.equal(nausea.occurrenceCount, 4);
    assert.equal(nausea.comparison, undefined);
  });

  it('L — short current pregnancy has no comparison', () => {
    const short = {
      ...PREG_EP,
      startedAt: new Date(`${addDays(TODAY, -17)}T10:00:00.000Z`),
    };
    const logs = [
      ...presentDays('nausea', [-15, -16]),
      ...absentDays('nausea', [-14, -17]),
      ...presentDays('nausea', [-1, -3, -5, -7, -9, -11]),
      ...absentDays('nausea', [0, -2, -4, -6]),
    ];
    const data = buildPregnancyObservationTrends({
      logs,
      today: TODAY,
      episode: short,
      pregnancyActive: true,
    });
    const nausea = data.trends.find((row) => row.key === 'nausea');
    assert.ok(nausea);
    assert.equal(nausea.comparison, undefined);
  });

  it('qualified pregnancy nausea attaches comparison after ranking', () => {
    const logs = [
      ...presentDays('nausea', [-15, -26]),
      ...absentDays('nausea', [-14, -16, -17, -18, -19, -20, -21, -22]),
      ...presentDays('nausea', [-1, -3, -5, -7, -9, -11]),
      ...absentDays('nausea', [0, -2, -4, -6]),
      ...presentDays('heartburn', [0, -2, -4]),
    ];
    const data = buildPregnancyObservationTrends({
      logs,
      today: TODAY,
      episode: PREG_EP,
      pregnancyActive: true,
    });
    const nausea = data.trends.find((row) => row.key === 'nausea');
    const heartburn = data.trends.find((row) => row.key === 'heartburn');
    assert.equal(nausea.comparison.direction, 'HIGHER');
    assert.equal(heartburn.comparison, undefined);
    assert.equal(JSON.stringify(data).includes('%'), false);
  });

  it('M — peri pre-mode facts can count; copy stays generic (no peri label in payload)', () => {
    const logs = [
      ...presentDays('hot_flashes', [-15, -26]),
      ...absentDays('hot_flashes', [-14, -16, -17, -18, -19, -20, -21, -22]),
      ...presentDays('hot_flashes', [-1, -3, -5, -7, -9, -11]),
      ...absentDays('hot_flashes', [0, -2, -4, -6]),
    ];
    const data = buildPerimenopauseObservationSummaries({
      logs,
      today: TODAY,
      mode: 'PERIMENOPAUSE',
    });
    const hot = data.summaries.find((row) => row.key === 'hot_flashes');
    assert.equal(hot.comparison.direction, 'HIGHER');
    const blob = JSON.stringify(data);
    assert.equal(blob.includes('early perimenopause'), false);
    assert.equal(blob.includes('later perimenopause'), false);
    assert.equal(blob.includes('perimenopause progression'), false);
  });

  it('caps comparison-enhanced rows at 3 and keeps Phase 23 ranking', () => {
    const logs = [
      ...presentDays('nausea', [-15, -26, -1, -3, -5, -7, -9, -11]),
      ...absentDays('nausea', [-14, -16, -17, -18, -19, -20, -21, -22, 0, -2, -4, -6]),
      ...presentDays('vomiting', [-15, -26, -1, -3, -5, -7, -9, -11]),
      ...absentDays('vomiting', [-14, -16, -17, -18, -19, -20, -21, -22, 0, -2, -4, -6]),
      ...presentDays('fatigue', [-15, -26, -1, -3, -5, -7, -9, -11]),
      ...absentDays('fatigue', [-14, -16, -17, -18, -19, -20, -21, -22, 0, -2, -4, -6]),
      ...presentDays('heartburn', [0, -6, -12]),
    ];
    const data = buildPregnancyObservationTrends({
      logs,
      today: TODAY,
      episode: PREG_EP,
      pregnancyActive: true,
    });
    const withComparison = data.trends.filter((row) => row.comparison);
    assert.ok(withComparison.length <= EXPOSURE_COMPARISON_MAX_ROWS);
    const keys = data.trends.map((row) => row.key);
    assert.equal(keys[0], 'nausea');
    assert.ok(keys.indexOf('nausea') < keys.indexOf('fatigue'));
  });

  it('W — Phase 29 single-window rate still uses 30-day assessedDays', () => {
    const logs = [
      ...presentDays('nausea', [-1, -4, -8, -12]),
      ...absentDays('nausea', [-2, -5, -9, -13, -16, -20]),
    ];
    const window = listCivilDates(addDays(TODAY, -29), TODAY);
    const exposure = buildObservationExposure(logs, 'nausea', { dates: window });
    assert.equal(exposure.assessedDays, 10);
    assert.equal(exposure.ratePercent, 40);
    assert.equal(exposure.availableDays, 30);
    const comparison = compare(logs);
    assert.equal(comparison, null);
  });

  it('does not rank by largest increase', () => {
    const rows = [
      { key: 'fatigue', occurrenceCount: 8 },
      { key: 'nausea', occurrenceCount: 10 },
    ];
    const logs = [
      ...presentDays('fatigue', [-15, -26, -1, -3, -5, -7, -9, -11]),
      ...absentDays('fatigue', [-14, -16, -17, -18, -19, -20, -21, -22, 0, -2, -4, -6]),
      ...presentDays('nausea', [-15, -1, -3, -5, -7, -9]),
      ...absentDays('nausea', [-14, -16, -17, -18, -19, -20, -21, -22, 0, -2, -4, -6]),
    ];
    const attached = attachExposureComparisons(rows, logs, {
      today: TODAY,
      allowedDates: listCivilDates(addDays(TODAY, -29), TODAY),
    });
    assert.equal(attached[0].key, 'fatigue');
    assert.equal(attached[1].key, 'nausea');
  });

  it('partner / doctor / AI do not receive comparison', () => {
    const logs = [
      ...presentDays('hot_flashes', [-15, -26, -1, -3, -5, -7, -9, -11]),
      ...absentDays('hot_flashes', [-14, -16, -17, -18, -19, -20, -21, -22, 0, -2, -4, -6]),
    ];
    const partner = JSON.stringify(
      buildPartnerPayload({
        today: TODAY,
        permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
        profile: {
          mode: 'PERIMENOPAUSE',
          lastPeriodStart: addDays(TODAY, -20),
          avgCycleLength: 28,
          avgPeriodLength: 5,
        },
        logs,
      }),
    );
    assert.equal(partner.includes('"direction"'), false);
    assert.equal(partner.includes('ratePercent'), false);
    const doctor = JSON.stringify(
      buildCycleDoctorSummaryData({
        today: TODAY,
        profile: { mode: 'PERIMENOPAUSE' },
        logs,
      }),
    );
    assert.equal(doctor.includes('"direction":"HIGHER"'), false);
    const prompt = buildCycleAiUserPrompt({
      profile: {
        mode: 'PERIMENOPAUSE',
        lastPeriodStart: addDays(TODAY, -20),
        avgCycleLength: 28,
        avgPeriodLength: 5,
        isIrregular: false,
        conditions: [],
      },
      logs,
      predictions: { confidence: 'low', nextPeriodStart: addDays(TODAY, 10), ovulationDate: addDays(TODAY, -2) },
      pregnancy: null,
      user: { age: 48 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
      today: TODAY,
    });
    assert.equal(String(prompt).includes('HIGHER'), false);
    assert.equal(String(prompt).includes('assessedDays'), false);
  });
});
