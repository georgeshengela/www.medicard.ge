// MEDIBOOK business panel — shared helpers: formatting, categories, API wrappers scoped to the open business.
import { h, icon, badge, toast } from '/app/js/ui.js';
import { get, post, patch, put, del, invalidate } from '/app/js/api.js';
import { t, isEn } from '/app/js/i18n.js';
import { currentId } from './state.js';

export const CATEGORIES = [
  ['DENTAL', t('სტომატოლოგია', 'Dental'), '#0EA5E9'],
  ['BEAUTY', t('სილამაზის სალონი', 'Beauty salon'), '#EC4899'],
  ['HAIR', t('თმა და ბარბერი', 'Hair and barber'), '#F59E0B'],
  ['NAILS', t('ფრჩხილები', 'Nails'), '#F472B6'],
  ['AESTHETIC', t('ესთეტიკა და კოსმეტოლოგია', 'Aesthetics and cosmetology'), '#A21CAF'],
  ['SPA', t('სპა და მასაჟი', 'Spa and massage'), '#14B8A6'],
  ['CLINIC', t('კლინიკა და ექიმები', 'Clinics and doctors'), '#2563EB'],
  ['FITNESS', t('ფიტნესი და იოგა', 'Fitness and yoga'), '#22C55E'],
  ['OPTICS', t('ოპტიკა', 'Optics'), '#6366F1'],
  ['LAB', t('ლაბორატორია', 'Laboratory'), '#4F46E5'],
  ['MIND', t('ფსიქოლოგი', 'Psychology'), '#8B5CF6'],
  ['PHYSIO', t('ფიზიოთერაპია', 'Physiotherapy'), '#0D9488'],
  ['TATTOO', t('ტატუ და პირსინგი', 'Tattoo and piercing'), '#374151'],
  ['OTHER', t('სხვა', 'Other'), '#64748B'],
];
export const categoryLabel = (id) => CATEGORIES.find(([k]) => k === id)?.[1] || id || '';
export const categoryColor = (id) => CATEGORIES.find(([k]) => k === id)?.[2] || '#64748B';

export const WEEKDAYS = isEn
  ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  : ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
export const WEEKDAYS_SHORT = isEn ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
export const MONTHS_SHORT = isEn
  ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  : ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
export const MONTHS = isEn
  ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  : ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];

export const STATUS = {
  PENDING: [t('დასადასტურებელი', 'To confirm'), 'warn'],
  CONFIRMED: [t('დადასტურებული', 'Confirmed'), 'brand'],
  COMPLETED: [t('დასრულებული', 'Completed'), 'ok'],
  CANCELLED: [t('გაუქმებული', 'Cancelled'), 'neutral'],
  NO_SHOW: [t('არ მოვიდა', 'No-show'), 'danger'],
};
export const statusBadge = (s) => badge(STATUS[s]?.[0] || s, STATUS[s]?.[1] || 'neutral');

export const METHODS = [['CASH', t('ნაღდი', 'Cash')], ['CARD', t('ბარათი', 'Card')], ['TRANSFER', t('გადარიცხვა', 'Transfer')], ['OTHER', t('სხვა', 'Other')]];
export const methodLabel = (m) => METHODS.find(([k]) => k === m)?.[1] || (m ? m : '—');

export const EXPENSE_CATEGORIES = [['RENT', t('ქირა', 'Rent')], ['SALARY', t('ხელფასი', 'Salaries')], ['SUPPLIES', t('მასალები', 'Supplies')], ['MARKETING', t('მარკეტინგი', 'Marketing')], ['UTILITIES', t('კომუნალური', 'Utilities')], ['EQUIPMENT', t('ტექნიკა', 'Equipment')], ['TAX', t('გადასახადი', 'Tax')], ['OTHER', t('სხვა', 'Other')]];
export const INCOME_CATEGORIES = [['SERVICE', t('სერვისი', 'Service')], ['PRODUCT', t('პროდუქტი', 'Product')], ['GIFT_CARD', t('სასაჩუქრე ბარათი', 'Gift card')], ['OTHER', t('სხვა', 'Other')]];
export const txCategoryLabel = (c) => [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find(([k]) => k === c)?.[1] || c;

export const ROLES = [['OWNER', t('მფლობელი', 'Owner')], ['MANAGER', t('მენეჯერი', 'Manager')], ['STAFF', t('თანამშრომელი', 'Staff')]];
export const roleLabel = (r) => ROLES.find(([k]) => k === r)?.[1] || r;

export function gel(v, digits) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  const d = digits ?? (Number.isInteger(n) ? 0 : 2);
  return `${n.toLocaleString(isEn ? 'en-GB' : 'ka-GE', { minimumFractionDigits: d, maximumFractionDigits: d })} ₾`;
}
export function pct(v) { return v == null ? '—' : `${Math.round(Number(v) * 10) / 10}%`; }
export function minutes(min) {
  const m = Number(min) || 0;
  if (m < 60) return t(`${m} წთ`, `${m} min`);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? t(`${hh} სთ ${mm} წთ`, `${hh} h ${mm} min`) : t(`${hh} სთ`, `${hh} h`);
}

/* Every business is in Georgia (UTC+4 all year): the panel reads and writes clock times in Tbilisi time whatever the
   browser's zone, so an owner travelling (or a test browser elsewhere) sees the same calendar as the salon. */
export const TBILISI_OFFSET_MIN = 240;
const shifted = (v) => new Date((v instanceof Date ? v : new Date(v)).getTime() + TBILISI_OFFSET_MIN * 60000);
const pad = (n) => String(n).padStart(2, '0');
/** Tbilisi civil date of an instant (Date or ISO); today when omitted. */
export function ymd(v = new Date()) { const d = shifted(v); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
/** A civil YYYY-MM-DD as the instant of Tbilisi midnight. */
export function fromYmd(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d) - TBILISI_OFFSET_MIN * 60000); }
export function addDays(s, n) { const [y, m, d] = String(s).split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`; }
export function weekdayOf(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
/** Minutes since Tbilisi midnight of an instant. */
export function minutesOf(v) { const d = shifted(v); return d.getUTCHours() * 60 + d.getUTCMinutes(); }
export function clock(v) { const m = minutesOf(v); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }
export function dayLabel(v, { long = false } = {}) {
  const d = shifted(v);
  const today = ymd();
  const s = ymd(v);
  if (s === today) return t('დღეს', 'Today');
  if (s === addDays(today, 1)) return t('ხვალ', 'Tomorrow');
  if (s === addDays(today, -1)) return t('გუშინ', 'Yesterday');
  return long ? `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}` : `${WEEKDAYS_SHORT[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}
export function when(v) { return `${dayLabel(v)} · ${clock(v)}`; }
export function dateText(v) { const d = shifted(v); return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
export function relative(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return t('ახლახან', 'just now');
  if (diff < 60) return t(`${Math.round(diff)} წთ წინ`, `${Math.round(diff)} min ago`);
  if (diff < 1440) return t(`${Math.round(diff / 60)} სთ წინ`, `${Math.round(diff / 60)} h ago`);
  return dayLabel(iso);
}
/** Tbilisi civil date + HH:mm → ISO instant. */
export function toIso(dateYmd, hhmm) { return new Date(`${dateYmd}T${hhmm}:00+04:00`).toISOString(); }

export function initials(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '•';
}

export function avatar(name, color, size = 34) {
  return h('span', { class: 'bz-avatar', style: { width: `${size}px`, height: `${size}px`, background: color || 'var(--brand)', fontSize: `${Math.round(size * 0.38)}px` } }, initials(name));
}

/* ── API scoped to the open business ─────────────────── */
export const biz = {
  path(sub = '') { return `/api/business/${currentId()}${sub}`; },
  get(sub, query) { return get(biz.path(sub), query); },
  post(sub, body) { return post(biz.path(sub), body); },
  patch(sub, body) { return patch(biz.path(sub), body); },
  put(sub, body) { return put(biz.path(sub), body); },
  del(sub, body) { return del(biz.path(sub), body); },
  bust() { invalidate(biz.path()); },
};

export function ok(message) { toast(message, 'ok'); }
export function fail(e) { toast(e?.message || t('ვერ შესრულდა.', 'Something went wrong.'), 'error'); }

/** Phone input normaliser for forms: 5XX XXX XXX / +995… are both fine. */
export function phoneText(v) { return String(v || '').replace(/^\+995/, '').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3'); }

export function emptyBox(title, body, action) {
  return h('div', { class: 'bz-empty' }, icon('info', { size: 22 }), h('strong', null, title), body ? h('span', null, body) : null, action || null);
}

/** 7-day working-hours editor: returns { el, value() } for { "0": [{from,to}], … }. */
export function hoursEditor(initial = {}, { allowEmpty = true } = {}) {
  const rows = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const list = Array.isArray(initial[String(d)]) ? initial[String(d)] : [];
    const on = h('input', { type: 'checkbox', checked: list.length > 0 });
    const from = h('input', { type: 'time', class: 'input', value: list[0]?.from || '10:00', step: 300 });
    const to = h('input', { type: 'time', class: 'input', value: list[0]?.to || '19:00', step: 300 });
    const sync = () => { from.disabled = to.disabled = !on.checked; };
    on.addEventListener('change', sync);
    sync();
    const el = h('div', { class: 'bz-hours-row' },
      h('label', { class: 'toggle' }, on, h('span', { class: 'toggle-track' }, h('span', { class: 'toggle-thumb' })), h('span', { class: 'bz-hours-day' }, WEEKDAYS[d])),
      from, h('span', { class: 'faint' }, '–'), to);
    return { d, el, on, from, to };
  });
  const el = h('div', { class: 'bz-hours' }, rows.map((r) => r.el));
  return {
    el,
    value() {
      const out = {};
      for (const r of rows) out[String(r.d)] = r.on.checked && r.from.value && r.to.value ? [{ from: r.from.value, to: r.to.value }] : [];
      if (!allowEmpty && !Object.values(out).some((l) => l.length)) throw new Error(t('მონიშნე სამუშაო დღე მაინც ერთი.', 'Mark at least one working day.'));
      return out;
    },
  };
}

/** The one Mapbox GL JS loader for the panel (map pin on the registration form and the settings page). */
let mapboxPromise = null;
export function loadMapbox() {
  if (mapboxPromise) return mapboxPromise;
  mapboxPromise = new Promise((resolve, reject) => {
    if (window.mapboxgl) return resolve(window.mapboxgl);
    const css = h('link', { rel: 'stylesheet', href: 'https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css' });
    const js = h('script', { src: 'https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js' });
    js.onload = () => resolve(window.mapboxgl);
    js.onerror = () => reject(new Error(t('რუკა ვერ ჩაიტვირთა.', 'The map could not load.')));
    document.head.append(css, js);
  });
  return mapboxPromise;
}

export function debounceFn(fn, ms = 250) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
