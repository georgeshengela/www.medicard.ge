import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, buildCycleAiUserPrompt, buildCycleWellnessContext, inferCycleStats } from './cycle.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { buildCycleExportPayload } from './cycleLifecycle.js';
import { buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';
import { capabilitiesForProfileMode, cycleModeForPatientAiContext, isCycleAiContextSupported, isLiveProductMode, PRODUCT_MODES, profileModeForAiPrompt } from './cycleModes.js';
import { engineLogWhere, filterLogsForEngine } from './cycleHistoryQuery.js';
import { CYCLE_POSTPARTUM_BLEED_CLASSIFICATION_PATH } from './cyclePostpartumBleedClassification.js';
import { pregnancyCareReminderEligibility } from '../../../mobile/src/lib/pregnancyCareReminderContract.js';
import {
  applyPostpartumEpisodeTransition,
  buildCyclePostpartumData,
  bundlePostpartumView,
  CYCLE_POSTPARTUM_HTTP_PATH,
  isCivilDateKey,
  isEngineEligibleLog,
  isPostpartumProfileMode,
  POSTPARTUM_EPISODE_ACTIVE,
  POSTPARTUM_EPISODE_ENDED,
  POSTPARTUM_TRACKING_CONTEXT,
  postpartumElapsed,
  stampPostpartumLogWrite,
  validatePostpartumReferenceDate,
} from './cyclePostpartum.js';

const TODAY = '2026-09-11';
const REF = '2026-08-19';

function mockEpisodeTx(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  return {
    rows,
    cyclePostpartumEpisode: {
      findFirst: async ({ where }) =>
        rows.find((row) => row.userId === where.userId && row.status === where.status) || null,
      create: async ({ data }) => {
        const row = {
          id: `pp-${rows.length + 1}`,
          startedAt: new Date('2026-09-11T10:00:00.000Z'),
          endedAt: null,
          createdAt: new Date('2026-09-11T10:00:00.000Z'),
          updatedAt: new Date('2026-09-11T10:00:00.000Z'),
          ...data,
        };
        rows.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = rows.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
  };
}

describe('Postpartum mode capabilities', () => {
  it('marks POSTPARTUM live as a fifth mode', () => {
    assert.equal(isLiveProductMode(PRODUCT_MODES.POSTPARTUM), true);
    assert.equal(isPostpartumProfileMode('POSTPARTUM'), true);
    const cap = capabilitiesForProfileMode('POSTPARTUM');
    assert.equal(cap.showPostpartumOverview, true);
    assert.equal(cap.showPostpartumTracking, true);
    assert.equal(cap.showClassicCycleOverview, false);
    assert.equal(cap.showPregnancyOverview, false);
    assert.equal(cap.showPregnancyCarePlanner, false);
    assert.equal(cap.showTtcOverview, false);
    assert.equal(cap.showPerimenopauseTracking, false);
    assert.equal(cap.showNextPeriodForecast, false);
    assert.equal(cap.showLatePeriod, false);
    assert.equal(cap.showFertileEstimates, false);
    assert.equal(cap.showOvulationEstimate, false);
    assert.equal(cap.showPregnancyTestLog, false);
    assert.equal(Object.hasOwn(cap, 'isPostpartum'), false);
  });
});

describe('Postpartum HTTP route registration', () => {
  it('registers GET and PUT /postpartum', async () => {
    const { cycleRouter } = await import('../routes/cycle.routes.js');
    const methods = [];
    for (const layer of cycleRouter.stack) {
      if (layer.route?.path === CYCLE_POSTPARTUM_HTTP_PATH) {
        methods.push(layer.route.methods);
      }
    }
    assert.equal(methods.some((m) => m.get === true), true, 'GET /api/cycle/postpartum');
    assert.equal(methods.some((m) => m.put === true), true, 'PUT /api/cycle/postpartum');
  });

  it('registers owner-only PUT and DELETE bleed-classifications', async () => {
    const { cycleRouter } = await import('../routes/cycle.routes.js');
    const methods = [];
    for (const layer of cycleRouter.stack) {
      if (layer.route?.path === CYCLE_POSTPARTUM_BLEED_CLASSIFICATION_PATH) {
        methods.push(layer.route.methods);
      }
    }
    assert.equal(methods.some((m) => m.put === true), true, 'PUT /api/cycle/postpartum/bleed-classifications');
    assert.equal(methods.some((m) => m.delete === true), true, 'DELETE /api/cycle/postpartum/bleed-classifications');
    assert.equal(methods.some((m) => m.get === true), false, 'no GET classification list');
  });
});

describe('Explicit entry only', () => {
  it('A: requires postpartumConfirm to enter', async () => {
    const tx = mockEpisodeTx();
    await assert.rejects(
      () =>
        applyPostpartumEpisodeTransition(tx, {
          userId: 'u1',
          currentMode: 'TRACK_PERIOD',
          nextMode: 'POSTPARTUM',
          body: {},
          today: TODAY,
        }),
      /დადასტურებით/,
    );
    assert.equal(tx.rows.length, 0);
  });

  it('B/C/D: due date, planner, and logs are not arguments to the transition', () => {
    const src = readFileSync(new URL('./cyclePostpartum.js', import.meta.url), 'utf8');
    assert.equal(src.includes('LIVE_BIRTH'), false);
    assert.equal(src.includes('dueDate'), false);
    assert.equal(src.includes('carePlan'), false);
    assert.equal(/week\s*===?\s*40/.test(src), false);
  });

  it('E: TRACK / TTC / PERI can enter without a pregnancy episode', async () => {
    for (const currentMode of ['TRACK_PERIOD', 'TRY_TO_CONCEIVE', 'PERIMENOPAUSE']) {
      const tx = mockEpisodeTx();
      await applyPostpartumEpisodeTransition(tx, {
        userId: 'u1',
        currentMode,
        nextMode: 'POSTPARTUM',
        body: { postpartumConfirm: true },
        today: TODAY,
      });
      assert.equal(tx.rows.length, 1, currentMode);
      assert.equal(tx.rows[0].status, POSTPARTUM_EPISODE_ACTIVE);
      assert.equal(tx.rows[0].referenceDate, null);
    }
  });
});

describe('Reference date', () => {
  it('F: mode works without a reference and elapsed is null', () => {
    const data = buildCyclePostpartumData({
      today: TODAY,
      profile: { mode: 'POSTPARTUM' },
      episode: { id: 'pp-1', status: POSTPARTUM_EPISODE_ACTIVE, referenceDate: null },
      logs: [],
    });
    assert.equal(data.active, true);
    assert.equal(data.referenceDate, null);
    assert.equal(data.elapsed, null);
    assert.equal(data.recentLogs.every((row) => row.classified !== true), true);
  });

  it('G: valid reference yields civil week + day', () => {
    const elapsed = postpartumElapsed(REF, TODAY);
    assert.equal(elapsed.days, 23);
    assert.equal(elapsed.week, 3);
    assert.equal(elapsed.day, 2);
  });

  it('H: future reference is rejected, not clamped', () => {
    const result = validatePostpartumReferenceDate(addDays(TODAY, 1), TODAY);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'future');
    assert.equal(postpartumElapsed(addDays(TODAY, 1), TODAY), null);
  });

  it('I: changing reference changes elapsed only', async () => {
    const tx = mockEpisodeTx([
      { id: 'pp-1', userId: 'u1', status: POSTPARTUM_EPISODE_ACTIVE, referenceDate: REF },
    ]);
    await applyPostpartumEpisodeTransition(tx, {
      userId: 'u1',
      currentMode: 'POSTPARTUM',
      nextMode: 'POSTPARTUM',
      body: { postpartumReferenceDate: '2026-09-01' },
      today: TODAY,
    });
    assert.equal(tx.rows[0].referenceDate, '2026-09-01');
    assert.deepEqual(postpartumElapsed('2026-09-01', TODAY), { days: 10, week: 1, day: 3 });
  });

  it('J: clearing reference keeps the episode active', async () => {
    const tx = mockEpisodeTx([
      { id: 'pp-1', userId: 'u1', status: POSTPARTUM_EPISODE_ACTIVE, referenceDate: REF },
    ]);
    await applyPostpartumEpisodeTransition(tx, {
      userId: 'u1',
      currentMode: 'POSTPARTUM',
      nextMode: 'POSTPARTUM',
      body: { postpartumReferenceDate: null },
      today: TODAY,
    });
    assert.equal(tx.rows[0].status, POSTPARTUM_EPISODE_ACTIVE);
    assert.equal(tx.rows[0].referenceDate, null);
  });

  it('never derives a reference from due date or episode end', () => {
    assert.equal(isCivilDateKey('2026-09-11'), true);
    assert.equal(isCivilDateKey('2026-02-30'), false);
    const src = readFileSync(new URL('./cyclePostpartum.js', import.meta.url), 'utf8');
    assert.equal(src.includes('birthDate'), false);
    assert.equal(src.includes('estimatedDueDate'), false);
  });
});

describe('Episode lifecycle', () => {
  it('K: leaving ends the episode without an outcome field', async () => {
    const tx = mockEpisodeTx([
      { id: 'pp-1', userId: 'u1', status: POSTPARTUM_EPISODE_ACTIVE, referenceDate: REF },
    ]);
    await applyPostpartumEpisodeTransition(tx, {
      userId: 'u1',
      currentMode: 'POSTPARTUM',
      nextMode: 'TRACK_PERIOD',
      today: TODAY,
    });
    assert.equal(tx.rows[0].status, POSTPARTUM_EPISODE_ENDED);
    assert.ok(tx.rows[0].endedAt);
    assert.equal(Object.hasOwn(tx.rows[0], 'outcome'), false);
    assert.equal(Object.hasOwn(tx.rows[0], 'LIVE_BIRTH'), false);
  });

  it('re-entry creates a new episode and does not reuse the ended one', async () => {
    const tx = mockEpisodeTx([
      { id: 'pp-old', userId: 'u1', status: POSTPARTUM_EPISODE_ENDED, referenceDate: REF },
    ]);
    await applyPostpartumEpisodeTransition(tx, {
      userId: 'u1',
      currentMode: 'TRACK_PERIOD',
      nextMode: 'POSTPARTUM',
      body: { postpartumConfirm: true, postpartumReferenceDate: '2026-09-01' },
      today: TODAY,
    });
    assert.equal(tx.rows.length, 2);
    assert.equal(tx.rows[0].id, 'pp-old');
    assert.equal(tx.rows[0].status, POSTPARTUM_EPISODE_ENDED);
    assert.equal(tx.rows[1].status, POSTPARTUM_EPISODE_ACTIVE);
    assert.equal(tx.rows[1].referenceDate, '2026-09-01');
    assert.notEqual(tx.rows[1].id, 'pp-old');
  });
});

describe('Flow / forecast isolation', () => {
  it('P: postpartum-stamped heavy flow does not change LMP or cycle length', () => {
    const historical = [
      { date: '2026-07-01', flow: 'medium' },
      { date: '2026-07-02', flow: 'light' },
      { date: '2026-07-29', flow: 'medium' },
      { date: '2026-07-30', flow: 'light' },
    ];
    const contaminated = [
      ...historical,
      { date: '2026-09-08', flow: 'heavy', trackingContext: POSTPARTUM_TRACKING_CONTEXT },
      { date: '2026-09-09', flow: 'heavy', trackingContext: POSTPARTUM_TRACKING_CONTEXT },
      { date: '2026-09-10', flow: 'medium', trackingContext: POSTPARTUM_TRACKING_CONTEXT },
    ];
    const clean = inferCycleStats(filterLogsForEngine(historical, TODAY));
    const isolated = inferCycleStats(filterLogsForEngine(contaminated, TODAY));
    assert.equal(isolated.lastPeriodStart, clean.lastPeriodStart);
    assert.deepEqual(isolated.periodStarts, clean.periodStarts);
    assert.equal(isolated.avgCycleLength, clean.avgCycleLength);
    assert.equal(isEngineEligibleLog({ trackingContext: POSTPARTUM_TRACKING_CONTEXT }), false);
    assert.equal(isEngineEligibleLog({ flow: 'heavy' }), true);
  });

  it('legacy logs without trackingContext stay in the engine (no fake backfill)', () => {
    const logs = [{ date: '2026-07-01', flow: 'medium' }];
    assert.equal(filterLogsForEngine(logs, TODAY).length, 1);
    const where = engineLogWhere('u1', TODAY);
    assert.ok(where.OR.some((row) => row.trackingContext === null));
  });

  it('does not rewrite cycle.js PERIOD_FLOWS', () => {
    const src = readFileSync(new URL('./cycle.js', import.meta.url), 'utf8');
    assert.match(src, /export const PERIOD_FLOWS = \['light', 'medium', 'heavy'\]/);
    assert.equal(src.includes('POSTPARTUM'), true);
    assert.equal(src.includes('lochia'), false);
  });
});

describe('Read model / fire walls', () => {
  it('bundle view is null off POSTPARTUM', () => {
    assert.equal(bundlePostpartumView({ profile: { mode: 'PREGNANCY' }, episode: { status: 'ACTIVE' }, today: TODAY }), null);
  });

  it('V: POSTPARTUM Cycle AI context is omitted, not mapped to TRACK_PERIOD', () => {
    assert.equal(profileModeForAiPrompt('POSTPARTUM'), null);
    assert.equal(isCycleAiContextSupported('POSTPARTUM'), false);
    assert.equal(cycleModeForPatientAiContext('POSTPARTUM'), null);
    assert.equal(cycleModeForPatientAiContext('TRACK_PERIOD'), 'TRACK_PERIOD');

    const prompt = buildCycleAiUserPrompt({
      profile: { mode: 'POSTPARTUM', avgCycleLength: 28, avgPeriodLength: 5, lastPeriodStart: '2026-07-01' },
      logs: [
        { date: TODAY, flow: 'heavy', trackingContext: POSTPARTUM_TRACKING_CONTEXT, symptoms: ['fatigue'], moods: ['sad'], painEntries: [{ type: 'cramps', severity: 3 }] },
        { date: '2026-07-01', flow: 'medium' },
      ],
      predictions: {
        nextPeriodStart: '2026-09-29',
        nextPeriodEnd: '2026-10-03',
        ovulationDate: '2026-09-15',
        fertileWindow: { start: '2026-09-10', end: '2026-09-16' },
        confidence: 'high',
      },
      pregnancy: { age: { week: 40, day: 2, trimester: 3 } },
      user: { age: 30 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5 },
      today: TODAY,
    });
    assert.equal(prompt, '');
    assert.equal(prompt.includes('TRACK_PERIOD'), false);
    assert.equal(prompt.includes('POSTPARTUM'), false);
    assert.equal(prompt.includes('PREGNANCY'), false);
    assert.equal(prompt.includes(REF), false);
    assert.equal(prompt.includes('3 კვირა'), false);
    assert.equal(prompt.includes('fatigue'), false);
    assert.equal(prompt.includes('სევდიანი'), false);
    assert.equal(prompt.includes('კრუნჩხვები'), false);
    assert.equal(prompt.includes('2026-09-29'), false);
    assert.equal(prompt.includes('2026-09-15'), false);
    assert.equal(prompt.includes('2026-09-10'), false);
    assert.equal(prompt.includes('კვირა 40'), false);

    const wellness = buildCycleWellnessContext({
      profile: { mode: 'POSTPARTUM' },
      logs: [{ date: TODAY, flow: 'heavy', trackingContext: POSTPARTUM_TRACKING_CONTEXT }],
      predictions: { nextPeriodStart: '2026-09-29' },
      pregnancy: null,
      user: { age: 30 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5 },
      today: TODAY,
    });
    assert.equal(wellness.prompt, '');
    assert.deepEqual(wellness.includedCategories, []);
  });

  it('F/G/H: TTC, Pregnancy, and Perimenopause AI mapping is unchanged', () => {
    assert.equal(profileModeForAiPrompt('TRY_TO_CONCEIVE'), 'TRY_TO_CONCEIVE');
    assert.equal(profileModeForAiPrompt('PREGNANCY'), 'PREGNANCY');
    assert.equal(profileModeForAiPrompt('PERIMENOPAUSE'), 'TRACK_PERIOD');
    assert.equal(isCycleAiContextSupported('TRY_TO_CONCEIVE'), true);
    assert.equal(isCycleAiContextSupported('PREGNANCY'), true);
    assert.equal(isCycleAiContextSupported('PERIMENOPAUSE'), true);
    assert.equal(cycleModeForPatientAiContext('TRY_TO_CONCEIVE'), 'TRY_TO_CONCEIVE');
    assert.equal(cycleModeForPatientAiContext('PREGNANCY'), 'PREGNANCY');
    assert.equal(cycleModeForPatientAiContext('PERIMENOPAUSE'), 'PERIMENOPAUSE');
  });

  it('E: TRACK_PERIOD Cycle AI context still includes mode and allowed forecast lines', () => {
    assert.equal(profileModeForAiPrompt('TRACK_PERIOD'), 'TRACK_PERIOD');
    assert.equal(isCycleAiContextSupported('TRACK_PERIOD'), true);
    const prompt = buildCycleAiUserPrompt({
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-08-01', avgCycleLength: 28, avgPeriodLength: 5 },
      logs: [{ date: '2026-08-01', flow: 'medium' }],
      predictions: { nextPeriodStart: '2026-08-29', ovulationDate: '2026-08-15', fertileWindow: { start: '2026-08-10', end: '2026-08-16' }, confidence: 'medium' },
      pregnancy: null,
      user: { age: 30 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
      today: TODAY,
    });
    assert.match(prompt, /რეჟიმი: TRACK_PERIOD/);
    assert.match(prompt, /2026-08-29/);
    assert.equal(prompt.includes('POSTPARTUM'), false);
  });

  it('W: partner payload has no postpartum keys', () => {
    const partner = buildPartnerPayload({
      profile: { mode: 'POSTPARTUM', avgCycleLength: 28, avgPeriodLength: 5 },
      logs: [{ date: TODAY, flow: 'heavy', trackingContext: POSTPARTUM_TRACKING_CONTEXT }],
      today: TODAY,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
    });
    assert.equal(partnerPayloadHasLeak(partner), false);
    assert.equal(partnerPayloadHasLeak({ ...partner, postpartum: { active: true } }), true);
    assert.equal(partnerPayloadHasLeak({ ...partner, trackingContext: 'POSTPARTUM' }), true);
  });

  it('X: doctor summary postpartum context is null without an ACTIVE episode', () => {
    const doctor = buildCycleDoctorSummaryData({
      profile: { mode: 'POSTPARTUM', avgCycleLength: 28, avgPeriodLength: 5 },
      logs: [],
      today: TODAY,
      inferred: { periodStarts: [], periodRanges: [] },
      pregnancyEpisode: { status: 'ENDED', referenceDate: '2026-01-01', referenceType: 'LMP' },
    });
    assert.equal(doctor.pregnancyContext, null);
    assert.equal(doctor.postpartumContext, null);
    assert.equal(doctor.inclusions?.pregnancyContext, false);
    assert.equal(doctor.inclusions?.postpartumContext, false);
  });

  it('personal export includes mode, reference, episode, and trackingContext', () => {
    const payload = buildCycleExportPayload({
      profile: { mode: 'POSTPARTUM' },
      logs: [{ date: TODAY, flow: 'heavy', trackingContext: POSTPARTUM_TRACKING_CONTEXT, postpartumEpisodeId: 'pp-1' }],
      postpartumEpisodes: [
        { id: 'pp-1', referenceDate: REF, status: POSTPARTUM_EPISODE_ACTIVE, startedAt: TODAY, endedAt: null },
      ],
    });
    assert.equal(payload.profile.mode, 'POSTPARTUM');
    assert.equal(payload.postpartumEpisodes[0].referenceDate, REF);
    assert.equal(payload.logs[0].trackingContext, POSTPARTUM_TRACKING_CONTEXT);
    assert.equal(Object.hasOwn(payload.postpartumEpisodes[0], 'outcome'), false);
  });
});

describe('Prenatal reminder revalidation after Pregnancy exit', () => {
  it('L: POSTPARTUM fails pregnancy-care eligibility via MODE_EXIT', () => {
    const check = pregnancyCareReminderEligibility(
      {
        id: 'anatomy_scan',
        userState: {
          status: 'PLANNED',
          plannedDate: addDays(TODAY, 3),
          reminderEnabled: true,
          reminderOffset: 1,
          reminderMode: 'DATE_BASED',
        },
      },
      { mode: 'POSTPARTUM', pregnancyActive: false, episodeStatus: 'ENDED', today: TODAY },
    );
    assert.equal(check.ok, false);
    assert.equal(check.reason, 'MODE_EXIT');
  });
});

describe('Stamp helper', () => {
  it('only stamps writes while mode is POSTPARTUM', () => {
    assert.deepEqual(stampPostpartumLogWrite({ mode: 'TRACK_PERIOD', episodeId: 'x' }), {});
    assert.deepEqual(stampPostpartumLogWrite({ mode: 'POSTPARTUM', episodeId: 'pp-1' }), {
      trackingContext: POSTPARTUM_TRACKING_CONTEXT,
      postpartumEpisodeId: 'pp-1',
    });
  });
});
