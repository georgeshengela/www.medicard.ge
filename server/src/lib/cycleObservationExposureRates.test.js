import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from './cycle.js';
import { getObservationDef, isExposureRateEligible } from './cycleObservationRegistry.js';
import { buildPartnerPayload } from './cycleShare.js';
import { buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';
import { buildCycleAiUserPrompt } from './cycle.js';
import { buildPregnancyObservationTrends } from './cyclePregnancyObservationTrends.js';
import { buildPerimenopauseObservationSummaries } from './cyclePerimenopauseObservationTrends.js';
import {
  EXPOSURE_RATE_MIN_ASSESSED_DAYS,
  EXPOSURE_RATE_MIN_COVERAGE,
  EXPOSURE_RATE_MIN_PRESENT_DAYS,
  attachExposureIfEligible,
  buildObservationExposure,
  isExposureRateDisplayEligible,
  listCivilDates,
  roundExposureRatePercent,
} from './cycleObservationExposureRates.js';

const TODAY = '2026-09-10';
const WINDOW = listCivilDates(addDays(TODAY, -29), TODAY);

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

describe('exposure rate registry', () => {
  it('defaults exposureRateEligible false', () => {
    assert.equal(getObservationDef('heartburn').exposureRateEligible, false);
    assert.equal(getObservationDef('swelling').exposureRateEligible, false);
    assert.equal(getObservationDef('migraine').exposureRateEligible, false);
    assert.equal(getObservationDef('energy').exposureRateEligible, false);
    assert.equal(getObservationDef('sleepQuality').exposureRateEligible, false);
    assert.equal(getObservationDef('notes').exposureRateEligible, false);
    assert.equal(getObservationDef('bbt').exposureRateEligible, false);
    assert.equal(getObservationDef('ovulationTest').exposureRateEligible, false);
    assert.equal(getObservationDef('libido').exposureRateEligible, false);
    assert.equal(getObservationDef('vaginal_dryness').exposureRateEligible, false);
    assert.equal(isExposureRateEligible('pain'), false);
    assert.equal(isExposureRateEligible('flow'), false);
    assert.equal(isExposureRateEligible('mystery'), false);
  });

  it('opts in only Phase 29 reviewed keys that are also assessmentEligible', () => {
    for (const key of ['nausea', 'vomiting', 'fatigue', 'hot_flashes', 'night_sweats']) {
      assert.equal(getObservationDef(key).assessmentEligible, true);
      assert.equal(getObservationDef(key).exposureRateEligible, true);
      assert.equal(isExposureRateEligible(key), true);
    }
  });
});

describe('isExposureRateDisplayEligible', () => {
  it('requires min assessedDays, coverage, and presentDays', () => {
    assert.equal(EXPOSURE_RATE_MIN_ASSESSED_DAYS, 5);
    assert.equal(EXPOSURE_RATE_MIN_COVERAGE, 0.3);
    assert.equal(EXPOSURE_RATE_MIN_PRESENT_DAYS, 2);
    assert.equal(
      isExposureRateDisplayEligible({ presentDays: 4, assessedDays: 4, availableDays: 30 }),
      false,
    );
    assert.equal(
      isExposureRateDisplayEligible({ presentDays: 4, assessedDays: 5, availableDays: 30 }),
      false,
    );
    assert.equal(
      isExposureRateDisplayEligible({ presentDays: 4, assessedDays: 8, availableDays: 30 }),
      false,
    );
    assert.equal(
      isExposureRateDisplayEligible({ presentDays: 4, assessedDays: 9, availableDays: 30 }),
      true,
    );
    assert.equal(
      isExposureRateDisplayEligible({ presentDays: 1, assessedDays: 15, availableDays: 30 }),
      false,
    );
    assert.equal(
      isExposureRateDisplayEligible({ presentDays: 0, assessedDays: 10, availableDays: 30 }),
      false,
    );
    assert.equal(
      isExposureRateDisplayEligible({ presentDays: 5, assessedDays: 5, availableDays: 7 }),
      true,
    );
    assert.equal(
      isExposureRateDisplayEligible({ presentDays: 1, assessedDays: 1, availableDays: 1 }),
      false,
    );
  });
});

describe('rounding', () => {
  it('uses whole percentage points', () => {
    assert.equal(roundExposureRatePercent(4, 10), 40);
    assert.equal(roundExposureRatePercent(2, 7), 29);
    assert.equal(roundExposureRatePercent(1, 3), 33);
  });
});

describe('Phase 29 fixtures', () => {
  it('A — no assessments, occurrence-only, no rate', () => {
    const logs = presentDays('nausea', [-4, 0]);
    const exposure = buildObservationExposure(logs, 'nausea', { dates: WINDOW });
    assert.equal(exposure.presentDays, 2);
    assert.equal(exposure.assessedDays, 2);
    assert.equal(exposure.rateDisplayEligible, false);
    const row = attachExposureIfEligible({ key: 'nausea', occurrenceCount: 2 }, logs, WINDOW);
    assert.equal(row.exposure, undefined);
  });

  it('B — sparse 2 present 0 absent, no rate', () => {
    const logs = presentDays('nausea', [-10, 0]);
    const exposure = buildObservationExposure(logs, 'nausea', { dates: WINDOW });
    assert.equal(exposure.presentDays, 2);
    assert.equal(exposure.absentDays, 0);
    assert.equal(exposure.assessedDays, 2);
    assert.equal(exposure.rateDisplayEligible, false);
  });

  it('C — 4 present 6 absent of 30, 40% qualified', () => {
    const logs = [
      ...presentDays('hot_flashes', [-1, -4, -8, -12]),
      ...absentDays('hot_flashes', [-2, -5, -9, -13, -16, -20]),
    ];
    const exposure = buildObservationExposure(logs, 'hot_flashes', { dates: WINDOW });
    assert.equal(exposure.presentDays, 4);
    assert.equal(exposure.absentDays, 6);
    assert.equal(exposure.assessedDays, 10);
    assert.equal(exposure.availableDays, 30);
    assert.equal(exposure.ratePercent, 40);
    assert.equal(exposure.rateDisplayEligible, true);
  });

  it('D — zero present with 10 absent, no rate', () => {
    const logs = absentDays('nausea', [-1, -2, -3, -4, -5, -6, -7, -8, -9, -10]);
    const exposure = buildObservationExposure(logs, 'nausea', { dates: WINDOW });
    assert.equal(exposure.presentDays, 0);
    assert.equal(exposure.assessedDays, 10);
    assert.equal(exposure.rateDisplayEligible, false);
  });

  it('E — one present 14 absent, no rate', () => {
    const logs = [
      ...presentDays('fatigue', [0]),
      ...absentDays(
        'fatigue',
        [-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14],
      ),
    ];
    const exposure = buildObservationExposure(logs, 'fatigue', { dates: WINDOW });
    assert.equal(exposure.presentDays, 1);
    assert.equal(exposure.assessedDays, 15);
    assert.equal(exposure.rateDisplayEligible, false);
  });

  it('F — field-specific denominators', () => {
    const logs = [
      ...presentDays('hot_flashes', [-1, -4, -8, -12]),
      ...absentDays('hot_flashes', [-2, -5, -9, -13, -16, -20]),
      ...presentDays('night_sweats', [-3, -6]),
    ];
    const hot = buildObservationExposure(logs, 'hot_flashes', { dates: WINDOW });
    const night = buildObservationExposure(logs, 'night_sweats', { dates: WINDOW });
    assert.equal(hot.assessedDays, 10);
    assert.equal(hot.rateDisplayEligible, true);
    assert.equal(night.assessedDays, 2);
    assert.equal(night.rateDisplayEligible, false);
  });

  it('G — energy answered does not assess hot flashes', () => {
    const logs = [
      log(addDays(TODAY, -1), { energy: 'low', observations: { energy: 'low' } }),
      ...presentDays('hot_flashes', [0]),
    ];
    const exposure = buildObservationExposure(logs, 'hot_flashes', { dates: WINDOW });
    assert.equal(exposure.assessedDays, 1);
    assert.equal(exposure.presentDays, 1);
  });

  it('H — legacy false is UNKNOWN, not denominator', () => {
    const logs = [
      ...presentDays('nausea', [-1, 0]),
      log(addDays(TODAY, -2), { observations: { nausea: false } }),
    ];
    const exposure = buildObservationExposure(logs, 'nausea', { dates: WINDOW });
    assert.equal(exposure.presentDays, 2);
    assert.equal(exposure.absentDays, 0);
    assert.equal(exposure.assessedDays, 2);
  });

  it('I — previous pregnancy episode dates excluded by window', () => {
    const currentFrom = addDays(TODAY, -10);
    const currentDates = listCivilDates(currentFrom, TODAY);
    const logs = [
      ...presentDays('nausea', [-40, -39, -38, -37]),
      ...absentDays('nausea', [-36, -35, -34, -33, -32, -31]),
      ...presentDays('nausea', [-1, -3, -5, -7]),
      ...absentDays('nausea', [-2, -4]),
    ];
    const exposure = buildObservationExposure(logs, 'nausea', { dates: currentDates });
    assert.equal(exposure.presentDays, 4);
    assert.equal(exposure.absentDays, 2);
    assert.equal(exposure.assessedDays, 6);
    assert.equal(exposure.availableDays, currentDates.length);
    assert.notEqual(exposure.assessedDays, 16);
  });

  it('K — PRESENT to ABSENT keeps assessedDays, changes rate', () => {
    const before = [
      ...presentDays('nausea', [-1, -4, -8, -12]),
      ...absentDays('nausea', [-2, -5, -9, -13, -16, -20]),
    ];
    const after = [
      ...presentDays('nausea', [-4, -8, -12]),
      ...absentDays('nausea', [-1, -2, -5, -9, -13, -16, -20]),
    ];
    const a = buildObservationExposure(before, 'nausea', { dates: WINDOW });
    const b = buildObservationExposure(after, 'nausea', { dates: WINDOW });
    assert.equal(a.presentDays, 4);
    assert.equal(b.presentDays, 3);
    assert.equal(a.absentDays + 1, b.absentDays);
    assert.equal(a.assessedDays, b.assessedDays);
    assert.equal(a.ratePercent, 40);
    assert.equal(b.ratePercent, 30);
  });

  it('L — clear UNKNOWN decreases assessedDays', () => {
    const before = [
      ...presentDays('nausea', [-1, -4, -8, -12]),
      ...absentDays('nausea', [-2, -5, -9, -13, -16, -20]),
    ];
    const after = [
      ...presentDays('nausea', [-1, -4, -8, -12]),
      ...absentDays('nausea', [-5, -9, -13, -16, -20]),
    ];
    const a = buildObservationExposure(before, 'nausea', { dates: WINDOW });
    const b = buildObservationExposure(after, 'nausea', { dates: WINDOW });
    assert.equal(a.assessedDays, 10);
    assert.equal(b.assessedDays, 9);
  });

  it('M — threshold loss removes rate, occurrence can remain', () => {
    const qualified = [
      ...presentDays('nausea', [-1, -4, -8, -12]),
      ...absentDays('nausea', [-2, -5, -9, -13, -16]),
    ];
    const lost = [
      ...presentDays('nausea', [-1, -4, -8, -12]),
      ...absentDays('nausea', [-5, -9, -13, -16]),
    ];
    assert.equal(buildObservationExposure(qualified, 'nausea', { dates: WINDOW }).rateDisplayEligible, true);
    assert.equal(buildObservationExposure(lost, 'nausea', { dates: WINDOW }).rateDisplayEligible, false);
  });

  it('N — categorical energy/sleep have no binary rate', () => {
    assert.equal(isExposureRateEligible('energy'), false);
    assert.equal(isExposureRateEligible('sleepQuality'), false);
    const row = attachExposureIfEligible({ key: 'energy.low', occurrenceCount: 4 }, [], WINDOW);
    assert.equal(row.exposure, undefined);
  });

  it('O/P — private and fertility excluded', () => {
    assert.equal(isExposureRateEligible('vaginal_dryness'), false);
    assert.equal(isExposureRateEligible('sexualActivity'), false);
    assert.equal(isExposureRateEligible('bbt'), false);
    assert.equal(isExposureRateEligible('pregnancyTest'), false);
  });
});

describe('Pregnancy / Perimenopause attachment', () => {
  const ep = {
    id: 'ep-b',
    status: 'ACTIVE',
    referenceDate: '2026-05-14',
    referenceType: 'LMP',
    startedAt: new Date(`${addDays(TODAY, -40)}T10:00:00.000Z`),
  };

  it('qualified nausea attaches exposure; sparse vomiting does not', () => {
    const logs = [
      ...presentDays('nausea', [-1, -4, -8, -12]),
      ...absentDays('nausea', [-2, -5, -9, -13, -16, -20]),
      ...presentDays('vomiting', [-3, -6]),
    ];
    const data = buildPregnancyObservationTrends({
      logs,
      today: TODAY,
      episode: ep,
      pregnancyActive: true,
    });
    const nausea = data.trends.find((row) => row.key === 'nausea');
    const vomiting = data.trends.find((row) => row.key === 'vomiting');
    assert.equal(nausea.occurrenceCount, 4);
    assert.equal(nausea.exposure.ratePercent, 40);
    assert.equal(nausea.exposure.assessedDays, 10);
    assert.equal(nausea.exposure.availableDays, 30);
    assert.equal(vomiting.occurrenceCount, 2);
    assert.equal(vomiting.exposure, undefined);
    assert.equal(JSON.stringify(data).includes('%'), false);
  });

  it('previous pregnancy episode does not enter current denominator', () => {
    const current = {
      ...ep,
      id: 'ep-current',
      startedAt: new Date(`${addDays(TODAY, -10)}T10:00:00.000Z`),
    };
    const logs = [
      ...presentDays('nausea', [-40, -39, -38, -37]),
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
    assert.equal(nausea.exposure.assessedDays, 9);
    assert.ok(nausea.exposure.availableDays <= 11);
  });

  it('heartburn occurrence has no exposure rate', () => {
    const logs = [
      log(addDays(TODAY, -1), { symptoms: ['heartburn'] }),
      log(TODAY, { symptoms: ['heartburn'] }),
    ];
    const data = buildPregnancyObservationTrends({
      logs,
      today: TODAY,
      episode: ep,
      pregnancyActive: true,
    });
    const row = data.trends.find((item) => item.key === 'heartburn');
    assert.equal(row.occurrenceCount, 2);
    assert.equal(row.exposure, undefined);
  });

  it('peri hot flashes qualified; night sweats sparse; pre-mode facts remain', () => {
    const logs = [
      ...presentDays('hot_flashes', [-1, -4, -8, -12]),
      ...absentDays('hot_flashes', [-2, -5, -9, -13, -16, -20]),
      ...presentDays('night_sweats', [-3, -6]),
    ];
    const data = buildPerimenopauseObservationSummaries({
      logs,
      today: TODAY,
      mode: 'PERIMENOPAUSE',
    });
    const hot = data.summaries.find((row) => row.key === 'hot_flashes');
    const night = data.summaries.find((row) => row.key === 'night_sweats');
    assert.equal(hot.exposure.ratePercent, 40);
    assert.equal(night.occurrenceCount, 2);
    assert.equal(night.exposure, undefined);
  });

  it('does not create a 0% peri card', () => {
    const logs = absentDays('hot_flashes', [-1, -2, -3, -4, -5, -6, -7, -8, -9, -10]);
    const data = buildPerimenopauseObservationSummaries({
      logs,
      today: TODAY,
      mode: 'PERIMENOPAUSE',
    });
    assert.equal(data.summaries.some((row) => row.key === 'hot_flashes'), false);
  });

  it('partner / doctor / AI do not receive exposure rates', () => {
    const logs = [
      ...presentDays('hot_flashes', [-1, -4, -8, -12]),
      ...absentDays('hot_flashes', [-2, -5, -9, -13, -16, -20]),
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
    assert.equal(partner.includes('ratePercent'), false);
    assert.equal(partner.includes('assessedDays'), false);
    const doctor = JSON.stringify(
      buildCycleDoctorSummaryData({
        today: TODAY,
        profile: { mode: 'PERIMENOPAUSE' },
        logs,
      }),
    );
    assert.equal(doctor.includes('ratePercent'), false);
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
    assert.equal(String(prompt).includes('ratePercent'), false);
    assert.equal(String(prompt).includes('assessedDays'), false);
  });
});
