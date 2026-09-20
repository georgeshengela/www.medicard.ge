const MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];

/** Georgian months even on runtimes whose Intl locale data does not include ka-GE. */
export function formatRunDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'თარიღი უცნობია';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
