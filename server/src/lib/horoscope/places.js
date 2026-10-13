// Birth place search for the natal chart: Open-Meteo geocoding (no key; the app already uses Open-Meteo for
// weather) returns coordinates and the IANA time zone. Only the typed place name leaves our server — never
// who is asking. A small built-in list keeps Georgian cities working when the service is down.

const CACHE = new Map();
const TTL_MS = 24 * 3600 * 1000;

const BUILT_IN = [
  ['თბილისი', 'Tbilisi', 41.7151, 44.8271], ['ქუთაისი', 'Kutaisi', 42.2679, 42.6946], ['ბათუმი', 'Batumi', 41.6168, 41.6367],
  ['რუსთავი', 'Rustavi', 41.5495, 44.9932], ['ზუგდიდი', 'Zugdidi', 42.5084, 41.868], ['გორი', 'Gori', 41.9842, 44.1158],
  ['ფოთი', 'Poti', 42.1462, 41.6719], ['ქობულეთი', 'Kobuleti', 41.8214, 41.7792], ['ხაშური', 'Khashuri', 41.9946, 43.5994],
  ['სამტრედია', 'Samtredia', 42.1545, 42.3352], ['სენაკი', 'Senaki', 42.2704, 42.0675], ['ზესტაფონი', 'Zestaponi', 42.11, 43.0525],
  ['მარნეული', 'Marneuli', 41.4759, 44.8089], ['თელავი', 'Telavi', 41.9198, 45.4732], ['ახალციხე', 'Akhaltsikhe', 41.639, 42.9826],
  ['ოზურგეთი', 'Ozurgeti', 41.9244, 42.0068], ['ჭიათურა', 'Chiatura', 42.2898, 43.2817], ['წყალტუბო', 'Tskaltubo', 42.3416, 42.5983],
  ['ბორჯომი', 'Borjomi', 41.8384, 43.3793], ['მცხეთა', 'Mtskheta', 41.8456, 44.7206], ['სიღნაღი', 'Sighnaghi', 41.6195, 45.9223],
  ['გურჯაანი', 'Gurjaani', 41.7429, 45.8008], ['ახალქალაქი', 'Akhalkalaki', 41.4056, 43.4862], ['ამბროლაური', 'Ambrolauri', 42.5214, 43.1625],
  ['მესტია', 'Mestia', 43.0458, 42.7281], ['სოხუმი', 'Sokhumi', 43.0015, 41.0234], ['ცხინვალი', 'Tskhinvali', 42.2276, 43.9686],
];

function builtIn(q, lang) {
  const needle = q.toLowerCase();
  return BUILT_IN.filter(([ka, en]) => ka.startsWith(q) || en.toLowerCase().startsWith(needle))
    .slice(0, 8)
    .map(([ka, en, lat, lon]) => ({
      id: `ge-${en.toLowerCase()}`, name: lang === 'en' ? en : ka, detail: lang === 'en' ? 'Georgia' : 'საქართველო',
      lat, lon, tz: 'Asia/Tbilisi',
    }));
}

/** Up to 8 populated places for a query: { id, name, detail, lat, lon, tz }. */
export async function searchPlaces(q, lang = 'ka', { fetchImpl = globalThis.fetch } = {}) {
  const key = `${lang}:${q.toLowerCase()}`;
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.places;
  let places = [];
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=12&language=${lang === 'en' ? 'en' : 'ka'}&format=json`;
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(6000) });
    const json = await res.json();
    places = (json.results || [])
      .filter((p) => String(p.feature_code || '').startsWith('PPL') && p.timezone && Number.isFinite(p.latitude))
      .slice(0, 8)
      .map((p) => ({
        id: String(p.id),
        name: p.name,
        detail: [p.admin1, p.country].filter(Boolean).join(', '),
        lat: Math.round(p.latitude * 10000) / 10000,
        lon: Math.round(p.longitude * 10000) / 10000,
        tz: p.timezone,
      }));
  } catch {
    places = [];
  }
  if (!places.length) places = builtIn(q, lang);
  if (CACHE.size > 500) CACHE.clear();
  CACHE.set(key, { at: Date.now(), places });
  return places;
}
