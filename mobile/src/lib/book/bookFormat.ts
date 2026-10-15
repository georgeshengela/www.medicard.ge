/**
 * MEDIBOOK formatting — pure. Dates and clocks in the phone's own zone (every business is in Georgia;
 * the phone of someone booking from abroad shows their local clock, like a calendar app would).
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

export function ymdLocal(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return ymdLocal(new Date(y, m - 1, d + days));
}

export function dateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function clockOf(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function weekdayShort(d: Date): string {
  return (en() ? EN_DAYS : KA_DAYS)[d.getDay()];
}

export function weekdayLong(index: number): string {
  return (en() ? EN_DAYS_LONG : KA_DAYS_LONG)[index];
}

/** „ორშ, 19 ოქტ“ / „Mon, 19 Oct“; today and tomorrow by name. */
export function dayLabel(iso: string | Date, now = new Date()): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const diff = Math.round((dateFromYmd(ymdLocal(d)).getTime() - dateFromYmd(ymdLocal(now)).getTime()) / 86_400_000);
  if (diff === 0) return tx('დღეს', 'Today');
  if (diff === 1) return tx('ხვალ', 'Tomorrow');
  if (diff === -1) return tx('გუშინ', 'Yesterday');
  return `${weekdayShort(d)}, ${d.getDate()} ${(en() ? EN_MONTHS : KA_MONTHS)[d.getMonth()]}`;
}

/** „ორშ, 19 ოქტ · 15:00“ */
export function whenLabel(iso: string, now = new Date()): string {
  return `${dayLabel(iso, now)} · ${clockOf(iso)}`;
}

export function monthDay(ymd: string): string {
  const d = dateFromYmd(ymd);
  return `${d.getDate()} ${(en() ? EN_MONTHS : KA_MONTHS)[d.getMonth()]}`;
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

/** Today's opening line: „დღეს 10:00–19:00“ / „დახურულია“ / unknown → null. */
export function todayHoursLine(hours: BookHours | null | undefined, now = new Date()): string | null {
  if (!hours || !Object.values(hours).some((l) => Array.isArray(l) && l.length)) return null;
  const list = hours[String(now.getDay())] ?? [];
  if (!list.length) return tx('დღეს დახურულია', 'Closed today');
  return tx(`დღეს ${list.map((r) => `${r.from}–${r.to}`).join(', ')}`, `Today ${list.map((r) => `${r.from}–${r.to}`).join(', ')}`);
}

/** Seven rows for the hours card, Monday first. */
export function weekHours(hours: BookHours): Array<{ day: string; ranges: string; today: boolean }> {
  const todayIndex = new Date().getDay();
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
