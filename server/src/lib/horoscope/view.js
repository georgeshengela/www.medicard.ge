// MEDIHOROSCOPE payloads for the app and the web: the person's sign and chart, stored readings, the sky,
// library texts. Everything here is computed from the birth date (profile) and the optional birth time/place.
import {
  SIGNS, natalChart, sunSign, skyAt, skyEvents, transitsFor, chineseZodiac, lifePath, personalDay, personalYear,
  zonedToUtc, civilDate, signOf, moonPhase, positions,
} from './astro.js';
import { SIGN_INFO } from './signs.js';
import { TZ, currentPeriodKeys } from './generate.js';
import { tarotOfDay, natalAspectKey, chineseBestMatches, compatKey, compatScore, TAROT, tarotRoman } from './catalog.js';
import { libraryEntries, readingsFor } from './store.js';

const toYmd = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : null);

/** Birth details from the profile birth date + the optional MEDIHOROSCOPE profile (time, place). */
export function birthOf(user, profile) {
  const date = toYmd(user?.birthDate);
  if (!date) return null;
  const hasPlace = Number.isFinite(profile?.lat) && Number.isFinite(profile?.lon);
  return {
    date,
    time: profile?.birthTime || null,
    tz: profile?.tz || TZ,
    lat: hasPlace ? profile.lat : null,
    lon: hasPlace ? profile.lon : null,
    placeName: profile?.placeName || null,
  };
}

const chartCache = new Map();
/** Natal chart, memoised per birth details (charts are pure and a person opens the module daily). */
export function chartFor(birth) {
  if (!birth) return null;
  const key = `${birth.date}|${birth.time}|${birth.tz}|${birth.lat}|${birth.lon}`;
  if (!chartCache.has(key)) {
    if (chartCache.size > 2000) chartCache.clear();
    chartCache.set(key, natalChart(birth));
  }
  return chartCache.get(key);
}

export function signFor(birth) {
  if (!birth) return null;
  const chart = chartFor(birth);
  const sun = chart.bodies[0];
  const plain = sunSign(birth.date, birth.tz);
  // With a known time the chart decides a cusp day; without it the noon sign stands and the cusp is flagged.
  return { key: sun.sign, degree: sun.degree, cusp: birth.time ? null : plain.cusp };
}

const TEXT_KEYS = ['headline', 'general', 'love', 'money', 'mood', 'tip'];

export function readingView(row, lang = 'ka') {
  if (!row || row.status !== 'LIVE') return null;
  const b = row.body || {};
  const t = b[lang] || b.ka || {};
  const out = { kind: row.kind, periodKey: row.periodKey };
  for (const k of TEXT_KEYS) out[k] = t[k] || '';
  out.scores = b.scores || null;
  if (b.lucky) out.lucky = b.lucky;
  if (b.bestDay) out.bestDay = b.bestDay;
  if (b.keyDates) out.keyDates = b.keyDates.map((d) => ({ date: d.date, text: d[lang] || d.ka }));
  if (b.highlights) out.highlights = b.highlights.map((d) => ({ month: d.month, text: d[lang] || d.ka }));
  return out;
}

/** Stored readings for a sign at the current period keys. */
export async function signReadings(sign, lang, now = new Date()) {
  const keys = currentPeriodKeys(now);
  const periods = [['day', keys.day], ['day', keys.tomorrow], ['week', keys.week], ['month', keys.month], ['year', keys.year]];
  const rows = await readingsFor(sign, periods);
  const pick = (kind, key) => readingView(rows.find((r) => r.kind === kind && r.periodKey === key && r.source === 'ai'), lang);
  return {
    today: pick('day', keys.day),
    tomorrow: pick('day', keys.tomorrow),
    week: pick('week', keys.week),
    month: pick('month', keys.month),
    year: pick('year', keys.year),
  };
}

/** Today's sky (Tbilisi noon) and the next sky events, as the app draws them. */
export function skyView(now = new Date(), days = 75) {
  const today = civilDate(now, TZ);
  const sky = skyAt(zonedToUtc(today, '12:00', TZ));
  const events = skyEvents(now, new Date(now.getTime() + days * 86400000))
    .filter((e) => e.type !== 'moon_ingress' && !(e.type === 'ingress' && e.body === 'moon'))
    .slice(0, 12)
    .map((e) => ({ type: e.type, at: e.at, body: e.body, sign: e.sign, from: e.from || null, kind: e.kind || null, retro: Boolean(e.retro) }));
  return {
    today,
    bodies: sky.bodies.map((b) => ({ key: b.key, lon: Math.round(b.lon * 100) / 100, sign: b.sign, degree: b.degree, retro: b.retro })),
    moon: {
      key: sky.moon.key, angle: Math.round(sky.moon.angle * 10) / 10, illumination: Math.round(sky.moon.illumination * 100) / 100,
      waxing: sky.moon.waxing, lunarDay: sky.moon.lunarDay, sign: sky.moon.sign,
    },
    retrograde: sky.retrograde,
    events,
  };
}

/** Moon phase for every day of a month (Tbilisi noon) — the sky calendar. */
export function moonCalendar(month) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => {
    const ymd = `${month}-${String(i + 1).padStart(2, '0')}`;
    const at = zonedToUtc(ymd, '12:00', TZ);
    const ph = moonPhase(at);
    const moon = positions(at, ['moon'])[0];
    return { date: ymd, key: ph.key, angle: Math.round(ph.angle), illumination: Math.round(ph.illumination * 100) / 100, sign: moon.sign };
  });
}

/** Strongest transits to a natal chart today, with library texts (missing texts come back empty). */
export async function personalDayView(chart, lang, now = new Date()) {
  if (!chart) return null;
  const at = zonedToUtc(civilDate(now, TZ), '12:00', TZ);
  const list = transitsFor(chart, at).slice(0, 4);
  const keys = list.map((x) => `transit:${x.transit}:${x.aspect}:${x.natal}`);
  const lib = await libraryEntries([...keys, ...list.map((x) => `aspect_kind:${x.aspect}`)], lang);
  return list.map((x, i) => ({
    transit: x.transit, aspect: x.aspect, natal: x.natal, orb: x.orb, applying: x.applying,
    title: lib[keys[i]]?.title || null,
    text: lib[keys[i]]?.text || lib[`aspect_kind:${x.aspect}`]?.text || null,
  }));
}

/** The full natal chart with every placement explained (library texts). */
export async function chartView(chart, birth, lang) {
  if (!chart) return null;
  const keys = [];
  for (const b of chart.bodies) {
    keys.push(`planet_sign:${b.key}:${b.sign}`, `planet:${b.key}`);
    if (b.house) keys.push(`planet_house:${b.key}:${b.house}`);
    if (b.retro) keys.push(`retro:${b.key}`);
  }
  if (chart.angles) keys.push(`asc:${chart.angles.asc.sign}`);
  for (let h = 1; h <= 12; h++) keys.push(`house:${h}`);
  const aspects = chart.aspects.slice(0, 24).map((a) => ({ ...a, key: natalAspectKey(a.a, a.aspect, a.b) }));
  keys.push(...aspects.map((a) => a.key));
  for (const e of ['fire', 'earth', 'air', 'water']) keys.push(`element:${e}`);
  const lib = await libraryEntries([...new Set(keys)], lang);
  const text = (k) => lib[k]?.text || null;
  return {
    birth: { date: birth.date, time: birth.time, placeName: birth.placeName, timeKnown: chart.timeKnown },
    system: chart.houses?.system || null,
    bodies: chart.bodies.map((b) => ({
      key: b.key, lon: Math.round(b.lon * 100) / 100, sign: b.sign, degree: b.degree, minute: b.minute, retro: b.retro, house: b.house || null,
      signText: text(`planet_sign:${b.key}:${b.sign}`),
      houseText: b.house ? text(`planet_house:${b.key}:${b.house}`) : null,
      planetText: text(`planet:${b.key}`),
      retroText: b.retro ? text(`retro:${b.key}`) : null,
    })),
    angles: chart.angles ? {
      asc: { lon: Math.round(chart.angles.asc.lon * 100) / 100, sign: chart.angles.asc.sign, degree: chart.angles.asc.degree, minute: chart.angles.asc.minute, text: text(`asc:${chart.angles.asc.sign}`) },
      mc: { lon: Math.round(chart.angles.mc.lon * 100) / 100, sign: chart.angles.mc.sign, degree: chart.angles.mc.degree, minute: chart.angles.mc.minute },
    } : null,
    houses: chart.houses ? chart.houses.cusps.map((c, i) => ({ n: i + 1, lon: Math.round(c * 100) / 100, sign: signOf(c).sign, degree: signOf(c).degree, title: lib[`house:${i + 1}`]?.title || null, text: text(`house:${i + 1}`) })) : null,
    aspects: aspects.map((a) => ({ a: a.a, b: a.b, aspect: a.aspect, orb: a.orb, text: text(a.key) })),
    elements: chart.elements,
    modalities: chart.modalities,
    elementTexts: Object.fromEntries(['fire', 'earth', 'air', 'water'].map((e) => [e, text(`element:${e}`)])),
    moonUncertain: chart.moonUncertain || null,
  };
}

export async function tarotView(userId, lang, now = new Date()) {
  const card = tarotOfDay(userId, civilDate(now, TZ));
  const lib = await libraryEntries([`tarot:${card.id}`], lang);
  return { id: card.id, n: card.n, roman: tarotRoman(card.n), name: card[lang === 'en' ? 'en' : 'ka'], glyph: card.glyph, ...(lib[`tarot:${card.id}`] || {}) };
}

export async function tarotCards(ids, lang) {
  const lib = await libraryEntries(ids.map((id) => `tarot:${id}`), lang);
  return ids.map((id) => {
    const card = TAROT.find((t) => t.id === id);
    return card ? { id, n: card.n, roman: tarotRoman(card.n), name: card[lang === 'en' ? 'en' : 'ka'], glyph: card.glyph, ...(lib[`tarot:${id}`] || {}) } : null;
  }).filter(Boolean);
}

export async function numbersView(birthDate, lang, now = new Date()) {
  if (!birthDate) return null;
  const today = civilDate(now, TZ);
  const lp = lifePath(birthDate);
  const pd = personalDay(birthDate, today);
  const py = personalYear(birthDate, Number(today.slice(0, 4)));
  const lib = await libraryEntries([`number:${lp}`, `pday:${pd}`, `pyear:${py}`], lang);
  return { lifePath: lp, personalDay: pd, personalYear: py, lifePathText: lib[`number:${lp}`] || null, dayText: lib[`pday:${pd}`] || null, yearText: lib[`pyear:${py}`] || null };
}

export async function chineseView(birthDate, lang, now = new Date()) {
  if (!birthDate) return null;
  const cz = chineseZodiac(birthDate);
  const year = Number(civilDate(now, TZ).slice(0, 4));
  const lib = await libraryEntries([`chinese:${cz.animal}`, `chinese_year:${year}:${cz.animal}`], lang);
  return { ...cz, bestMatches: chineseBestMatches(cz.animal), profile: lib[`chinese:${cz.animal}`] || null, yearForecast: lib[`chinese_year:${year}:${cz.animal}`] || null, forecastYear: year };
}

export async function compatView(a, b, lang) {
  const key = compatKey(a, b);
  const lib = await libraryEntries([key], lang);
  return { a, b, score: compatScore(a, b), ...(lib[key] || {}) };
}

export async function signProfileView(sign, lang) {
  const lib = await libraryEntries([`sign:${sign}`], lang);
  const info = SIGN_INFO[sign];
  return { key: sign, element: info.element, modality: info.modality, ruler: info.ruler, from: info.from, to: info.to, ...(lib[`sign:${sign}`] || {}) };
}

export const isSign = (s) => SIGNS.includes(s);
