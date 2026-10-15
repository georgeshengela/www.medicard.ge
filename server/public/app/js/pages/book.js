// MEDICARD web — MEDIBOOK (/book). The catalogue of dentists, salons, aesthetic centres, clinics and studios
// around the person, one business's page, online booking (service → person → day → time → confirm) and the
// person's bookings (cancel, review), plus the map. Mirrors mobile/app/book/** and uses /api/book exactly as the
// app does (server/src/routes/book.routes.js). Only public business facts travel; booking needs a verified phone
// (the server's 403 opens the one-time SMS check); the search term stays on the page, never in the URL.
import {
  h, mount, icon, tile, button, iconButton, busy, badge, skeleton, errorBox, toast, openModal, confirmDialog, textarea, section, debounce,
} from '../ui.js';
import { get, post, put, del, invalidate, ApiError } from '../api.js';
import { t, isEn } from '../i18n.js';
import { session, featureOn, profileExtra } from '../session.js';
import { wordmark } from '../brand.js';

const CSS = '/app/css/book.css';
let cssReady = null;
/** Adds the module's stylesheet once; resolves when it has loaded (the map measures its box on creation). */
function ensureCss() {
  if (cssReady) return cssReady;
  if (document.querySelector(`link[href="${CSS}"]`)) { cssReady = Promise.resolve(); return cssReady; }
  const link = h('link', { rel: 'stylesheet', href: CSS });
  cssReady = new Promise((resolve) => { link.onload = resolve; link.onerror = resolve; setTimeout(resolve, 1500); });
  document.head.append(link);
  return cssReady;
}

/* ── Formatting (mobile src/lib/book/bookFormat.ts): clocks in the browser's own zone, like a calendar app ── */
const MONTHS = isEn ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const DAYS = isEn ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
const DAYS_LONG = isEn ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] : ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
const pad = (n) => String(n).padStart(2, '0');
const ymdLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateFromYmd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const addDaysYmd = (s, n) => { const [y, m, d] = String(s).split('-').map(Number); return ymdLocal(new Date(y, m - 1, d + n)); };
const daysBetween = (a, b) => Math.round((dateFromYmd(b) - dateFromYmd(a)) / 86400000);
const clockOf = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/** „ორშ, 19 ოქტ“ / „Mon, 19 Oct“; today, tomorrow and yesterday by name. */
function dayLabel(v) {
  const d = v instanceof Date ? v : new Date(v);
  const diff = daysBetween(ymdLocal(), ymdLocal(d));
  if (diff === 0) return t('დღეს', 'Today');
  if (diff === 1) return t('ხვალ', 'Tomorrow');
  if (diff === -1) return t('გუშინ', 'Yesterday');
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
const whenLabel = (iso) => `${dayLabel(iso)} · ${clockOf(iso)}`;
const money = (v) => (Number.isInteger(v) ? String(v) : Number(v).toFixed(2));
function priceLabel(price, priceTo, currency = 'GEL') {
  if (price == null) return t('ფასი ადგილზე', 'Price on site');
  const sym = currency === 'GEL' ? '₾' : currency;
  return priceTo != null && priceTo > price ? `${money(price)}–${money(priceTo)} ${sym}` : `${money(price)} ${sym}`;
}
const fromPriceLabel = (price) => (price == null ? null : t(`${money(price)} ₾-დან`, `from ${money(price)} ₾`));
function durationLabel(min) {
  const m = Number(min) || 0;
  if (m < 60) return t(`${m} წთ`, `${m} min`);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? t(`${hh} სთ ${mm} წთ`, `${hh} h ${mm} min`) : t(`${hh} სთ`, `${hh} h`);
}
function distanceLabel(km) {
  if (km == null) return null;
  if (km < 1) { const m = Math.max(50, Math.round((km * 1000) / 50) * 50); return t(`${m} მ`, `${m} m`); }
  const v = km < 10 ? km.toFixed(1) : Math.round(km);
  return t(`${v} კმ`, `${v} km`);
}
const STATUS = {
  PENDING: [t('ელოდება დადასტურებას', 'Awaiting confirmation'), 'warn'],
  CONFIRMED: [t('დადასტურებული', 'Confirmed'), 'brand'],
  CANCELLED: [t('გაუქმებული', 'Cancelled'), 'neutral'],
  COMPLETED: [t('დასრულებული', 'Completed'), 'ok'],
  NO_SHOW: [t('არ მოხვედი', 'No-show'), 'danger'],
};
const statusBadge = (s) => badge(STATUS[s]?.[0] || s, STATUS[s]?.[1] || 'neutral');
const hasHours = (hours) => Boolean(hours) && Object.values(hours).some((l) => Array.isArray(l) && l.length);
const rangesText = (list) => list.map((r) => `${r.from}–${r.to}`).join(', ');
function todayHoursLine(hours) {
  if (!hasHours(hours)) return null;
  const list = hours[String(new Date().getDay())] ?? [];
  return list.length ? t(`დღეს ${rangesText(list)}`, `Today ${rangesText(list)}`) : t('დღეს დახურულია', 'Closed today');
}
const weekHours = (hours) => [1, 2, 3, 4, 5, 6, 0].map((d) => {
  const list = hours[String(d)] ?? [];
  return { day: DAYS_LONG[d], ranges: list.length ? rangesText(list) : t('დახურულია', 'Closed'), today: d === new Date().getDay() };
});
const ratingLabel = (rating, count) => (rating == null || !count
  ? t('ჯერ შეფასება არ აქვს', 'No ratings yet')
  : t(`${rating.toFixed(1)} · ${count} შეფასება`, `${rating.toFixed(1)} · ${count} ${count === 1 ? 'rating' : 'ratings'}`));
const openLine = (b) => (b.openNow
  ? t(`ღიაა${b.closesAt ? ` · ${b.closesAt}-მდე` : ''}`, `Open${b.closesAt ? ` · until ${b.closesAt}` : ''}`)
  : t(`დახურულია${b.opensAt ? ` · ${b.opensAt}` : ''}`, `Closed${b.opensAt ? ` · opens ${b.opensAt}` : ''}`));
const directionsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;

/* ── Categories (server catalog.js CATEGORIES: ids, labels, pin colours; icons are ours) ── */
const CATEGORIES = [
  { id: 'DENTAL', label: t('სტომატოლოგია', 'Dental'), short: t('სტომატოლოგია', 'Dental'), color: '#0EA5E9', icon: 'stethoscope' },
  { id: 'BEAUTY', label: t('სილამაზის სალონი', 'Beauty salon'), short: t('სილამაზე', 'Beauty'), color: '#EC4899', icon: 'sparkles' },
  { id: 'HAIR', label: t('თმა და ბარბერი', 'Hair and barber'), short: t('თმა', 'Hair'), color: '#F59E0B', icon: 'scissors' },
  { id: 'NAILS', label: t('ფრჩხილები', 'Nails'), short: t('ფრჩხილები', 'Nails'), color: '#F472B6', icon: 'hand' },
  { id: 'AESTHETIC', label: t('ესთეტიკა და კოსმეტოლოგია', 'Aesthetics and cosmetology'), short: t('ესთეტიკა', 'Aesthetics'), color: '#A855F7', icon: 'syringe' },
  { id: 'SPA', label: t('სპა და მასაჟი', 'Spa and massage'), short: t('სპა', 'Spa'), color: '#14B8A6', icon: 'waves' },
  { id: 'CLINIC', label: t('კლინიკა და ექიმები', 'Clinics and doctors'), short: t('კლინიკა', 'Clinic'), color: '#2563EB', icon: 'heartPulse' },
  { id: 'FITNESS', label: t('ფიტნესი და იოგა', 'Fitness and yoga'), short: t('ფიტნესი', 'Fitness'), color: '#22C55E', icon: 'dumbbell' },
  { id: 'OPTICS', label: t('ოპტიკა', 'Optics'), short: t('ოპტიკა', 'Optics'), color: '#6366F1', icon: 'glasses' },
  { id: 'LAB', label: t('ლაბორატორია', 'Laboratory'), short: t('ლაბორატორია', 'Lab'), color: '#4F46E5', icon: 'flask' },
  { id: 'MIND', label: t('ფსიქოლოგი', 'Psychology'), short: t('ფსიქოლოგი', 'Psychology'), color: '#8B5CF6', icon: 'brain' },
  { id: 'PHYSIO', label: t('ფიზიოთერაპია', 'Physiotherapy'), short: t('ფიზიო', 'Physio'), color: '#0D9488', icon: 'activity' },
  { id: 'TATTOO', label: t('ტატუ და პირსინგი', 'Tattoo and piercing'), short: t('ტატუ', 'Tattoo'), color: '#374151', icon: 'eye' },
  { id: 'OTHER', label: t('სხვა', 'Other'), short: t('სხვა', 'Other'), color: '#64748B', icon: 'sparkles' },
];
const catOf = (id) => CATEGORIES.find((c) => c.id === String(id || '').toUpperCase()) || CATEGORIES[CATEGORIES.length - 1];
const CHIP_CATEGORIES = CATEGORIES.filter((c) => c.id !== 'OTHER');
const validCategory = (v) => (typeof v === 'string' && CHIP_CATEGORIES.some((c) => c.id === v.toUpperCase()) ? v.toUpperCase() : null);

/* ── Where „ახლოს შენთან“ is measured from ─────────────────────────────────────────────────────────────────
   The browser's position once the person asked for it (a button, never an effect), else the city saved in the
   profile (its coordinates, or the town's centre from the catalogue's table), else the centre of Tbilisi. */
const TBILISI = { lat: 41.7151, lng: 44.8271 };
const CITIES = [
  ['თბილისი', 'Tbilisi', 41.7151, 44.8271], ['ბათუმი', 'Batumi', 41.6168, 41.6367], ['ქუთაისი', 'Kutaisi', 42.2679, 42.718], ['რუსთავი', 'Rustavi', 41.5495, 44.993],
  ['გორი', 'Gori', 41.9842, 44.1158], ['ზუგდიდი', 'Zugdidi', 42.5088, 41.8709], ['ფოთი', 'Poti', 42.1462, 41.6718], ['თელავი', 'Telavi', 41.9198, 45.4733],
  ['ქობულეთი', 'Kobuleti', 41.8203, 41.7753], ['ახალციხე', 'Akhaltsikhe', 41.6392, 42.9826], ['ოზურგეთი', 'Ozurgeti', 41.9247, 42.0066], ['მარნეული', 'Marneuli', 41.476, 44.8094],
  ['გარდაბანი', 'Gardabani', 41.4616, 45.0932], ['მცხეთა', 'Mtskheta', 41.8454, 44.7206], ['სამტრედია', 'Samtredia', 42.1537, 42.336], ['ხაშური', 'Khashuri', 41.9975, 43.598],
  ['სენაკი', 'Senaki', 42.27, 42.067], ['ზესტაფონი', 'Zestafoni', 42.1097, 43.0463], ['წყალტუბო', 'Tskaltubo', 42.3432, 42.5976], ['ბორჯომი', 'Borjomi', 41.839, 43.3827],
  ['სიღნაღი', 'Sighnaghi', 41.6166, 45.9227], ['ბოლნისი', 'Bolnisi', 41.4474, 44.5383], ['კასპი', 'Kaspi', 41.9256, 44.4263], ['ლაგოდეხი', 'Lagodekhi', 41.8264, 46.2764],
  ['ყვარელი', 'Kvareli', 41.9542, 45.8147], ['ამბროლაური', 'Ambrolauri', 42.5203, 43.1492], ['ჭიათურა', 'Chiatura', 42.2893, 43.2976], ['ტყიბული', 'Tkibuli', 42.3503, 42.9999],
  ['საჩხერე', 'Sachkhere', 42.3461, 43.4038], ['დუშეთი', 'Dusheti', 42.0865, 44.6978], ['გურჯაანი', 'Gurjaani', 41.7461, 45.7978], ['დედოფლისწყარო', 'Dedoplistskaro', 41.4636, 46.1056],
  ['წალენჯიხა', 'Tsalenjikha', 42.6, 42.0667], ['ხონი', 'Khoni', 42.3222, 42.4208], ['თერჯოლა', 'Terjola', 42.1958, 42.9956], ['ვანი', 'Vani', 42.0847, 42.5103],
  ['მესტია', 'Mestia', 43.0458, 42.7297], ['სტეფანწმინდა', 'Stepantsminda', 42.6567, 44.6428], ['წნორი', 'Tsnori', 41.6236, 45.9695], ['აბაშა', 'Abasha', 42.2061, 42.2047],
  ['მართვილი', 'Martvili', 42.4147, 42.3789], ['ონი', 'Oni', 42.5833, 43.4417], ['თეთრიწყარო', 'Tetritskaro', 41.5478, 44.4689], ['საგარეჯო', 'Sagarejo', 41.7336, 45.3317],
  ['წალკა', 'Tsalka', 41.5958, 44.0875], ['ნინოწმინდა', 'Ninotsminda', 41.2644, 43.5906], ['ახალქალაქი', 'Akhalkalaki', 41.4053, 43.4864], ['ადიგენი', 'Adigeni', 41.6833, 42.7],
  ['ასპინძა', 'Aspindza', 41.5733, 43.2503], ['ლანჩხუთი', 'Lanchkhuti', 42.0906, 42.0353], ['ჩოხატაური', 'Chokhatauri', 42.0147, 42.2461], ['ქედა', 'Keda', 41.5967, 41.9411],
  ['ხულო', 'Khulo', 41.6428, 42.3069], ['შუახევი', 'Shuakhevi', 41.6286, 42.1836], ['ხელვაჭაური', 'Khelvachauri', 41.5847, 41.6611], ['თიანეთი', 'Tianeti', 42.1083, 44.9667],
];
let gps = null;
function origin() {
  if (gps) return { ...gps, source: 'gps', city: null };
  const loc = profileExtra().location;
  if (loc && typeof loc === 'object') {
    const cityName = loc.cityKa || loc.cityName || null;
    if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) return { lat: loc.lat, lng: loc.lng, source: 'profile', city: cityName };
    const row = CITIES.find(([ka, en]) => ka === loc.cityKa || en === loc.cityName);
    if (row) return { lat: row[2], lng: row[3], source: 'profile', city: isEn ? row[1] : row[0] };
  }
  return { ...TBILISI, source: 'default', city: null };
}
/** Asks the browser for the position — only ever from a click. Resolves true when a fix arrived. */
function locate() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { toast(t('ეს ბრაუზერი მდებარეობას არ იძლევა.', 'This browser does not share your location.'), 'info'); resolve(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { gps = { lat: pos.coords.latitude, lng: pos.coords.longitude }; resolve(true); },
      () => { toast(t('მდებარეობა ვერ განვსაზღვრეთ — ვაჩვენებ ქალაქის მიხედვით.', 'Couldn’t find your location — showing places by city.'), 'info'); resolve(false); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
    );
  });
}

/* ── API (/api/book, as mobile api.book.*) ────────────── */
const bizPath = (id) => `/api/book/businesses/${encodeURIComponent(id)}`;
const api = {
  nearby: (o, extra = {}) => get('/api/book/businesses', { lat: o.lat, lng: o.lng, radiusKm: o.source === 'gps' ? 4 : 8, limit: 8, ...extra }),
  search: ({ q, category, limit = 60 }) => { const o = origin(); return get('/api/book/businesses', { q, category, limit, originLat: o.lat, originLng: o.lng }); },
  business: (idOrSlug) => get(bizPath(idOrSlug)).then((r) => r.business),
  // Free times must always be fresh: drop the client's 30 s read cache before asking.
  days: (id, query) => { invalidate(`${bizPath(id)}/days`); return get(`${bizPath(id)}/days`, query); },
  availability: (id, query) => { invalidate(`${bizPath(id)}/availability`); return get(`${bizPath(id)}/availability`, query); },
  event: (id, kind) => post(`${bizPath(id)}/events`, { kind }).catch(() => undefined),
  mine: () => get('/api/book/appointments'),
  appointment: (id) => get(`/api/book/appointments/${encodeURIComponent(id)}`).then((r) => r.appointment),
  create: (body) => post('/api/book/appointments', body),
  cancel: (id) => post(`/api/book/appointments/${encodeURIComponent(id)}/cancel`, {}),
  review: (id, body) => post(`/api/book/appointments/${encodeURIComponent(id)}/review`, body),
  favorites: () => { const o = origin(); return get('/api/book/favorites', { lat: o.lat, lng: o.lng }); },
  setFavorite: (id, on) => (on ? put(`/api/book/favorites/${encodeURIComponent(id)}`, {}) : del(`/api/book/favorites/${encodeURIComponent(id)}`)),
  pins: (bounds, category) => get('/api/book/map', { ...bounds, category }),
};

/* ── Shared pieces ────────────────────────────────────── */
const bizHref = (b) => `/book/${encodeURIComponent(b.slug || b.id)}`;
const flowHref = (b, serviceId) => `${bizHref(b)}/book${serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : ''}`;
const backLink = (href, label) => h('a', { class: 'back', href, 'data-link': '' }, icon('chevronLeft', { size: 16 }), label);

/** Picture or the category's tinted tile. */
function thumb(b, cls = '', { preferLogo = false } = {}) {
  const img = preferLogo ? (b.logoUrl || b.coverUrl) : (b.coverUrl || b.logoUrl);
  if (img) return h('img', { class: `bk-thumb ${cls}`, src: img, alt: '', loading: 'lazy' });
  const cat = catOf(b.category);
  return h('span', { class: `bk-thumb ${cls}`, style: `--cat:${cat.color}` }, icon(cat.icon, { size: cls === 'lg' ? 28 : cls === 'sm' ? 20 : 22 }));
}

function stars(value, size = 14) {
  const v = Math.round(Number(value) || 0);
  return h('span', { class: 'bk-stars', 'aria-label': t(`${value} 5-დან`, `${value} out of 5`) }, [1, 2, 3, 4, 5].map((i) => icon('star', { size, className: i <= v ? 'on' : 'off' })));
}

/** One business in a list: picture or tile, name (+ claimed check), category · place · distance, rating, open now, price. */
function bizRow(b) {
  const meta = [b.categoryLabel, b.district || b.city, distanceLabel(b.distanceKm)].filter(Boolean).join(' · ');
  const price = fromPriceLabel(b.fromPrice);
  return h('a', { class: 'bk-biz-row', href: bizHref(b), 'data-link': '', 'aria-label': `${b.name}. ${meta}` },
    thumb(b),
    h('div', { class: 'bk-biz-main' },
      h('div', { class: 'bk-name' }, h('span', null, b.name), b.claimed ? icon('badgeCheck', { size: 15 }) : null),
      h('div', { class: 'bk-meta' }, meta),
      h('div', { class: 'bk-facts' },
        b.rating != null ? h('span', { class: 'bk-rating' }, icon('star', { size: 12 }), b.rating.toFixed(1), h('small', null, `(${b.ratingCount})`)) : null,
        b.openNow != null ? h('span', { class: b.openNow ? 'bk-open' : 'bk-closed' }, openLine(b)) : null,
        price ? h('span', null, price) : null)),
    b.bookable ? h('span', { class: 'bk-pill' }, icon('calendarCheck', { size: 13 }), t('ჩაწერა', 'Book')) : icon('chevronRight', { size: 17, className: 'bk-chev' }));
}
const bizList = (rows) => h('div', { class: 'bk-list' }, rows.map(bizRow));

/** One booking in a list (upcoming / past). */
function apptRow(a) {
  return h('a', { class: 'bk-biz-row', href: `/book/appointments/${encodeURIComponent(a.id)}`, 'data-link': '' },
    thumb(a.business || {}, 'sm', { preferLogo: true }),
    h('div', { class: 'bk-biz-main' },
      h('div', { class: 'bk-name' }, h('span', null, a.serviceName)),
      h('div', { class: 'bk-meta' }, [a.business?.name, a.staffName].filter(Boolean).join(' · ')),
      h('div', { class: 'bk-when' }, whenLabel(a.startsAt))),
    statusBadge(a.status));
}
const apptList = (rows) => h('div', { class: 'bk-list' }, rows.map(apptRow));

/** Category chips; `null` = every category. Clicking the active chip clears it. */
function categoryChips(value, onChange, { all = true } = {}) {
  const wrap = h('div', { class: 'bk-chips', role: 'group', 'aria-label': t('კატეგორია', 'Category') });
  const chip = (id, label, color, on) => h('button', {
    type: 'button', class: `bk-chip ${color ? 'cat' : ''} ${on ? 'on' : ''}`, style: color ? `--chip:${color}` : null, 'aria-pressed': on ? 'true' : 'false',
    onClick: () => { const next = on ? null : id; paint(next); onChange(next); },
  }, h('i'), label);
  const paint = (current) => mount(wrap,
    all ? chip(null, t('ყველა', 'All'), null, current === null) : null,
    CHIP_CATEGORIES.map((c) => chip(c.id, c.short, c.color, current === c.id)));
  paint(value);
  return wrap;
}

function noteCard(text) { return h('div', { class: 'bk-list' }, h('p', { class: 'bk-note' }, text)); }

/** Share a place: the system sheet when the browser has one, else the link goes to the clipboard. */
async function shareBusiness(b) {
  api.event(b.id, 'SHARE');
  const url = `https://medicard.ge/app/book/${encodeURIComponent(b.slug || b.id)}`;
  const text = `${b.name} — ${b.categoryLabel}${b.address ? `, ${b.address}` : ''}`;
  if (navigator.share) {
    try { await navigator.share({ title: b.name, text, url }); } catch { /* closed */ }
    return;
  }
  try { await navigator.clipboard.writeText(`${text}. ${url}`); toast(t('ბმული დაკოპირდა', 'Link copied')); } catch { toast(url, 'info'); }
}

/** Phone gate (403 PHONE_VERIFICATION_REQUIRED): the one-time SMS check lives in quest.js. Resolves true when verified. */
async function offerPhone(reason) {
  const { offerPhoneVerification } = await import('./quest.js');
  return offerPhoneVerification(reason);
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════ */
export default async function bookPage(root, ctx) {
  ensureCss();
  const path = location.pathname.replace(/^\/app(?=\/|$)/, '').replace(/\/+$/, '');
  const segs = path.split('/').filter(Boolean);
  if (segs[1] === 'map') return mapView(root, ctx);
  if (segs[1] === 'appointments' && ctx.params.id) return appointmentView(root, ctx, ctx.params.id);
  if (ctx.params.slug) return segs[2] === 'book' ? flowView(root, ctx, ctx.params.slug) : businessView(root, ctx, ctx.params.slug);
  return hubView(root, ctx);
}

/* ── Hub (/book) ──────────────────────────────────────── */
async function hubView(root, ctx) {
  let alive = true;
  const st = { q: '', category: validCategory(ctx.query.category), seq: 0 };
  const heroSlot = h('div');
  const upcomingSlot = h('div');
  const nearSlot = h('div');
  const favSlot = h('div');
  const visitsSlot = h('div');
  const pastSlot = h('div');

  const searchInput = h('input', {
    type: 'search', autocomplete: 'off', spellcheck: 'false', 'aria-label': t('ძებნა', 'Search'),
    placeholder: t('სტომატოლოგი, მანიკური, მასაჟი, კლინიკა…', 'Dentist, manicure, massage, clinic…'),
  });
  const clearBtn = h('button', { type: 'button', class: 'bk-clear', 'aria-label': t('გასუფთავება', 'Clear'), hidden: true, onClick: () => {
    searchInput.value = ''; st.q = ''; clearBtn.hidden = true; loadNear(); searchInput.focus();
  } }, icon('x', { size: 15 }));
  searchInput.addEventListener('input', debounce(() => { st.q = searchInput.value; clearBtn.hidden = !st.q; loadNear(); }, 280));
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape' && searchInput.value) { e.preventDefault(); clearBtn.click(); } });
  const searchBar = h('div', { class: 'bk-search', role: 'search' }, icon('search', { size: 18 }), searchInput, clearBtn);
  const chips = categoryChips(st.category, (next) => {
    st.category = next;
    const url = new URL(location.href);
    if (next) url.searchParams.set('category', next); else url.searchParams.delete('category');
    history.replaceState({}, '', url.toString());
    loadNear();
  }, { all: false });

  const ownerCard = h('a', { class: 'bk-biz-row bk-solo', href: '/business' },
    tile('store', 'book', 44),
    h('div', { class: 'bk-biz-main' },
      h('div', { class: 'bk-name' }, h('span', null, t('შენი ბიზნესია?', 'Is this your business?'))),
      h('div', { class: 'bk-meta wrap' }, t('დაადასტურე ან დაარეგისტრირე — კალენდარი, კლიენტები, ანალიტიკა უფასოდ', 'Claim or register — calendar, clients and analytics, free'))),
    icon('chevronRight', { size: 17, className: 'bk-chev' }));

  mount(root,
    h('header', { class: 'page-head' },
      h('div', { class: 'page-head-text' }, h('h1', null, wordmark('book')), h('p', null, t('ჯავშნები და სერვისები შენ ირგვლივ', 'Bookings and services around you'))),
      h('div', { class: 'page-head-actions' }, button(t('რუკა', 'Map'), { icon: 'map', variant: 'secondary', href: '/book/map' }))),
    h('div', { class: 'bk-hub' },
      h('div', { class: 'bk-col' }, heroSlot, searchBar, chips, upcomingSlot, nearSlot),
      h('div', { class: 'bk-col' }, favSlot, visitsSlot, pastSlot, ownerCard)));

  mount(heroSlot, hero(null, { loading: true }));
  mount(nearSlot, section(t('ახლოს შენთან', 'Near you'), skeleton(4)));

  function hero(next, { loading = false } = {}) {
    const el = h('div', { class: 'bk-hero' }, wordmark('book'));
    if (next) {
      el.append(
        h('div', { class: 'bk-hero-label' }, t('შემდეგი ჯავშანი', 'Next booking')),
        h('h2', null, next.serviceName),
        h('p', { class: 'bk-hero-biz' }, next.business?.name ?? ''),
        h('p', null, `${whenLabel(next.startsAt)}${next.staffName ? ` · ${next.staffName}` : ''}`),
        h('div', { class: 'bk-hero-actions' },
          button(t('დეტალები', 'Details'), { variant: 'light', icon: 'calendarCheck', href: `/book/appointments/${encodeURIComponent(next.id)}` }),
          button(t('ძებნა', 'Search'), { variant: 'glass', icon: 'search', onClick: focusSearch })));
    } else {
      el.append(
        h('h2', null, t('ჩაეწერე სტომატოლოგთან, სალონში, ესთეტიკის ცენტრში', 'Book a dentist, a salon, an aesthetic centre')),
        h('p', null, t('ირგვლივ ყველა ადგილი — რუკაზე, ფასებით, თავისუფალი დროებით. ჯავშანი ორ შეხებაში.', 'Every place around you — on the map, with prices and free slots. Booked in two taps.')),
        loading ? null : h('div', { class: 'bk-hero-actions' },
          button(t('ძებნა', 'Search'), { variant: 'light', icon: 'search', onClick: focusSearch }),
          button(t('რუკა', 'Map'), { variant: 'glass', icon: 'mapPin', href: '/book/map' })));
    }
    return el;
  }
  function focusSearch() { searchInput.focus({ preventScroll: true }); searchBar.scrollIntoView({ block: 'center', behavior: 'smooth' }); }

  async function loadMine() {
    try {
      const r = await api.mine();
      if (!alive) return;
      const upcoming = r.upcoming || [];
      const past = r.past || [];
      mount(heroSlot, hero(upcoming[0] || null));
      mount(upcomingSlot, upcoming.length > 1 ? section(t('მომავალი ჯავშნები', 'Upcoming bookings'), apptList(upcoming.slice(1, 6))) : '');
      mount(pastSlot, past.length ? section(t('წარსული', 'Past'), apptList(past.slice(0, 4))) : '');
    } catch {
      if (alive) mount(heroSlot, hero(null));
    }
  }

  function locateCard(o) {
    const btn = h('button', { type: 'button', class: 'bk-locate' },
      icon('locate', { size: 18 }),
      h('span', { class: 'row-main' },
        h('b', null, t('გამოიყენე ჩემი მდებარეობა', 'Use my location')),
        h('span', null, o.source === 'profile'
          ? (o.city ? t(`ახლა შენი ქალაქის მიხედვით ვაჩვენებ — ${o.city}`, `Showing places around ${o.city} for now`) : t('ახლა შენი ქალაქის მიხედვით ვაჩვენებ', 'Showing places by your city for now'))
          : t('ახლა თბილისის ცენტრიდან ვაჩვენებ', 'Showing places from the centre of Tbilisi for now'))),
      icon('chevronRight', { size: 17, className: 'bk-chev' }));
    btn.addEventListener('click', () => busy(btn, async () => { if (await locate()) { loadNear(); loadFavs(); } }));
    return btn;
  }

  async function loadNear() {
    const my = ++st.seq;
    const term = st.q.trim();
    const active = term.length >= 2 || Boolean(st.category);
    const title = active ? t('შედეგები', 'Results') : t('ახლოს შენთან', 'Near you');
    const opts = active
      ? { action: button(t('გასუფთავება', 'Clear'), { variant: 'ghost', size: 'sm', icon: 'x', onClick: () => { searchInput.value = ''; st.q = ''; clearBtn.hidden = true; st.category = null; chips.querySelectorAll('.bk-chip.on').forEach((c) => { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); }); history.replaceState({}, '', `${location.pathname}`); loadNear(); } }) }
      : { link: { href: '/book/map', label: t('რუკაზე', 'On the map') } };
    mount(nearSlot, section(title, skeleton(4), opts));
    try {
      const o = origin();
      const r = active
        ? (term.length >= 2 || o.source !== 'gps'
          ? await api.search({ q: term, category: st.category })
          : await api.nearby(o, { radiusKm: 15, category: st.category, limit: 60 }))
        : await api.nearby(o);
      if (my !== st.seq || !alive) return;
      const rows = r.businesses || [];
      const body = h('div', null,
        !active && o.source !== 'gps' ? locateCard(o) : null,
        rows.length ? bizList(rows) : noteCard(active
          ? t('ვერაფერი მოიძებნა. სცადე სხვა სიტყვა ან კატეგორია — თუ ადგილი კატალოგში არ არის, ჩაწერე ვიზიტი ხელით.', 'Nothing found. Try another word or category — if the place is not in the catalogue, add the visit by hand.')
          : t('ამ რადიუსში ჯერ არაფერია. მოძებნე სახელით ან გახსენი რუკა.', 'Nothing in this radius yet. Search by name or open the map.')));
      mount(nearSlot, section(title, body, opts));
    } catch (e) {
      if (my === st.seq && alive) mount(nearSlot, section(title, errorBox(e, loadNear), opts));
    }
  }

  async function loadFavs() {
    try {
      const r = await api.favorites();
      if (!alive) return;
      const rows = r.businesses || [];
      mount(favSlot, rows.length
        ? section(t('რჩეულები', 'Saved places'), bizList(rows.slice(0, 6)))
        : h('p', { class: 'bk-hint' }, icon('heart', { size: 13 }), t('შეინახე ადგილები გულით — აქ გამოჩნდება.', 'Save places with the heart — they show up here.')));
    } catch { if (alive) mount(favSlot, ''); }
  }

  /** „ვიზიტები ხელით“: the old doctor-visit editor lives on at /visits. */
  async function loadVisits() {
    if (!featureOn('visits')) return;
    try {
      const [r, mod] = await Promise.all([get('/api/visits'), import('./visits.js').catch(() => null)]);
      if (!alive) return;
      const at = (v) => new Date(`${v.visitDate}T${String(v.visitTime || '00:00').slice(0, 5)}:00`).getTime();
      const now = Date.now();
      const rows = (r.visits || []).filter((v) => v.active !== false && at(v) >= now).sort((a, b) => at(a) - at(b)).slice(0, 3);
      const label = (v) => [v.doctorFirstName, v.doctorLastName].filter(Boolean).join(' ') || mod?.typeLabel?.(v.doctorType) || v.doctorType;
      const place = (v) => v.addressLabel || v.address || '';
      mount(visitsSlot, section(t('ვიზიტები ხელით', 'Visits by hand'), rows.length
        ? h('div', { class: 'bk-list' }, rows.map((v) => h('a', { class: 'bk-biz-row', href: '/visits', 'data-link': '' },
          tile('stethoscope', 'sky', 44),
          h('div', { class: 'bk-biz-main' },
            h('div', { class: 'bk-name' }, h('span', null, label(v))),
            h('div', { class: 'bk-meta' }, `${dayLabel(dateFromYmd(v.visitDate))}${v.visitTime ? `, ${String(v.visitTime).slice(0, 5)}` : ''}${place(v) ? ` · ${place(v)}` : ''}`)),
          icon('chevronRight', { size: 17, className: 'bk-chev' }))))
        : h('a', { class: 'bk-biz-row bk-solo', href: '/visits', 'data-link': '' },
          tile('plus', 'teal', 44),
          h('div', { class: 'bk-biz-main' },
            h('div', { class: 'bk-name' }, h('span', null, t('ჩაწერე ვიზიტი ხელით', 'Add a visit by hand'))),
            h('div', { class: 'bk-meta wrap' }, t('ექიმი, თარიღი, მისამართი და შეხსენება — თუ ადგილი კატალოგში არ არის', 'A doctor, a date, an address and a reminder — when the place is not in the catalogue'))),
          icon('chevronRight', { size: 17, className: 'bk-chev' })),
      { link: { href: '/visits', label: t('დამატება', 'Add') } }));
    } catch { /* the section stays empty */ }
  }

  loadMine();
  loadNear();
  loadFavs();
  loadVisits();
  return () => { alive = false; };
}

/* ── One place (/book/:slug) ──────────────────────────── */
async function businessView(root, ctx, slug) {
  let alive = true;
  mount(root, backLink('/book', 'MEDIBOOK'), h('div', { class: 'bk-biz' }, h('div', { class: 'bk-main' }, skeleton(5), skeleton(4)), skeleton(4)));
  let b;
  try { b = await api.business(slug); } catch (e) {
    if (alive) mount(root, backLink('/book', 'MEDIBOOK'), errorBox(e, () => businessView(root, ctx, slug)));
    return () => { alive = false; };
  }
  if (!alive) return () => {};
  ctx.setTitle?.(b.name);
  let favorite = Boolean(b.favorite);
  const todayLine = todayHoursLine(b.hours);
  const online = (b.services || []).filter((s) => s.online);
  const startBooking = (svc) => { api.event(b.id, 'BOOK_START'); ctx.navigate(flowHref(b, svc?.id)); };

  const favBtn = action('heart', favorite ? t('შენახულია', 'Saved') : t('შენახვა', 'Save'), async () => {
    const next = !favorite;
    favorite = next;
    paintFav();
    try { await api.setFavorite(b.id, next); invalidate('/api/book'); } catch (e) { favorite = !next; paintFav(); toast(e.message, 'error'); }
  });
  function paintFav() { favBtn.classList.toggle('on', favorite); favBtn.lastChild.textContent = favorite ? t('შენახულია', 'Saved') : t('შენახვა', 'Save'); }
  paintFav();

  const head = h('div', { class: 'card' },
    h('div', { class: 'bk-head' },
      thumb({ ...b, coverUrl: null }, 'lg', { preferLogo: true }),
      h('div', { class: 'bk-head-text' },
        h('h1', { class: 'bk-title' }, b.name, b.claimed ? icon('badgeCheck', { size: 20 }) : null),
        h('div', { class: 'bk-meta wrap' }, [b.categoryLabel, b.district || b.city, distanceLabel(b.distanceKm)].filter(Boolean).join(' · ')),
        h('div', { class: 'bk-facts' }, b.rating != null ? stars(b.rating) : null, h('span', null, ratingLabel(b.rating, b.ratingCount))),
        todayLine ? h('div', { class: `bk-line ${b.openNow ? 'open' : ''}` }, icon('clock', { size: 14 }), h('span', null, b.openNow ? t(`ღიაა · ${todayLine}`, `Open · ${todayLine}`) : todayLine)) : null,
        b.address ? h('a', { class: 'bk-line', href: `/book/map?focus=${encodeURIComponent(b.id)}`, 'data-link': '' }, icon('mapPin', { size: 14 }), h('span', null, b.address), icon('chevronRight', { size: 14 })) : null)),
    h('div', { class: 'bk-actions' },
      action('phone', t('დარეკვა', 'Call'), () => { api.event(b.id, 'CALL'); location.href = telHref(b.phone); }, !b.phone),
      action('navigation', t('მარშრუტი', 'Route'), () => { api.event(b.id, 'ROUTE'); window.open(directionsUrl(b.lat, b.lng), '_blank', 'noopener'); }, b.lat == null),
      b.website || !b.instagram
        ? action('globe', t('საიტი', 'Site'), () => { api.event(b.id, 'WEBSITE'); window.open(b.website, '_blank', 'noopener'); }, !b.website)
        : action('instagram', 'Instagram', () => { api.event(b.id, 'WEBSITE'); window.open(`https://instagram.com/${encodeURIComponent(b.instagram)}`, '_blank', 'noopener'); }),
      action('share', t('გაზიარება', 'Share'), () => shareBusiness(b)),
      favBtn));

  const main = h('div', { class: 'bk-main' });
  if (b.discounts?.length) {
    main.append(section(t('ფასდაკლებები', 'Discounts'), h('div', { class: 'bk-list' }, b.discounts.map((d) => h('div', { class: 'bk-discount' },
      tile('percent', 'neutral', 40),
      h('div', { class: 'bk-biz-main' },
        h('div', { class: 'bk-name' }, h('span', null, d.title)),
        h('div', { class: 'bk-meta wrap' }, [
          d.kind === 'PERCENT' ? `−${d.value}%` : `−${d.value} ₾`,
          d.hoursFrom && d.hoursTo ? `${d.hoursFrom}–${d.hoursTo}` : null,
          d.endsOn ? t(`${d.endsOn}-მდე`, `until ${d.endsOn}`) : null,
          d.code ? t(`კოდი ${d.code}`, `code ${d.code}`) : null,
        ].filter(Boolean).join(' · '))))))));
  }
  if (b.claimed && b.services?.length) {
    const groups = new Map();
    for (const s of b.services) { const g = s.group || ''; groups.set(g, [...(groups.get(g) || []), s]); }
    main.append(section(t('სერვისები', 'Services'), h('div', null, [...groups.entries()].map(([group, list]) => h('div', { class: 'bk-group-wrap' },
      group ? h('div', { class: 'bk-group' }, group) : null,
      h('div', { class: 'bk-list' }, list.map((svc) => h('div', { class: 'bk-svc' },
        h('div', { class: 'bk-svc-main' }, h('b', null, svc.name), h('span', null, [durationLabel(svc.durationMin), svc.description].filter(Boolean).join(' · '))),
        h('div', { class: 'bk-svc-trail' },
          h('span', { class: 'bk-price' }, priceLabel(svc.price, svc.priceTo, svc.currency)),
          b.bookable && svc.online ? h('button', { type: 'button', class: 'bk-pill bk-pill-btn', onClick: () => startBooking(svc) }, t('ჩაწერა', 'Book')) : null)))))))));
  }
  if (b.staff?.length) {
    main.append(section(t('გუნდი', 'The team'), h('div', { class: 'bk-team' }, b.staff.map((p) => h('div', { class: 'bk-person' },
      // The initial as typed: upper-casing Georgian would turn it into Mtavruli.
      p.imageUrl ? h('img', { class: 'bk-avatar', src: p.imageUrl, alt: '' }) : h('span', { class: 'bk-avatar', style: p.color ? `background:${p.color};color:#fff` : null }, p.name.trim().slice(0, 1)),
      h('b', null, p.name), p.title ? h('span', null, p.title) : null)))));
  }
  if (hasHours(b.hours)) {
    main.append(section(t('სამუშაო საათები', 'Opening hours'), h('div', { class: 'bk-list' }, h('div', { class: 'bk-hours' }, weekHours(b.hours).map((r) => h('div', { class: r.today ? 'today' : '' }, h('span', null, r.day), h('span', null, r.ranges)))))));
  }
  if (b.description) {
    const text = h('p', { class: `bk-about ${b.description.length > 220 ? 'clamp' : ''}` }, b.description);
    const more = b.description.length > 220 ? h('button', { type: 'button', class: 'bk-more', onClick: () => { const open = text.classList.toggle('clamp'); more.textContent = open ? t('მეტი', 'More') : t('ნაკლები', 'Less'); } }, t('მეტი', 'More')) : null;
    main.append(section(t('შესახებ', 'About'), h('div', { class: 'card' }, text, more)));
  }
  if (b.reviews?.length) {
    main.append(section(t('შეფასებები', 'Reviews'), h('div', { class: 'bk-list' }, b.reviews.map((r) => h('div', { class: 'bk-review' },
      h('div', { class: 'bk-review-head' }, stars(r.rating, 12), h('span', null, r.author || t('მომხმარებელი', 'A client'))),
      r.text ? h('p', null, r.text) : null,
      r.reply ? h('div', { class: 'bk-reply' }, t('პასუხი: ', 'Reply: '), r.reply) : null)))));
  }
  if (!main.childElementCount) main.append(noteCard(t('ამ ადგილზე ჯერ მხოლოდ საჯარო ფაქტები გვაქვს — დარეკე და ჰკითხე.', 'For this place we only have the public facts so far — call and ask.')));

  const side = h('aside', { class: 'bk-side' });
  if (b.bookable && online.length) {
    side.append(h('div', { class: 'card bk-side-card' },
      h('h3', null, t('ჩაწერა ონლაინ', 'Book online')),
      h('p', { class: 'muted' }, b.fromPrice != null
        ? t(`${online.length} სერვისი · ${fromPriceLabel(b.fromPrice)}`, `${online.length} ${online.length === 1 ? 'service' : 'services'} · ${fromPriceLabel(b.fromPrice)}`)
        : t(`${online.length} სერვისი`, `${online.length} ${online.length === 1 ? 'service' : 'services'}`)),
      button(t('ჩაწერა', 'Book an appointment'), { variant: 'book', size: 'lg', class: 'btn-block', icon: 'calendarCheck', onClick: () => startBooking() }),
      h('p', { class: 'faint bk-policy' }, t(`უფასო გაუქმება ვიზიტამდე ${b.settings.cancelHours} საათით ადრე. გადახდა ადგილზე — MEDICARD-ში არაფერი იხდის.`, `Free cancellation up to ${b.settings.cancelHours} hours before. You pay on site — nothing is charged in MEDICARD.`)),
      sideFacts(b, todayLine)));
  } else if (b.claimed) {
    side.append(h('div', { class: 'card bk-side-card' },
      h('h3', null, t('ონლაინ ჯავშნა ამჟამად გამორთულია', 'Online booking is off right now')),
      h('p', { class: 'muted' }, t('დარეკე და ჩაეწერე ტელეფონით — შეხსენებას MEDICARD მოგცემს, თუ ვიზიტს ხელით ჩაწერ.', 'Call to book by phone — MEDICARD will remind you if you add the visit by hand.')),
      b.phone ? button(t('დარეკვა', 'Call'), { icon: 'phone', href: telHref(b.phone), external: true, class: 'btn-block' }) : null,
      sideFacts(b, todayLine)));
  } else {
    side.append(h('div', { class: 'card bk-side-card' },
      h('h3', null, t('ეს ადგილი ჯერ არ იღებს ონლაინ ჯავშნებს', 'This place does not take online bookings yet')),
      h('p', { class: 'muted' }, t('დარეკე და ჩაეწერე ტელეფონით, ან ჩაწერე ვიზიტი ხელით — შეხსენებას MEDICARD მოგცემს.', 'Call to book by phone, or add the visit by hand — MEDICARD will remind you.')),
      b.phone ? button(t('დარეკვა', 'Call'), { icon: 'phone', href: telHref(b.phone), external: true, class: 'btn-block' }) : null,
      featureOn('visits') ? button(t('ვიზიტის ჩაწერა ხელით', 'Add the visit by hand'), { variant: 'ghost', icon: 'plus', href: '/visits', class: 'btn-block' }) : null,
      sideFacts(b, todayLine),
      h('a', { class: 'bk-owner', href: '/business' }, icon('store', { size: 16 }), h('span', null, t('შენი ბიზნესია? დაადასტურე და ჩართე ონლაინ ჯავშნა', 'Is this your business? Claim it and turn on online booking')), icon('chevronRight', { size: 14 }))));
  }

  mount(root, backLink('/book', 'MEDIBOOK'),
    b.gallery?.length ? h('div', { class: 'bk-gallery' }, b.gallery.map((src) => h('img', { src, alt: '', loading: 'lazy' }))) : null,
    head,
    h('div', { class: 'bk-biz' }, main, side));
  return () => { alive = false; };

  function action(ic, label, onClick, disabled = false) {
    return h('button', { type: 'button', class: 'bk-action', disabled, 'aria-label': label, onClick }, icon(ic, { size: 18 }), h('span', null, label));
  }
}

function sideFacts(b, todayLine) {
  return h('div', { class: 'bk-side-facts' },
    todayLine ? h('div', { class: `bk-line ${b.openNow ? 'open' : ''}` }, icon('clock', { size: 14 }), h('span', null, todayLine)) : null,
    b.address ? h('a', { class: 'bk-line', href: `/book/map?focus=${encodeURIComponent(b.id)}`, 'data-link': '' }, icon('mapPin', { size: 14 }), h('span', null, b.address)) : null,
    b.phone ? h('a', { class: 'bk-line', href: telHref(b.phone) }, icon('phone', { size: 14 }), h('span', null, b.phone)) : null);
}

/* ── Booking flow (/book/:slug/book?serviceId=&staffId=) ─────────────────────────────────────────────────── */
async function flowView(root, ctx, slug) {
  let alive = true;
  mount(root, backLink(`/book/${encodeURIComponent(slug)}`, t('ბიზნესის გვერდი', 'Business page')), h('div', { class: 'bk-flow' }, h('div', null, skeleton(5), skeleton(4)), skeleton(5)));
  let b;
  try { b = await api.business(slug); } catch (e) {
    if (alive) mount(root, backLink('/book', 'MEDIBOOK'), errorBox(e, () => flowView(root, ctx, slug)));
    return () => { alive = false; };
  }
  if (!alive) return () => {};
  ctx.setTitle?.(t(`ჯავშანი · ${b.name}`, `Booking · ${b.name}`));
  const services = (b.services || []).filter((s) => s.online);
  if (!b.bookable || !services.length) {
    mount(root, backLink(bizHref(b), b.name), h('div', { class: 'card' }, h('div', { class: 'empty' },
      h('div', { class: 'empty-art' }, icon('phone', { size: 26 })),
      h('h3', null, t('ეს ადგილი ჯერ არ იღებს ონლაინ ჯავშნებს', 'This place does not take online bookings yet')),
      h('p', null, t('დარეკე და ჩაეწერე ტელეფონით.', 'Call to book by phone.')),
      b.phone ? button(t('დარეკვა', 'Call'), { icon: 'phone', href: telHref(b.phone), external: true }) : null)));
    return () => { alive = false; };
  }

  const st = {
    serviceId: services.some((s) => s.id === ctx.query.serviceId) ? ctx.query.serviceId : services[0].id,
    staffId: typeof ctx.query.staffId === 'string' && ctx.query.staffId ? ctx.query.staffId : null,
    from: ymdLocal(), date: ymdLocal(), strip: null, slots: null, slot: null, seq: 0, daySeq: 0,
  };
  const today = ymdLocal();
  const horizon = Number(b.settings?.horizonDays) || 30;
  const service = () => services.find((s) => s.id === st.serviceId) || services[0];
  const eligibleStaff = () => (b.staff || []).filter((p) => p.bookable && (!p.serviceIds.length || p.serviceIds.includes(service().id)));
  const showStaff = () => Boolean(b.settings?.allowStaffChoice) && eligibleStaff().length > 1;
  const staffName = () => (b.staff || []).find((p) => p.id === st.staffId)?.name || null;

  const svcList = h('div', { class: 'bk-list' });
  const staffStep = h('div', { class: 'bk-step', hidden: true });
  const staffChips = h('div', { class: 'bk-chips' });
  staffStep.append(h('h2', null, h('span', { class: 'bk-step-n' }, '2'), t('ვინ', 'With whom')), staffChips);
  const daysEl = h('div', { class: 'bk-days' });
  const prevBtn = h('button', { type: 'button', class: 'bk-day-nav', 'aria-label': t('წინა დღეები', 'Earlier days'), onClick: () => { st.from = addDaysYmd(st.from, -14); if (daysBetween(today, st.from) < 0) st.from = today; loadDays(); } }, icon('chevronLeft', { size: 18 }));
  const nextBtn = h('button', { type: 'button', class: 'bk-day-nav', 'aria-label': t('შემდეგი დღეები', 'Later days'), onClick: () => { st.from = addDaysYmd(st.from, 14); loadDays(); } }, icon('chevronRight', { size: 18 }));
  const slotsEl = h('div');
  const noteInput = textarea({ placeholder: t('მაგ. პირველი ვიზიტი, მოდი ადრე 10 წუთით…', 'e.g. first visit, I may be 10 minutes early…'), maxlength: 500, rows: 3, 'aria-label': t('შენიშვნა', 'Note') });
  const summary = h('div', { class: 'card bk-summary' });
  const confirmBtn = button(t('ჯავშნის დადასტურება', 'Confirm booking'), { variant: 'book', size: 'lg', class: 'btn-block', disabled: true, onClick: () => confirm() });
  const policy = t(`უფასო გაუქმება ვიზიტამდე ${b.settings.cancelHours} საათით ადრე. გადახდა ადგილზე — MEDICARD-ში არაფერი იხდის.`, `Free cancellation up to ${b.settings.cancelHours} hours before. You pay on site — nothing is charged in MEDICARD.`);
  const stepN = (n) => h('span', { class: 'bk-step-n' }, String(n));

  const steps = h('div', { class: 'bk-main' },
    h('div', { class: 'bk-step' }, h('h2', null, stepN(1), t('სერვისი', 'Service')), svcList),
    staffStep,
    h('div', { class: 'bk-step' }, h('h2', null, stepN(3), t('დღე', 'Day')), h('div', { class: 'bk-days-wrap' }, prevBtn, daysEl, nextBtn)),
    h('div', { class: 'bk-step' }, h('h2', null, stepN(4), t('დრო', 'Time')), slotsEl),
    h('div', { class: 'bk-step' }, h('h2', null, stepN(5), t('შენიშვნა (არასავალდებულო)', 'Note (optional)')), noteInput,
      b.settings.bookingNote ? h('div', { class: 'bk-note-box' }, icon('info', { size: 15 }), h('span', null, b.settings.bookingNote)) : null));
  mount(root, backLink(bizHref(b), b.name),
    h('header', { class: 'page-head' }, h('div', { class: 'page-head-text' }, h('h1', null, t('ჯავშანი', 'Booking')), h('p', null, t('აირჩიე სერვისი, დღე და დრო — ბიზნესი დაგელოდება.', 'Pick a service, a day and a time — the business will expect you.')))),
    h('div', { class: 'bk-flow' }, steps, h('aside', { class: 'bk-side' }, summary)));
  api.event(b.id, 'BOOK_START');

  function paintServices() {
    mount(svcList, services.map((svc) => h('button', { type: 'button', class: `bk-radio-row ${svc.id === st.serviceId ? 'on' : ''}`, 'aria-pressed': svc.id === st.serviceId ? 'true' : 'false', onClick: () => {
      if (svc.id === st.serviceId) return;
      st.serviceId = svc.id;
      if (st.staffId && !eligibleStaff().some((p) => p.id === st.staffId)) st.staffId = null;
      paintServices(); paintStaff(); paintSummary(); loadDays();
    } },
    h('span', { class: 'bk-radio' }, svc.id === st.serviceId ? icon('check', { size: 13, stroke: 3 }) : null),
    h('div', { class: 'bk-svc-main' }, h('b', null, svc.name), h('span', null, [durationLabel(svc.durationMin), svc.description].filter(Boolean).join(' · '))),
    h('span', { class: 'bk-price' }, priceLabel(svc.price, svc.priceTo, svc.currency)))));
  }
  function paintStaff() {
    staffStep.hidden = !showStaff();
    // Steps stay numbered 1, 2, 3… whether or not „ვინ“ is shown.
    let n = 0;
    for (const step of steps.querySelectorAll('.bk-step')) { if (!step.hidden) { n += 1; const num = step.querySelector('.bk-step-n'); if (num) num.textContent = String(n); } }
    if (staffStep.hidden) { if (st.staffId && !eligibleStaff().some((p) => p.id === st.staffId)) st.staffId = null; return; }
    const chip = (id, label, ic) => h('button', { type: 'button', class: `bk-chip ${st.staffId === id ? 'on' : ''}`, 'aria-pressed': st.staffId === id ? 'true' : 'false', onClick: () => { st.staffId = id; paintStaff(); paintSummary(); loadDays(); } }, icon(ic, { size: 14 }), label);
    mount(staffChips, chip(null, t('ნებისმიერი', 'Anyone'), 'users'), eligibleStaff().map((p) => chip(p.id, p.name, 'user')));
  }
  function paintDays() {
    const days = st.strip?.days || Array.from({ length: 14 }, (_, i) => ({ date: addDaysYmd(st.from, i), count: -1, closed: false }));
    prevBtn.disabled = daysBetween(today, st.from) <= 0;
    nextBtn.disabled = daysBetween(today, st.from) + 14 > horizon;
    mount(daysEl, days.map((d) => {
      const dt = dateFromYmd(d.date);
      const on = d.date === st.date;
      const none = d.count === 0 || d.closed;
      return h('button', { type: 'button', class: `bk-day ${on ? 'on' : ''}`, disabled: none, 'aria-pressed': on ? 'true' : 'false', 'aria-label': `${DAYS_LONG[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]}`, onClick: () => { st.date = d.date; paintDays(); loadSlots(); } },
        h('span', null, DAYS[dt.getDay()]), h('b', null, String(dt.getDate())), h('small', null, MONTHS[dt.getMonth()]));
    }));
  }
  function paintSlots() {
    if (!st.slots) { mount(slotsEl, h('p', { class: 'faint' }, t('თავისუფალ დროებს ვეძებ…', 'Looking for free times…'))); return; }
    if (!st.slots.slots.length) {
      mount(slotsEl, noteCard(st.slots.reason === 'closed' || st.slots.reason === 'no-staff' ? t('ამ დღეს დახურულია. აირჩიე სხვა დღე.', 'Closed on this day. Pick another one.')
        : st.slots.reason === 'horizon' ? t('ასე შორს ჯერ არ იწერენ.', 'Bookings do not open that far ahead yet.')
          : st.slots.reason === 'past' ? t('ეს დღე უკვე გავიდა.', 'This day has passed.')
            : t('ამ დღეს თავისუფალი დრო არ დარჩა. აირჩიე სხვა დღე ან სხვა თანამშრომელი.', 'No free time left on this day. Pick another day or another person.')));
      return;
    }
    const groups = [[t('დილა', 'Morning'), []], [t('დღე', 'Afternoon'), []], [t('საღამო', 'Evening'), []]];
    for (const sl of st.slots.slots) { const hh = Number(sl.time.split(':')[0]); (hh < 12 ? groups[0] : hh < 17 ? groups[1] : groups[2])[1].push(sl); }
    mount(slotsEl, groups.filter((g) => g[1].length).map(([label, list]) => h('div', null,
      h('div', { class: 'bk-part' }, label),
      h('div', { class: 'bk-slots' }, list.map((sl) => h('button', { type: 'button', class: `bk-slot ${st.slot?.startsAt === sl.startsAt ? 'on' : ''}`, 'aria-pressed': st.slot?.startsAt === sl.startsAt ? 'true' : 'false', onClick: () => { st.slot = sl; paintSlots(); paintSummary(); } }, sl.time))))));
  }
  function paintSummary() {
    const svc = service();
    mount(summary,
      h('div', { class: 'bk-summary-biz' }, thumb(b, 'sm', { preferLogo: true }), h('div', null, h('b', null, b.name), h('span', null, b.categoryLabel))),
      h('dl', null,
        h('dt', null, t('სერვისი', 'Service')), h('dd', null, `${svc.name} · ${durationLabel(svc.durationMin)}`),
        h('dt', null, t('ფასი', 'Price')), h('dd', null, priceLabel(svc.price, svc.priceTo, svc.currency)),
        showStaff() ? [h('dt', null, t('ვინ', 'With')), h('dd', null, staffName() || t('ნებისმიერი', 'Anyone'))] : null,
        h('dt', null, t('როდის', 'When')), h('dd', { class: st.slot ? '' : 'faint' }, st.slot ? whenLabel(st.slot.startsAt) : t('აირჩიე დღე და დრო', 'Pick a day and a time'))),
      confirmBtn,
      h('p', { class: 'faint bk-policy' }, policy));
    confirmBtn.disabled = !st.slot;
  }
  async function loadDays() {
    const my = ++st.daySeq;
    st.strip = null; paintDays();
    try {
      const r = await api.days(b.id, { serviceId: service().id, staffId: st.staffId, days: 14, from: st.from });
      if (my !== st.daySeq || !alive) return;
      st.strip = r;
      const open = r.days.find((d) => d.date === st.date && d.count > 0) || r.days.find((d) => d.count > 0);
      if (open) st.date = open.date; else st.date = r.days[0]?.date || st.date;
      paintDays();
      loadSlots();
    } catch (e) {
      if (my !== st.daySeq || !alive) return;
      paintDays();
      mount(slotsEl, errorBox(e, loadDays));
    }
  }
  async function loadSlots() {
    const my = ++st.seq;
    st.slots = null; st.slot = null; paintSlots(); paintSummary();
    try {
      const r = await api.availability(b.id, { serviceId: service().id, date: st.date, staffId: st.staffId });
      if (my !== st.seq || !alive) return;
      st.slots = r;
    } catch {
      if (my !== st.seq || !alive) return;
      st.slots = { slots: [], closed: true, reason: 'error' };
    }
    paintSlots();
  }
  async function confirm() {
    const svc = service();
    if (!st.slot) return;
    let gated = false;
    await busy(confirmBtn, async () => {
      try {
        const { appointment } = await api.create({
          businessId: b.id, serviceId: svc.id, startsAt: st.slot.startsAt,
          staffId: st.staffId ?? (st.slot.staffIds.length === 1 ? st.slot.staffIds[0] : null),
          note: noteInput.value.trim() || undefined,
        });
        invalidate('/api/book');
        showDone(appointment);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'PHONE_VERIFICATION_REQUIRED') { gated = true; return; }
        if (e instanceof ApiError && e.code === 'SLOT_TAKEN') {
          toast(e.message || t('ეს დრო უკვე დაიკავეს — აირჩიე სხვა.', 'This time was just taken — pick another one.'), 'error');
          loadSlots();
          return;
        }
        toast(e?.message || t('ვერ ჩაიწერა. სცადე ხელახლა.', 'Could not book. Please try again.'), 'error');
      }
    });
    // The phone gate runs outside the busy state; once the number is verified the same booking is sent again.
    if (gated && alive && await offerPhone(t('ჯავშნისთვის ტელეფონის ნომერი საჭიროა — ბიზნესი ასე დაგიკავშირდება.', 'A phone number is needed to book — this is how the business reaches you.')) && alive) confirm();
  }
  function showDone(a) {
    const pending = a.status === 'PENDING';
    mount(root, backLink('/book', 'MEDIBOOK'), h('div', { class: 'card bk-done' },
      h('div', { class: `bk-done-mark ${pending ? 'pending' : ''}` }, icon(pending ? 'clock' : 'check', { size: 32, stroke: 2.6 })),
      h('h2', null, pending ? t('ჯავშანი გაგზავნილია', 'Booking sent') : t('ჩაწერილი ხარ', 'You are booked')),
      h('p', null, `${a.serviceName} · ${a.business?.name ?? b.name}`),
      h('p', null, `${whenLabel(a.startsAt)}${a.staffName ? ` · ${a.staffName}` : ''}`),
      h('p', { class: 'faint' }, pending ? t('ბიზნესი დაადასტურებს და შეტყობინება მოგივა.', 'The business will confirm and you will get a notification.') : t('შეხსენება მოგივა წინა დღეს და 2 საათით ადრე.', 'You will be reminded the day before and two hours ahead.')),
      h('div', { class: 'bk-done-actions' },
        button(t('ჯავშნის დეტალები', 'Booking details'), { onClick: () => ctx.navigate(`/book/appointments/${encodeURIComponent(a.id)}`, { replace: true }) }),
        button(t('MEDIBOOK-ზე დაბრუნება', 'Back to MEDIBOOK'), { variant: 'ghost', href: '/book' }))));
    window.scrollTo({ top: 0 });
  }

  paintServices(); paintStaff(); paintDays(); paintSlots(); paintSummary();
  loadDays();
  return () => { alive = false; };
}

/* ── One booking (/book/appointments/:id?review=1) ────────────────────────────────────────────────────────── */
async function appointmentView(root, ctx, id) {
  let alive = true;
  let askedReview = false;
  const draw = async () => {
    mount(root, backLink('/book', 'MEDIBOOK'), h('div', { class: 'bk-narrow' }, skeleton(5), skeleton(3)));
    let a;
    try { a = await api.appointment(id); } catch (e) {
      if (alive) mount(root, backLink('/book', 'MEDIBOOK'), errorBox(e, draw));
      return;
    }
    if (!alive) return;
    ctx.setTitle?.(a.serviceName);
    const past = new Date(a.endsAt).getTime() < Date.now();
    const open = (a.status === 'PENDING' || a.status === 'CONFIRMED') && !past;
    const canReview = !a.reviewed && (a.status === 'COMPLETED' || (a.status === 'CONFIRMED' && past));
    const biz = a.business;

    const details = h('div', { class: 'card bk-appt' },
      h('div', null, statusBadge(a.status)),
      h('h2', null, a.serviceName),
      h('div', { class: 'bk-when' }, whenLabel(a.startsAt)),
      h('div', { class: 'bk-meta' }, [
        durationLabel(a.durationMin),
        a.staffName ? t(`${a.staffName}`, `with ${a.staffName}`) : null,
        `${priceLabel(a.price)}${a.discountAmount ? t(` (ფასდაკლება −${a.discountAmount} ₾)`, ` (discount −${a.discountAmount} ₾)`) : ''}`,
      ].filter(Boolean).join(' · ')),
      a.note ? h('div', { class: 'bk-meta' }, t('შენიშვნა: ', 'Note: '), a.note) : null,
      a.status === 'CANCELLED' ? h('div', { class: 'faint', style: { fontSize: '13px' } }, `${a.cancelledBy === 'BUSINESS' ? t('გააუქმა ბიზნესმა', 'Cancelled by the business') : t('გააუქმე შენ', 'Cancelled by you')}${a.cancelReason ? ` · ${a.cancelReason}` : ''}`) : null);

    const bizCard = biz ? h('a', { class: 'bk-biz-row bk-solo', href: bizHref(biz), 'data-link': '' },
      thumb(biz, 'sm', { preferLogo: true }),
      h('div', { class: 'bk-biz-main' },
        h('div', { class: 'bk-name' }, h('span', null, biz.name)),
        biz.address ? h('div', { class: 'bk-meta wrap' }, biz.address) : null),
      icon('chevronRight', { size: 17, className: 'bk-chev' })) : null;

    const actions = h('div', { class: 'bk-actions', style: { marginTop: 0 } },
      h('button', { type: 'button', class: 'bk-action', disabled: !biz?.phone, onClick: () => { location.href = telHref(biz.phone); } }, icon('phone', { size: 18 }), h('span', null, t('დარეკვა', 'Call'))),
      h('button', { type: 'button', class: 'bk-action', disabled: biz?.lat == null, onClick: () => window.open(directionsUrl(biz.lat, biz.lng), '_blank', 'noopener') }, icon('navigation', { size: 18 }), h('span', null, t('მარშრუტი', 'Route'))),
      open ? h('button', { type: 'button', class: 'bk-action', onClick: () => downloadIcs(a) }, icon('calendarPlus', { size: 18 }), h('span', null, t('კალენდარში', 'Calendar'))) : null);

    const reviewCta = canReview ? h('button', { type: 'button', class: 'bk-review-cta', onClick: () => openReview(a, draw) },
      icon('star', { size: 20 }),
      h('div', { class: 'bk-biz-main' },
        h('div', { class: 'bk-name' }, h('span', null, t('როგორ იყო?', 'How was it?'))),
        h('div', { class: 'bk-meta wrap' }, t('შეაფასე ერთი შეხებით — ეს სხვებს ეხმარება არჩევაში', 'Rate it with one tap — it helps others choose'))),
      icon('chevronRight', { size: 17, className: 'bk-chev' })) : null;

    const cancelWrap = open ? h('div', { class: 'bk-cancel-wrap' },
      button(t('ჯავშნის გაუქმება', 'Cancel booking'), { variant: 'ghost', onClick: () => cancel(a) }),
      h('p', null, a.canCancelFree
        ? t(`უფასო გაუქმება ვიზიტამდე ${a.cancelHours} საათით ადრე`, `Free cancellation up to ${a.cancelHours} hours before`)
        : t('გაუქმების ვადა გასულია — თუ ვერ მოხვალ, მაინც გააუქმე, რომ დრო სხვას დარჩეს', 'The free window has passed — if you cannot make it, cancel anyway so the slot goes to someone else'))) : null;
    const again = !open && biz && a.status !== 'PENDING'
      ? button(t('ისევ ჩაწერა', 'Book again'), { variant: 'secondary', icon: 'repeat', href: flowHref(biz, a.serviceId) })
      : null;

    mount(root, backLink('/book', 'MEDIBOOK'), h('div', { class: 'bk-narrow' },
      details, bizCard, actions, reviewCta,
      a.reviewed ? h('p', { class: 'faint', style: { textAlign: 'center', fontSize: '13px' } }, t('მადლობა შეფასებისთვის.', 'Thanks for your review.')) : null,
      cancelWrap, again));
    if (ctx.query.review === '1' && canReview && !askedReview) { askedReview = true; openReview(a, draw); }
  };

  async function cancel(a) {
    const ok = await confirmDialog({
      title: t('ჯავშნის გაუქმება', 'Cancel booking'),
      body: a.canCancelFree
        ? t(`${a.serviceName}, ${whenLabel(a.startsAt)}. ბიზნესს შეტყობინება მივა.`, `${a.serviceName}, ${whenLabel(a.startsAt)}. The business will be notified.`)
        : t(`გაუქმების ვადა (${a.cancelHours} სთ) გასულია — ბიზნესი ამას ხედავს. მაინც გავაუქმო?`, `The free-cancellation window (${a.cancelHours} h) has passed — the business sees that. Cancel anyway?`),
      confirm: t('გაუქმება', 'Cancel booking'), cancel: t('არა', 'No'), danger: true,
    });
    if (!ok) return;
    try {
      await api.cancel(a.id);
      invalidate('/api/book');
      toast(t('ჯავშანი გაუქმდა', 'Booking cancelled'), 'info');
      draw();
    } catch (e) { toast(e?.message || t('ვერ გაუქმდა.', 'Could not cancel.'), 'error'); }
  }

  await draw();
  return () => { alive = false; };
}

/** 1–5 stars and a few words; one review per booking (the server replaces an earlier one). */
function openReview(a, onDone) {
  let rating = 0;
  const pick = h('div', { class: 'bk-stars-pick' });
  const text = textarea({ placeholder: t('რამდენიმე სიტყვა (არასავალდებულო)', 'A few words (optional)'), maxlength: 1000, rows: 3 });
  const send = button(t('შეფასების გაგზავნა', 'Send review'), { disabled: true });
  const paint = () => mount(pick, [1, 2, 3, 4, 5].map((i) => h('button', { type: 'button', class: `bk-star-btn ${i <= rating ? 'on' : ''}`, 'aria-label': t(`${i} ვარსკვლავი`, `${i} ${i === 1 ? 'star' : 'stars'}`), 'aria-pressed': i <= rating ? 'true' : 'false', onClick: () => { rating = i; send.disabled = false; paint(); } }, icon('star', { size: 34, stroke: 1.6 }))));
  paint();
  const m = openModal({
    title: t('შეაფასე ვიზიტი', 'Rate your visit'),
    size: 'sm',
    body: h('div', { class: 'stack' },
      h('p', { class: 'muted' }, `${a.business?.name ?? ''} · ${a.serviceName}`),
      pick, text),
    footer: (close) => {
      send.addEventListener('click', () => busy(send, async () => {
        try {
          await api.review(a.id, { rating, text: text.value.trim() || undefined });
          invalidate('/api/book');
          toast(t('მადლობა შეფასებისთვის', 'Thanks for your review'));
          close();
          onDone?.();
        } catch (e) { toast(e?.message || t('შეფასება ვერ შეინახა.', 'Could not save the review.'), 'error'); }
      }));
      return [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), send];
    },
  });
  return m;
}

/** An .ics file for the person's own calendar: place · service · time, nothing else. */
function downloadIcs(a) {
  const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MEDICARD//MEDIBOOK//EN', 'BEGIN:VEVENT',
    `UID:${a.id}@medicard.ge`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(a.startsAt)}`, `DTEND:${stamp(a.endsAt)}`,
    `SUMMARY:${esc(`${a.serviceName} · ${a.business?.name || 'MEDIBOOK'}`)}`,
    a.business?.address ? `LOCATION:${esc(a.business.address)}` : null,
    a.staffName ? `DESCRIPTION:${esc(t(`თანამშრომელი: ${a.staffName}`, `With ${a.staffName}`))}` : null,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  const link = h('a', { href: url, download: 'medibook.ics', hidden: true });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── Map (/book/map?category=&focus=<id>) ────────────────────────────────────────────────────────────────────
   Mapbox GL JS like the app's BookMap: one dot per business in its category colour, a ring for places that take
   bookings, clusters when dense, the person's blue dot once they asked for it. Pins reload as the view moves. */
const MAP_LIMIT = 500; // /api/book/map's default cap
let mapboxPromise = null;
function loadMapbox() {
  if (mapboxPromise) return mapboxPromise;
  mapboxPromise = new Promise((resolve, reject) => {
    if (window.mapboxgl) { resolve(window.mapboxgl); return; }
    const css = h('link', { rel: 'stylesheet', href: 'https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css' });
    const js = h('script', { src: 'https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js' });
    js.onload = () => resolve(window.mapboxgl);
    js.onerror = () => { mapboxPromise = null; reject(new Error(t('რუკა ვერ ჩაიტვირთა. შეამოწმე ინტერნეტი.', 'The map couldn’t load. Check your internet connection.'))); };
    document.head.append(css, js);
  });
  return mapboxPromise;
}

async function mapView(root, ctx) {
  let alive = true;
  let map = null;
  let timer = null;
  root.style.animation = 'none';
  const st = { category: validCategory(ctx.query.category), selected: null, selectedBiz: null, seq: 0, features: { type: 'FeatureCollection', features: [] } };
  const mapEl = h('div', { class: 'bk-map' });
  const cardSlot = h('div', { class: 'bk-map-card', hidden: true });
  const countEl = h('div', { class: 'bk-map-count', hidden: true, 'aria-live': 'polite' });
  const chips = categoryChips(st.category, (next) => {
    st.category = next;
    // A filter that leaves the selected place out closes its card too — its pin is gone from the map.
    if (next && st.selectedBiz && String(st.selectedBiz.category || '').toUpperCase() !== next) select(null);
    refresh();
  });
  const locateBtn = h('button', { type: 'button', class: 'bk-round', title: t('ჩემი მდებარეობა', 'My location'), 'aria-label': t('ჩემი მდებარეობა', 'My location') }, icon('locate', { size: 20 }));
  const backBtn = h('a', { class: 'bk-round', href: '/book', 'data-link': '', 'aria-label': t('უკან', 'Back') }, icon('chevronLeft', { size: 20 }));
  mount(root, h('div', { class: 'bk-map-page' }, mapEl, h('div', { class: 'bk-map-top' }, backBtn, chips, locateBtn), countEl, cardSlot));

  let token = session.mapboxToken || null;
  if (!token) { try { token = (await get('/api/app/status'))?.mapboxToken || null; } catch { token = null; } }
  let mapboxgl = null;
  if (token) { try { mapboxgl = await loadMapbox(); } catch { mapboxgl = null; } }
  await ensureCss();
  if (!alive) return () => {};
  if (!token || !mapboxgl) {
    root.style.animation = '';
    mount(root, backLink('/book', 'MEDIBOOK'), h('div', { class: 'card' }, h('div', { class: 'empty' },
      h('div', { class: 'empty-art' }, icon('map', { size: 26 })),
      h('h3', null, t('რუკა ახლა მიუწვდომელია', 'The map is unavailable right now')),
      h('p', null, t('მოძებნე ადგილები სახელით ან კატეგორიით — სია იმავე კატალოგიდანაა.', 'Search places by name or category — the list comes from the same catalogue.')),
      button(t('MEDIBOOK-ზე დაბრუნება', 'Back to MEDIBOOK'), { href: '/book' }))));
    return () => { alive = false; };
  }

  // The style follows the app theme: the theme button only flips `data-theme` on <html>, so the map watches
  // that attribute and swaps light-v11 ↔ dark-v11; a style swap drops our source and layers, `style.load` re-adds them.
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const styleFor = (d) => (d ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11');
  let dark = isDark();
  const colorExpr = ['match', ['get', 'category'], ...CATEGORIES.flatMap((c) => [c.id, c.color]), '#64748B'];
  const o = origin();
  mapboxgl.accessToken = token;
  map = new mapboxgl.Map({ container: mapEl, style: styleFor(dark), center: [o.lng, o.lat], zoom: o.source === 'default' ? 12 : 13.5, attributionControl: false, projection: 'mercator' });
  map.addControl(new mapboxgl.AttributionControl({ compact: true }));
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
  let me = null;
  const placeMe = () => {
    if (!gps) return;
    if (!me) me = new mapboxgl.Marker({ element: h('div', { class: 'bk-me' }) }).setLngLat([gps.lng, gps.lat]).addTo(map);
    else me.setLngLat([gps.lng, gps.lat]);
  };
  locateBtn.addEventListener('click', () => busy(locateBtn, async () => {
    if (await locate()) { placeMe(); map.easeTo({ center: [gps.lng, gps.lat], zoom: Math.max(map.getZoom(), 14), duration: 600 }); }
  }));

  /** Source + layers for the current theme; the last pins come back at once after a style swap. */
  function addLayers() {
    if (map.getSource('pins')) return;
    // Lilac as a line: clusters are neutral discs with a lilac ring (mobile mapHtml.ts).
    const ink = dark ? '#C6B2F5' : '#7A58C9';
    map.addSource('pins', { type: 'geojson', data: st.features, cluster: true, clusterMaxZoom: 15, clusterRadius: 44 });
    map.addLayer({ id: 'clusters', type: 'circle', source: 'pins', filter: ['has', 'point_count'], paint: { 'circle-color': dark ? '#151319' : '#FFFFFF', 'circle-opacity': 0.96, 'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26], 'circle-stroke-width': 2, 'circle-stroke-color': ink } });
    map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'pins', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'] }, paint: { 'text-color': ink } });
    map.addLayer({ id: 'pin-ring', type: 'circle', source: 'pins', filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'bookable'], 1]], paint: { 'circle-color': 'transparent', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 9, 16, 15], 'circle-stroke-width': 2, 'circle-stroke-color': colorExpr, 'circle-stroke-opacity': 0.55 } });
    map.addLayer({ id: 'pin', type: 'circle', source: 'pins', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': colorExpr, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 5, 16, 9], 'circle-stroke-width': 2, 'circle-stroke-color': dark ? '#0b1220' : '#ffffff', 'circle-opacity': 0.92 } });
    map.addLayer({ id: 'pin-selected', type: 'circle', source: 'pins', filter: ['==', ['get', 'id'], st.selected || ''], paint: { 'circle-color': 'transparent', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 12, 16, 20], 'circle-stroke-width': 3, 'circle-stroke-color': colorExpr } });
    map.addLayer({ id: 'pin-label', type: 'symbol', source: 'pins', minzoom: 14.5, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-max-width': 9, 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-optional': true }, paint: { 'text-color': dark ? '#E5E7EB' : '#1F2937', 'text-halo-color': dark ? '#0b1220' : '#ffffff', 'text-halo-width': 1.2 } });
  }
  // Layer listeners are bound once by layer id: Mapbox keeps them across style swaps.
  function bindLayerEvents() {
    map.on('click', 'clusters', (e) => {
      const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
      if (!f) return;
      map.getSource('pins').getClusterExpansionZoom(f.properties.cluster_id, (err, z) => { if (!err) map.easeTo({ center: f.geometry.coordinates, zoom: z + 0.4 }); });
    });
    map.on('click', 'pin', (e) => {
      const f = e.features?.[0];
      if (!f) return;
      select(f.properties.id);
      map.easeTo({ center: f.geometry.coordinates, duration: 350 });
    });
    map.on('click', (e) => { if (!map.queryRenderedFeatures(e.point, { layers: ['pin', 'clusters'] }).length) select(null); });
    for (const layer of ['pin', 'clusters']) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    }
  }

  async function refresh() {
    if (!map.getSource('pins')) return;
    const my = ++st.seq;
    const bnd = map.getBounds();
    try {
      const { pins } = await api.pins({ minLat: bnd.getSouth(), maxLat: bnd.getNorth(), minLng: bnd.getWest(), maxLng: bnd.getEast() }, st.category);
      if (my !== st.seq || !alive) return;
      st.features = { type: 'FeatureCollection', features: pins.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, slug: p.slug, name: p.name, category: p.category, bookable: p.claimed ? 1 : 0 } })) };
      map.getSource('pins')?.setData(st.features);
      countEl.hidden = false;
      // The server sends at most MAP_LIMIT pins (claimed and best-rated first): say „500+“ rather than a false exact count.
      const n = pins.length;
      const shown = n >= MAP_LIMIT ? `${MAP_LIMIT}+` : String(n);
      countEl.textContent = n
        ? t(`${shown} ადგილი ამ ხედში`, `${shown} ${n === 1 ? 'place' : 'places'} in view`)
        : t('ამ ხედში ადგილი არ არის — გადაადგილე რუკა', 'No places in this view — move the map');
    } catch { /* the next move retries */ }
  }

  async function select(id, known = null) {
    st.selected = id;
    st.selectedBiz = known;
    if (map.getLayer('pin-selected')) map.setFilter('pin-selected', ['==', ['get', 'id'], id || '']);
    if (!id) { cardSlot.hidden = true; return; }
    cardSlot.hidden = false;
    mount(cardSlot, h('div', { class: 'bk-list' }, h('div', { style: { padding: '14px 16px' } }, skeleton(2))));
    try {
      const b = known || await api.business(id);
      if (st.selected !== id || !alive) return;
      st.selectedBiz = b;
      mount(cardSlot, h('div', { class: 'bk-list bk-map-sel' }, bizRow(b), iconButton('x', { title: t('დახურვა', 'Close'), onClick: () => select(null) })));
    } catch { if (st.selected === id) cardSlot.hidden = true; }
  }

  const themeWatch = new MutationObserver(() => {
    const next = isDark();
    if (next === dark || !map) return;
    dark = next;
    map.once('style.load', () => { if (alive) addLayers(); });
    map.setStyle(styleFor(dark));
  });
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  map.on('load', async () => {
    map.resize();
    addLayers();
    bindLayerEvents();
    placeMe();
    if (typeof ctx.query.focus === 'string' && ctx.query.focus) {
      try {
        const b = await api.business(ctx.query.focus);
        if (!alive) return;
        if (b.lat != null && b.lng != null) map.jumpTo({ center: [b.lng, b.lat], zoom: 15.5 });
        select(b.id, b);
      } catch { /* the pin is simply not highlighted */ }
    }
    refresh();
  });
  map.on('moveend', () => { clearTimeout(timer); timer = setTimeout(refresh, 220); });
  map.on('error', (e) => {
    console.warn('[MEDIBOOK map]', e?.error?.message || e?.error || e);
    if (e?.error?.status === 401) toast(t('რუკის სერვისი ვერ პასუხობს.', 'The map service is not responding.'), 'error');
  });

  return () => {
    alive = false;
    clearTimeout(timer);
    themeWatch.disconnect();
    root.style.animation = '';
    try { map?.remove(); } catch { /* already gone */ }
  };
}
