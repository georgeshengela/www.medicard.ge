/**
 * MEDIBOOK catalogue — pure helpers shared by the installer, the crawler, the routes and the tests:
 * categories, ids and slugs, opening hours, booking settings and the public shapes of a business.
 * No I/O here (store.js talks to the database). docs/agents/medibook.md.
 */
import { createHash, randomUUID } from 'node:crypto';
import { clockToMinutes, minutesToClock, tbilisiMinutes, tbilisiWeekday } from './time.js';

/**
 * The consumer segment of MEDICARD: dental, beauty, aesthetics, hair, nails, spa, clinics, fitness,
 * optics, labs, psychology, physiotherapy, tattoo. `mapbox` = Search Box canonical categories,
 * `osm` = OpenStreetMap tag values (amenity / shop / leisure / healthcare), `color` = the map pin.
 */
export const CATEGORIES = Object.freeze([
  { id: 'DENTAL', ka: 'სტომატოლოგია', en: 'Dental', color: '#0EA5E9', mapbox: ['dentist'], osm: ['dentist'], words: ['dent', 'სტომატ', 'стомат', 'ყბა'] },
  { id: 'BEAUTY', ka: 'სილამაზის სალონი', en: 'Beauty salon', color: '#EC4899', mapbox: ['salon', 'tanning_salon'], osm: ['beauty'], words: ['beauty', 'სილამაზ', 'салон', 'salon'] },
  { id: 'HAIR', ka: 'თმა და ბარბერი', en: 'Hair and barber', color: '#F59E0B', mapbox: ['hairdresser'], osm: ['hairdresser'], words: ['hair', 'barber', 'ბარბერ', 'თმ', 'парикмах', 'coiffure'] },
  { id: 'NAILS', ka: 'ფრჩხილები', en: 'Nails', color: '#F472B6', mapbox: ['nail_salon'], osm: [], words: ['nail', 'ფრჩხილ', 'მანიკურ', 'manicure', 'маникюр'] },
  { id: 'AESTHETIC', ka: 'ესთეტიკა და კოსმეტოლოგია', en: 'Aesthetics and cosmetology', color: '#A21CAF', mapbox: [], osm: [], words: ['aesthetic', 'esthetic', 'ესთეტ', 'კოსმეტოლოგ', 'cosmetolog', 'laser', 'ლაზერ', 'botox', 'ბოტოქს', 'derma', 'დერმატ', 'skin'] },
  { id: 'SPA', ka: 'სპა და მასაჟი', en: 'Spa and massage', color: '#14B8A6', mapbox: ['spa', 'massage_shop'], osm: ['massage', 'spa'], words: ['spa', 'სპა', 'massage', 'მასაჟ', 'массаж', 'sauna', 'საუნა'] },
  { id: 'CLINIC', ka: 'კლინიკა და ექიმები', en: 'Clinics and doctors', color: '#2563EB', mapbox: ['medical_clinic', 'medical_practice', 'doctors_office'], osm: ['clinic', 'doctors'], words: ['clinic', 'კლინიკ', 'клиник', 'medical', 'სამედიცინო', 'ჰოსპიტ', 'hospital', 'პოლიკლინ'] },
  { id: 'FITNESS', ka: 'ფიტნესი და იოგა', en: 'Fitness and yoga', color: '#22C55E', mapbox: ['fitness_center', 'yoga_studio', 'gymnastics'], osm: ['fitness_centre'], words: ['fitness', 'ფიტნეს', 'gym', 'yoga', 'იოგა', 'pilates', 'პილატეს', 'crossfit'] },
  { id: 'OPTICS', ka: 'ოპტიკა', en: 'Optics', color: '#6366F1', mapbox: ['optician'], osm: ['optician'], words: ['optic', 'ოპტიკ', 'оптик'] },
  { id: 'LAB', ka: 'ლაბორატორია', en: 'Laboratory', color: '#4F46E5', mapbox: ['medical_laboratory', 'laboratory'], osm: ['laboratory'], words: ['lab', 'ლაბორატ', 'лаборатор', 'analys', 'ანალიზ'] },
  { id: 'MIND', ka: 'ფსიქოლოგი', en: 'Psychology', color: '#8B5CF6', mapbox: ['psychotherapist', 'psychological_services'], osm: ['psychotherapist'], words: ['psycho', 'ფსიქო', 'психо', 'therapy'] },
  { id: 'PHYSIO', ka: 'ფიზიოთერაპია', en: 'Physiotherapy', color: '#0D9488', mapbox: ['physiotherapist'], osm: ['physiotherapist'], words: ['physio', 'ფიზიო', 'реабилит', 'rehab', 'რეაბილიტ'] },
  { id: 'TATTOO', ka: 'ტატუ და პირსინგი', en: 'Tattoo and piercing', color: '#374151', mapbox: ['tattoo_parlour'], osm: ['tattoo'], words: ['tattoo', 'ტატუ', 'piercing', 'პირსინგ'] },
  { id: 'OTHER', ka: 'სხვა', en: 'Other', color: '#64748B', mapbox: [], osm: [], words: [] },
]);

export const CATEGORY_IDS = Object.freeze(CATEGORIES.map((c) => c.id));
const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryOf(id) {
  return CATEGORY_BY_ID.get(String(id ?? '').toUpperCase()) ?? CATEGORY_BY_ID.get('OTHER');
}

export function categoryLabel(id, lang = 'ka') {
  const c = categoryOf(id);
  return lang === 'en' ? c.en : c.ka;
}

/** Public list for clients (both languages so the app can render without a round trip). */
export function publicCategories() {
  return CATEGORIES.filter((c) => c.id !== 'OTHER').map((c) => ({ id: c.id, ka: c.ka, en: c.en, color: c.color }));
}

/** Guess the category from a source category list and the name (crawler + registration fallback). */
export function guessCategory({ mapbox = [], osm = [], name = '' } = {}) {
  const mb = mapbox.map((v) => String(v).toLowerCase());
  const os = osm.map((v) => String(v).toLowerCase());
  const lower = String(name).toLowerCase();
  // Words first: „ესთეტიკური ცენტრი“ is listed as a salon by map providers, a nail bar as a salon, …
  for (const c of CATEGORIES) if (c.id !== 'OTHER' && c.id !== 'BEAUTY' && c.id !== 'CLINIC' && c.words.some((w) => lower.includes(w))) return c.id;
  for (const c of CATEGORIES) if (c.mapbox.some((v) => mb.includes(v)) || c.osm.some((v) => os.includes(v))) return c.id;
  for (const c of CATEGORIES) if (c.words.some((w) => lower.includes(w))) return c.id;
  return 'OTHER';
}

export const slugify = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^\p{L}\p{N}]+/gu, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 56);

/** Stable id for a catalogue row so re-running the installer or crawler never duplicates it. */
export function catalogId(source, ref) {
  return `bk-${createHash('sha1').update(`${source}|${ref}`.toLowerCase()).digest('hex').slice(0, 12)}`;
}

export function newId() {
  return randomUUID();
}

/** A slug that stays readable and unique without a lookup: name + 6 hex of the id. */
export function slugFor(name, id) {
  const base = slugify(name) || 'business';
  return `${base}-${String(id).replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase()}`;
}

const clean = (v, max = 200) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

/** Georgian phone → E.164 (+995…). Anything else is kept as typed, trimmed. */
export function normalizePhone(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const digits = s.replace(/[^\d+]/g, '');
  const bare = digits.replace(/^\+/, '');
  if (/^995\d{9}$/.test(bare)) return `+${bare}`;
  if (/^5\d{8}$/.test(bare)) return `+995${bare}`;
  if (/^0?32\d{6,7}$/.test(bare)) return `+995${bare.replace(/^0/, '')}`;
  return s.slice(0, 32);
}

export function normalizeWebsite(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    return u.toString().replace(/\/$/, '').slice(0, 200);
  } catch {
    return null;
  }
}

export function normalizeInstagram(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const handle = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0];
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : null;
}

// ——— opening hours ———

/**
 * Hours = { "0": [{from,to}], … "6": [...] } (0 = Sunday). An empty list = closed that day. `to` may
 * be "24:00" or smaller than `from` for an overnight close (treated as next day).
 */
export function normalizeHours(raw) {
  const out = {};
  const src = raw && typeof raw === 'object' ? raw : {};
  for (let d = 0; d < 7; d += 1) {
    const list = Array.isArray(src[d]) ? src[d] : Array.isArray(src[String(d)]) ? src[String(d)] : [];
    const ranges = [];
    for (const r of list.slice(0, 4)) {
      const from = clockToMinutes(r?.from);
      const to = clockToMinutes(r?.to);
      if (from == null || to == null) continue;
      ranges.push({ from: minutesToClock(from), to: to === 24 * 60 ? '24:00' : minutesToClock(to) });
    }
    ranges.sort((a, b) => clockToMinutes(a.from) - clockToMinutes(b.from));
    out[String(d)] = ranges;
  }
  return out;
}

/** Minute ranges of a weekday as [start, end) since that day's midnight (end may exceed 1440). */
export function dayRanges(hours, weekday) {
  const list = Array.isArray(hours?.[String(weekday)]) ? hours[String(weekday)] : [];
  return list
    .map((r) => {
      const from = clockToMinutes(r.from);
      let to = r.to === '24:00' ? 24 * 60 : clockToMinutes(r.to);
      if (from == null || to == null) return null;
      if (to <= from) to += 24 * 60;
      return [from, to];
    })
    .filter(Boolean);
}

export function hasAnyHours(hours) {
  return Object.values(hours ?? {}).some((list) => Array.isArray(list) && list.length);
}

/** Open right now (Tbilisi), with today's ranges for the card. Unknown hours → open: null. */
export function openState(hours, now = new Date()) {
  if (!hasAnyHours(hours)) return { open: null, today: [] };
  const wd = tbilisiWeekday(now);
  const minutes = tbilisiMinutes(now);
  const today = dayRanges(hours, wd);
  const yesterday = dayRanges(hours, (wd + 6) % 7).filter(([, to]) => to > 24 * 60);
  const open = today.some(([a, b]) => minutes >= a && minutes < b) || yesterday.some(([, b]) => minutes < b - 24 * 60);
  const closesAt = open ? today.find(([a, b]) => minutes >= a && minutes < b)?.[1] : null;
  const next = !open ? today.find(([a]) => a > minutes)?.[0] : null;
  return {
    open,
    today: (hours[String(wd)] ?? []).map((r) => ({ from: r.from, to: r.to })),
    closesAt: closesAt != null ? (closesAt >= 24 * 60 ? '24:00' : minutesToClock(closesAt)) : null,
    opensAt: next != null ? minutesToClock(next) : null,
  };
}

/** Mapbox Search Box `metadata.open_hours.periods` → our hours. */
export function hoursFromMapboxPeriods(periods) {
  const out = {};
  for (const p of Array.isArray(periods) ? periods : []) {
    const day = Number(p?.open?.day);
    const t = String(p?.open?.time ?? '');
    const c = String(p?.close?.time ?? '');
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    // A single {open: day 0 time 0000} with no close = open 24 hours every day.
    if (!p.close) {
      for (let d = 0; d < 7; d += 1) out[String(d)] = [{ from: '00:00', to: '24:00' }];
      break;
    }
    if (!/^\d{4}$/.test(t) || !/^\d{4}$/.test(c)) continue;
    const from = `${t.slice(0, 2)}:${t.slice(2)}`;
    const to = c === '0000' ? '24:00' : `${c.slice(0, 2)}:${c.slice(2)}`;
    (out[String(day)] ||= []).push({ from, to });
  }
  return normalizeHours(out);
}

/** OSM `opening_hours` — only the common simple forms (Mo-Fr 10:00-19:00; Sa 11:00-17:00; 24/7). */
export function hoursFromOsm(text) {
  const s = String(text ?? '').trim();
  if (!s) return {};
  if (/^24\s*\/\s*7$/.test(s)) return normalizeHours(Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ from: '00:00', to: '24:00' }]])));
  const DAYS = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
  const out = {};
  for (const part of s.split(';')) {
    const m = /^\s*([A-Za-z,\-\s]+?)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/.exec(part);
    if (!m) {
      const all = /^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/.exec(part);
      if (all) for (let d = 0; d < 7; d += 1) (out[d] ||= []).push({ from: all[1], to: all[2] });
      continue;
    }
    const days = new Set();
    for (const token of m[1].toLowerCase().split(',')) {
      const range = token.trim().split('-').map((x) => x.trim().slice(0, 2));
      const a = DAYS[range[0]];
      const b = range[1] != null ? DAYS[range[1]] : a;
      if (a == null || b == null) continue;
      for (let d = a; ; d = (d + 1) % 7) {
        days.add(d);
        if (d === b) break;
      }
    }
    for (const d of days) (out[d] ||= []).push({ from: m[2], to: m[3] });
  }
  return normalizeHours(out);
}

// ——— booking settings ———

export const DEFAULT_SETTINGS = Object.freeze({
  /** Slot grid in minutes. */
  slotMinutes: 30,
  /** The earliest a client may book, in minutes from now. */
  leadMinutes: 60,
  /** How far ahead the calendar opens. */
  horizonDays: 30,
  /** Free cancellation up to N hours before. */
  cancelHours: 12,
  /** New online bookings are CONFIRMED at once (false = PENDING until the business confirms). */
  autoConfirm: true,
  /** Online booking switch for the whole business. */
  onlineBooking: true,
  /** Clients may pick a specific person. */
  allowStaffChoice: true,
  /** A line shown before confirming (parking, deposit by phone, …). */
  bookingNote: '',
});

export function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const int = (v, d, lo, hi) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : d);
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  return {
    slotMinutes: [10, 15, 20, 30, 45, 60].includes(Number(s.slotMinutes)) ? Number(s.slotMinutes) : DEFAULT_SETTINGS.slotMinutes,
    leadMinutes: int(s.leadMinutes, DEFAULT_SETTINGS.leadMinutes, 0, 7 * 24 * 60),
    horizonDays: int(s.horizonDays, DEFAULT_SETTINGS.horizonDays, 1, 180),
    cancelHours: int(s.cancelHours, DEFAULT_SETTINGS.cancelHours, 0, 14 * 24),
    autoConfirm: bool(s.autoConfirm, DEFAULT_SETTINGS.autoConfirm),
    onlineBooking: bool(s.onlineBooking, DEFAULT_SETTINGS.onlineBooking),
    allowStaffChoice: bool(s.allowStaffChoice, DEFAULT_SETTINGS.allowStaffChoice),
    bookingNote: String(s.bookingNote ?? '').trim().slice(0, 300),
  };
}

// ——— geometry ———

export function distanceKm(a, b) {
  if (!a || !b || ![a.lat, a.lng, b.lat, b.lng].every((v) => Number.isFinite(Number(v)))) return null;
  const R = 6371;
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Bounding box of a radius around a point (for the SQL pre-filter on the btree index). */
export function bboxAround({ lat, lng }, radiusKm) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(0.2, Math.cos((Number(lat) * Math.PI) / 180)));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export const GEORGIA_BBOX = Object.freeze({ minLat: 41.0, maxLat: 43.6, minLng: 39.9, maxLng: 46.8 });
export const TBILISI_CENTER = Object.freeze({ lat: 41.7151, lng: 44.8271 });

/** Towns the crawler covers; also the Georgian names the app shows for a provider's English city. */
export const CITY_TABLE = Object.freeze([
  ['Tbilisi', 'თბილისი', 41.7151, 44.8271], ['Batumi', 'ბათუმი', 41.6168, 41.6367], ['Kutaisi', 'ქუთაისი', 42.2679, 42.718], ['Rustavi', 'რუსთავი', 41.5495, 44.993],
  ['Gori', 'გორი', 41.9842, 44.1158], ['Zugdidi', 'ზუგდიდი', 42.5088, 41.8709], ['Poti', 'ფოთი', 42.1462, 41.6718], ['Telavi', 'თელავი', 41.9198, 45.4733],
  ['Kobuleti', 'ქობულეთი', 41.8203, 41.7753], ['Akhaltsikhe', 'ახალციხე', 41.6392, 42.9826], ['Ozurgeti', 'ოზურგეთი', 41.9247, 42.0066], ['Marneuli', 'მარნეული', 41.476, 44.8094],
  ['Gardabani', 'გარდაბანი', 41.4616, 45.0932], ['Mtskheta', 'მცხეთა', 41.8454, 44.7206], ['Samtredia', 'სამტრედია', 42.1537, 42.336], ['Khashuri', 'ხაშური', 41.9975, 43.598],
  ['Senaki', 'სენაკი', 42.27, 42.067], ['Zestafoni', 'ზესტაფონი', 42.1097, 43.0463], ['Tskaltubo', 'წყალტუბო', 42.3432, 42.5976], ['Borjomi', 'ბორჯომი', 41.839, 43.3827],
  ['Sighnaghi', 'სიღნაღი', 41.6166, 45.9227], ['Bolnisi', 'ბოლნისი', 41.4474, 44.5383], ['Kaspi', 'კასპი', 41.9256, 44.4263], ['Lagodekhi', 'ლაგოდეხი', 41.8264, 46.2764],
  ['Kvareli', 'ყვარელი', 41.9542, 45.8147], ['Ambrolauri', 'ამბროლაური', 42.5203, 43.1492], ['Chiatura', 'ჭიათურა', 42.2893, 43.2976], ['Tkibuli', 'ტყიბული', 42.3503, 42.9999],
  ['Sachkhere', 'საჩხერე', 42.3461, 43.4038], ['Dusheti', 'დუშეთი', 42.0865, 44.6978], ['Gurjaani', 'გურჯაანი', 41.7461, 45.7978], ['Dedoplistskaro', 'დედოფლისწყარო', 41.4636, 46.1056],
  ['Tsalenjikha', 'წალენჯიხა', 42.6, 42.0667], ['Khoni', 'ხონი', 42.3222, 42.4208], ['Terjola', 'თერჯოლა', 42.1958, 42.9956], ['Vani', 'ვანი', 42.0847, 42.5103],
  ['Mestia', 'მესტია', 43.0458, 42.7297], ['Stepantsminda', 'სტეფანწმინდა', 42.6567, 44.6428], ['Tsnori', 'წნორი', 41.6236, 45.9695], ['Abasha', 'აბაშა', 42.2061, 42.2047],
  ['Martvili', 'მართვილი', 42.4147, 42.3789], ['Oni', 'ონი', 42.5833, 43.4417], ['Tetritskaro', 'თეთრიწყარო', 41.5478, 44.4689], ['Sagarejo', 'საგარეჯო', 41.7336, 45.3317],
  ['Tsalka', 'წალკა', 41.5958, 44.0875], ['Ninotsminda', 'ნინოწმინდა', 41.2644, 43.5906], ['Akhalkalaki', 'ახალქალაქი', 41.4053, 43.4864], ['Adigeni', 'ადიგენი', 41.6833, 42.7],
  ['Aspindza', 'ასპინძა', 41.5733, 43.2503], ['Lanchkhuti', 'ლანჩხუთი', 42.0906, 42.0353], ['Chokhatauri', 'ჩოხატაური', 42.0147, 42.2461], ['Keda', 'ქედა', 41.5967, 41.9411],
  ['Khulo', 'ხულო', 41.6428, 42.3069], ['Shuakhevi', 'შუახევი', 41.6286, 42.1836], ['Khelvachauri', 'ხელვაჭაური', 41.5847, 41.6611], ['Tianeti', 'თიანეთი', 42.1083, 44.9667],
]);
const CITY_KA = new Map(CITY_TABLE.map(([en, ka]) => [en.toLowerCase(), ka]));
const CITY_EN = new Map(CITY_TABLE.map(([en, ka]) => [ka, en]));

/** The nearest known town within `maxKm` (fills a missing city on crawled rows). */
export function nearestCity(lat, lng, maxKm = 30) {
  let best = null;
  for (const [en, ka, cLat, cLng] of CITY_TABLE) {
    const d = distanceKm({ lat, lng }, { lat: cLat, lng: cLng });
    if (d != null && d <= maxKm && (!best || d < best.d)) best = { en, ka, d };
  }
  return best ? { en: best.en, ka: best.ka } : null;
}

/** A city name in the requested language when we know it (providers give English; owners type Georgian). */
export function cityLabel(name, lang = 'ka') {
  const s = String(name ?? '').trim();
  if (!s) return null;
  if (lang === 'ka') return CITY_KA.get(s.toLowerCase()) ?? s;
  return CITY_EN.get(s) ?? s;
}

export function inGeorgia(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= GEORGIA_BBOX.minLat && lat <= GEORGIA_BBOX.maxLat && lng >= GEORGIA_BBOX.minLng && lng <= GEORGIA_BBOX.maxLng;
}

// ——— directory (server/src/data/medibook-ge.json) → rows ———

/**
 * The crawler writes `{ businesses: [{ source, ref, name, nameKa, category, tags, phone, website,
 * instagram, address, addressKa, city, district, lat, lng, hours }] }`; this turns it into insert rows.
 */
export function catalogRowsFromDirectory(directory) {
  const rows = [];
  const seen = new Set();
  const list = Array.isArray(directory?.businesses) ? directory.businesses : [];
  for (const b of list) {
    const source = clean(b.source, 20)?.toUpperCase();
    const ref = clean(b.ref, 120);
    const name = clean(b.name, 120);
    if (!source || !ref || !name) continue;
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    if (!inGeorgia(lat, lng)) continue;
    const id = catalogId(source, ref);
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      slug: slugFor(name, id),
      name,
      nameKa: clean(b.nameKa, 120),
      category: CATEGORY_IDS.includes(String(b.category).toUpperCase()) ? String(b.category).toUpperCase() : guessCategory({ name }),
      tags: Array.isArray(b.tags) ? b.tags.map((t) => clean(t, 40)).filter(Boolean).slice(0, 12) : [],
      phone: normalizePhone(b.phone),
      website: normalizeWebsite(b.website),
      instagram: normalizeInstagram(b.instagram),
      address: clean(b.address, 200),
      addressKa: clean(b.addressKa, 200),
      city: clean(b.city, 60) ?? nearestCity(lat, lng)?.en ?? null,
      district: clean(b.district, 60),
      lat,
      lng,
      hours: normalizeHours(b.hours),
      source,
      sourceRef: ref,
    });
  }
  return rows;
}

// ——— public shapes ———

const num = (v) => (v == null ? null : Number(v));

export function imageUrl(id) {
  return id ? `/api/book/image/${id}` : null;
}

/** The card in lists and on the map. `origin` adds the distance. */
export function businessCard(row, { lang = 'ka', origin = null, now = new Date(), fromPrice = null, favorite = false } = {}) {
  const settings = normalizeSettings(row.settings);
  const name = lang === 'ka' && row.nameKa ? row.nameKa : row.name;
  const address = lang === 'ka' && row.addressKa ? row.addressKa : row.address;
  const state = openState(row.hours, now);
  return {
    id: row.id,
    slug: row.slug,
    name,
    category: row.category,
    categoryLabel: categoryLabel(row.category, lang),
    tags: Array.isArray(row.tags) ? row.tags : [],
    address,
    city: cityLabel(row.city, lang),
    district: row.district,
    lat: num(row.lat),
    lng: num(row.lng),
    phone: row.phone,
    rating: row.ratingAvg == null ? null : Math.round(Number(row.ratingAvg) * 10) / 10,
    ratingCount: Number(row.ratingCount ?? 0),
    claimed: row.status === 'CLAIMED',
    bookable: row.status === 'CLAIMED' && settings.onlineBooking && Boolean(row.onlineServices ?? true),
    coverUrl: imageUrl(row.coverImageId),
    logoUrl: imageUrl(row.logoImageId),
    openNow: state.open,
    closesAt: state.closesAt ?? null,
    opensAt: state.opensAt ?? null,
    distanceKm: origin ? (distanceKm(origin, { lat: row.lat, lng: row.lng }) ?? null) : null,
    fromPrice: fromPrice == null ? null : Number(fromPrice),
    favorite,
  };
}

export function servicePublic(row) {
  return {
    id: row.id,
    group: row.group ?? null,
    name: row.nameKa && row.nameKa.trim() ? row.nameKa : row.name,
    nameEn: row.name,
    description: row.description ?? null,
    durationMin: Number(row.durationMin),
    bufferMin: Number(row.bufferMin ?? 0),
    price: row.price == null ? null : Number(row.price),
    priceTo: row.priceTo == null ? null : Number(row.priceTo),
    currency: row.currency ?? 'GEL',
    online: Boolean(row.online),
    active: Boolean(row.active),
    sortOrder: Number(row.sortOrder ?? 0),
  };
}

export function staffPublic(row) {
  return {
    id: row.id,
    name: row.name,
    title: row.title ?? null,
    imageUrl: imageUrl(row.imageId),
    color: row.color ?? null,
    serviceIds: Array.isArray(row.serviceIds) ? row.serviceIds : [],
    bookable: Boolean(row.bookable),
  };
}

export function discountPublic(row) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    value: Number(row.value),
    serviceIds: Array.isArray(row.serviceIds) ? row.serviceIds : [],
    startsOn: row.startsOn ? String(row.startsOn).slice(0, 10) : null,
    endsOn: row.endsOn ? String(row.endsOn).slice(0, 10) : null,
    weekdays: Array.isArray(row.weekdays) ? row.weekdays : [],
    hoursFrom: row.hoursFrom ?? null,
    hoursTo: row.hoursTo ?? null,
    code: row.code ?? null,
  };
}

/** Is a discount live for a service at an instant (Tbilisi)? */
export function discountApplies(d, { serviceId, at = new Date(), code = null }) {
  if (!d || d.active === false) return false;
  if (d.maxUses != null && Number(d.usedCount ?? 0) >= Number(d.maxUses)) return false;
  const ids = Array.isArray(d.serviceIds) ? d.serviceIds : [];
  if (ids.length && !ids.includes(serviceId)) return false;
  if (d.code && String(d.code).toUpperCase() !== String(code ?? '').toUpperCase()) return false;
  const ymd = new Date(at.getTime() + 4 * 3600_000).toISOString().slice(0, 10);
  if (d.startsOn && ymd < String(d.startsOn).slice(0, 10)) return false;
  if (d.endsOn && ymd > String(d.endsOn).slice(0, 10)) return false;
  const wds = Array.isArray(d.weekdays) ? d.weekdays.map(Number) : [];
  if (wds.length && !wds.includes(tbilisiWeekday(at))) return false;
  const from = clockToMinutes(d.hoursFrom);
  const to = clockToMinutes(d.hoursTo);
  const m = tbilisiMinutes(at);
  if (from != null && m < from) return false;
  if (to != null && m >= to) return false;
  return true;
}

/** Price after a discount, never below 0, rounded to tetri. */
export function discountedPrice(price, d) {
  if (price == null) return { price: null, off: 0 };
  const p = Number(price);
  const off = d.kind === 'PERCENT' ? (p * Number(d.value)) / 100 : Number(d.value);
  const final = Math.max(0, Math.round((p - off) * 100) / 100);
  return { price: final, off: Math.round((p - final) * 100) / 100 };
}

export function bookError(status, ka, code, en) {
  const err = new Error(ka);
  err.status = status;
  err.code = code ?? undefined;
  err.messageEn = en ?? ka;
  err.expose = true;
  return err;
}
