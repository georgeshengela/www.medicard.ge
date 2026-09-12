/**
 * Spoken / visible Georgian civil-date formatter.
 * Civil YYYY-MM-DD in; Georgian day + month + year out. No timezone shift.
 */

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

export function formatCycleDateKa(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ''))) return ymd;
  const [y, m, d] = String(ymd).split('-');
  return `${Number(d)} ${MONTHS_KA[Number(m) - 1]} ${y}`;
}
