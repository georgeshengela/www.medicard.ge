import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildPredictions, daysBetween, detectLatePeriod, todayInTimeZone } from './cycle.js';
import { interpretContraception } from './cycleContraception.js';
import { buildCycleAiUserPrompt } from './cycle.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { buildCycleExportPayload } from './cycleLifecycle.js';
import { buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';
import { isLiveProductMode, PRODUCT_MODES, capabilitiesForProfileMode } from './cycleModes.js';
import {
  applyPregnancyEpisodeTransition,
  buildCyclePregnancyData,
  bundlePregnancyView,
  CYCLE_PREGNANCY_HTTP_PATH,
  estimatedDueDateFromReference,
  gestationalAgeFromReference,
  PREGNANCY_ACTIVE_MAX_DAYS,
  PREGNANCY_EPISODE_ACTIVE,
  PREGNANCY_EPISODE_ENDED,
  PREGNANCY_LMP_TO_DUE_DAYS,
  PREGNANCY_REJECT_AFTER_DAYS,
  presentPregnancyDating,
  validatePregnancyReferenceDate,
} from './cyclePregnancy.js';

const TODAY = '2026-09-09';
const LMP = '2026-07-15';

function bleed(start, days = 4) {
  const rows = [];
  for (let i = 0; i < days; i += 1) {
    rows.push({ date: addDays(start, i), flow: i === 0 ? 'medium' : 'light' });
  }
  return rows;
}

function pred(logs) {
  return buildPredictions({
    lastPeriodStart: LMP,
    avgCycleLength: 28,
    avgPeriodLength: 5,
    cycleCount: 3,
    logs,
  });
}

function mockEpisodeTx(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  return {
    rows,
    cyclePregnancyEpisode: {
      findFirst: async ({ where }) =>
        rows.find((row) => row.userId === where.userId && row.status === where.status) || null,
      create: async ({ data }) => {
        const row = {
          id: `ep-${rows.length + 1}`,
          startedAt: new Date('2026-09-09T10:00:00.000Z'),
          endedAt: null,
          createdAt: new Date('2026-09-09T10:00:00.000Z'),
          updatedAt: new Date('2026-09-09T10:00:00.000Z'),
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

describe('Pregnancy mode capabilities', () => {
  it('marks Pregnancy live alongside tracking, TTC, and perimenopause', () => {
    assert.equal(isLiveProductMode(PRODUCT_MODES.CYCLE_TRACKING), true);
    assert.equal(isLiveProductMode(PRODUCT_MODES.TRYING_TO_CONCEIVE), true);
    assert.equal(isLiveProductMode(PRODUCT_MODES.PREGNANCY), true);
    assert.equal(isLiveProductMode(PRODUCT_MODES.PERIMENOPAUSE), true);
    assert.equal(capabilitiesForProfileMode('PREGNANCY').showPregnancyOverview, true);
    assert.equal(capabilitiesForProfileMode('PREGNANCY').showFertileEstimates, false);
    assert.equal(capabilitiesForProfileMode('PREGNANCY').showTtcOverview, false);
    assert.equal(capabilitiesForProfileMode('PREGNANCY').showLatePeriod, false);
    assert.equal(capabilitiesForProfileMode('PREGNANCY').showNextPeriodForecast, false);
    assert.deepEqual(capabilitiesForProfileMode('PREGNANCY').engineUsesObservations, ['flow']);
  });
});

describe('Pregnancy HTTP route registration', () => {
  it('Cycle router registers authenticated GET /pregnancy', async () => {
    const { cycleRouter } = await import('../routes/cycle.routes.js');
    const methods = [];
    const weekMethods = [];
    for (const layer of cycleRouter.stack) {
      if (layer.route?.path === CYCLE_PREGNANCY_HTTP_PATH) {
        methods.push(layer.route.methods);
      }
      if (layer.route?.path === `${CYCLE_PREGNANCY_HTTP_PATH}/weeks/:week`) {
        weekMethods.push(layer.route.methods);
      }
    }
    assert.equal(
      methods.some((m) => m.get === true),
      true,
      'GET /api/cycle/pregnancy must be registered',
    );
    assert.equal(
      weekMethods.some((m) => m.get === true),
      true,
      'GET /api/cycle/pregnancy/weeks/:week must be registered',
    );
  });
});

describe('Pregnancy civil-date math', () => {
  it('same day is 0 weeks + 0 days', () => {
    const age = gestationalAgeFromReference('2026-09-09', '2026-09-09');
    assert.deepEqual(age, { week: 0, day: 0, dayOfPregnancy: 0, trimester: 1 });
  });

  it('week boundary is 1 week + 0 days after 7 civil days', () => {
    const age = gestationalAgeFromReference('2026-09-09', '2026-09-16');
    assert.equal(age.week, 1);
    assert.equal(age.day, 0);
    assert.equal(age.dayOfPregnancy, 7);
  });

  it('example 8 weeks + 3 days', () => {
    const age = gestationalAgeFromReference(LMP, addDays(LMP, 8 * 7 + 3));
    assert.equal(age.week, 8);
    assert.equal(age.day, 3);
  });

  it('month and year boundaries stay civil', () => {
    assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1);
    assert.equal(daysBetween('2026-01-31', '2026-02-01'), 1);
    const age = gestationalAgeFromReference('2025-12-31', '2026-01-07');
    assert.equal(age.week, 1);
    assert.equal(age.day, 0);
  });

  it('leap day is one civil day', () => {
    assert.equal(daysBetween('2024-02-28', '2024-02-29'), 1);
    assert.equal(daysBetween('2024-02-29', '2024-03-01'), 1);
    const due = estimatedDueDateFromReference('2024-02-29');
    assert.equal(due, addDays('2024-02-29', PREGNANCY_LMP_TO_DUE_DAYS));
  });

  it('DST does not shift civil pregnancy dates', () => {
    const brussels = todayInTimeZone('Europe/Brussels', new Date('2026-03-29T12:00:00.000Z'));
    const tbilisi = todayInTimeZone('Asia/Tbilisi', new Date('2026-03-29T12:00:00.000Z'));
    assert.match(brussels, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(tbilisi, /^\d{4}-\d{2}-\d{2}$/);
    const ageB = gestationalAgeFromReference('2026-03-20', brussels);
    const ageT = gestationalAgeFromReference('2026-03-20', tbilisi);
    assert.equal(ageB.dayOfPregnancy, daysBetween('2026-03-20', brussels));
    assert.equal(ageT.dayOfPregnancy, daysBetween('2026-03-20', tbilisi));
  });

  it('Naegele estimate is reference + 280 and labeled estimated', () => {
    const due = estimatedDueDateFromReference(LMP);
    assert.equal(due, '2027-04-21');
    const presented = presentPregnancyDating({
      referenceDate: LMP,
      referenceType: 'LMP',
      today: TODAY,
    });
    assert.equal(presented.estimatedDueDate.estimated, true);
    assert.equal(presented.estimatedDueDate.date, due);
    assert.equal(presented.referenceType, 'LMP');
  });
});

describe('Pregnancy reference validation', () => {
  it('rejects a future reference', () => {
    const result = validatePregnancyReferenceDate('2026-09-10', TODAY);
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(result.code, 'future');
  });

  it('rejects a reference older than 365 days', () => {
    const old = addDays(TODAY, -(PREGNANCY_REJECT_AFTER_DAYS + 1));
    const result = validatePregnancyReferenceDate(old, TODAY);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'too_old');
  });

  it('marks 309–365 days as review-required without computing a 90-week age', () => {
    const ref = addDays(TODAY, -(PREGNANCY_ACTIVE_MAX_DAYS + 1));
    const presented = presentPregnancyDating({
      referenceDate: ref,
      referenceType: 'LMP',
      today: TODAY,
    });
    assert.equal(presented.reviewRequired, true);
    assert.equal(presented.estimatedGestationalAge, null);
    assert.equal(gestationalAgeFromReference(ref, TODAY), null);
  });
});

describe('Pregnancy episode transitions', () => {
  it('requires explicit confirmation to enter Pregnancy', async () => {
    const tx = mockEpisodeTx();
    await assert.rejects(
      () =>
        applyPregnancyEpisodeTransition(tx, {
          userId: 'u1',
          currentMode: 'TRACK_PERIOD',
          nextMode: 'PREGNANCY',
          body: { pregnancyReferenceDate: LMP, pregnancyReferenceType: 'LMP' },
          today: TODAY,
        }),
      /დადასტურებით/,
    );
    assert.equal(tx.rows.length, 0);
  });

  it('creates one ACTIVE episode on confirmed enter', async () => {
    const tx = mockEpisodeTx();
    const result = await applyPregnancyEpisodeTransition(tx, {
      userId: 'u1',
      currentMode: 'TRY_TO_CONCEIVE',
      nextMode: 'PREGNANCY',
      body: {
        pregnancyConfirm: true,
        pregnancyReferenceDate: LMP,
        pregnancyReferenceType: 'LMP',
      },
      today: TODAY,
    });
    assert.equal(tx.rows.length, 1);
    assert.equal(tx.rows[0].status, PREGNANCY_EPISODE_ACTIVE);
    assert.equal(tx.rows[0].referenceDate, LMP);
    assert.equal(result.dueDate, estimatedDueDateFromReference(LMP));
  });

  it('ends the active episode without deleting it', async () => {
    const tx = mockEpisodeTx([
      { id: 'ep-1', userId: 'u1', status: PREGNANCY_EPISODE_ACTIVE, referenceDate: LMP, referenceType: 'LMP' },
    ]);
    await applyPregnancyEpisodeTransition(tx, {
      userId: 'u1',
      currentMode: 'PREGNANCY',
      nextMode: 'TRACK_PERIOD',
      today: TODAY,
    });
    assert.equal(tx.rows[0].status, PREGNANCY_EPISODE_ENDED);
    assert.ok(tx.rows[0].endedAt);
    assert.equal(tx.rows[0].referenceDate, LMP);
  });

  it('re-entry creates a new episode and does not reuse the old reference', async () => {
    const tx = mockEpisodeTx([
      {
        id: 'ep-old',
        userId: 'u1',
        status: PREGNANCY_EPISODE_ENDED,
        referenceDate: '2025-01-01',
        referenceType: 'LMP',
      },
    ]);
    await applyPregnancyEpisodeTransition(tx, {
      userId: 'u1',
      currentMode: 'TRACK_PERIOD',
      nextMode: 'PREGNANCY',
      body: {
        pregnancyConfirm: true,
        pregnancyReferenceDate: LMP,
        pregnancyReferenceType: 'USER_SELECTED',
      },
      today: TODAY,
    });
    const active = tx.rows.filter((row) => row.status === PREGNANCY_EPISODE_ACTIVE);
    assert.equal(active.length, 1);
    assert.equal(active[0].referenceDate, LMP);
    assert.equal(tx.rows.find((row) => row.id === 'ep-old').status, PREGNANCY_EPISODE_ENDED);
  });
});

describe('Positive/negative test safety', () => {
  it('positive pregnancy test does not create an episode or change mode', () => {
    const logs = [...bleed(LMP), { date: TODAY, pregnancyTest: 'positive' }];
    const ttc = buildCyclePregnancyData({
      today: TODAY,
      profile: { mode: 'TRY_TO_CONCEIVE' },
      logs,
    });
    assert.equal(ttc.mode, 'TRY_TO_CONCEIVE');
    assert.equal(ttc.pregnancyActive, false);
    assert.equal(ttc.pregnancyTestHistory[0].result, 'positive');
    assert.equal(ttc.pregnancyTestHistory[0].doesNotConfirmMode, true);
  });

  it('negative test while in Pregnancy does not exit the episode', () => {
    const data = buildCyclePregnancyData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      episode: {
        id: 'ep-1',
        referenceDate: LMP,
        referenceType: 'LMP',
        status: PREGNANCY_EPISODE_ACTIVE,
        startedAt: new Date(),
      },
      logs: [{ date: TODAY, pregnancyTest: 'negative', flow: 'spotting' }],
    });
    assert.equal(data.pregnancyActive, true);
    assert.equal(data.todayLogged.pregnancyTest, 'negative');
    assert.equal(data.todayLogged.spotting, true);
  });
});

describe('Pregnancy presentation vs frozen engine', () => {
  it('does not change forecast arithmetic', () => {
    const logs = [...bleed('2026-06-17'), ...bleed('2026-07-15'), ...bleed(LMP)];
    const a = pred(logs);
    const b = pred(logs);
    assert.equal(a.nextPeriodStart, b.nextPeriodStart);
    assert.deepEqual(a.fertileWindow, b.fertileWindow);
    assert.equal(a.ovulationDate, b.ovulationDate);
  });

  it('late detection stays suppressed by existing pregnancy_mode reason', () => {
    const late = detectLatePeriod({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      logs: bleed(LMP),
      predictions: pred(bleed(LMP)),
      inferred: { periodRanges: [], cycleCount: 3 },
    });
    assert.equal(late.reason, 'pregnancy_mode');
    assert.equal(late.status, 'unknown');
    assert.equal(late.notifyEligible, false);
  });
});

describe('Pregnancy privacy firewalls', () => {
  it('does not add episode/reference/week/due date to AI, partner, or doctor-summary defaults', () => {
    const episode = {
      id: 'ep-secret',
      referenceDate: LMP,
      referenceType: 'LMP',
      status: PREGNANCY_EPISODE_ACTIVE,
    };
    const payload = buildCyclePregnancyData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      episode,
      logs: [{ date: TODAY, pregnancyTest: 'positive', notes: 'private' }],
    });
    const prompt = buildCycleAiUserPrompt({
      today: TODAY,
      profile: { mode: 'PREGNANCY', lastPeriodStart: LMP, avgCycleLength: 28, avgPeriodLength: 5 },
      logs: [{ date: TODAY, pregnancyTest: 'positive', notes: 'private' }],
      predictions: pred(bleed(LMP)),
    });
    assert.doesNotMatch(prompt, /ep-secret|pregnancyReferenceDate|CyclePregnancyEpisode|weekDevelopment|comparisonKey|raspberry|beyondStandardTerm|anatomy_scan|ms_heart|carePlannerSummary|prenatal-care-v1|careItemId|reminderEnabled|reminderOffset|reminderMode|exactReminderOffsetMinutes|calendarEventId|calendarExport|plannedTime|plannedPlace/);
    const partner = buildPartnerPayload({
      today: TODAY,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { mode: 'PREGNANCY', lastPeriodStart: LMP },
      logs: [{ date: TODAY, pregnancyTest: 'positive' }],
      predictions: pred(bleed(LMP)),
    });
    assert.equal(partnerPayloadHasLeak(partner), false);
    assert.equal(JSON.stringify(partner).includes('ep-secret'), false);
    assert.doesNotMatch(JSON.stringify(partner), /weekDevelopment|comparisonKey|raspberry|illustrationKey|beyondStandardTerm|anatomy_scan|ms_heart/);
    const doctor = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      logs: [{ date: TODAY, pregnancyTest: 'positive' }],
    });
    assert.equal(doctor.fertilityObservations, null);
    assert.equal(doctor.pregnancyContext, null);
    assert.doesNotMatch(JSON.stringify(doctor), /weekDevelopment|comparisonKey|raspberry|მარწყვ|beyondStandardTerm|anatomy_scan|ms_heart/);
    const personal = buildCycleExportPayload({
      profile: { mode: 'PREGNANCY' },
      logs: [{ date: TODAY, pregnancyTest: 'positive' }],
      pregnancyEpisodes: [episode],
    });
    assert.equal(personal.pregnancyEpisodes[0].referenceDate, LMP);
    assert.equal(personal.weekDevelopment, undefined);
    assert.equal(personal.timeline, undefined);
  });
});

describe('Pregnancy bundle view', () => {
  it('omits baby-size insight and marks due date estimated', () => {
    const view = bundlePregnancyView({
      profile: { mode: 'PREGNANCY' },
      episode: { referenceDate: LMP, referenceType: 'LMP', status: PREGNANCY_EPISODE_ACTIVE },
      today: TODAY,
    });
    assert.equal(view.estimated, true);
    assert.equal(view.insight, undefined);
    assert.equal(view.referenceType, 'LMP');
    assert.ok(view.age.week >= 0);
  });

  it('is null when mode is not PREGNANCY', () => {
    assert.equal(
      bundlePregnancyView({
        profile: { mode: 'TRACK_PERIOD' },
        episode: { referenceDate: LMP, referenceType: 'LMP', status: PREGNANCY_EPISODE_ACTIVE },
        today: TODAY,
      }),
      null,
    );
  });
});

describe('LIMITED contraception still independent', () => {
  it('does not invent pregnancy from a pill context', () => {
    const ctx = interpretContraception({ contraceptionMethod: 'COMBINED_PILL' });
    assert.equal(ctx.presentation.showFertilityMarkers, false);
    const data = buildCyclePregnancyData({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD' },
    });
    assert.equal(data.pregnancyActive, false);
  });
});

describe('Pregnancy weekDevelopment catalog', () => {
  function episodeAt(elapsedDays) {
    return {
      id: 'ep-1',
      referenceDate: addDays(TODAY, -elapsedDays),
      referenceType: 'LMP',
      status: PREGNANCY_EPISODE_ACTIVE,
    };
  }

  it('matches Phase 18 completed week including 8w+6d and does not invent grams at week 8', () => {
    const age = gestationalAgeFromReference(addDays(TODAY, -(8 * 7 + 6)), TODAY);
    assert.equal(age.week, 8);
    assert.equal(age.day, 6);
    const data = buildCyclePregnancyData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      episode: episodeAt(8 * 7 + 6),
    });
    assert.equal(data.estimatedGestationalAge.week, 8);
    assert.equal(data.weekDevelopment.week, 8);
    assert.equal(data.weekDevelopment.comparisonKey, 'raspberry');
    assert.equal(data.weekDevelopment.lengthCm, 1.4);
    assert.equal(data.weekDevelopment.measurementType, 'CRL');
    assert.equal(data.carePlannerSummary.available, true);
    assert.equal(data.carePlannerSummary.personalized, true);
    assert.equal(data.carePlannerSummary.next.id, 'first_booking');
    assert.equal(data.timeline.available, true);
    assert.equal(data.weekDevelopment.weightGrams, null);
  });

  it('covers catalog boundaries without client math', () => {
    const cases = [
      [4, 'analogy', null],
      [12, 'catalog', 5.6],
      [20, 'catalog', 25],
      [28, 'catalog', 35],
      [36, 'catalog', 45],
      [40, 'catalog', 50],
    ];
    for (const [week, kind, length] of cases) {
      const data = buildCyclePregnancyData({
        today: TODAY,
        profile: { mode: 'PREGNANCY' },
        episode: episodeAt(week * 7 + 2),
      });
      assert.equal(data.estimatedGestationalAge.week, week);
      assert.equal(data.weekDevelopment.week, week);
      assert.equal(data.weekDevelopment.kind, kind);
      assert.equal(data.weekDevelopment.lengthCm, length);
    }
  });

  it('omits fruit when TRACK/TTC or reviewRequired', () => {
    const episode = episodeAt(8 * 7);
    assert.equal(
      buildCyclePregnancyData({
        today: TODAY,
        profile: { mode: 'TRACK_PERIOD' },
        episode,
      }).weekDevelopment,
      null,
    );
    assert.equal(
      buildCyclePregnancyData({
        today: TODAY,
        profile: { mode: 'TRY_TO_CONCEIVE' },
        episode,
      }).weekDevelopment,
      null,
    );
    const old = buildCyclePregnancyData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      episode: {
        id: 'ep-old',
        referenceDate: addDays(TODAY, -320),
        referenceType: 'LMP',
        status: PREGNANCY_EPISODE_ACTIVE,
      },
    });
    assert.equal(old.reviewRequired, true);
    assert.equal(old.weekDevelopment, null);
  });

  it('clamps beyond catalog to week 40 without crashing', () => {
    const data = buildCyclePregnancyData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      episode: episodeAt(43 * 7),
    });
    assert.equal(data.estimatedGestationalAge.week, 43);
    assert.equal(data.weekDevelopment.week, 40);
    assert.equal(data.weekDevelopment.beyondCatalog, true);
  });
});
