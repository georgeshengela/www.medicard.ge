// WHO growth z-scores for MEDIFAMILY (LMS method, WHO Child Growth Standards 0–5 y + WHO 2007 reference
// 5–19 y). The app never ranks a child against others in words: it says whether the child follows their
// own line and only flags WHO cut-offs or a sharp change of line, with a calm next step.
import { WHO_0_5, WHO_5_19 } from './whoGrowthData.js';
import { DAYS_PER_MONTH, correctedAgeDays, daysBetween } from './age.js';

export const INDICATORS = Object.freeze(['wfa', 'lhfa', 'hcfa', 'bfa']);
/** WHO: below 731 days length is measured lying down; a standing height there gets +0.7 cm and vice versa. */
export const LENGTH_HEIGHT_SWITCH_DAYS = 731;
export const POSITION_ADJUST_CM = 0.7;
/** Percentile lines drawn on the charts (z for 3rd, 15th, 50th, 85th, 97th). */
export const CURVE_Z = Object.freeze({ p3: -1.8808, p15: -1.0364, p50: 0, p85: 1.0364, p97: 1.8808 });
/** One "centile space" on WHO/UK charts ≈ 0.67 z; crossing two of them is worth a doctor's look. */
export const TREND_DELTA_Z = 1.34;
export const TREND_MIN_GAP_DAYS = 56;

const MAX_DAYS = Object.freeze({ wfa: 120 * DAYS_PER_MONTH, lhfa: 228 * DAYS_PER_MONTH, hcfa: 1826, bfa: 228 * DAYS_PER_MONTH });
const MIN_DAYS = Object.freeze({ wfa: 0, lhfa: 0, hcfa: 0, bfa: 731 });
const WEIGHT_BASED = new Set(['wfa', 'bfa']);

function parseRows(text, scale = 1) {
  return text.split(';').map((row) => {
    const [age, l, m, s] = row.split(',').map(Number);
    return [age * scale, l, m, s];
  });
}

const TABLES = {};
for (const indicator of INDICATORS) {
  TABLES[indicator] = {};
  for (const sex of ['M', 'F']) {
    const young = WHO_0_5[indicator]?.[sex] ? parseRows(WHO_0_5[indicator][sex]) : [];
    const older = WHO_5_19[indicator]?.[sex] ? parseRows(WHO_5_19[indicator][sex], DAYS_PER_MONTH) : [];
    TABLES[indicator][sex] = [...young, ...older].sort((a, b) => a[0] - b[0]);
  }
}

function sexKey(sex) {
  return sex === 'MALE' || sex === 'M' ? 'M' : 'F';
}

export function indicatorCovers(indicator, ageDays) {
  return ageDays >= MIN_DAYS[indicator] && ageDays <= MAX_DAYS[indicator];
}

/** L, M, S at an age in days, linearly interpolated; the length (≤730) and height (≥731) rows never mix. */
export function lmsAt(indicator, sex, ageDays) {
  const rows = TABLES[indicator]?.[sexKey(sex)];
  if (!rows?.length || !indicatorCovers(indicator, ageDays)) return null;
  let usable = rows;
  if (indicator === 'lhfa') usable = ageDays < LENGTH_HEIGHT_SWITCH_DAYS ? rows.filter((r) => r[0] < LENGTH_HEIGHT_SWITCH_DAYS) : rows.filter((r) => r[0] >= LENGTH_HEIGHT_SWITCH_DAYS);
  if (ageDays <= usable[0][0]) return { L: usable[0][1], M: usable[0][2], S: usable[0][3] };
  const last = usable[usable.length - 1];
  if (ageDays >= last[0]) return { L: last[1], M: last[2], S: last[3] };
  let hi = usable.findIndex((r) => r[0] >= ageDays);
  const b = usable[hi];
  if (b[0] === ageDays) return { L: b[1], M: b[2], S: b[3] };
  const a = usable[hi - 1];
  const f = (ageDays - a[0]) / (b[0] - a[0]);
  return { L: a[1] + f * (b[1] - a[1]), M: a[2] + f * (b[2] - a[2]), S: a[3] + f * (b[3] - a[3]) };
}

export function valueAtZ({ L, M, S }, z) {
  if (Math.abs(L) < 1e-9) return M * Math.exp(S * z);
  return M * (1 + L * S * z) ** (1 / L);
}

/** WHO z-score; weight-based indicators use WHO's restricted extrapolation beyond ±3. */
export function zFromLms(value, lms, indicator) {
  const { L, M, S } = lms;
  let z = Math.abs(L) < 1e-9 ? Math.log(value / M) / S : ((value / M) ** L - 1) / (L * S);
  if (WEIGHT_BASED.has(indicator)) {
    if (z > 3) {
      const sd3 = valueAtZ(lms, 3);
      z = 3 + (value - sd3) / (sd3 - valueAtZ(lms, 2));
    } else if (z < -3) {
      const sd3 = valueAtZ(lms, -3);
      z = -3 + (value - sd3) / (valueAtZ(lms, -2) - sd3);
    }
  }
  return z;
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

export function percentileFromZ(z) {
  const p = normalCdf(z) * 100;
  if (p < 0.1) return 0.1;
  if (p > 99.9) return 99.9;
  return Math.round(p * 10) / 10;
}

/** Implausible per WHO flags — almost always a typo (kg vs g, cm vs mm). */
export function isImplausible(indicator, z) {
  if (indicator === 'wfa') return z < -6 || z > 5;
  if (indicator === 'lhfa') return Math.abs(z) > 6;
  return Math.abs(z) > 5;
}

/**
 * Category of one value. Tone: ok (inside WHO's normal band), info (worth knowing), watch (show the
 * pediatrician at the next visit), alert (see the pediatrician soon). Never "bad", never a rank.
 */
export function classify(indicator, z, ageDays) {
  if (isImplausible(indicator, z)) return { status: 'check', tone: 'watch' };
  if (indicator === 'wfa') {
    if (z < -3) return { status: 'very_low', tone: 'alert' };
    if (z < -2) return { status: 'low', tone: 'watch' };
    if (z > 3) return { status: 'very_high', tone: 'watch' };
    if (z > 2) return { status: 'high', tone: 'info' };
    return { status: 'normal', tone: 'ok' };
  }
  if (indicator === 'lhfa') {
    if (z < -3) return { status: 'very_low', tone: 'alert' };
    if (z < -2) return { status: 'low', tone: 'watch' };
    if (z > 3) return { status: 'very_high', tone: 'watch' };
    return { status: 'normal', tone: 'ok' };
  }
  if (indicator === 'hcfa') {
    if (z < -3 || z > 3) return { status: z < 0 ? 'very_low' : 'very_high', tone: 'alert' };
    if (z < -2 || z > 2) return { status: z < 0 ? 'low' : 'high', tone: 'watch' };
    return { status: 'normal', tone: 'ok' };
  }
  // bfa: WHO under-five cut-offs (risk > +1, overweight > +2, obesity > +3) vs 5–19 (overweight > +1,
  // obesity > +2, thinness < −2).
  const under5 = ageDays < 1826;
  if (z < -3) return { status: 'very_thin', tone: 'alert' };
  if (z < -2) return { status: 'thin', tone: 'watch' };
  if (under5) {
    if (z > 3) return { status: 'obese', tone: 'watch' };
    if (z > 2) return { status: 'overweight', tone: 'watch' };
    if (z > 1) return { status: 'risk_overweight', tone: 'info' };
  } else {
    if (z > 2) return { status: 'obese', tone: 'watch' };
    if (z > 1) return { status: 'overweight', tone: 'info' };
  }
  return { status: 'normal', tone: 'ok' };
}

const NOTES = {
  normal: ['ჯანმოს ნორმის ფარგლებშია.', 'Within the WHO normal range.'],
  check: ['ძალიან უჩვეულო მნიშვნელობაა — გადაამოწმე, სწორად ხომ არ ჩაიწერა (კგ / სმ).', 'Very unusual value — check it was entered right (kg / cm).'],
  very_low: ['ნორმაზე საგრძნობლად დაბალია — უახლოეს დღეებში აჩვენე პედიატრს.', 'Well below the normal range — show your pediatrician in the next few days.'],
  low: ['ნორმის ქვედა ზღვარს ქვემოთაა — შემდეგ ვიზიტზე აჩვენე პედიატრს.', 'Below the normal range — show your pediatrician at the next visit.'],
  high: ['ნორმის ზედა ზღვარს ზემოთაა — სიმაღლესთან ერთად შეაფასე (BMI).', 'Above the normal range — judge it together with height (BMI).'],
  very_high: ['ნორმაზე საგრძნობლად მაღალია — აჩვენე პედიატრს.', 'Well above the normal range — show your pediatrician.'],
  thin: ['წონა სიმაღლესთან შედარებით დაბალია — აჩვენე პედიატრს.', 'Weight is low for height — show your pediatrician.'],
  very_thin: ['წონა სიმაღლესთან შედარებით ძალიან დაბალია — უახლოეს დღეებში ექიმთან.', 'Weight is very low for height — see a doctor in the next few days.'],
  risk_overweight: ['ზედა ზღვართან ახლოსაა — ღირს კვებასა და მოძრაობაზე ყურადღება.', 'Close to the upper limit — worth an eye on food and movement.'],
  overweight: ['ჭარბი წონის ზონაშია — მოძრაობა და ოჯახის კვება უფრო მეტს შველის, ვიდრე დიეტა. აჩვენე პედიატრს.', 'In the overweight range — family meals and movement help more than diets. Show your pediatrician.'],
  obese: ['სიმსუქნის ზონაშია — პედიატრთან ერთად დაგეგმე ნაბიჯები, ბავშვს დიეტაზე ნუ დასვამ.', 'In the obesity range — plan steps with your pediatrician; don\'t put the child on a diet.'],
};

export function growthNote(status, lang = 'ka') {
  const pair = NOTES[status] || NOTES.normal;
  return lang === 'en' ? pair[1] : pair[0];
}

function adjustedHeight(heightCm, ageDays, position) {
  const pos = position || (ageDays < LENGTH_HEIGHT_SWITCH_DAYS ? 'LYING' : 'STANDING');
  if (ageDays < LENGTH_HEIGHT_SWITCH_DAYS && pos === 'STANDING') return heightCm + POSITION_ADJUST_CM;
  if (ageDays >= LENGTH_HEIGHT_SWITCH_DAYS && pos === 'LYING') return heightCm - POSITION_ADJUST_CM;
  return heightCm;
}

/**
 * Scores of one measurement. Growth uses the corrected age for children born early (until 2 years).
 * Returns { ageDays, entries: { wfa?, lhfa?, hcfa?, bfa? } } with value, z, percentile, status, tone.
 */
export function scoreMeasurement({ birthYmd, sex, gestationWeeks, measuredOn, weightKg, heightCm, headCm, position }) {
  const chrono = daysBetween(birthYmd, measuredOn);
  const ageDays = correctedAgeDays(chrono, gestationWeeks);
  const entries = {};
  const add = (indicator, value) => {
    if (!(value > 0) || !indicatorCovers(indicator, ageDays)) return;
    const lms = lmsAt(indicator, sex, ageDays);
    if (!lms) return;
    const z = zFromLms(value, lms, indicator);
    if (!Number.isFinite(z)) return;
    entries[indicator] = { value: Math.round(value * 100) / 100, z: Math.round(z * 100) / 100, percentile: percentileFromZ(z), ...classify(indicator, z, ageDays) };
  };
  add('wfa', Number(weightKg));
  if (heightCm > 0) add('lhfa', adjustedHeight(Number(heightCm), ageDays, position));
  add('hcfa', Number(headCm));
  if (weightKg > 0 && heightCm > 0) {
    const h = adjustedHeight(Number(heightCm), ageDays, position) / 100;
    add('bfa', Number(weightKg) / (h * h));
  }
  return { ageDays, chronoDays: chrono, entries };
}

/** Change of line between the latest point and an earlier one ≥ 8 weeks before (newborn weeks skipped). */
export function growthTrend(points) {
  const usable = (points || []).filter((p) => Number.isFinite(p.z) && p.ageDays >= 14).sort((a, b) => a.ageDays - b.ageDays);
  if (usable.length < 2) return null;
  const latest = usable[usable.length - 1];
  const earlier = [...usable].reverse().find((p) => latest.ageDays - p.ageDays >= TREND_MIN_GAP_DAYS);
  if (!earlier) return null;
  const delta = Math.round((latest.z - earlier.z) * 100) / 100;
  if (delta <= -TREND_DELTA_Z) return { direction: 'falling', delta, sinceDays: latest.ageDays - earlier.ageDays };
  if (delta >= TREND_DELTA_Z) return { direction: 'rising', delta, sinceDays: latest.ageDays - earlier.ageDays };
  return { direction: 'steady', delta, sinceDays: latest.ageDays - earlier.ageDays };
}

/** The chart window for a child: 0–2 years, then 0–5 years, then 5–19 years. */
export function chartWindow(indicator, ageDays) {
  const min = MIN_DAYS[indicator];
  const max = MAX_DAYS[indicator];
  let from = 0;
  let to = 730;
  if (ageDays > 700) to = 1826;
  if (ageDays > 1790) { from = 1826; to = Math.min(max, Math.max(ageDays + 3 * 365, 10 * 365.25)); }
  from = Math.max(from, min);
  to = Math.min(to, max);
  return from < to ? { from, to } : null;
}

/** Percentile lines for the chart, one point per table row inside the window (plus both ends). */
export function growthCurves(indicator, sex, window) {
  if (!window) return null;
  const rows = (TABLES[indicator]?.[sexKey(sex)] || []).map((r) => r[0]).filter((d) => d > window.from && d < window.to);
  const ages = [window.from, ...rows, window.to];
  const lines = {};
  for (const [key, z] of Object.entries(CURVE_Z)) {
    lines[key] = ages.map((d) => {
      const lms = lmsAt(indicator, sex, d);
      return lms ? [Math.round(d), Math.round(valueAtZ(lms, z) * 100) / 100] : null;
    }).filter(Boolean);
  }
  return lines;
}
