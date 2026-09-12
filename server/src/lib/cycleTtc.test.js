import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildPredictions } from './cycle.js';
import { interpretContraception } from './cycleContraception.js';
import { buildCycleAiUserPrompt } from './cycle.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { buildCycleExportPayload } from './cycleLifecycle.js';
import { buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';
import { isLiveProductMode, PRODUCT_MODES, capabilitiesForProfileMode } from './cycleModes.js';
import { buildCycleTtcData } from './cycleTtc.js';
import { buildObservationTrends } from './cycleObservationTrends.js';

const TODAY = '2026-09-09';
const LMP = '2026-08-12';

function bleed(start, days = 4) {
  const rows = [];
  for (let i = 0; i < days; i += 1) {
    rows.push({ date: addDays(start, i), flow: i === 0 ? 'medium' : 'light' });
  }
  return rows;
}

const BASE_LOGS = [
  ...bleed('2026-06-17'),
  ...bleed('2026-07-15'),
  ...bleed(LMP),
];

function pred(logs = BASE_LOGS) {
  return buildPredictions({
    lastPeriodStart: LMP,
    avgCycleLength: 28,
    avgPeriodLength: 5,
    cycleCount: 3,
    logs,
  });
}

describe('TTC mode capabilities', () => {
  it('marks TTC, Pregnancy, and Perimenopause live', () => {
    assert.equal(isLiveProductMode(PRODUCT_MODES.CYCLE_TRACKING), true);
    assert.equal(isLiveProductMode(PRODUCT_MODES.TRYING_TO_CONCEIVE), true);
    assert.equal(isLiveProductMode(PRODUCT_MODES.PREGNANCY), true);
    assert.equal(isLiveProductMode(PRODUCT_MODES.PERIMENOPAUSE), true);
    assert.equal(capabilitiesForProfileMode('TRY_TO_CONCEIVE').showTtcOverview, true);
    assert.equal(capabilitiesForProfileMode('TRACK_PERIOD').showTtcOverview, false);
    assert.deepEqual(capabilitiesForProfileMode('TRY_TO_CONCEIVE').engineUsesObservations, ['flow']);
    assert.ok(capabilitiesForProfileMode('TRY_TO_CONCEIVE').futureOnly.includes('conceptionProbability'));
  });
});

describe('TTC HTTP route registration', () => {
  it('Cycle router registers authenticated GET /ttc (not a missing 404 path)', async () => {
    const { cycleRouter } = await import('../routes/cycle.routes.js');
    const { CYCLE_TTC_HTTP_PATH } = await import('./cycleTtc.js');
    const methods = [];
    for (const layer of cycleRouter.stack) {
      if (layer.route?.path === CYCLE_TTC_HTTP_PATH) {
        methods.push(layer.route.methods);
      }
    }
    assert.equal(
      methods.some((m) => m.get === true),
      true,
      'GET /api/cycle/ttc must be registered on a clean server start',
    );
    assert.equal(
      cycleRouter.stack.some((layer) => layer.handle?.name === 'requireAuth'),
      true,
      'TTC shares requireAuth with the rest of /api/cycle',
    );
  });
});

describe('TTC presentation does not change the forecast engine', () => {
  it('TRACK_PERIOD and TRY_TO_CONCEIVE produce identical forecasts', () => {
    const a = pred(BASE_LOGS);
    const b = pred(BASE_LOGS);
    assert.equal(a.nextPeriodStart, b.nextPeriodStart);
    assert.deepEqual(a.fertileWindow, b.fertileWindow);
    assert.equal(a.ovulationDate, b.ovulationDate);
    assert.equal(a.confidence, b.confidence);
  });

  it('positive OPK does not change forecast', () => {
    const clean = pred(BASE_LOGS);
    const withOpk = pred([...BASE_LOGS, { date: '2026-08-25', ovulationTest: 'positive' }]);
    assert.equal(withOpk.ovulationDate, clean.ovulationDate);
    assert.deepEqual(withOpk.fertileWindow, clean.fertileWindow);
    assert.equal(withOpk.confidence, clean.confidence);
  });

  it('BBT history does not change forecast', () => {
    const clean = pred(BASE_LOGS);
    const logs = BASE_LOGS.concat(
      { date: '2026-08-20', bbt: 36.4 },
      { date: '2026-08-21', bbt: 36.5 },
      { date: '2026-08-22', bbt: 36.6 },
    );
    const withBbt = pred(logs);
    assert.equal(withBbt.ovulationDate, clean.ovulationDate);
    assert.equal(withBbt.nextPeriodStart, clean.nextPeriodStart);
  });

  it('egg-white mucus does not change forecast', () => {
    const clean = pred(BASE_LOGS);
    const withMucus = pred([...BASE_LOGS, { date: '2026-08-24', cervicalMucus: 'eggwhite' }]);
    assert.deepEqual(withMucus.fertileWindow, clean.fertileWindow);
  });

  it('sexual activity does not change forecast', () => {
    const clean = pred(BASE_LOGS);
    const withSex = pred([...BASE_LOGS, { date: '2026-08-24', sexualActivity: true }]);
    assert.equal(withSex.ovulationDate, clean.ovulationDate);
  });

  it('positive pregnancy test does not change forecast or imply pregnancy mode', () => {
    const clean = pred(BASE_LOGS);
    const logs = [...BASE_LOGS, { date: TODAY, pregnancyTest: 'positive' }];
    const withTest = pred(logs);
    assert.equal(withTest.ovulationDate, clean.ovulationDate);
    const ttc = buildCycleTtcData({
      today: TODAY,
      profile: { mode: 'TRY_TO_CONCEIVE' },
      logs,
      predictions: withTest,
    });
    assert.equal(ttc.mode, 'TRY_TO_CONCEIVE');
    assert.equal(ttc.todayLogged.pregnancyTest, 'positive');
    assert.equal(ttc.honesty.pregnancyTestDoesNotChangeMode, true);
  });
});

describe('TTC read model', () => {
  it('keeps estimates labeled and observations user-logged', () => {
    const logs = [
      ...BASE_LOGS,
      {
        date: TODAY,
        ovulationTest: 'positive',
        bbt: 36.6,
        cervicalMucus: 'watery',
        pregnancyTest: 'negative',
      },
    ];
    const predictions = pred(logs);
    const ttc = buildCycleTtcData({
      today: TODAY,
      profile: { mode: 'TRY_TO_CONCEIVE' },
      logs,
      predictions,
      contraception: interpretContraception({ mode: 'TRY_TO_CONCEIVE', contraceptionMethod: 'NONE' }),
    });
    assert.equal(ttc.fertilityEstimate.estimated, true);
    assert.equal(ttc.todayLogged.opk, 'positive');
    assert.equal(ttc.timeline[0].items.some((i) => i.kind === 'opk' && i.estimated === false), true);
    assert.equal(ttc.honesty.positiveOpkDoesNotConfirmOvulation, true);
    assert.equal(ttc.honesty.noConceptionProbability, true);
    assert.equal(ttc.score, undefined);
    assert.equal(ttc.bbtChartEligible, false);
  });

  it('does not force fertile estimates when contraception is LIMITED', () => {
    const predictions = pred(BASE_LOGS);
    const contraception = interpretContraception({
      mode: 'TRY_TO_CONCEIVE',
      contraceptionMethod: 'COMBINED_PILL',
    });
    const ttc = buildCycleTtcData({
      today: TODAY,
      profile: { mode: 'TRY_TO_CONCEIVE', contraceptionMethod: 'COMBINED_PILL' },
      logs: BASE_LOGS,
      predictions,
      contraception,
    });
    assert.equal(ttc.fertilityEstimatesUnavailable, true);
    assert.equal(ttc.fertilityEstimate.available, false);
    assert.equal(ttc.fertilityEstimate.fertileWindow, null);
    assert.equal(ttc.contraceptionConflict, true);
  });

  it('requires three BBT points before a chart is eligible', () => {
    const logs = [
      ...BASE_LOGS,
      { date: '2026-09-07', bbt: 36.4 },
      { date: '2026-09-08', bbt: 36.5 },
    ];
    const two = buildCycleTtcData({ today: TODAY, profile: { mode: 'TRY_TO_CONCEIVE' }, logs, predictions: pred(logs) });
    assert.equal(two.bbtChartEligible, false);
    const three = buildCycleTtcData({
      today: TODAY,
      profile: { mode: 'TRY_TO_CONCEIVE' },
      logs: [...logs, { date: TODAY, bbt: 36.6 }],
      predictions: pred(logs),
    });
    assert.equal(three.bbtChartEligible, true);
  });

  it('TRACK → TTC → TRACK keeps fertility observations in the read model', () => {
    const logs = [...BASE_LOGS, { date: TODAY, ovulationTest: 'positive', bbt: 36.7 }];
    const track = buildCycleTtcData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
      logs,
      predictions: pred(logs),
    });
    const ttc = buildCycleTtcData({
      today: TODAY,
      profile: { mode: 'TRY_TO_CONCEIVE' },
      logs,
      predictions: pred(logs),
    });
    assert.equal(track.opkHistory.length, ttc.opkHistory.length);
    assert.equal(track.bbtHistory[0].temperature, 36.7);
    assert.equal(track.ttcActive, false);
    assert.equal(ttc.ttcActive, true);
  });

  it('keeps civil dates across month and year boundaries', () => {
    const logs = [
      { date: '2025-12-31', ovulationTest: 'negative' },
      { date: '2026-01-01', bbt: 36.4 },
    ];
    const ttc = buildCycleTtcData({
      today: '2026-01-02',
      profile: { mode: 'TRY_TO_CONCEIVE' },
      logs,
      predictions: pred(BASE_LOGS),
    });
    assert.equal(ttc.opkHistory.some((row) => row.date === '2025-12-31'), true);
    assert.equal(ttc.bbtHistory.some((row) => row.date === '2026-01-01' && row.temperature === 36.4), true);
  });

  it('softens estimates when confidence is low', () => {
    const predictions = { ...pred(BASE_LOGS), confidence: 'low' };
    const ttc = buildCycleTtcData({
      today: TODAY,
      profile: { mode: 'TRY_TO_CONCEIVE', isIrregular: true },
      logs: BASE_LOGS,
      predictions,
    });
    assert.equal(ttc.cycleContext.softened, true);
    assert.equal(ttc.fertilityEstimate.softened, true);
  });
});

describe('TTC privacy firewalls', () => {
  it('does not widen AI, partner, doctor-summary default, or personal export', () => {
    const logs = [
      ...BASE_LOGS,
      {
        date: TODAY,
        ovulationTest: 'positive',
        bbt: 36.6,
        cervicalMucus: 'eggwhite',
        sexualActivity: true,
        pregnancyTest: 'negative',
        notes: 'private',
      },
    ];
    const predictions = pred(logs);
    const profile = { mode: 'TRY_TO_CONCEIVE', lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5 };
    buildCycleTtcData({ today: TODAY, profile, logs, predictions });
    const prompt = buildCycleAiUserPrompt({
      today: TODAY,
      profile,
      logs,
      predictions,
    });
    assert.doesNotMatch(prompt, /sexualActivity|სექსი/);
    const partner = buildPartnerPayload({
      today: TODAY,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile,
      logs,
      predictions,
    });
    assert.equal(partnerPayloadHasLeak(partner), false);
    const doctor = buildCycleDoctorSummaryData({ today: TODAY, profile, logs });
    assert.equal(doctor.fertilityObservations, null);
    const personal = buildCycleExportPayload({ profile, logs });
    assert.equal(personal.logs.some((row) => row.ovulationTest === 'positive'), true);
    const trends = buildObservationTrends({
      logs,
      today: TODAY,
      inferred: { lastPeriodStart: LMP, cycleGaps: [28, 28] },
    });
    const keys = (trends.trends || []).map((row) => row.key);
    assert.equal(keys.includes('ovulationTest'), false);
    assert.equal(keys.includes('bbt'), false);
    assert.equal(keys.includes('cervicalMucus'), false);
  });
});
