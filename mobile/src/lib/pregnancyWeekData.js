/**
 * Canonical pregnancy week development catalog (Phase 19).
 * Educational averages only. Does not date a pregnancy and does not diagnose.
 *
 * Length 5–18: Hadlock 1992 CRL (LMP), 1-decimal cm.
 * Length 19: omitted (CRL → crown-heel switch; no interpolation).
 * Length 20–40: Williams Obstetrics LMP crown-heel anchors, linear interpolate, whole cm.
 * Weight 14–40: WHO Fetal Growth Charts 2017 Table 11, 50th percentile, sexes combined, grams.
 * Weeks 1–3: informational, no size. Week 4: poppy-seed analogy, no cm/g.
 *
 * Week numbering matches Phase 18: completed weeks = floor(elapsed/7).
 * 8 weeks + 6 days → catalog week 8.
 */

export const PREGNANCY_WEEK_DATA_VERSION = '1.0.0';
export const PREGNANCY_WEEK_SOURCE_VERSION = 'hadlock1992-who2017-williams-chl';
export const PREGNANCY_WEEK_REVIEW_DATE = '2026-09-09';
export const PREGNANCY_WEEK_CATALOG_MIN = 1;
export const PREGNANCY_WEEK_CATALOG_MAX = 40;
export const PREGNANCY_WEEK_SIZE_MIN = 5;
export const PREGNANCY_WEEK_CRL_MAX = 18;
export const PREGNANCY_WEEK_CHL_MIN = 20;

/** Hadlock 1992 CRL (cm) at completed LMP weeks. Educational 1-decimal rounding of published table. */
export const HADLOCK_CRL_CM = Object.freeze({
  5: 0.2,
  6: 0.5,
  7: 0.9,
  8: 1.4,
  9: 2.3,
  10: 3.3,
  11: 4.4,
  12: 5.6,
  13: 6.8,
  14: 8.0,
  15: 9.0,
  16: 10.0,
  17: 11.0,
  18: 12.0,
});

/** Raw published Hadlock CRL (cm) before educational rounding — provenance only. */
/** Raw Hadlock 1992 CRL-by-GA (cm) as reprinted in Hologic Obstetrical References. */
export const HADLOCK_CRL_CM_RAW = Object.freeze({
  5: 0.222017,
  6: 0.458221,
  7: 0.853455,
  8: 1.44749,
  9: 2.25575,
  10: 3.25926,
  11: 4.40564,
  12: 5.62178,
  13: 6.83319,
  14: 7.98308,
  15: 9.04534,
  16: 10.03,
  17: 10.9826,
  18: 11.9826,
});

/** WHO 2017 Table 11 EFW 50th percentile, sexes combined (grams). Starts week 14. */
export const WHO_EFW_P50_G = Object.freeze({
  14: 90,
  15: 114,
  16: 144,
  17: 179,
  18: 222,
  19: 272,
  20: 330,
  21: 398,
  22: 476,
  23: 565,
  24: 665,
  25: 778,
  26: 902,
  27: 1039,
  28: 1189,
  29: 1350,
  30: 1523,
  31: 1707,
  32: 1901,
  33: 2103,
  34: 2312,
  35: 2527,
  36: 2745,
  37: 2966,
  38: 3186,
  39: 3403,
  40: 3617,
});

/** Williams Obstetrics classic LMP crown-heel length anchors (cm). */
export const WILLIAMS_CHL_ANCHORS = Object.freeze([
  Object.freeze([20, 25]),
  Object.freeze([24, 30]),
  Object.freeze([28, 35]),
  Object.freeze([32, 40]),
  Object.freeze([36, 45]),
  Object.freeze([40, 50]),
]);

export const COMPARISON_KEYS = Object.freeze([
  'poppy_seed',
  'sesame',
  'blueberry',
  'raspberry',
  'strawberry',
  'lime',
  'lemon',
  'kiwi',
  'avocado',
  'pear',
  'mango',
  'banana',
  'eggplant',
  'coconut',
  'pineapple',
  'watermelon',
]);

export const DEVELOPMENT_FACT_KEYS = Object.freeze([
  'informational_dating',
  'microscopic_scale',
  'neural_fold_forming',
  'heart_tube_forming',
  'limb_buds_appearing',
  'body_shape_forming',
  'limb_structures_forming',
  'facial_features_forming',
  'fingers_forming',
  'major_organs_forming',
  'fetal_period_begins',
  'organs_in_place',
  'ossification_beginning',
  'skin_thin',
  'movement_developing',
  'ears_in_position',
  'lung_airways_branching',
  'vernix_forming',
  'hearing_structures_present',
  'hair_appearing',
  'skin_less_transparent',
  'lungs_continuing',
  'eyes_can_open',
  'fat_accumulating',
  'bones_hardening',
  'lungs_maturing',
  'term_window',
]);

const COMPARISON_BY_WEEK = Object.freeze({
  4: 'poppy_seed',
  5: 'sesame',
  6: 'sesame',
  7: 'blueberry',
  8: 'raspberry',
  9: 'raspberry',
  10: 'strawberry',
  11: 'lime',
  12: 'lime',
  13: 'lemon',
  14: 'kiwi',
  15: 'kiwi',
  16: 'avocado',
  17: 'pear',
  18: 'mango',
  20: 'banana',
  21: 'banana',
  22: 'banana',
  23: 'banana',
  24: 'coconut',
  25: 'coconut',
  26: 'coconut',
  27: 'coconut',
  28: 'eggplant',
  29: 'eggplant',
  30: 'pineapple',
  31: 'pineapple',
  32: 'pineapple',
  33: 'pineapple',
  34: 'pineapple',
  35: 'pineapple',
  36: 'watermelon',
  37: 'watermelon',
  38: 'watermelon',
  39: 'watermelon',
  40: 'watermelon',
});

const FACTS_BY_WEEK = Object.freeze({
  1: ['informational_dating', 'microscopic_scale'],
  2: ['informational_dating', 'microscopic_scale'],
  3: ['informational_dating', 'microscopic_scale'],
  4: ['microscopic_scale', 'informational_dating'],
  5: ['neural_fold_forming', 'heart_tube_forming'],
  6: ['heart_tube_forming', 'limb_buds_appearing'],
  7: ['limb_buds_appearing', 'body_shape_forming'],
  8: ['limb_structures_forming', 'facial_features_forming'],
  9: ['fingers_forming', 'facial_features_forming'],
  10: ['major_organs_forming', 'fingers_forming'],
  11: ['fetal_period_begins', 'organs_in_place'],
  12: ['organs_in_place', 'facial_features_forming'],
  13: ['organs_in_place', 'ossification_beginning'],
  14: ['ossification_beginning', 'movement_developing'],
  15: ['ossification_beginning', 'movement_developing'],
  16: ['ossification_beginning', 'skin_thin', 'movement_developing'],
  17: ['movement_developing', 'skin_thin'],
  18: ['ears_in_position', 'movement_developing'],
  19: ['ears_in_position', 'lung_airways_branching'],
  20: ['lung_airways_branching', 'vernix_forming', 'hearing_structures_present'],
  21: ['hearing_structures_present', 'vernix_forming'],
  22: ['hair_appearing', 'skin_less_transparent'],
  23: ['hair_appearing', 'lungs_continuing'],
  24: ['skin_less_transparent', 'lungs_continuing'],
  25: ['lungs_continuing', 'skin_less_transparent'],
  26: ['lungs_continuing', 'fat_accumulating'],
  27: ['eyes_can_open', 'lungs_continuing'],
  28: ['eyes_can_open', 'fat_accumulating'],
  29: ['fat_accumulating', 'lungs_continuing'],
  30: ['fat_accumulating', 'bones_hardening'],
  31: ['fat_accumulating', 'lungs_maturing'],
  32: ['bones_hardening', 'fat_accumulating'],
  33: ['lungs_maturing', 'fat_accumulating'],
  34: ['lungs_maturing', 'bones_hardening'],
  35: ['lungs_maturing', 'fat_accumulating'],
  36: ['lungs_maturing', 'fat_accumulating'],
  37: ['term_window', 'lungs_maturing'],
  38: ['term_window', 'fat_accumulating'],
  39: ['term_window', 'lungs_maturing'],
  40: ['term_window', 'lungs_maturing'],
});

export function williamsCrownHeelCm(week) {
  const n = Number(week);
  if (!Number.isInteger(n) || n < PREGNANCY_WEEK_CHL_MIN || n > PREGNANCY_WEEK_CATALOG_MAX) {
    return null;
  }
  const anchors = WILLIAMS_CHL_ANCHORS;
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const [w0, l0] = anchors[i];
    const [w1, l1] = anchors[i + 1];
    if (n >= w0 && n <= w1) {
      const t = (n - w0) / (w1 - w0);
      return Math.round(l0 + t * (l1 - l0));
    }
  }
  return 50;
}

function freezeWeek(row) {
  return Object.freeze({
    week: row.week,
    kind: row.kind,
    comparisonKey: row.comparisonKey,
    lengthCm: row.lengthCm,
    weightGrams: row.weightGrams,
    measurementType: row.measurementType,
    developmentFactKeys: Object.freeze(row.developmentFactKeys.slice()),
    illustrationKey: row.illustrationKey,
  });
}

function buildCatalog() {
  const rows = [];
  for (let week = 1; week <= PREGNANCY_WEEK_CATALOG_MAX; week += 1) {
    if (week <= 3) {
      rows.push(
        freezeWeek({
          week,
          kind: 'informational',
          comparisonKey: null,
          lengthCm: null,
          weightGrams: null,
          measurementType: null,
          developmentFactKeys: FACTS_BY_WEEK[week],
          illustrationKey: null,
        }),
      );
      continue;
    }
    if (week === 4) {
      rows.push(
        freezeWeek({
          week,
          kind: 'analogy',
          comparisonKey: COMPARISON_BY_WEEK[4],
          lengthCm: null,
          weightGrams: null,
          measurementType: null,
          developmentFactKeys: FACTS_BY_WEEK[4],
          illustrationKey: COMPARISON_BY_WEEK[4],
        }),
      );
      continue;
    }
    if (week === 19) {
      rows.push(
        freezeWeek({
          week,
          kind: 'catalog',
          comparisonKey: null,
          lengthCm: null,
          weightGrams: WHO_EFW_P50_G[19],
          measurementType: null,
          developmentFactKeys: FACTS_BY_WEEK[19],
          illustrationKey: null,
        }),
      );
      continue;
    }
    const crl = HADLOCK_CRL_CM[week];
    const chl = williamsCrownHeelCm(week);
    const measurementType = crl != null ? 'CRL' : chl != null ? 'CHL' : null;
    const lengthCm = crl != null ? crl : chl;
    rows.push(
      freezeWeek({
        week,
        kind: 'catalog',
        comparisonKey: COMPARISON_BY_WEEK[week] || null,
        lengthCm,
        weightGrams: WHO_EFW_P50_G[week] ?? null,
        measurementType,
        developmentFactKeys: FACTS_BY_WEEK[week],
        illustrationKey: COMPARISON_BY_WEEK[week] || null,
      }),
    );
  }
  return Object.freeze(rows);
}

export const PREGNANCY_WEEK_CATALOG = buildCatalog();

const BY_WEEK = new Map(PREGNANCY_WEEK_CATALOG.map((row) => [row.week, row]));

function withMeta(row, extra = {}) {
  if (!row) return null;
  return {
    ...row,
    developmentFactKeys: [...row.developmentFactKeys],
    dataVersion: PREGNANCY_WEEK_DATA_VERSION,
    sourceVersion: PREGNANCY_WEEK_SOURCE_VERSION,
    reviewDate: PREGNANCY_WEEK_REVIEW_DATE,
    beyondCatalog: false,
    ...extra,
  };
}

/**
 * Catalog lookup by completed gestational week. No dating math.
 * Weeks below 1 or non-integers → null.
 * Weeks above 40 → week 40 payload + beyondCatalog.
 */
export function weekDevelopmentForCompletedWeek(week) {
  const n = Number(week);
  if (!Number.isInteger(n) || n < 0) return null;
  if (n === 0) {
    return withMeta({
      week: 0,
      kind: 'informational',
      comparisonKey: null,
      lengthCm: null,
      weightGrams: null,
      measurementType: null,
      developmentFactKeys: ['informational_dating', 'microscopic_scale'],
      illustrationKey: null,
    });
  }
  if (n > PREGNANCY_WEEK_CATALOG_MAX) {
    const last = BY_WEEK.get(PREGNANCY_WEEK_CATALOG_MAX);
    return withMeta(last, { beyondCatalog: true, requestedWeek: n });
  }
  const row = BY_WEEK.get(n);
  return withMeta(row);
}

/**
 * Attach catalog data to an existing Phase 18 dating object.
 * Uses estimatedGestationalAge.week only — does not recompute gestational age.
 */
export function attachWeekDevelopment(dating) {
  if (!dating || dating.reviewRequired) return null;
  const age = dating.estimatedGestationalAge;
  if (!age || !Number.isInteger(age.week)) return null;
  return weekDevelopmentForCompletedWeek(age.week);
}

export function formatLengthCm(lengthCm) {
  if (lengthCm == null || !Number.isFinite(lengthCm)) return null;
  if (lengthCm >= 10 || Number.isInteger(lengthCm)) return String(Math.round(lengthCm));
  return String(Math.round(lengthCm * 10) / 10);
}

export function formatWeightGrams(weightGrams) {
  if (weightGrams == null || !Number.isFinite(weightGrams)) return null;
  if (weightGrams >= 1000) {
    const kg = Math.round((weightGrams / 1000) * 10) / 10;
    return { value: kg, unit: 'kg' };
  }
  return { value: Math.round(weightGrams), unit: 'g' };
}

export function catalogWeekNumbers() {
  return PREGNANCY_WEEK_CATALOG.map((row) => row.week);
}

export function milestoneWeeks() {
  return Object.freeze([4, 8, 12, 16, 20, 24, 28, 32, 36, 40]);
}
