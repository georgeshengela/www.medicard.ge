/**
 * MEDIBOOK formatting — pure. Every clock and day is the business's own: Georgia, a fixed UTC+4 (the server's
 * `lib/book/time.js` and the web's `tbilisi()` use the same rule) — never the phone's zone. The slots arrive as
 * Tbilisi labels („11:30“), so the summary, the done card, the hub, the appointment page, the cancel dialog, Home
 * and the local reminder text must say the same time whatever zone the phone is in: a person booking from Belgium
 * picked „11:30“ and read „ხვალ · 09:30“ before. Calendar exports and reminder triggers stay real instants.
 *
 * Two kinds of value travel here: an instant (ISO string / Date — `startsAt`, `endsAt`, now) and a civil day
 * (`YYYY-MM-DD` from the day strip, `fromDate`, `date` params). A civil day is read as it is; an instant is shifted
 * by +4 h and read through its UTC fields.
 */
import { isEn, tx } from '../../i18n/locale.js';
const en = () => isEn();
import type { BookAppointment, BookAppointmentStatus, BookHours } from './bookTypes';

const KA_MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KA_DAYS = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KA_DAYS_LONG = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
const EN_DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Georgia has kept UTC+4 all year since 2005, so a fixed offset is exact and needs no tz database. */
export const TBILISI_OFFSET_MS = 4 * 3600_000;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');

type Instant = string | number | Date;

/** The instant shifted so that its UTC fields read as Tbilisi wall-clock fields. */
export function tbilisi(at: Instant): Date {
  const ms = at instanceof Date ? at.getTime() : typeof at === 'number' ? at : new Date(at).getTime();
  return new Date(ms + TBILISI_OFFSET_MS);
}

/** `YYYY-MM-DD` of an instant (default: now) in Tbilisi. */
export function tbilisiYmd(at: Instant = new Date()): string {
  return tbilisi(at).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday of an instant (default: now) in Tbilisi. */
export function tbilisiWeekday(at: Instant = new Date()): number {
  return tbilisi(at).getUTCDay();
}

/** `HH:mm` of an instant in Tbilisi — the same label the server's slots carry. */
export function clockOf(at: Instant): string {
  const d = tbilisi(at);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Civil-day arithmetic on `YYYY-MM-DD`, free of any zone (and of the phone's DST days). */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Weekday (0 = Sunday) of a `YYYY-MM-DD`. */
export function weekdayOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Days between two `YYYY-MM-DD` (b − a). */
export function daysBetweenYmd(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * A civil day as a Date at the phone's local midnight — only for reading calendar fields of that day
 * (`getDate()`, `getMonth()`, `getFullYear()`), never for clocks or for `dayLabel`, which takes the `YYYY-MM-DD` itself.
 */
export function dateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The calendar fields of a value: a `YYYY-MM-DD` as it is, an instant in Tbilisi. */
function civil(v: string | Date): { ymd: string; weekday: number; date: number; month: number } {
  if (typeof v === 'string' && YMD.test(v)) {
    const [, m, d] = v.split('-').map(Number);
    return { ymd: v, weekday: weekdayOfYmd(v), date: d, month: m - 1 };
  }
  const t = tbilisi(v);
  return { ymd: t.toISOString().slice(0, 10), weekday: t.getUTCDay(), date: t.getUTCDate(), month: t.getUTCMonth() };
}

/** „ორშ“ / „Mon“ of a `YYYY-MM-DD`, or of an instant in Tbilisi. */
export function weekdayShort(v: string | Date): string {
  return (en() ? EN_DAYS : KA_DAYS)[civil(v).weekday];
}

export function weekdayLong(index: number): string {
  return (en() ? EN_DAYS_LONG : KA_DAYS_LONG)[index];
}

/** „ორშ, 19 ოქტ“ / „Mon, 19 Oct“; today, tomorrow and yesterday by name — all on Tbilisi's calendar. */
export function dayLabel(v: string | Date, now: Instant = new Date()): string {
  const c = civil(v);
  const diff = daysBetweenYmd(tbilisiYmd(now), c.ymd);
  if (diff === 0) return tx('დღეს', 'Today');
  if (diff === 1) return tx('ხვალ', 'Tomorrow');
  if (diff === -1) return tx('გუშინ', 'Yesterday');
  return `${(en() ? EN_DAYS : KA_DAYS)[c.weekday]}, ${c.date} ${(en() ? EN_MONTHS : KA_MONTHS)[c.month]}`;
}

/** „ორშ, 19 ოქტ · 15:00“ — the day and the clock of an instant, both in Tbilisi. */
export function whenLabel(at: Instant, now: Instant = new Date()): string {
  return `${dayLabel(new Date(at), now)} · ${clockOf(at)}`;
}

export function monthDay(ymd: string): string {
  const c = civil(ymd);
  return `${c.date} ${(en() ? EN_MONTHS : KA_MONTHS)[c.month]}`;
}

export function priceLabel(price: number | null, priceTo?: number | null, currency = 'GEL'): string {
  if (price == null) return tx('ფასი ადგილზე', 'Price on site');
  const sym = currency === 'GEL' ? '₾' : currency;
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
  if (priceTo != null && priceTo > price) return `${fmt(price)}–${fmt(priceTo)} ${sym}`;
  return `${fmt(price)} ${sym}`;
}

export function fromPriceLabel(price: number | null): string | null {
  if (price == null) return null;
  return tx(`${Number.isInteger(price) ? price : price.toFixed(2)} ₾-დან`, `from ${Number.isInteger(price) ? price : price.toFixed(2)} ₾`);
}

export function durationLabel(min: number): string {
  if (min < 60) return tx(`${min} წთ`, `${min} min`);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? tx(`${h} სთ ${m} წთ`, `${h} h ${m} min`) : tx(`${h} სთ`, `${h} h`);
}

export function distanceLabel(km: number | null): string | null {
  if (km == null) return null;
  if (km < 1) return tx(`${Math.max(50, Math.round(km * 1000 / 50) * 50)} მ`, `${Math.max(50, Math.round(km * 1000 / 50) * 50)} m`);
  return tx(`${km < 10 ? km.toFixed(1) : Math.round(km)} კმ`, `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);
}

export function statusLabel(status: BookAppointmentStatus): string {
  switch (status) {
    case 'PENDING': return tx('ელოდება დადასტურებას', 'Awaiting confirmation');
    case 'CONFIRMED': return tx('დადასტურებული', 'Confirmed');
    case 'CANCELLED': return tx('გაუქმებული', 'Cancelled');
    case 'COMPLETED': return tx('დასრულებული', 'Completed');
    case 'NO_SHOW': return tx('არ მოხვედი', 'No-show');
    default: return status;
  }
}

export function statusTone(status: BookAppointmentStatus): 'neutral' | 'brand' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'PENDING': return 'warning';
    case 'CONFIRMED': return 'brand';
    case 'COMPLETED': return 'success';
    case 'CANCELLED': return 'neutral';
    case 'NO_SHOW': return 'danger';
    default: return 'neutral';
  }
}

export function isUpcoming(a: BookAppointment, now = new Date()): boolean {
  return (a.status === 'PENDING' || a.status === 'CONFIRMED') && new Date(a.endsAt).getTime() >= now.getTime();
}

/** Today's opening line (Tbilisi's today): „დღეს 10:00–19:00“ / „დახურულია“ / unknown → null. */
export function todayHoursLine(hours: BookHours | null | undefined, now: Instant = new Date()): string | null {
  if (!hours || !Object.values(hours).some((l) => Array.isArray(l) && l.length)) return null;
  const list = hours[String(tbilisiWeekday(now))] ?? [];
  if (!list.length) return tx('დღეს დახურულია', 'Closed today');
  return tx(`დღეს ${list.map((r) => `${r.from}–${r.to}`).join(', ')}`, `Today ${list.map((r) => `${r.from}–${r.to}`).join(', ')}`);
}

/** Seven rows for the hours card, Monday first; „today“ is Tbilisi's. */
export function weekHours(hours: BookHours, now: Instant = new Date()): Array<{ day: string; ranges: string; today: boolean }> {
  const todayIndex = tbilisiWeekday(now);
  return [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const list = hours[String(d)] ?? [];
    return { day: weekdayLong(d), ranges: list.length ? list.map((r) => `${r.from}–${r.to}`).join(', ') : tx('დახურულია', 'Closed'), today: d === todayIndex };
  });
}

export function ratingLabel(rating: number | null, count: number): string {
  if (rating == null || !count) return tx('ჯერ შეფასება არ აქვს', 'No ratings yet');
  return tx(`${rating.toFixed(1)} · ${count} შეფასება`, `${rating.toFixed(1)} · ${count} ${count === 1 ? 'rating' : 'ratings'}`);
}

/** Maps app link for directions (the OS picks the app). */
export function directionsUrl(lat: number, lng: number, name?: string): string {
  const label = encodeURIComponent(name ?? 'MEDIBOOK');
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=driving&q=${label}`;
}
