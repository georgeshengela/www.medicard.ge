import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildCycleAiUserPrompt } from './cycle.js';
import { getObservationDef } from './cycleObservationRegistry.js';
import { buildPartnerPayload } from './cycleShare.js';
import { buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';
import { buildPregnancyObservationTrends } from './cyclePregnancyObservationTrends.js';
import { buildPerimenopauseObservationSummaries } from './cyclePerimenopauseObservationTrends.js';
import { listCivilDates } from './cycleObservationExposureRates.js';
import {
  COMPARISON_DIRECTION_UNAVAILABLE_REASON,
  COMPARISON_NUMBERS_UNAVAILABLE_REASON,
  comparisonDirectionUnavailableReason,
  qualifyObservationExposureComparison,
} from './cycleObservationExposureComparison.js';
import {
  EXPOSURE_RATE_UNAVAILABLE_REASON,
  attachObservationExplainability,
  explainObservationComparison,
  explainObservationRate,
} from './cycleObservationExplainability.js';
import { exposureRateUnavailableReason } from './cycleObservationExposureRates.js';

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

function window(present, assessed, available = 14) {
  return {
    presentDays: present,
    absentDays: assessed - present,
    assessedDays: assessed,
    availableDays: available,
  };
}

const PREG_EP = {
  id: 'ep-b',
  status: 'ACTIVE',
  referenceDate: '2026-05-14',
  referenceType: 'LMP',
  startedAt: new Date(`${addDays(TODAY, -40)}T10:00:00.000Z`),
};

describe('rate unavailable reasons', () => {
  it('A — eligible 4/10 rate is available with null reason', () => {
    const logs = [
      ...presentDays('nausea', [-1, -3, -5, -7]),
      ...absentDays('nausea', [0, -2, -4, -6, -8, -10]),
    ];
    const explained = explainObservationRate(logs, 'nausea', WINDOW);
    assert.equal(explained.available, true);
    assert.equal(explained.reason, null);
  });

  it('B — occurrence with too few assessed days has INSUFFICIENT_ASSESSED_DAYS', () => {
    const logs = presentDays('nausea', [-4, 0, -8, -12]);
    const explained = explainObservationRate(logs, 'nausea', WINDOW);
    assert.equal(explained.available, false);
    assert.equal(explained.reason, EXPOSURE_RATE_UNAVAILABLE_REASON.INSUFFICIENT_ASSESSED_DAYS);
  });

  it('does not change Phase 29 eligibility booleans', () => {
    assert.equal(
      exposureRateUnavailableReason({ presentDays: 4, assessedDays: 9, availableDays: 30 }),
      null,
    );
    assert.equal(
      exposureRateUnavailableReason({ presentDays: 4, assessedDays: 8, availableDays: 30 }),
      EXPOSURE_RATE_UNAVAILABLE_REASON.INSUFFICIENT_COVERAGE,
    );
    assert.equal(
      exposureRateUnavailableReason({ presentDays: 1, assessedDays: 15, availableDays: 30 }),
      EXPOSURE_RATE_UNAVAILABLE_REASON.INSUFFICIENT_OCCURRENCES,
    );
    assert.equal(
      exposureRateUnavailableReason({ presentDays: 0, assessedDays: 10, availableDays: 30 }),
      EXPOSURE_RATE_UNAVAILABLE_REASON.NO_PRESENT_OCCURRENCES,
    );
  });
});

describe('comparison / direction reasons', () => {
  it('C — earlier window insufficient', () => {
    const logs = [
      ...presentDays('nausea', [-1, -3, -5, -7, -9, -11]),
      ...absentDays('nausea', [0, -2, -4, -6, -8, -10]),
    ];
    const explained = explainObservationComparison(logs, 'nausea', { today: TODAY, allowedDates: WINDOW });
    assert.equal(explained.numbersAvailable, false);
    assert.equal(explained.numbersReason, COMPARISON_NUMBERS_UNAVAILABLE_REASON.EARLIER_WINDOW_INSUFFICIENT);
  });

  it('D — numbers no direction is CHANGE_TOO_SMALL', () => {
    const q = qualifyObservationExposureComparison({
      earlier: window(4, 9),
      recent: window(5, 10),
    });
    assert.equal(q.numbersEligible, true);
    assert.equal(q.directionEligible, false);
    assert.equal(
      comparisonDirectionUnavailableReason(window(4, 9), window(5, 10)),
      COMPARISON_DIRECTION_UNAVAILABLE_REASON.CHANGE_TOO_SMALL,
    );
  });

  it('E — coverage imbalance withholds direction as COVERAGE_NOT_COMPARABLE', () => {
    assert.equal(
      comparisonDirectionUnavailableReason(window(2, 5, 14), window(12, 14, 14)),
      COMPARISON_DIRECTION_UNAVAILABLE_REASON.COVERAGE_NOT_COMPARABLE,
    );
  });

  it('F — small difference is CHANGE_TOO_SMALL not a similar claim', () => {
    assert.equal(
      comparisonDirectionUnavailableReason(window(4, 10), window(5, 10)),
      COMPARISON_DIRECTION_UNAVAILABLE_REASON.CHANGE_TOO_SMALL,
    );
  });

  it('G — HIGHER still has no withheld direction reason', () => {
    assert.equal(comparisonDirectionUnavailableReason(window(2, 10), window(6, 10)), null);
  });

  it('H — LOWER still has no withheld direction reason', () => {
    assert.equal(comparisonDirectionUnavailableReason(window(6, 10), window(2, 10)), null);
  });

  it('I — zero-baseline withheld is ZERO_BASELINE_NOT_QUALIFIED', () => {
    assert.equal(
      comparisonDirectionUnavailableReason(window(0, 20, 20), window(3, 20, 20)),
      COMPARISON_DIRECTION_UNAVAILABLE_REASON.ZERO_BASELINE_NOT_QUALIFIED,
    );
  });

  it('J — short available history', () => {
    const logs = presentDays('nausea', [-1, -3, -5, -7]);
    const episodeDates = listCivilDates(addDays(TODAY, -10), TODAY);
    const explained = explainObservationComparison(logs, 'nausea', {
      today: TODAY,
      allowedDates: episodeDates,
    });
    assert.equal(explained.numbersAvailable, false);
    assert.equal(explained.numbersReason, COMPARISON_NUMBERS_UNAVAILABLE_REASON.SHORT_AVAILABLE_HISTORY);
  });
});

describe('attach explainability', () => {
  it('attaches rate+comparison explainability after ranking', () => {
    const logs = [
      ...presentDays('nausea', [-1, -3, -5, -7, -9, -11, -15, -26]),
      ...absentDays('nausea', [0, -2, -4, -6, -14, -16, -17, -18, -19, -20, -21, -22]),
    ];
    const data = buildPregnancyObservationTrends({
      today: TODAY,
      logs,
      episode: PREG_EP,
      pregnancyActive: true,
    });
    const nausea = data.trends.find((row) => row.key === 'nausea');
    assert.equal(nausea.exposure.ratePercent, 40);
    assert.equal(nausea.comparison.direction, 'HIGHER');
    assert.equal(nausea.explainability.rate.available, true);
    assert.equal(nausea.explainability.rate.reason, null);
    assert.equal(nausea.explainability.comparison.numbersAvailable, true);
    assert.equal(nausea.explainability.comparison.directionAvailable, true);
    assert.equal(nausea.explainability.comparison.directionReason, null);
  });

  it('K — peri pre-mode facts stay generic (no lifecycle reason)', () => {
    const logs = [
      ...presentDays('hot_flashes', [-1, -3, -5, -7, -9, -11, -15, -26]),
      ...absentDays('hot_flashes', [0, -2, -4, -6, -14, -16, -17, -18, -19, -20, -21, -22]),
    ];
    const data = buildPerimenopauseObservationSummaries({ today: TODAY, logs, mode: 'PERIMENOPAUSE' });
    const hot = data.summaries.find((row) => row.key === 'hot_flashes');
    assert.equal(hot.explainability.comparison.directionAvailable, true);
    assert.equal(JSON.stringify(hot.explainability).includes('PERIMENOPAUSE'), false);
    assert.equal(JSON.stringify(hot.explainability).includes('during'), false);
  });

  it('L — unanswered days still yield a rate reason without exposing UNKNOWN', () => {
    const logs = presentDays('nausea', [0, -6, -12, -18, -24]);
    const explained = explainObservationRate(logs, 'nausea', WINDOW);
    assert.equal(explained.available, false);
    assert.equal(JSON.stringify(explained).includes('UNKNOWN'), false);
  });

  it('M — private fields get no explainability', () => {
    assert.equal(getObservationDef('notes').exposureRateEligible, false);
    const attached = attachObservationExplainability([{ key: 'notes', occurrenceCount: 4 }], [], {
      today: TODAY,
      allowedDates: WINDOW,
    });
    assert.equal(attached[0].explainability, undefined);
  });

  it('N — fertility fields get no explainability', () => {
    const attached = attachObservationExplainability([{ key: 'bbt', occurrenceCount: 6 }], [], {
      today: TODAY,
      allowedDates: WINDOW,
    });
    assert.equal(attached[0].explainability, undefined);
  });

  it('pain and bleeding rows are not explainable', () => {
    const attached = attachObservationExplainability(
      [
        { key: 'pain', occurrenceCount: 5 },
        { key: 'flow', occurrenceCount: 4 },
      ],
      [],
      { today: TODAY, allowedDates: WINDOW },
    );
    assert.equal(attached[0].explainability, undefined);
    assert.equal(attached[1].explainability, undefined);
  });
});

describe('firewalls and regressions', () => {
  it('O/P/Q — partner / doctor / AI do not receive explainability', () => {
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
    assert.equal(partner.includes('explainability'), false);
    assert.equal(partner.includes('INSUFFICIENT_ASSESSED_DAYS'), false);
    const doctor = JSON.stringify(
      buildCycleDoctorSummaryData({
        today: TODAY,
        profile: { mode: 'PERIMENOPAUSE' },
        logs,
      }),
    );
    assert.equal(doctor.includes('explainability'), false);
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
    assert.equal(String(prompt).includes('explainability'), false);
    assert.equal(String(prompt).includes('CHANGE_TOO_SMALL'), false);
  });

  it('R — Phase 30 comparison numbers/direction unchanged', () => {
    const logs = [
      ...presentDays('nausea', [-1, -3, -5, -7, -9, -11, -15, -26]),
      ...absentDays('nausea', [0, -2, -4, -6, -14, -16, -17, -18, -19, -20, -21, -22]),
    ];
    const data = buildPregnancyObservationTrends({
      today: TODAY,
      logs,
      episode: PREG_EP,
      pregnancyActive: true,
    });
    const nausea = data.trends.find((row) => row.key === 'nausea');
    assert.equal(nausea.comparison.earlier.presentDays, 2);
    assert.equal(nausea.comparison.earlier.assessedDays, 10);
    assert.equal(nausea.comparison.recent.presentDays, 6);
    assert.equal(nausea.comparison.recent.assessedDays, 10);
    assert.equal(nausea.comparison.direction, 'HIGHER');
    assert.equal(Object.keys(nausea.comparison).sort().join(','), 'direction,earlier,recent');
  });

  it('S — Phase 29 rate payload unchanged', () => {
    const logs = [
      ...presentDays('nausea', [-1, -3, -5, -7, -9, -11, -15, -26]),
      ...absentDays('nausea', [0, -2, -4, -6, -14, -16, -17, -18, -19, -20, -21, -22]),
    ];
    const data = buildPregnancyObservationTrends({
      today: TODAY,
      logs,
      episode: PREG_EP,
      pregnancyActive: true,
    });
    const nausea = data.trends.find((row) => row.key === 'nausea');
    assert.equal(nausea.exposure.rateDisplayEligible, true);
    assert.equal(nausea.exposure.ratePercent, 40);
    assert.equal(nausea.exposure.presentDays, 8);
    assert.equal(nausea.exposure.assessedDays, 20);
  });
});
