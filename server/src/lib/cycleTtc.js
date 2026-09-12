/**
 * TTC presentation read model.
 * Does not change forecast math. Observations stay observational.
 */

import { addDays } from './cycle.js';
import { capabilitiesForProfileMode, isTtcProfileMode } from './cycleModes.js';
import { collectFertilityTests, isCycleTestResult } from './cycleFertility.js';

export const TTC_HISTORY_DAYS = 180;
export const TTC_BBT_CHART_MIN = 3;
/** Owner GET path on the Cycle router (`/api/cycle` + this). */
export const CYCLE_TTC_HTTP_PATH = '/ttc';

export function civilInRange(date, from, to) {
  return typeof date === 'string' && date >= from && date <= to;
}

export function buildCycleTtcData({
  today,
  profile = {},
  logs = [],
  predictions = {},
  contraception = {},
} = {}) {
  const to = today;
  const from = addDays(today, -(TTC_HISTORY_DAYS - 1));
  const windowLogs = (logs || []).filter((log) => civilInRange(log.date, from, to));
  const capabilities = capabilitiesForProfileMode(profile.mode);
  const limited = contraception?.predictionAvailability === 'LIMITED';
  const showEstimates = Boolean(contraception?.presentation?.showFertileWindow !== false) && !limited;
  const confidence = predictions.confidence || 'low';
  const softened = confidence === 'low' || Boolean(profile.isIrregular);
  const { ovulationTests, pregnancyTests } = collectFertilityTests(windowLogs);
  const bbtHistory = windowLogs
    .filter((log) => log.bbt != null && Number.isFinite(Number(log.bbt)))
    .map((log) => ({ date: log.date, temperature: Number(log.bbt), unit: 'celsius', source: 'USER_LOGGED' }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const mucusHistory = windowLogs
    .filter((log) => log.cervicalMucus)
    .map((log) => ({ date: log.date, value: log.cervicalMucus, source: 'USER_LOGGED' }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const timeline = [];
  for (const log of windowLogs) {
    const items = [];
    if (isCycleTestResult(log.ovulationTest)) {
      items.push({ kind: 'opk', result: log.ovulationTest, estimated: false });
    }
    if (log.bbt != null && Number.isFinite(Number(log.bbt))) {
      items.push({ kind: 'bbt', temperature: Number(log.bbt), unit: 'celsius', estimated: false });
    }
    if (log.cervicalMucus) {
      items.push({ kind: 'mucus', value: log.cervicalMucus, estimated: false });
    }
    if (isCycleTestResult(log.pregnancyTest)) {
      items.push({ kind: 'pregnancyTest', result: log.pregnancyTest, estimated: false });
    }
    if (items.length) timeline.push({ date: log.date, items });
  }
  timeline.sort((a, b) => b.date.localeCompare(a.date));

  const todayLog = windowLogs.find((log) => log.date === today) || null;
  const todayLogged = {
    opk: isCycleTestResult(todayLog?.ovulationTest) ? todayLog.ovulationTest : null,
    bbt: todayLog?.bbt != null && Number.isFinite(Number(todayLog.bbt)) ? Number(todayLog.bbt) : null,
    mucus: todayLog?.cervicalMucus || null,
    pregnancyTest: isCycleTestResult(todayLog?.pregnancyTest) ? todayLog.pregnancyTest : null,
    sexualActivity: Boolean(todayLog?.sexualActivity),
  };

  return {
    version: 'cycle-ttc-v1',
    mode: profile.mode || 'TRACK_PERIOD',
    ttcActive: isTtcProfileMode(profile.mode),
    capabilities,
    range: { from, to, queryDays: TTC_HISTORY_DAYS },
    cycleContext: {
      confidence,
      softened,
      nextPeriodStart: predictions.nextPeriodStart || null,
      estimated: true,
    },
    fertilityEstimate: showEstimates
      ? {
          estimated: true,
          available: Boolean(predictions.fertileWindow || predictions.ovulationDate),
          softened,
          fertileWindow: predictions.fertileWindow || null,
          ovulationDate: predictions.ovulationDate || null,
        }
      : {
          estimated: true,
          available: false,
          softened: true,
          fertileWindow: null,
          ovulationDate: null,
          unavailableReason: limited ? 'contraception_limited' : 'hidden',
        },
    contraceptionConflict: Boolean(contraception?.ttcConflict),
    fertilityEstimatesUnavailable: limited,
    todayLogged,
    timeline,
    bbtHistory,
    bbtChartEligible: bbtHistory.length >= TTC_BBT_CHART_MIN,
    opkHistory: ovulationTests,
    mucusHistory,
    pregnancyTestHistory: pregnancyTests,
    honesty: {
      estimatesAreEstimates: true,
      observationsAreUserLogged: true,
      positiveOpkDoesNotConfirmOvulation: true,
      bbtNotInterpreted: true,
      mucusNotInterpreted: true,
      noConceptionProbability: true,
      pregnancyTestDoesNotChangeMode: true,
    },
  };
}
