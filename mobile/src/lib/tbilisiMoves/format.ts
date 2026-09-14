export function formatKaInt(value: number) {
  return new Intl.NumberFormat('ka-GE').format(Math.max(0, Math.round(value)));
}

const KA_MONTHS = [
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
];

export function formatYmdKa(ymd: string) {
  const [year, month, day] = ymd.split('-').map(Number);
  if (!year || !month || !day) return ymd;
  return `${day} ${KA_MONTHS[month - 1]}, ${year}`;
}

export function formatGoalPct(ratio: number) {
  const pct = Math.round(ratio * 1000) / 10;
  if (Number.isInteger(pct)) return String(pct);
  return pct.toFixed(1).replace(/\.0$/, '');
}

export function initialsFromHandle(handle: string | null | undefined) {
  const text = String(handle || '').trim();
  if (!text) return '—';
  const parts = text.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}
