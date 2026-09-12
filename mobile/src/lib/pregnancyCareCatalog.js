/**
 * Pregnancy prenatal care planner catalog — Phase 32.
 *
 * Informational + organizational. Not medical orders, diagnosis, or a
 * second gestational-age engine. Week numbers are Phase 18 completed weeks:
 * week = floor(elapsedCivilDays / 7). A window [startWeek, endWeek] is
 * inclusive of those completed-week integers.
 *
 * Catalog lives in versioned code. The database stores owner overrides only.
 */

export const PREGNANCY_CARE_CATALOG_VERSION = 'prenatal-care-v1';
export const PREGNANCY_CARE_CATALOG_REVIEWED_AT = '2026-09-10';
export const PREGNANCY_CARE_CATALOG_SOURCE_SET = 'who-nhs-nice-acog-2026';

export const PREGNANCY_CARE_CATEGORIES = Object.freeze([
  'APPOINTMENT',
  'ULTRASOUND',
  'LAB',
  'SCREENING',
  'VACCINATION_DISCUSSION',
  'EDUCATION',
  'BIRTH_PLANNING',
]);

export const PREGNANCY_CARE_TIMING_TYPES = Object.freeze(['WINDOW']);

export const PREGNANCY_CARE_WINDOW_RELATIONS = Object.freeze([
  'BEFORE_WINDOW',
  'IN_WINDOW',
  'AFTER_WINDOW',
]);

export const PREGNANCY_CARE_USER_STATUSES = Object.freeze([
  'PLANNED',
  'COMPLETED',
  'DISMISSED',
  'NOT_APPLICABLE',
]);

export const PREGNANCY_CARE_NOTE_MAX = 400;

/**
 * Authoritative source records. Fail closed: an item without a live
 * sourceRefs entry must not render.
 */
export const PREGNANCY_CARE_SOURCES = Object.freeze({
  src_who_anc_2016: Object.freeze({
    id: 'src_who_anc_2016',
    organization: 'World Health Organization',
    title: 'WHO recommendations on antenatal care for a positive pregnancy experience (2016)',
    url: 'https://www.who.int/publications/i/item/9789241549912',
    reviewedAt: '2026-09-10',
  }),
  src_who_anc_news_2016: Object.freeze({
    id: 'src_who_anc_news_2016',
    organization: 'World Health Organization',
    title: 'New guidelines on antenatal care for a positive pregnancy experience (7 November 2016)',
    url: 'https://www.who.int/news/item/07-11-2016-new-guidelines-on-antenatal-care-for-a-positive-pregnancy-experience',
    reviewedAt: '2026-09-10',
  }),
  src_who_ultrasound_2022: Object.freeze({
    id: 'src_who_ultrasound_2022',
    organization: 'World Health Organization',
    title: 'WHO antenatal care recommendations for a positive pregnancy experience. Maternal and fetal assessment update: imaging ultrasound before 24 weeks of pregnancy (2022)',
    url: 'https://www.who.int/publications/i/item/9789240046009',
    reviewedAt: '2026-09-10',
  }),
  src_nhs_antenatal: Object.freeze({
    id: 'src_nhs_antenatal',
    organization: 'NHS',
    title: 'Your antenatal care and appointments',
    url: 'https://www.nhs.uk/pregnancy/your-pregnancy-care/your-antenatal-care-and-appointments/',
    reviewedAt: '2026-09-10',
  }),
  src_nhs_12_scan: Object.freeze({
    id: 'src_nhs_12_scan',
    organization: 'NHS',
    title: '12-week scan',
    url: 'https://www.nhs.uk/pregnancy/your-pregnancy-care/12-week-scan/',
    reviewedAt: '2026-09-10',
  }),
  src_nhs_20_scan: Object.freeze({
    id: 'src_nhs_20_scan',
    organization: 'NHS',
    title: '20-week scan',
    url: 'https://www.nhs.uk/pregnancy/your-pregnancy-care/20-week-scan/',
    reviewedAt: '2026-09-10',
  }),
  src_nhs_gbs: Object.freeze({
    id: 'src_nhs_gbs',
    organization: 'NHS',
    title: 'Group B strep',
    url: 'https://www.nhs.uk/pregnancy/your-pregnancy-care/group-b-strep/',
    reviewedAt: '2026-09-10',
  }),
  src_nhs_vaccinations: Object.freeze({
    id: 'src_nhs_vaccinations',
    organization: 'NHS',
    title: 'Pregnancy vaccinations',
    url: 'https://www.nhs.uk/pregnancy/keeping-well/vaccinations/',
    reviewedAt: '2026-09-10',
  }),
  src_nice_ng201: Object.freeze({
    id: 'src_nice_ng201',
    organization: 'NICE',
    title: 'Antenatal care (NG201)',
    url: 'https://www.nice.org.uk/guidance/ng201',
    reviewedAt: '2026-09-10',
  }),
  src_acog_path_2025: Object.freeze({
    id: 'src_acog_path_2025',
    organization: 'ACOG',
    title: 'Tailored Prenatal Care Delivery for Pregnant Individuals (Clinical Consensus, April 2025)',
    url: 'https://www.acog.org/clinical/clinical-guidance/clinical-consensus/articles/2025/04/tailored-prenatal-care-delivery-for-pregnant-individuals',
    reviewedAt: '2026-09-10',
  }),
  src_acog_gdm: Object.freeze({
    id: 'src_acog_gdm',
    organization: 'ACOG',
    title: 'Gestational Diabetes',
    url: 'https://www.acog.org/womens-health/faqs/gestational-diabetes',
    reviewedAt: '2026-09-10',
  }),
  src_acog_gbs: Object.freeze({
    id: 'src_acog_gbs',
    organization: 'ACOG',
    title: 'Group B Strep and Pregnancy',
    url: 'https://www.acog.org/womens-health/faqs/group-b-strep-and-pregnancy',
    reviewedAt: '2026-09-10',
  }),
  src_acog_screening: Object.freeze({
    id: 'src_acog_screening',
    organization: 'ACOG',
    title: 'Prenatal Genetic Screening Tests',
    url: 'https://www.acog.org/womens-health/faqs/prenatal-genetic-screening-tests',
    reviewedAt: '2026-09-10',
  }),
});

function item(row) {
  return Object.freeze({
    id: row.id,
    category: row.category,
    titleKey: row.titleKey,
    descriptionKey: row.descriptionKey,
    whyKey: row.whyKey,
    startWeek: row.startWeek,
    endWeek: row.endWeek,
    timingType: row.timingType || 'WINDOW',
    sourceRefs: Object.freeze([...(row.sourceRefs || [])]),
    optional: row.optional !== false,
    regionalVariation: Boolean(row.regionalVariation),
    disclaimerKey: row.disclaimerKey || null,
  });
}

export const PREGNANCY_CARE_ITEMS = Object.freeze([
  item({
    id: 'first_booking',
    category: 'APPOINTMENT',
    titleKey: 'care_first_booking_title',
    descriptionKey: 'care_first_booking_desc',
    whyKey: 'care_first_booking_why',
    startWeek: 0,
    endWeek: 12,
    sourceRefs: ['src_who_anc_2016', 'src_who_anc_news_2016', 'src_nhs_antenatal', 'src_acog_path_2025'],
  }),
  item({
    id: 'first_trimester_labs',
    category: 'LAB',
    titleKey: 'care_first_trimester_labs_title',
    descriptionKey: 'care_first_trimester_labs_desc',
    whyKey: 'care_first_trimester_labs_why',
    startWeek: 0,
    endWeek: 12,
    sourceRefs: ['src_nhs_antenatal', 'src_nice_ng201', 'src_who_anc_2016'],
  }),
  item({
    id: 'dating_ultrasound',
    category: 'ULTRASOUND',
    titleKey: 'care_dating_ultrasound_title',
    descriptionKey: 'care_dating_ultrasound_desc',
    whyKey: 'care_dating_ultrasound_why',
    startWeek: 10,
    endWeek: 14,
    regionalVariation: true,
    sourceRefs: ['src_nhs_12_scan', 'src_nice_ng201', 'src_who_ultrasound_2022'],
  }),
  item({
    id: 'aneuploidy_screening_discussion',
    category: 'SCREENING',
    titleKey: 'care_aneuploidy_title',
    descriptionKey: 'care_aneuploidy_desc',
    whyKey: 'care_aneuploidy_why',
    startWeek: 10,
    endWeek: 16,
    regionalVariation: true,
    disclaimerKey: 'care_aneuploidy_disclaimer',
    sourceRefs: ['src_acog_screening', 'src_nhs_12_scan', 'src_nice_ng201'],
  }),
  item({
    id: 'anatomy_ultrasound',
    category: 'ULTRASOUND',
    titleKey: 'care_anatomy_ultrasound_title',
    descriptionKey: 'care_anatomy_ultrasound_desc',
    whyKey: 'care_anatomy_ultrasound_why',
    startWeek: 18,
    endWeek: 22,
    regionalVariation: true,
    sourceRefs: ['src_nhs_20_scan', 'src_nice_ng201', 'src_acog_path_2025'],
  }),
  item({
    id: 'gdm_screening_discussion',
    category: 'SCREENING',
    titleKey: 'care_gdm_title',
    descriptionKey: 'care_gdm_desc',
    whyKey: 'care_gdm_why',
    startWeek: 24,
    endWeek: 28,
    regionalVariation: true,
    disclaimerKey: 'care_gdm_disclaimer',
    sourceRefs: ['src_acog_gdm', 'src_nhs_antenatal', 'src_nice_ng201'],
  }),
  item({
    id: 'blood_group_rh_review',
    category: 'LAB',
    titleKey: 'care_rh_title',
    descriptionKey: 'care_rh_desc',
    whyKey: 'care_rh_why',
    startWeek: 26,
    endWeek: 30,
    regionalVariation: true,
    disclaimerKey: 'care_rh_disclaimer',
    sourceRefs: ['src_nhs_antenatal', 'src_nice_ng201'],
  }),
  item({
    id: 'vaccination_discussion',
    category: 'VACCINATION_DISCUSSION',
    titleKey: 'care_vaccination_title',
    descriptionKey: 'care_vaccination_desc',
    whyKey: 'care_vaccination_why',
    startWeek: 16,
    endWeek: 36,
    regionalVariation: true,
    disclaimerKey: 'care_vaccination_disclaimer',
    sourceRefs: ['src_nhs_vaccinations', 'src_who_anc_2016'],
  }),
  item({
    id: 'third_trimester_followup',
    category: 'APPOINTMENT',
    titleKey: 'care_third_trimester_title',
    descriptionKey: 'care_third_trimester_desc',
    whyKey: 'care_third_trimester_why',
    startWeek: 28,
    endWeek: 40,
    regionalVariation: true,
    sourceRefs: ['src_who_anc_2016', 'src_who_anc_news_2016', 'src_acog_path_2025'],
  }),
  item({
    id: 'gbs_screening_discussion',
    category: 'SCREENING',
    titleKey: 'care_gbs_title',
    descriptionKey: 'care_gbs_desc',
    whyKey: 'care_gbs_why',
    startWeek: 35,
    endWeek: 38,
    regionalVariation: true,
    disclaimerKey: 'care_gbs_disclaimer',
    sourceRefs: ['src_acog_gbs', 'src_nhs_gbs'],
  }),
  item({
    id: 'birth_planning',
    category: 'BIRTH_PLANNING',
    titleKey: 'care_birth_planning_title',
    descriptionKey: 'care_birth_planning_desc',
    whyKey: 'care_birth_planning_why',
    startWeek: 28,
    endWeek: 40,
    sourceRefs: ['src_nhs_antenatal', 'src_nice_ng201'],
  }),
  item({
    id: 'postpartum_newborn_prep',
    category: 'EDUCATION',
    titleKey: 'care_postpartum_title',
    descriptionKey: 'care_postpartum_desc',
    whyKey: 'care_postpartum_why',
    startWeek: 32,
    endWeek: 40,
    sourceRefs: ['src_nhs_antenatal', 'src_who_anc_2016'],
  }),
]);

export function pregnancyCareSourceById(id) {
  return PREGNANCY_CARE_SOURCES[id] || null;
}

export function isRenderableCareItem(row) {
  if (!row || typeof row.id !== 'string' || !row.id) return false;
  if (!PREGNANCY_CARE_CATEGORIES.includes(row.category)) return false;
  if (!Number.isInteger(row.startWeek) || !Number.isInteger(row.endWeek)) return false;
  if (row.startWeek < 0 || row.endWeek < row.startWeek || row.endWeek > 42) return false;
  if (!row.titleKey || !row.descriptionKey || !row.whyKey) return false;
  if (!Array.isArray(row.sourceRefs) || row.sourceRefs.length < 1) return false;
  for (const ref of row.sourceRefs) {
    const src = pregnancyCareSourceById(ref);
    if (!src) return false;
    if (!src.organization || !src.title || !src.reviewedAt || !src.url) return false;
  }
  return true;
}

export function pregnancyCareItemById(id) {
  return PREGNANCY_CARE_ITEMS.find((row) => row.id === id) || null;
}

export function renderablePregnancyCareItems() {
  return PREGNANCY_CARE_ITEMS.filter(isRenderableCareItem);
}

/**
 * Planner timing vs frozen completed week. Null when dating is not
 * personalizable (reviewRequired / missing week). Not a health alert.
 */
export function careWindowRelation({ week, startWeek, endWeek, reviewRequired } = {}) {
  if (reviewRequired) return null;
  if (!Number.isInteger(week) || week < 0) return null;
  if (!Number.isInteger(startWeek) || !Number.isInteger(endWeek)) return null;
  if (week < startWeek) return 'BEFORE_WINDOW';
  if (week > endWeek) return 'AFTER_WINDOW';
  return 'IN_WINDOW';
}

export function isCivilDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function plannedDateOutsideWindow({ plannedDate, relation } = {}) {
  return Boolean(plannedDate) && (relation === 'BEFORE_WINDOW' || relation === 'AFTER_WINDOW');
}
