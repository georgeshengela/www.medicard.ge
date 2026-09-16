/** Public vet-clinic directory from Dogdog.ge — hours as published, not a live queue. */

export const DOGDOG_CLINICS_URL = 'https://dogdog.ge/index.php?m=315';
export const DOGDOG_SOURCE_NAME = 'Dogdog.ge';
export const CLINICS_TIMEZONE = 'Asia/Tbilisi';
export const CLINICS_CACHE_MS = 6 * 60 * 60 * 1000;

const WEEKDAYS = [
  ['monday', 'ორშაბათი'],
  ['tuesday', 'სამშაბათი'],
  ['wednesday', 'ოთხშაბათი'],
  ['thursday', 'ხუთშაბათი'],
  ['friday', 'პარასკევი'],
  ['saturday', 'შაბათი'],
  ['sunday', 'კვირა'],
];

const WEEKDAY_BY_KA = new Map(WEEKDAYS.map(([id, ka]) => [ka, id]));
const WEEKDAY_BY_UTC = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const ALL_DAY_HINT = /სადღეღამისო|24\s*საათ/i;

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripTags(value) {
  return decodeEntities(String(value || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function slugify(value) {
  const base = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u10a0-\u10ff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return base || 'clinic';
}

export function parseClockToken(raw) {
  const token = String(raw || '').trim();
  if (!token) return null;
  if (/^24:?$/.test(token) || token === '24:00') return { allDay: true, minutes: 0 };
  const match = token.match(/^(\d{1,2})(?::(\d{2})?)?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) return null;
  if (hour === 24 && minute === 0) return { allDay: true, minutes: 0 };
  if (hour > 24) return null;
  return { allDay: false, minutes: Math.min(hour, 23) * 60 + minute };
}

export function parseHourRange(raw) {
  const text = String(raw || '').trim();
  const parts = text.split(/\s*[-–—]\s*/);
  if (parts.length !== 2) return { closed: true };
  const open = parseClockToken(parts[0]);
  const close = parseClockToken(parts[1]);
  if (!open || !close) return { closed: true };
  if (open.allDay || close.allDay) return { allDay: true, openMin: 0, closeMin: 1440 };
  if (open.minutes === 0 && close.minutes === 0) return { allDay: true, openMin: 0, closeMin: 1440 };
  const closeMin = close.minutes === 0 && open.minutes > 0 ? 1440 : close.minutes;
  return { allDay: false, openMin: open.minutes, closeMin };
}

export function tbilisiClockParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINICS_TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayName = String(map.weekday || '');
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayName);
  return {
    weekday: WEEKDAY_BY_UTC[weekdayIndex] || 'monday',
    minutes: Number(map.hour || 0) * 60 + Number(map.minute || 0),
  };
}

export function slotOpenAt(slot, minutes) {
  if (!slot) return { open: false, known: false };
  if (slot.closed) return { open: false, known: true };
  if (slot.allDay) return { open: true, known: true };
  const openMin = Number(slot.openMin);
  const closeMin = Number(slot.closeMin);
  if (!Number.isFinite(openMin) || !Number.isFinite(closeMin)) return { open: false, known: false };
  if (closeMin > openMin) {
    return { open: minutes >= openMin && minutes < closeMin, known: true };
  }
  if (closeMin < openMin) {
    return { open: minutes >= openMin || minutes < closeMin, known: true };
  }
  return { open: false, known: true };
}

export function clinicOpenState(clinic, now = new Date()) {
  const { weekday, minutes } = tbilisiClockParts(now);
  const hours = clinic?.hours && typeof clinic.hours === 'object' ? clinic.hours : {};
  const knownDays = WEEKDAYS.filter(([id]) => hours[id]).length;
  if (!knownDays) return { open: false, known: false, weekday, minutes };
  const status = slotOpenAt(hours[weekday], minutes);
  return { ...status, weekday, minutes };
}

function emptyHours() {
  return Object.fromEntries(WEEKDAYS.map(([id]) => [id, null]));
}

function applyAllDayHours() {
  return Object.fromEntries(
    WEEKDAYS.map(([id]) => [id, { allDay: true, openMin: 0, closeMin: 1440, label: '24:00 - 24:00' }]),
  );
}

function parseHoursBlock(block) {
  const hours = emptyHours();
  let any = false;
  const lines = [...String(block || '').matchAll(/<p class="mb-2"[^>]*>([\s\S]*?)<\/p>/gi)];
  for (const line of lines) {
    const text = stripTags(line[1]);
    const match = text.match(/^([^:]+):\s*(.+)$/);
    if (!match) continue;
    const dayId = WEEKDAY_BY_KA.get(match[1].trim());
    if (!dayId) continue;
    const range = parseHourRange(match[2]);
    hours[dayId] = { ...range, label: match[2].trim() };
    any = true;
  }
  return { hours, any };
}

function extractPhones(block) {
  const fromHref = [...String(block || '').matchAll(/href="tel:([^"]+)"/gi)].map((m) => stripTags(m[1]));
  const fromText = [...String(block || '').matchAll(/fa-phone[\s\S]*?<p>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]));
  const seen = new Set();
  const phones = [];
  for (const raw of [...fromHref, ...fromText]) {
    for (const part of String(raw).split(/[\/,;]+/)) {
      const display = part.replace(/\s+/g, ' ').trim();
      const tel = display.replace(/[^\d+]/g, '');
      if (tel.replace(/\D/g, '').length < 7) continue;
      const key = tel.replace(/\D/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      phones.push({ display, tel: tel.startsWith('+') ? tel : tel });
    }
  }
  return phones;
}

function extractEmail(block) {
  const href = String(block || '').match(/href="mailto:([^"]+)"/i);
  if (href) return stripTags(href[1]).toLowerCase();
  const text = stripTags(block).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return text ? text[0].toLowerCase() : null;
}

function extractLocation(block) {
  const pins = [...String(block || '').matchAll(/fa-location-dot[\s\S]*?<p>([\s\S]*?)<\/p>/gi)];
  const last = pins.at(-1);
  return last ? stripTags(last[1]) : null;
}

function parseClinicBlock(block) {
  const name = stripTags(block.match(/<div class="object_name">\s*<p>([\s\S]*?)<\/p>/i)?.[1] || '');
  if (!name) return null;
  const description = stripTags(block.match(/<div class="object_description">([\s\S]*?)<\/div>/i)?.[1] || '');
  const hoursHtml = block.match(/<div class="working_block[^"]*">([\s\S]*?)<\/div>/i)?.[1] || '';
  const { hours, any } = parseHoursBlock(hoursHtml);
  const phones = extractPhones(block);
  const email = extractEmail(block);
  const location = extractLocation(block);
  const filledHours = any ? hours : ALL_DAY_HINT.test(`${name}\n${description}`) ? applyAllDayHours() : emptyHours();
  return {
    id: slugify(`${name}-${phones[0]?.tel || location || ''}`),
    name,
    description: description || null,
    location,
    email,
    phones,
    hours: filledHours,
    sourceUrl: DOGDOG_CLINICS_URL,
  };
}

export function parseDogdogClinicsHtml(html) {
  const blocks = [...String(html || '').matchAll(/<div class="service_info">([\s\S]*?)<div class="contact_info">[\s\S]*?<\/div>\s*<\/div>/gi)];
  const clinics = [];
  const seen = new Set();
  for (const match of blocks) {
    const clinic = parseClinicBlock(match[0]);
    if (!clinic) continue;
    if (seen.has(clinic.id)) continue;
    seen.add(clinic.id);
    clinics.push(clinic);
  }
  return clinics;
}

function withOpenState(clinic, now) {
  const status = clinicOpenState(clinic, now);
  return {
    ...clinic,
    openNow: status.known ? status.open : null,
    hoursKnown: status.known,
  };
}

let cache = { at: 0, clinics: null, fetchedAt: null, error: null };

export function resetPetsClinicsCache() {
  cache = { at: 0, clinics: null, fetchedAt: null, error: null };
}

async function defaultFetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ka,en;q=0.8',
        'User-Agent': 'MedicardPetsDirectory/1.0 (+https://medicard.ge)',
      },
    });
    if (!response.ok) {
      const error = new Error(`directory HTTP ${response.status}`);
      error.status = 502;
      throw error;
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function getPetsClinicsDirectory({ now = new Date(), force = false, fetchHtml = defaultFetchHtml } = {}) {
  const fresh = cache.clinics && Date.now() - cache.at < CLINICS_CACHE_MS;
  if (fresh && !force) {
    return {
      source: { name: DOGDOG_SOURCE_NAME, url: DOGDOG_CLINICS_URL },
      timezone: CLINICS_TIMEZONE,
      fetchedAt: cache.fetchedAt,
      stale: false,
      clinics: cache.clinics.map((clinic) => withOpenState(clinic, now)),
    };
  }

  try {
    const html = await fetchHtml(DOGDOG_CLINICS_URL);
    const clinics = parseDogdogClinicsHtml(html);
    cache = { at: Date.now(), clinics, fetchedAt: now.toISOString(), error: null };
    return {
      source: { name: DOGDOG_SOURCE_NAME, url: DOGDOG_CLINICS_URL },
      timezone: CLINICS_TIMEZONE,
      fetchedAt: cache.fetchedAt,
      stale: false,
      clinics: clinics.map((clinic) => withOpenState(clinic, now)),
    };
  } catch {
    if (cache.clinics) {
      return {
        source: { name: DOGDOG_SOURCE_NAME, url: DOGDOG_CLINICS_URL },
        timezone: CLINICS_TIMEZONE,
        fetchedAt: cache.fetchedAt,
        stale: true,
        error: 'directory_unavailable',
        clinics: cache.clinics.map((clinic) => withOpenState(clinic, now)),
      };
    }
    return {
      source: { name: DOGDOG_SOURCE_NAME, url: DOGDOG_CLINICS_URL },
      timezone: CLINICS_TIMEZONE,
      fetchedAt: null,
      stale: false,
      error: 'directory_unavailable',
      clinics: [],
    };
  }
}
