import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildPredictions, inferCycleStats } from '../../../server/src/lib/cycle.js';
import { buildCycleDoctorSummaryData } from '../../../server/src/lib/cycleDoctorSummary.js';
import { buildCycleAiUserPrompt } from '../../../server/src/lib/cycle.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from '../../../server/src/lib/cycleShare.js';
import { buildCycleExportPayload } from '../../../server/src/lib/cycleLifecycle.js';
import {
  DOCTOR_SUMMARY_COPY,
  DOCTOR_SUMMARY_ENUM_KEYS,
  DOCTOR_SUMMARY_LOCALES,
  DOCTOR_SUMMARY_STRING_KEYS,
} from '../i18n/cycle/doctorSummary.js';
import {
  buildCycleReportHtmlFromSummary,
  doctorReportFactIds,
  doctorSummaryCopy,
  doctorSummaryEnumLabel,
  formatDoctorCivilDate,
  formatDoctorGestationalAge,
  resolveDoctorSummaryLocale,
} from './cycleDoctorSummaryI18n.js';

const TODAY = '2026-09-09';

function log(date, extra = {}) {
  return { date, flow: extra.flow ?? 'none', ...extra };
}
function bleed(start, days = 4, extra = {}) {
  const rows = [];
  for (let i = 0; i < days; i += 1) {
    rows.push(log(addDays(start, i), { flow: i === 0 ? 'medium' : i === 1 ? 'heavy' : 'light', ...extra }));
  }
  return rows;
}

function richLogs() {
  return [
    ...bleed('2026-06-17', 4, { painEntries: [{ type: 'cramps', severity: 'moderate' }] }),
    ...bleed('2026-07-15', 4, { painEntries: [{ type: 'pelvic', severity: 'mild' }] }),
    ...bleed('2026-08-12', 4, { painEntries: [{ type: 'cramps', severity: 'severe' }] }),
    log('2026-08-22', { flow: 'spotting' }),
    log('2026-09-01', {
      symptoms: ['bloating', 'fatigue', 'migraine', 'hair_loss'],
      observations: { energy: 'low' },
      sleepQuality: 'poor',
      stressLevel: 'high',
      ovulationTest: 'positive',
      bbt: 36.7,
      cervicalMucus: 'eggwhite',
      pregnancyTest: 'negative',
      sexualActivity: true,
      notes: 'private journal <script>alert(1)</script>',
    }),
  ];
}

function summary(options = {}) {
  return buildCycleDoctorSummaryData({
    today: TODAY,
    profile: { mode: 'TRACK_PERIOD', avgCycleLength: 28, avgPeriodLength: 5, contraceptionMethod: 'BARRIER' },
    logs: richLogs(),
    options,
  });
}

describe('doctor-summary locale catalog coverage', () => {
  it('has every string key in ka/en/fr/ru', () => {
    for (const locale of DOCTOR_SUMMARY_LOCALES) {
      const copy = DOCTOR_SUMMARY_COPY[locale];
      for (const key of DOCTOR_SUMMARY_STRING_KEYS) {
        assert.equal(typeof copy[key], 'string', `${locale}.${key}`);
        assert.ok(copy[key].length > 1, `${locale}.${key} empty`);
        assert.notEqual(copy[key], key, `${locale}.${key} is a raw key`);
      }
      assert.equal(typeof copy.loggedDays, 'function');
      assert.equal(typeof copy.days, 'function');
      assert.equal(typeof copy.cycles, 'function');
      assert.equal(typeof copy.weeks, 'function');
      assert.equal(typeof copy.perimenopauseIntervalRange, 'function');
      assert.equal(typeof copy.perimenopauseIntervalCount, 'function');
    }
  });

  it('has every enum label in ka/en/fr/ru', () => {
    for (const locale of DOCTOR_SUMMARY_LOCALES) {
      for (const [group, keys] of Object.entries(DOCTOR_SUMMARY_ENUM_KEYS)) {
        for (const key of keys) {
          const label = doctorSummaryEnumLabel(group, key, locale);
          assert.ok(label, `${locale}.${group}.${key}`);
          assert.notEqual(label, key);
        }
      }
    }
  });

  it('unknown enums are excluded, never shown as raw keys', () => {
    assert.equal(doctorSummaryEnumLabel('flow', 'future_flow', 'fr'), null);
    assert.equal(doctorSummaryEnumLabel('symptom', 'gas', 'en'), null);
    const html = buildCycleReportHtmlFromSummary(
      buildCycleDoctorSummaryData({
        today: TODAY,
        profile: { mode: 'TRACK_PERIOD' },
        logs: [log('2026-09-01', { symptoms: ['bloating'], painEntries: [{ type: 'not_a_pain', severity: 'mild' }] })],
      }),
      'fr',
    );
    assert.equal(html.includes('not_a_pain'), false);
    assert.equal(html.includes('future_flow'), false);
  });
});

describe('doctor-summary locale rendering', () => {
  it('resolves locale like Quest and falls back to ka', () => {
    assert.equal(resolveDoctorSummaryLocale('fr-BE'), 'fr');
    assert.equal(resolveDoctorSummaryLocale('en-GB'), 'en');
    assert.equal(resolveDoctorSummaryLocale('ru-RU'), 'ru');
    assert.equal(resolveDoctorSummaryLocale('de'), 'ka');
    assert.equal(doctorSummaryCopy('xx').htmlLang, 'ka');
  });

  it('formats civil dates without UTC off-by-one (month, leap, Brussels DST)', () => {
    assert.match(formatDoctorCivilDate('2026-03-01', 'en'), /1 March 2026|1 Mar/);
    assert.match(formatDoctorCivilDate('2024-02-29', 'fr'), /29 février 2024/);
    assert.match(formatDoctorCivilDate('2026-10-25', 'fr'), /25 octobre 2026/);
    assert.match(formatDoctorCivilDate('2026-09-09', 'ru'), /9 сентября 2026/);
    assert.match(formatDoctorCivilDate('2026-09-09', 'ka'), /9 სექტემბერი 2026/);
  });

  it('pluralizes duration in fr/ru/en/ka', () => {
    const ka = doctorSummaryCopy('ka');
    const en = doctorSummaryCopy('en');
    const fr = doctorSummaryCopy('fr');
    const ru = doctorSummaryCopy('ru');
    assert.equal(en.days(1), '1 day');
    assert.equal(en.days(2), '2 days');
    assert.equal(fr.days(1), '1 jour');
    assert.equal(fr.days(2), '2 jours');
    assert.equal(ru.days(1), '1 день');
    assert.equal(ru.days(2), '2 дня');
    assert.equal(ru.days(5), '5 дней');
    assert.equal(ka.days(1), '1 დღე');
    assert.equal(fr.cycles(1), '1 cycle');
    assert.equal(fr.cycles(2), '2 cycles');
    assert.equal(ru.cycles(1), '1 цикл');
    assert.equal(ru.cycles(2), '2 цикла');
  });

  it('renders the same payload facts in all four locales', () => {
    const payload = summary();
    const facts = doctorReportFactIds(payload);
    assert.ok(facts.episodeStarts.length >= 3);
    assert.ok(facts.spottingDates.includes('2026-08-22'));
    const html = {};
    for (const locale of DOCTOR_SUMMARY_LOCALES) {
      html[locale] = buildCycleReportHtmlFromSummary(payload, locale);
      assert.equal(html[locale].includes(payload.range.from.slice(0, 4)), true);
      const bodyRows = html[locale].match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || '';
      assert.equal((bodyRows.match(/<tr>/g) || []).length, facts.episodeStarts.length);
      assert.equal(html[locale].includes('nextPeriodStart'), false);
      assert.equal(html[locale].includes('gas'), false);
      assert.equal(html[locale].includes('ovulation confirmed'), false);
      assert.equal(html[locale].includes('self_reported'), false);
      assert.equal(html[locale].includes('BARRIER'), false);
      if (locale !== 'ka') {
        assert.equal(/[\u10A0-\u10FF]/.test(html[locale]), false, `${locale} mixed Georgian`);
      }
    }
    assert.match(html.ka, /ციკლის კლინიკური ისტორია/);
    assert.match(html.en, /Cycle clinical history/);
    assert.match(html.fr, /Histoire clinique du cycle/);
    assert.match(html.ru, /Клинический анамнез цикла/);
    assert.match(html.en, /9 September 2026/);
    assert.match(html.fr, /9 septembre 2026/);
    assert.match(html.ru, /9 сентября 2026/);
    assert.match(html.ka, /9 სექტემბერი 2026/);
    assert.match(html.en, /Generated on/);
    assert.equal(html.fr.includes('ციკლის კლინიკური ისტორია'), false);
    assert.equal(html.en.includes('Histoire clinique'), false);
    assert.deepEqual(doctorReportFactIds(payload), facts);
  });

  it('default reports exclude fertility, sexual data, and notes in every locale', () => {
    const payload = summary();
    assert.equal(payload.fertilityObservations, null);
    assert.equal(payload.privateObservations, null);
    for (const locale of DOCTOR_SUMMARY_LOCALES) {
      const html = buildCycleReportHtmlFromSummary(payload, locale);
      assert.equal(html.includes(doctorSummaryCopy(locale).fertility), false);
      assert.equal(html.includes(doctorSummaryCopy(locale).notes), false);
      assert.equal(html.includes('36.7'), false);
      assert.equal(html.includes('private journal'), false);
      assert.equal(html.includes('pain_sex'), false);
    }
  });

  it('fertility opt-in keeps the same facts and only changes labels', () => {
    const payload = summary({ includeFertility: true });
    const facts = doctorReportFactIds(payload);
    assert.ok(facts.opkDates.includes('2026-09-01'));
    assert.ok(facts.bbtDates.includes('2026-09-01'));
    for (const locale of DOCTOR_SUMMARY_LOCALES) {
      const html = buildCycleReportHtmlFromSummary(payload, locale);
      assert.match(html, /36\.7/);
      assert.match(html, /°C/);
      assert.equal(html.includes('confirms ovulation'), false);
      assert.equal(html.includes('ovulation confirmée'), false);
      assert.equal(html.includes('овуляция подтверждена'), false);
      assert.equal(html.includes('eggwhite'), false);
      assert.deepEqual(doctorReportFactIds(payload), facts);
    }
    assert.match(buildCycleReportHtmlFromSummary(payload, 'fr'), /Test d’ovulation \(LH\)/);
  });

  it('private opt-in keeps notes escaped and sexual labels localized', () => {
    const payload = summary({ includeSexual: true, includeNotes: true });
    for (const locale of DOCTOR_SUMMARY_LOCALES) {
      const html = buildCycleReportHtmlFromSummary(payload, locale);
      assert.match(html, /private journal/);
      assert.equal(html.includes('<script>'), false);
      assert.match(html, /&lt;script&gt;/);
      assert.equal(html.includes('pain_sex'), false);
    }
    assert.match(buildCycleReportHtmlFromSummary(payload, 'fr'), /Activité sexuelle/);
    assert.match(buildCycleReportHtmlFromSummary(payload, 'ru'), /Сексуальная активность/);
  });

  it('does not mix Georgian symptom names into a French report', () => {
    const html = buildCycleReportHtmlFromSummary(summary(), 'fr');
    assert.equal(html.includes('შებერილობა'), false);
    assert.equal(html.includes('კრუნჩხვები'), false);
    assert.match(html, /Ballonnements|Crampes menstruelles/);
  });
});

describe('doctor-summary locale firewalls', () => {
  it('does not change forecast, AI, partner, or personal export', () => {
    const logs = richLogs();
    const pred = buildPredictions({
      lastPeriodStart: '2026-08-12',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      logs,
    });
    const after = buildPredictions({
      lastPeriodStart: '2026-08-12',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      logs,
    });
    assert.equal(pred.nextPeriodStart, after.nextPeriodStart);
    const prompt = buildCycleAiUserPrompt({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-08-12' },
      logs,
      predictions: pred,
    });
    buildCycleReportHtmlFromSummary(summary({ includeFertility: true, includeSexual: true, includeNotes: true }), 'fr');
    const promptAfter = buildCycleAiUserPrompt({
      today: TODAY,
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-08-12' },
      logs,
      predictions: pred,
    });
    assert.equal(prompt, promptAfter);
    const partner = buildPartnerPayload({
      today: TODAY,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      profile: { lastPeriodStart: '2026-08-12', avgCycleLength: 28, avgPeriodLength: 5, mode: 'TRACK_PERIOD' },
      logs,
      predictions: pred,
    });
    assert.equal(partnerPayloadHasLeak(partner), false);
    const personal = buildCycleExportPayload({
      profile: { mode: 'TRACK_PERIOD' },
      logs,
    });
    assert.equal(personal.logs.some((row) => row.notes && row.notes.includes('private journal')), true);
  });
});

describe('doctor-summary pregnancy header locales', () => {
  const LMP = '2026-07-13';
  const episode = {
    id: 'ep-1',
    referenceDate: LMP,
    referenceType: 'LMP',
    status: 'ACTIVE',
  };

  function pregnancySummary(extra = {}) {
    return buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: extra.mode || 'PREGNANCY' },
      logs: richLogs(),
      pregnancyEpisode: extra.episode === undefined ? episode : extra.episode,
      options: extra.options,
    });
  }

  it('L same payload facts in KA/EN/FR/RU including pregnancy header', () => {
    const payload = pregnancySummary();
    const facts = doctorReportFactIds(payload);
    assert.equal(facts.pregnancyCurrent, true);
    assert.equal(facts.pregnancyTrackingMode, 'PREGNANCY');
    assert.equal(facts.pregnancyReferenceType, 'LMP');
    assert.equal(facts.pregnancyReferenceDate, LMP);
    assert.equal(Number.isFinite(facts.pregnancyWeek), true);
    assert.equal(Number.isFinite(facts.pregnancyDay), true);
    assert.ok(facts.pregnancyDueDate);
    const html = {};
    for (const locale of DOCTOR_SUMMARY_LOCALES) {
      html[locale] = buildCycleReportHtmlFromSummary(payload, locale);
      assert.deepEqual(doctorReportFactIds(payload), facts);
      assert.equal(html[locale].includes('USER_SELECTED'), false);
      assert.equal(html[locale].includes('trackingMode'), false);
      assert.equal(html[locale].includes('weekDevelopment'), false);
      assert.equal(html[locale].includes('comparisonKey'), false);
      assert.equal(html[locale].includes('raspberry'), false);
      assert.equal(html[locale].includes('ჟოლო'), false);
      assert.equal(html[locale].includes('Confirmed pregnancy'), false);
      assert.equal(html[locale].includes('Confirmed'), false);
      assert.equal(html[locale].includes('viability'), false);
      assert.equal(html[locale].includes('weekDevelopment'), false);
      const titleIdx = html[locale].indexOf(doctorSummaryCopy(locale).pregnancyContextTitle);
      const menstrualIdx = html[locale].indexOf(doctorSummaryCopy(locale).menstrualOn);
      assert.ok(titleIdx > 0);
      assert.ok(titleIdx < menstrualIdx);
    }
    assert.match(html.ka, /ორსულობის მიმდინარე აღრიცხვის კონტექსტი/);
    assert.match(html.en, /Current pregnancy tracking context/);
    assert.match(html.fr, /Contexte actuel de suivi de grossesse/);
    assert.match(html.ru, /Текущий контекст наблюдения за беременностью/);
    assert.match(html.en, /Estimated due date/);
    assert.match(html.fr, /Date prévue d’accouchement/);
    assert.match(html.ru, /Предполагаемая дата родов/);
    assert.equal(html.en.includes('Due date\n'), false);
  });

  it('pluralizes gestational week and day including Russian', () => {
    const ru = doctorSummaryCopy('ru');
    const en = doctorSummaryCopy('en');
    const fr = doctorSummaryCopy('fr');
    const ka = doctorSummaryCopy('ka');
    assert.equal(en.weeks(1), '1 week');
    assert.equal(en.weeks(2), '2 weeks');
    assert.equal(fr.weeks(1), '1 semaine');
    assert.equal(fr.weeks(5), '5 semaines');
    assert.equal(ru.weeks(1), '1 неделя');
    assert.equal(ru.weeks(2), '2 недели');
    assert.equal(ru.weeks(5), '5 недель');
    assert.equal(ru.weeks(21), '21 неделя');
    assert.equal(ka.weeks(8), '8 კვირა');
    assert.equal(formatDoctorGestationalAge({ week: 1, day: 0 }, 'en'), '1 week + 0 days');
    assert.equal(formatDoctorGestationalAge({ week: 2, day: 1 }, 'en'), '2 weeks + 1 day');
    assert.equal(formatDoctorGestationalAge({ week: 5, day: 2 }, 'ru'), '5 недель + 2 дня');
    assert.equal(formatDoctorGestationalAge({ week: 21, day: 1 }, 'ru'), '21 неделя + 1 день');
  });

  it('formats pregnancy civil dates without UTC shift', () => {
    const leap = buildCycleDoctorSummaryData({
      today: '2024-03-01',
      profile: { mode: 'PREGNANCY' },
      logs: [log('2024-03-01')],
      pregnancyEpisode: {
        referenceDate: '2024-02-29',
        referenceType: 'LMP',
        status: 'ACTIVE',
      },
    });
    const html = buildCycleReportHtmlFromSummary(leap, 'fr');
    assert.match(html, /29 février 2024/);
    const yearBoundary = buildCycleDoctorSummaryData({
      today: '2027-01-02',
      profile: { mode: 'PREGNANCY' },
      logs: [log('2027-01-02')],
      pregnancyEpisode: {
        referenceDate: '2026-12-31',
        referenceType: 'USER_SELECTED',
        status: 'ACTIVE',
      },
    });
    const en = buildCycleReportHtmlFromSummary(yearBoundary, 'en');
    assert.match(en, /31 December 2026/);
    assert.equal(en.includes('USER_SELECTED'), false);
  });

  it('review-required HTML has no week or due date', () => {
    const payload = pregnancySummary({
      episode: {
        id: 'ep-old',
        referenceDate: addDays(TODAY, -320),
        referenceType: 'LMP',
        status: 'ACTIVE',
      },
    });
    const html = buildCycleReportHtmlFromSummary(payload, 'fr');
    assert.match(html, /La date de référence doit être vérifiée/);
    assert.equal(html.includes(doctorSummaryCopy('fr').pregnancyEstimatedDue), false);
    assert.equal(/\d+ semaines \+/.test(html), false);
  });

  it('Pregnancy mode does not auto-enable fertility in any locale', () => {
    const payload = pregnancySummary();
    assert.equal(payload.fertilityObservations, null);
    for (const locale of DOCTOR_SUMMARY_LOCALES) {
      const html = buildCycleReportHtmlFromSummary(payload, locale);
      assert.equal(html.includes('36.7'), false);
    }
  });
});

describe('doctor-summary perimenopause header locales', () => {
  function periLogs() {
    const s4 = addDays(TODAY, -10);
    const s3 = addDays(s4, -29);
    const s2 = addDays(s3, -46);
    const s1 = addDays(s2, -31);
    const s0 = addDays(s1, -24);
    return [
      ...bleed(s0, 4),
      ...bleed(s1, 3),
      ...bleed(s2, 5),
      ...bleed(s3, 4),
      ...bleed(s4, 3),
      log(TODAY, { symptoms: ['hot_flashes', 'night_sweats', 'vaginal_dryness'], notes: 'private journal' }),
    ];
  }

  function periSummary(mode = 'PERIMENOPAUSE', options = {}) {
    const logs = periLogs();
    return buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode },
      logs,
      inferred: inferCycleStats(logs),
      options,
    });
  }

  const diagnosticLeak = [
    /patient is perimenopausal/i,
    /confirmed menopause/i,
    /diagnosed perimenopause/i,
    /Patiente en périménopause/,
    /Пациентка находится в перименопаузе/,
  ];

  it('same payload facts in KA/EN/FR/RU including peri header', () => {
    const payload = periSummary();
    const facts = doctorReportFactIds(payload);
    assert.equal(facts.perimenopauseCurrent, true);
    assert.equal(facts.perimenopauseTrackingMode, 'PERIMENOPAUSE');
    assert.equal(facts.perimenopauseUserSelected, true);
    assert.equal(facts.perimenopauseIntervalCount, 4);
    assert.equal(facts.perimenopauseShortestDays, 24);
    assert.equal(facts.perimenopauseLongestDays, 46);
    const html = {};
    for (const locale of DOCTOR_SUMMARY_LOCALES) {
      html[locale] = buildCycleReportHtmlFromSummary(payload, locale);
      assert.deepEqual(doctorReportFactIds(payload), facts);
      assert.equal(html[locale].includes('PERIMENOPAUSE'), false);
      assert.equal(html[locale].includes('trackingMode'), false);
      assert.equal(html[locale].includes('nextPeriodStart'), false);
      assert.equal(html[locale].includes('fertileWindow'), false);
      assert.equal(html[locale].includes('vaginal_dryness'), false);
      for (const leak of diagnosticLeak) {
        assert.equal(leak.test(html[locale]), false, `${locale} ${leak}`);
      }
      const titleIdx = html[locale].indexOf(doctorSummaryCopy(locale).perimenopauseContextTitle);
      const menstrualIdx = html[locale].indexOf(doctorSummaryCopy(locale).menstrualOn);
      assert.ok(titleIdx > 0);
      assert.ok(titleIdx < menstrualIdx);
    }
    assert.match(html.ka, /მიმდინარე აღრიცხვის კონტექსტი/);
    assert.match(html.en, /Current tracking context/);
    assert.match(html.fr, /Contexte actuel de suivi/);
    assert.match(html.ru, /Текущий контекст отслеживания/);
    assert.match(html.en, /Perimenopause tracking mode selected by user/);
    assert.match(html.fr, /Mode de suivi sélectionné par l’utilisatrice : périménopause/);
    assert.match(html.ru, /Выбранный режим отслеживания: перименопауза/);
    assert.match(html.en, /ranged from 24 to 46 days/);
    assert.match(html.en, /most recent 4 recorded intervals/);
  });

  it('TRACK HTML has no peri header', () => {
    const html = buildCycleReportHtmlFromSummary(periSummary('TRACK_PERIOD'), 'en');
    assert.equal(html.includes('Current tracking context'), false);
    assert.equal(html.includes('Perimenopause tracking mode selected by user'), false);
  });

  it('Pregnancy HTML is unchanged and has no peri header', () => {
    const payload = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      logs: richLogs(),
      pregnancyEpisode: {
        id: 'ep-1',
        referenceDate: '2026-07-13',
        referenceType: 'LMP',
        status: 'ACTIVE',
      },
    });
    const html = buildCycleReportHtmlFromSummary(payload, 'en');
    assert.match(html, /Current pregnancy tracking context/);
    assert.equal(html.includes('Perimenopause tracking mode selected by user'), false);
    assert.equal(payload.perimenopauseContext, null);
  });

  it('insufficient intervals omit a fake range in HTML', () => {
    const logs = [...bleed(addDays(TODAY, -40), 4), ...bleed(TODAY, 3)];
    const payload = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE' },
      logs,
      inferred: inferCycleStats(logs),
    });
    const html = buildCycleReportHtmlFromSummary(payload, 'en');
    assert.match(html, /Current tracking context/);
    assert.equal(html.includes('ranged from'), false);
    assert.equal(payload.perimenopauseContext.variability, null);
  });
});

describe('doctor-summary postpartum header locales', () => {
  const TODAY_PP = '2026-09-11';
  const REF = '2026-08-19';
  const STARTED = '2026-07-01';
  const outcomeLeak = [
    /days since birth/i,
    /date d'accouchement/i,
    /дата родов/,
    /დაბადების თარიღი/,
    /მშობიარობის თარიღი/,
    /liveBirth/,
    /birthDate/,
    /deliveryDate/,
    /deliveryType/,
    /lochia/i,
    /trackingContext/,
    /POSTPARTUM/,
    /pp-active/,
    /startedAt/,
    /plannedPlace/,
    /plannedTime/,
  ];

  function ppSummary(extra = {}) {
    return buildCycleDoctorSummaryData({
      today: TODAY_PP,
      profile: { mode: extra.mode || 'POSTPARTUM' },
      logs: extra.logs || [log(TODAY_PP, { flow: 'heavy' })],
      postpartumEpisode:
        extra.episode === undefined
          ? {
              id: 'pp-active',
              referenceDate: REF,
              status: 'ACTIVE',
              startedAt: STARTED,
              endedAt: null,
            }
          : extra.episode,
      pregnancyEpisode: extra.pregnancyEpisode,
      options: extra.options,
    });
  }

  it('L–O same payload facts in KA/EN/FR/RU including postpartum context', () => {
    const payload = ppSummary();
    const facts = doctorReportFactIds(payload);
    assert.equal(facts.postpartumCurrent, true);
    assert.equal(facts.postpartumTrackingMode, 'POSTPARTUM');
    assert.equal(facts.postpartumReferenceDate, REF);
    assert.equal(facts.postpartumElapsedWeek, 3);
    assert.equal(facts.postpartumElapsedDay, 2);
    const html = {};
    for (const locale of DOCTOR_SUMMARY_LOCALES) {
      html[locale] = buildCycleReportHtmlFromSummary(payload, locale);
      assert.deepEqual(doctorReportFactIds(payload), facts);
      for (const leak of outcomeLeak) {
        assert.equal(leak.test(html[locale]), false, `${locale} ${leak}`);
      }
      const titleIdx = html[locale].indexOf(doctorSummaryCopy(locale).postpartumContextTitle);
      const menstrualIdx = html[locale].indexOf(doctorSummaryCopy(locale).menstrualOn);
      const generatedIdx = html[locale].indexOf(doctorSummaryCopy(locale).generatedOn);
      assert.ok(titleIdx > 0);
      assert.ok(generatedIdx > 0);
      assert.ok(titleIdx > generatedIdx);
      if (menstrualIdx > 0) assert.ok(titleIdx < menstrualIdx);
      assert.match(html[locale], new RegExp(doctorSummaryCopy(locale).postpartumCurrentNote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(html.ka, /მშობიარობის შემდგომი აღრიცხვის კონტექსტი/);
    assert.match(html.ka, /პაციენტის მითითებული საწყისი თარიღი/);
    assert.match(html.ka, /მითითებული თარიღიდან გასული დრო/);
    assert.match(html.ka, /3 კვირა \+ 2 დღე/);
    assert.match(html.en, /Current postpartum tracking context/);
    assert.match(html.en, /Reference date entered by the patient/);
    assert.match(html.en, /Time since entered reference date/);
    assert.match(html.en, /3 weeks \+ 2 days/);
    assert.match(html.fr, /Contexte actuel de suivi post-partum/);
    assert.match(html.fr, /Date de référence saisie par la patiente/);
    assert.equal(html.fr.includes('date d\'accouchement'), false);
    assert.match(html.ru, /Текущий контекст послеродового отслеживания/);
    assert.match(html.ru, /Дата отсчёта, указанная пациенткой/);
    assert.equal(html.ru.includes('дата родов'), false);
    assert.match(html.en, /time this report was generated/i);
  });

  it('X null reference renders missing copy and no fake zero', () => {
    const payload = ppSummary({
      episode: {
        id: 'pp-none',
        referenceDate: null,
        status: 'ACTIVE',
        startedAt: STARTED,
        endedAt: null,
      },
    });
    const html = buildCycleReportHtmlFromSummary(payload, 'en');
    assert.match(html, /Not provided/);
    assert.equal(html.includes('0 weeks'), false);
    assert.equal(html.includes('1 July 2026'), false);
    assert.equal(html.includes('unknown recovery'), false);
    assert.equal(payload.postpartumContext.elapsed, null);
  });

  it('P Pregnancy HTML regression has no postpartum header', () => {
    const payload = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      logs: richLogs(),
      pregnancyEpisode: {
        id: 'ep-1',
        referenceDate: '2026-07-13',
        referenceType: 'LMP',
        status: 'ACTIVE',
      },
    });
    const html = buildCycleReportHtmlFromSummary(payload, 'en');
    assert.match(html, /Current pregnancy tracking context/);
    assert.equal(html.includes('Current postpartum tracking context'), false);
    assert.equal(payload.postpartumContext, null);
    assert.ok(payload.pregnancyContext);
  });

  it('Q Perimenopause HTML regression has no postpartum header', () => {
    const logs = [
      ...bleed(addDays(TODAY, -140), 4),
      ...bleed(addDays(TODAY, -111), 3),
      ...bleed(addDays(TODAY, -65), 5),
      ...bleed(addDays(TODAY, -34), 4),
      ...bleed(addDays(TODAY, -10), 3),
    ];
    const payload = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PERIMENOPAUSE' },
      logs,
      inferred: inferCycleStats(logs),
    });
    const html = buildCycleReportHtmlFromSummary(payload, 'en');
    assert.match(html, /Current tracking context/);
    assert.equal(html.includes('Current postpartum tracking context'), false);
    assert.equal(payload.postpartumContext, null);
  });

  it('TRACK HTML has no postpartum header', () => {
    const html = buildCycleReportHtmlFromSummary(ppSummary({ mode: 'TRACK_PERIOD' }), 'en');
    assert.equal(html.includes('Current postpartum tracking context'), false);
    assert.equal(html.includes('Postpartum tracking'), false);
  });
});

