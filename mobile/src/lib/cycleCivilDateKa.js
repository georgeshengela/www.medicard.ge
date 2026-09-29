/**
 * Spoken / visible civil-date formatter (Georgian by default, English for English users).
 * Civil YYYY-MM-DD in; day + month + year out. No timezone shift.
 * The exported name stays `formatCycleDateKa` for existing callers; it follows the app language.
 */
import { isEn } from '../i18n/locale.js';

const MONTHS_KA = Object.freeze([
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
]);

const MONTHS_EN = Object.freeze([
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]);

/** Format a civil date in the given language (`'ka'` | `'en'`); defaults to the app language. */
export function formatCycleCivilDate(ymd, lang) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))) return ymd;
  const [y, m, d] = String(ymd).split('-');
  const en = lang ? lang === 'en' : isEn();
  const months = en ? MONTHS_EN : MONTHS_KA;
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

export function formatCycleDateKa(ymd) {
  return formatCycleCivilDate(ymd);
}
