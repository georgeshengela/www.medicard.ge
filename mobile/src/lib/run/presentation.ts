import { isEn, tx } from '../../i18n/locale.js';

const MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Georgian months even on runtimes whose Intl locale data does not include ka-GE. */
export function formatRunDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return tx('თარიღი უცნობია', 'Date unknown');
  if (isEn()) return `${date.getDate()} ${MONTHS_EN[date.getMonth()]} ${date.getFullYear()}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
