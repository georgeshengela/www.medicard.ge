// MEDIHOROSCOPE sky engine. Real positions from astronomy-engine (tropical zodiac,
// true ecliptic of date), Placidus houses, aspects, moon phases and sky events.
// Pure functions only — no database, no network.
import * as A from 'astronomy-engine';

export const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

export const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

const BODY = {
  sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars',
  jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto',
};

export const ASPECTS = [
  { key: 'conjunction', angle: 0, orb: 8 },
  { key: 'sextile', angle: 60, orb: 5 },
  { key: 'square', angle: 90, orb: 7 },
  { key: 'trine', angle: 120, orb: 7 },
  { key: 'opposition', angle: 180, orb: 8 },
];

const DEG = Math.PI / 180;
const DAY_MS = 86400000;

export const norm360 = (x) => ((x % 360) + 360) % 360;

/** Signed smallest difference b − a in (−180, 180]. */
export function angleDiff(a, b) {
  let d = norm360(b - a);
  if (d > 180) d -= 360;
  return d;
}

export function signOf(lon) {
  const l = norm360(lon);
  const index = Math.floor(l / 30) % 12;
  const inSign = l - index * 30;
  return {
    sign: SIGNS[index],
    index,
    degree: Math.floor(inSign),
    minute: Math.floor((inSign - Math.floor(inSign)) * 60),
    inSign,
  };
}

/** Ecliptic longitude (tropical, of date) of a body at a Date. */
export function longitude(key, date) {
  if (key === 'sun') return norm360(A.SunPosition(date).elon);
  if (key === 'moon') return norm360(A.EclipticGeoMoon(date).lon);
  return norm360(A.Ecliptic(A.GeoVector(BODY[key], date, true)).elon);
}

/** Degrees per day, from positions 12 h either side. */
export function speed(key, date) {
  const t = date.getTime();
  return angleDiff(longitude(key, new Date(t - DAY_MS / 2)), longitude(key, new Date(t + DAY_MS / 2)));
}

export function bodyAt(key, date) {
  const lon = longitude(key, date);
  const spd = speed(key, date);
  return { key, lon, speed: spd, retro: key !== 'sun' && key !== 'moon' && spd < 0, ...signOf(lon) };
}

export function positions(date, keys = PLANETS) {
  return keys.map((k) => bodyAt(k, date));
}

// ── Moon ────────────────────────────────────────────────────────────────

const PHASES = [
  'new', 'waxing_crescent', 'first_quarter', 'waxing_gibbous',
  'full', 'waning_gibbous', 'last_quarter', 'waning_crescent',
];

export function moonPhase(date) {
  const angle = norm360(A.MoonPhase(date));
  const illumination = (1 - Math.cos(angle * DEG)) / 2;
  // Named phases: the four exact phases get a ±12° window, the rest fill the gaps.
  let key;
  if (angle < 12 || angle >= 348) key = 'new';
  else if (angle < 78) key = 'waxing_crescent';
  else if (angle < 102) key = 'first_quarter';
  else if (angle < 168) key = 'waxing_gibbous';
  else if (angle < 192) key = 'full';
  else if (angle < 258) key = 'waning_gibbous';
  else if (angle < 282) key = 'last_quarter';
  else key = 'waning_crescent';
  const prevNew = A.SearchMoonPhase(0, new Date(date.getTime() - 31 * DAY_MS), 31);
  const age = prevNew ? (date.getTime() - prevNew.date.getTime()) / DAY_MS : angle / 12.19;
  return { angle, illumination, key, index: PHASES.indexOf(key), age, waxing: angle < 180 };
}

/** Lunar day 1–30 counted from the last new moon (the traditional „მთვარის დღე“). */
export function lunarDay(date) {
  const age = moonPhase(date).age;
  return Math.min(30, Math.floor(age) + 1);
}

// ── Aspects ─────────────────────────────────────────────────────────────

function orbFor(aspect, a, b, scale) {
  const lum = a === 'sun' || a === 'moon' || b === 'sun' || b === 'moon';
  return (aspect.orb + (lum ? 2 : 0)) * scale;
}

/**
 * Aspects between two lists of points ({key, lon}). With `same` (one list),
 * each pair is counted once. `scale` shrinks/expands the default orbs.
 */
export function aspects(listA, listB = null, { scale = 1, maxOrb = null } = {}) {
  const same = !listB;
  const B = listB || listA;
  const out = [];
  for (let i = 0; i < listA.length; i++) {
    for (let j = same ? i + 1 : 0; j < B.length; j++) {
      const p = listA[i];
      const q = B[j];
      if (same && p.key === q.key) continue;
      const sep = Math.abs(angleDiff(p.lon, q.lon));
      for (const asp of ASPECTS) {
        const orb = Math.abs(sep - asp.angle);
        const limit = maxOrb ?? orbFor(asp, p.key, q.key, scale);
        if (orb <= limit) {
          out.push({ a: p.key, b: q.key, aspect: asp.key, orb: Math.round(orb * 100) / 100 });
          break;
        }
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}

// ── Time zones ──────────────────────────────────────────────────────────

function tzOffsetMinutes(utcMs, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute, +v.second);
  return Math.round((asUtc - utcMs) / 60000);
}

/** Local civil date + time in an IANA zone → UTC Date (historical offsets via ICU). */
export function zonedToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '12:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let off = tzOffsetMinutes(guess, tz);
  let utc = guess - off * 60000;
  const off2 = tzOffsetMinutes(utc, tz);
  if (off2 !== off) utc = guess - off2 * 60000;
  return new Date(utc);
}

/** YYYY-MM-DD of a Date in a zone. */
export function civilDate(date, tz = 'Asia/Tbilisi') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// ── Houses ──────────────────────────────────────────────────────────────

function obliquity(date) {
  // IAU 2006 mean obliquity; nutation (< 10″) is irrelevant for house cusps.
  const T = (A.MakeTime(date).tt) / 36525;
  return (84381.406 - 46.836769 * T - 0.0001831 * T * T) / 3600;
}

const raToLon = (ra, eps) => norm360(Math.atan2(Math.sin(ra * DEG), Math.cos(ra * DEG) * Math.cos(eps * DEG)) / DEG);

/**
 * Ascendant, MC and twelve house cusps. Placidus where it is defined
 * (|latitude| < 66°), Whole Sign otherwise or on request.
 */
export function houses(date, lat, lon, system = 'placidus') {
  const eps = obliquity(date);
  const ramc = norm360(A.SiderealTime(date) * 15 + lon);
  const e = eps * DEG;
  const phi = lat * DEG;
  const r = ramc * DEG;
  const mc = norm360(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e)) / DEG);
  const asc = norm360(Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(e) + Math.tan(phi) * Math.sin(e))) / DEG);

  let usedSystem = system;
  let cusps;
  if (system === 'placidus' && Math.abs(lat) < 66) {
    const cusp = (offsetFromRamc, frac, nocturnal) => {
      let l = raToLon(ramc + offsetFromRamc, eps);
      for (let i = 0; i < 50; i++) {
        const dec = Math.asin(Math.sin(e) * Math.sin(l * DEG));
        const x = Math.tan(phi) * Math.tan(dec);
        const ad = Math.asin(Math.max(-1, Math.min(1, x))) / DEG;
        const ra = nocturnal
          ? ramc + 180 - frac * (90 - ad)
          : ramc + frac * (90 + ad);
        const next = raToLon(ra, eps);
        if (Math.abs(angleDiff(l, next)) < 1e-7) { l = next; break; }
        l = next;
      }
      return l;
    };
    const c11 = cusp(30, 1 / 3, false);
    const c12 = cusp(60, 2 / 3, false);
    const c2 = cusp(120, 2 / 3, true);
    const c3 = cusp(150, 1 / 3, true);
    cusps = [asc, c2, c3, norm360(mc + 180), norm360(c11 + 180), norm360(c12 + 180),
      norm360(asc + 180), norm360(c2 + 180), norm360(c3 + 180), mc, c11, c12];
  } else {
    usedSystem = 'whole_sign';
    const first = Math.floor(asc / 30) * 30;
    cusps = Array.from({ length: 12 }, (_, i) => norm360(first + i * 30));
  }
  return { system: usedSystem, asc, mc, cusps, ramc, obliquity: eps };
}

/** House number 1–12 for a longitude given cusps. */
export function houseOf(lon, cusps) {
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    const span = norm360(end - start);
    if (norm360(lon - start) < span) return i + 1;
  }
  return 1;
}

// ── Natal chart ─────────────────────────────────────────────────────────

/**
 * birth: { date: 'YYYY-MM-DD', time: 'HH:MM' | null, tz, lat, lon }.
 * Without a time the chart is cast for local noon and houses/ascendant are left out;
 * the Moon's sign is then flagged uncertain when it changes sign that day.
 */
export function natalChart(birth) {
  const timeKnown = Boolean(birth.time);
  const tz = birth.tz || 'Asia/Tbilisi';
  const at = zonedToUtc(birth.date, timeKnown ? birth.time : '12:00', tz);
  const bodies = positions(at);
  const out = { at: at.toISOString(), timeKnown, bodies, houses: null, angles: null };

  if (!timeKnown) {
    const start = zonedToUtc(birth.date, '00:00', tz);
    const end = new Date(start.getTime() + DAY_MS - 60000);
    const m0 = signOf(longitude('moon', start)).sign;
    const m1 = signOf(longitude('moon', end)).sign;
    out.moonUncertain = m0 !== m1 ? [m0, m1] : null;
    const s0 = signOf(longitude('sun', start)).sign;
    const s1 = signOf(longitude('sun', end)).sign;
    out.sunUncertain = s0 !== s1 ? [s0, s1] : null;
  }

  if (timeKnown && Number.isFinite(birth.lat) && Number.isFinite(birth.lon)) {
    const h = houses(at, birth.lat, birth.lon);
    out.houses = { system: h.system, cusps: h.cusps };
    out.angles = { asc: { lon: h.asc, ...signOf(h.asc) }, mc: { lon: h.mc, ...signOf(h.mc) } };
    for (const b of bodies) b.house = houseOf(b.lon, h.cusps);
  }
  const points = [...bodies];
  if (out.angles) points.push({ key: 'asc', lon: out.angles.asc.lon }, { key: 'mc', lon: out.angles.mc.lon });
  out.aspects = aspects(points, null, { scale: 1 });
  out.elements = balance(bodies, ELEMENT_OF);
  out.modalities = balance(bodies, MODALITY_OF);
  return out;
}

export const ELEMENT_OF = {
  aries: 'fire', leo: 'fire', sagittarius: 'fire',
  taurus: 'earth', virgo: 'earth', capricorn: 'earth',
  gemini: 'air', libra: 'air', aquarius: 'air',
  cancer: 'water', scorpio: 'water', pisces: 'water',
};
export const MODALITY_OF = {
  aries: 'cardinal', cancer: 'cardinal', libra: 'cardinal', capricorn: 'cardinal',
  taurus: 'fixed', leo: 'fixed', scorpio: 'fixed', aquarius: 'fixed',
  gemini: 'mutable', virgo: 'mutable', sagittarius: 'mutable', pisces: 'mutable',
};
const WEIGHT = { sun: 3, moon: 3, mercury: 2, venus: 2, mars: 2, jupiter: 1, saturn: 1, uranus: 0.5, neptune: 0.5, pluto: 0.5 };

function balance(bodies, map) {
  const acc = {};
  let total = 0;
  for (const b of bodies) {
    const k = map[b.sign];
    const w = WEIGHT[b.key] ?? 1;
    acc[k] = (acc[k] || 0) + w;
    total += w;
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, Math.round((v / total) * 100)]));
}

// ── Sun sign from a birth date ──────────────────────────────────────────

/** Sun sign for a civil birth date (cast at local noon); `cusp` when the Sun changed sign that day. */
export function sunSign(dateStr, tz = 'Asia/Tbilisi') {
  const noon = zonedToUtc(dateStr, '12:00', tz);
  const s = signOf(longitude('sun', noon));
  const start = signOf(longitude('sun', zonedToUtc(dateStr, '00:00', tz))).sign;
  const end = signOf(longitude('sun', zonedToUtc(dateStr, '23:59', tz))).sign;
  return { sign: s.sign, degree: s.degree, cusp: start !== end ? [start, end] : null };
}

// ── Transits to a natal chart ───────────────────────────────────────────

const TRANSIT_ORB = { moon: 3, sun: 1.5, mercury: 1.5, venus: 1.5, mars: 1.5, jupiter: 1.2, saturn: 1.2, uranus: 1, neptune: 1, pluto: 1 };
const TRANSIT_WEIGHT = { moon: 1, sun: 3, mercury: 2, venus: 3, mars: 3, jupiter: 4, saturn: 4, uranus: 3, neptune: 3, pluto: 3 };
const NATAL_WEIGHT = { sun: 4, moon: 4, asc: 4, mc: 3, venus: 3, mars: 3, mercury: 2, jupiter: 2, saturn: 2, uranus: 1, neptune: 1, pluto: 1 };

/** Transits active on a day (UTC instant at local midday), strongest first. */
export function transitsFor(chart, date) {
  const now = positions(date);
  const natal = [...chart.bodies.map((b) => ({ key: b.key, lon: b.lon }))];
  if (chart.angles) natal.push({ key: 'asc', lon: chart.angles.asc.lon }, { key: 'mc', lon: chart.angles.mc.lon });
  const out = [];
  for (const t of now) {
    for (const n of natal) {
      if (!chart.timeKnown && n.key === 'moon' && chart.moonUncertain) continue;
      const sep = Math.abs(angleDiff(t.lon, n.lon));
      for (const asp of ASPECTS) {
        const orb = Math.abs(sep - asp.angle);
        if (orb <= (TRANSIT_ORB[t.key] ?? 1)) {
          const applying = Math.abs(angleDiff(longitude(t.key, new Date(date.getTime() + DAY_MS / 4)), n.lon)) - asp.angle;
          out.push({
            transit: t.key, natal: n.key, aspect: asp.key, orb: Math.round(orb * 100) / 100,
            applying: Math.abs(applying) < orb, retro: t.retro,
            weight: (TRANSIT_WEIGHT[t.key] ?? 1) * (NATAL_WEIGHT[n.key] ?? 1) * (1.5 - orb / 3),
          });
          break;
        }
      }
    }
  }
  return out.sort((a, b) => b.weight - a.weight);
}

// ── Sky events ──────────────────────────────────────────────────────────

function bisect(fn, t0, t1, iters = 40) {
  let a = t0;
  let b = t1;
  const fa = fn(a);
  for (let i = 0; i < iters; i++) {
    const m = (a + b) / 2;
    if (fn(m) === fa) a = m; else b = m;
  }
  return new Date((a + b) / 2);
}

/** New/full moons, eclipses, sign ingresses and retrograde stations between two Dates. */
export function skyEvents(from, to) {
  const events = [];
  const t0 = from.getTime();
  const t1 = to.getTime();

  // Lunations.
  for (const [angle, type] of [[0, 'new_moon'], [180, 'full_moon']]) {
    let cursor = from;
    for (;;) {
      const hit = A.SearchMoonPhase(angle, cursor, (t1 - cursor.getTime()) / DAY_MS);
      if (!hit || hit.date.getTime() > t1) break;
      const lon = longitude('moon', hit.date);
      events.push({ type, at: hit.date.toISOString(), body: 'moon', sign: signOf(lon).sign, degree: signOf(lon).degree });
      cursor = new Date(hit.date.getTime() + DAY_MS);
    }
  }

  // Eclipses.
  let lunar = A.SearchLunarEclipse(from);
  while (lunar && lunar.peak.date.getTime() <= t1) {
    const lon = longitude('moon', lunar.peak.date);
    events.push({ type: 'lunar_eclipse', kind: lunar.kind, at: lunar.peak.date.toISOString(), body: 'moon', sign: signOf(lon).sign, degree: signOf(lon).degree });
    lunar = A.NextLunarEclipse(lunar.peak);
  }
  let solar = A.SearchGlobalSolarEclipse(from);
  while (solar && solar.peak.date.getTime() <= t1) {
    const lon = longitude('sun', solar.peak.date);
    events.push({ type: 'solar_eclipse', kind: solar.kind, at: solar.peak.date.toISOString(), body: 'sun', sign: signOf(lon).sign, degree: signOf(lon).degree });
    solar = A.NextGlobalSolarEclipse(solar.peak);
  }

  // Ingresses and stations, scanned every 6 h (Moon ingresses every 2 h).
  for (const key of PLANETS) {
    const step = key === 'moon' ? DAY_MS / 12 : DAY_MS / 4;
    let prevSign = signOf(longitude(key, from)).index;
    let prevRetro = key === 'sun' || key === 'moon' ? false : speed(key, from) < 0;
    for (let t = t0 + step; t <= t1; t += step) {
      const d = new Date(t);
      const idx = signOf(longitude(key, d)).index;
      if (idx !== prevSign && key !== 'moon') {
        const at = bisect((ms) => signOf(longitude(key, new Date(ms))).index, t - step, t);
        events.push({ type: 'ingress', at: at.toISOString(), body: key, sign: SIGNS[idx], from: SIGNS[prevSign], retro: speed(key, at) < 0 });
      } else if (idx !== prevSign && key === 'moon') {
        const at = bisect((ms) => signOf(longitude(key, new Date(ms))).index, t - step, t);
        events.push({ type: 'moon_ingress', at: at.toISOString(), body: 'moon', sign: SIGNS[idx] });
      }
      prevSign = idx;
      if (key !== 'sun' && key !== 'moon' && (t - t0) % DAY_MS < step) {
        const retro = speed(key, d) < 0;
        if (retro !== prevRetro) {
          const at = bisect((ms) => speed(key, new Date(ms)) < 0, t - DAY_MS, t, 24);
          const lon = longitude(key, at);
          events.push({ type: retro ? 'station_retrograde' : 'station_direct', at: at.toISOString(), body: key, sign: signOf(lon).sign, degree: signOf(lon).degree });
          prevRetro = retro;
        }
      }
    }
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

// ── Chinese zodiac ──────────────────────────────────────────────────────

export const CHINESE_ANIMALS = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig'];
const CHINESE_ELEMENTS = ['wood', 'fire', 'earth', 'metal', 'water'];

const cnyCache = new Map();
const chinaDate = (d) => civilDate(d, 'Asia/Shanghai');
const nextNewMoon = (d) => A.SearchMoonPhase(0, new Date(d.getTime() + DAY_MS), 33).date;

function newMoonOnOrBefore(dateStr) {
  const t = new Date(`${dateStr}T23:59:59+08:00`);
  let nm = A.SearchMoonPhase(0, new Date(t.getTime() - 32 * DAY_MS), 33).date;
  for (let next = nextNewMoon(nm); chinaDate(next) <= dateStr; next = nextNewMoon(nm)) nm = next;
  return nm;
}

/** A lunar month holds a principal term (zhongqi) when the Sun crosses a 30° mark inside it. */
function hasPrincipalTerm(nm) {
  const start = new Date(`${chinaDate(nm)}T00:00:00+08:00`);
  const end = new Date(`${chinaDate(nextNewMoon(nm))}T00:00:00+08:00`);
  return Math.floor(longitude('sun', start) / 30) !== Math.floor(longitude('sun', end) / 30);
}

/**
 * Chinese New Year (YYYY-MM-DD, China time). Month 11 holds the December solstice;
 * New Year starts month 1, one later when a leap 11th/12th month comes first.
 * Checked against 40 published dates 1930–2050.
 */
export function chineseNewYear(year) {
  if (cnyCache.has(year)) return cnyCache.get(year);
  const m11a = newMoonOnOrBefore(chinaDate(A.Seasons(year - 1).dec_solstice.date));
  const m11b = chinaDate(newMoonOnOrBefore(chinaDate(A.Seasons(year).dec_solstice.date)));
  const months = [m11a];
  for (let m = nextNewMoon(m11a); chinaDate(m) < m11b; m = nextNewMoon(m)) months.push(m);
  let first = 2;
  if (months.length === 13) {
    const leap = months.findIndex((m, i) => i > 0 && !hasPrincipalTerm(m));
    if (leap === 1 || leap === 2) first = 3;
  }
  const value = chinaDate(months[first]);
  cnyCache.set(year, value);
  return value;
}

export function chineseZodiac(dateStr) {
  const y = Number(dateStr.slice(0, 4));
  const year = dateStr < chineseNewYear(y) ? y - 1 : y;
  const animal = CHINESE_ANIMALS[((year - 4) % 12 + 12) % 12];
  const stem = ((year - 4) % 10 + 10) % 10;
  return {
    year,
    animal,
    element: CHINESE_ELEMENTS[Math.floor(stem / 2)],
    yin: stem % 2 === 1,
    newYear: chineseNewYear(year),
  };
}

// ── Numerology ──────────────────────────────────────────────────────────

const reduce = (n, keepMaster = true) => {
  while (n > 9 && !(keepMaster && (n === 11 || n === 22 || n === 33))) {
    n = String(n).split('').reduce((s, c) => s + Number(c), 0);
  }
  return n;
};

/** Life path number (Pythagorean, month/day/year reduced separately, masters kept). */
export function lifePath(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return reduce(reduce(y) + reduce(m) + reduce(d));
}

export function personalYear(dateStr, year) {
  const [, m, d] = dateStr.split('-').map(Number);
  return reduce(reduce(m, false) + reduce(d, false) + reduce(year, false), false);
}

export function personalDay(dateStr, todayStr) {
  const [y, m, d] = todayStr.split('-').map(Number);
  return reduce(personalYear(dateStr, y) + reduce(m, false) + reduce(d, false), false);
}

// ── Sky snapshot used by the app and the generators ─────────────────────

export function skyAt(date) {
  const bodies = positions(date);
  return {
    at: date.toISOString(),
    bodies,
    moon: { ...moonPhase(date), lunarDay: lunarDay(date), sign: bodies[1].sign },
    aspects: aspects(bodies, null, { scale: 0.5 }),
    retrograde: bodies.filter((b) => b.retro).map((b) => b.key),
  };
}
