/**
 * Canonical pregnancy timeline milestones (Phase 21).
 * Educational calendar markers only. Does not date a pregnancy, diagnose,
 * or generate a personal prenatal schedule.
 *
 * Week numbers match Phase 18 completed weeks = floor(elapsed/7).
 * Trimester bands match gestationalAgeFromReference (NHS week-number bands).
 *
 * Phase 19 baby-size catalog remains in pregnancyWeekData.js — this file
 * must not duplicate fruit / length / weight / facts.
 */

export const PREGNANCY_TIMELINE_VERSION = 'cycle.pregnancy-timeline.v1';
export const PREGNANCY_TIMELINE_REVIEW_DATE = '2026-09-10';
export const PREGNANCY_TIMELINE_SOURCE_SET = 'who-nhs-acog-williams-2026';
export const PREGNANCY_STANDARD_TERM_WEEKS = 40;

export const PREGNANCY_TIMELINE_CATEGORIES = Object.freeze([
  'PREGNANCY_STAGE',
  'GENERAL_DEVELOPMENT',
  'MATERNAL_CHANGE',
  'CLINICAL_WINDOW',
]);

/** Completed-week inclusive bands. Identical to trimesterFromCompletedWeek. */
export const PREGNANCY_TRIMESTER_BANDS = Object.freeze([
  Object.freeze({ trimester: 1, fromWeek: 0, toWeek: 12 }),
  Object.freeze({ trimester: 2, fromWeek: 13, toWeek: 26 }),
  Object.freeze({ trimester: 3, fromWeek: 27, toWeek: 40 }),
]);

export const PREGNANCY_TIMELINE_SOURCES = Object.freeze({
  src_nhs_weeks: Object.freeze({
    citation: 'NHS, Pregnancy week-by-week',
    url: 'https://www.nhs.uk/pregnancy/week-by-week/',
  }),
  src_nhs_trimesters: Object.freeze({
    citation: 'NHS Start for Life, Week-by-week guide to pregnancy (trimester bands)',
    url: 'https://www.nhs.uk/start-for-life/pregnancy/week-by-week-guide-to-pregnancy/',
  }),
  src_acog_fetus: Object.freeze({
    citation: 'ACOG, How Your Fetus Grows During Pregnancy',
    url: 'https://www.acog.org/womens-health/faqs/how-your-fetus-grows-during-pregnancy',
  }),
  src_nhs_20_scan: Object.freeze({
    citation: 'NHS, 20-week scan (anomaly / anatomy scan, commonly 18–21 weeks)',
    url: 'https://www.nhs.uk/pregnancy/your-pregnancy-care/20-week-scan/',
  }),
  src_acog_gdm: Object.freeze({
    citation: 'ACOG, Gestational Diabetes Mellitus (screening commonly 24–28 weeks)',
    url: 'https://www.acog.org/womens-health/faqs/gestational-diabetes',
  }),
  src_acog_gbs: Object.freeze({
    citation: 'ACOG, Group B Strep and Pregnancy (screening commonly 36–37 weeks)',
    url: 'https://www.acog.org/womens-health/faqs/group-b-strep-and-pregnancy',
  }),
  src_who_anc: Object.freeze({
    citation: 'WHO, WHO recommendations on antenatal care for a positive pregnancy experience (2016)',
    url: 'https://www.who.int/publications/i/item/9789241549912',
  }),
  src_williams: Object.freeze({
    citation: 'Williams Obstetrics, 26th ed. — embryonic period and gestational calendar',
    url: null,
  }),
});

export const PREGNANCY_TIMELINE_MILESTONES = Object.freeze([
  Object.freeze({
    id: 'early_calendar',
    week: 4,
    category: 'PREGNANCY_STAGE',
    titleKey: 'ms_early_title',
    bodyKey: 'ms_early_body',
    sourceKey: 'src_nhs_weeks',
  }),
  Object.freeze({
    id: 'heart_activity',
    week: 6,
    category: 'GENERAL_DEVELOPMENT',
    titleKey: 'ms_heart_title',
    bodyKey: 'ms_heart_body',
    sourceKey: 'src_acog_fetus',
  }),
  Object.freeze({
    id: 'embryonic_period',
    week: 8,
    category: 'GENERAL_DEVELOPMENT',
    titleKey: 'ms_embryo_title',
    bodyKey: 'ms_embryo_body',
    sourceKey: 'src_williams',
  }),
  Object.freeze({
    id: 't1_end',
    week: 12,
    category: 'PREGNANCY_STAGE',
    titleKey: 'ms_t1_end_title',
    bodyKey: 'ms_t1_end_body',
    sourceKey: 'src_nhs_trimesters',
  }),
  Object.freeze({
    id: 't2_start',
    week: 13,
    category: 'PREGNANCY_STAGE',
    titleKey: 'ms_t2_start_title',
    bodyKey: 'ms_t2_start_body',
    sourceKey: 'src_nhs_trimesters',
  }),
  Object.freeze({
    id: 'movement_window',
    week: 16,
    category: 'MATERNAL_CHANGE',
    titleKey: 'ms_move_title',
    bodyKey: 'ms_move_body',
    sourceKey: 'src_nhs_weeks',
  }),
  Object.freeze({
    id: 'anatomy_scan',
    week: 18,
    weekRange: Object.freeze([18, 21]),
    category: 'CLINICAL_WINDOW',
    titleKey: 'ms_anatomy_title',
    bodyKey: 'ms_anatomy_body',
    sourceKey: 'src_nhs_20_scan',
  }),
  Object.freeze({
    id: 'calendar_mid',
    week: 20,
    category: 'PREGNANCY_STAGE',
    titleKey: 'ms_mid_title',
    bodyKey: 'ms_mid_body',
    sourceKey: 'src_nhs_trimesters',
  }),
  Object.freeze({
    id: 'glucose_screen',
    week: 26,
    weekRange: Object.freeze([24, 28]),
    category: 'CLINICAL_WINDOW',
    titleKey: 'ms_glucose_title',
    bodyKey: 'ms_glucose_body',
    sourceKey: 'src_acog_gdm',
  }),
  Object.freeze({
    id: 't3_start',
    week: 27,
    category: 'PREGNANCY_STAGE',
    titleKey: 'ms_t3_start_title',
    bodyKey: 'ms_t3_start_body',
    sourceKey: 'src_nhs_trimesters',
  }),
  Object.freeze({
    id: 'later_pregnancy',
    week: 28,
    category: 'PREGNANCY_STAGE',
    titleKey: 'ms_later_title',
    bodyKey: 'ms_later_body',
    sourceKey: 'src_nhs_weeks',
  }),
  Object.freeze({
    id: 'gbs_screen',
    week: 36,
    weekRange: Object.freeze([36, 37]),
    category: 'CLINICAL_WINDOW',
    titleKey: 'ms_gbs_title',
    bodyKey: 'ms_gbs_body',
    sourceKey: 'src_acog_gbs',
  }),
  Object.freeze({
    id: 'estimated_term',
    week: 40,
    category: 'PREGNANCY_STAGE',
    titleKey: 'ms_term_title',
    bodyKey: 'ms_term_body',
    sourceKey: 'src_who_anc',
  }),
]);

export function milestoneStatusForWeek(milestoneWeek, currentWeek) {
  if (!Number.isInteger(currentWeek) || !Number.isInteger(milestoneWeek)) return null;
  if (milestoneWeek < currentWeek) return 'PAST';
  if (milestoneWeek === currentWeek) return 'CURRENT';
  return 'UPCOMING';
}

export function calendarRailPosition(week, day) {
  if (!Number.isInteger(week) || !Number.isInteger(day)) return null;
  if (week < 0 || day < 0 || day > 6) return null;
  return week + day / 7;
}

export function calendarProgressFraction(week, day, ofWeeks = PREGNANCY_STANDARD_TERM_WEEKS) {
  const pos = calendarRailPosition(week, day);
  if (pos == null || ofWeeks <= 0) return null;
  return Math.min(1, pos / ofWeeks);
}
