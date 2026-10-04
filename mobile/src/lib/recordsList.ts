import { isEn, tx } from '@/i18n/locale';

const KA_SHORT = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const EN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KA_MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** „სექ“ / „Sep“ for a 0-based month. */
export function shortMonth(index: number): string {
  return (isEn() ? EN_SHORT : KA_SHORT)[index] ?? '';
}

/** `YYYY-MM-DD` → „31 აგვ“ / „Aug 31“ (chart axes, compact rows). */
export function shortYmd(ymd: string): string {
  const [, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  if (!m || !d || m > 12) return ymd;
  return isEn() ? `${EN_SHORT[m - 1]} ${d}` : `${d} ${KA_SHORT[m - 1]}`;
}

const pad = (n: number) => String(n).padStart(2, '0');
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 86_400_000;

/** Right-hand date of a list row, the way Mail shows it: „09:40“ today, „გუშინ“, „22 სექ“, „22 სექ 2025“. */
export function listDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (days <= 0) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (days === 1) return tx('გუშინ', 'Yesterday');
  const month = (isEn() ? EN_SHORT : KA_SHORT)[date.getMonth()];
  const sameYear = date.getFullYear() === now.getFullYear();
  if (isEn()) return sameYear ? `${month} ${date.getDate()}` : `${month} ${date.getDate()}, ${date.getFullYear()}`;
  return sameYear ? `${date.getDate()} ${month}` : `${date.getDate()} ${month} ${date.getFullYear()}`;
}

/** Group heading: „დღეს“, „ბოლო 7 დღე“, then the month („სექტემბერი“, „აგვისტო 2025“ in another year). */
export function periodLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (days <= 0) return tx('დღეს', 'Today');
  if (days < 7) return tx('ბოლო 7 დღე', 'Last 7 days');
  const month = (isEn() ? EN_MONTHS : KA_MONTHS)[date.getMonth()];
  return date.getFullYear() === now.getFullYear() ? month : `${month} ${date.getFullYear()}`;
}

/** Newest first, cut into consecutive period groups. */
export function groupByPeriod<T>(items: T[], at: (item: T) => string, now = new Date()): { label: string; items: T[] }[] {
  const sorted = [...items].sort((a, b) => at(b).localeCompare(at(a)));
  const groups: { label: string; items: T[] }[] = [];
  for (const item of sorted) {
    const label = periodLabel(at(item), now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

/** First readable sentence of the Markdown analysis, for the list preview. */
export function plainSummary(markdown: string): string {
  const line = (markdown || '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('-') && !l.startsWith('|'));

  if (!line) return '';
  const clean = line.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1').replace(/[*`>]/g, '');
  return clean.length <= 160 ? clean : `${clean.slice(0, 157)}…`;
}
