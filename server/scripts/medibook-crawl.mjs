// MEDIBOOK catalogue crawler — public places of the consumer segment (dental, beauty, aesthetics, hair, nails,
// spa, clinics, fitness, optics, labs, psychology, physio, tattoo) in Georgia, from the Mapbox Search Box
// category API (names, addresses, phones, websites, opening hours) and OpenStreetMap (Overpass) where it
// answers. Writes server/src/data/medibook-ge.json; install-medibook.mjs inserts rows not in the table yet.
//
//   node server/scripts/medibook-crawl.mjs            # full run (~2 000 Mapbox calls, a few minutes)
//   node server/scripts/medibook-crawl.mjs --city=Batumi --no-osm
//
// Token: MAPBOX_PUBLIC_TOKEN (server/.env) or the one /api/app/status serves (public pk.* token).
import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { CATEGORIES, guessCategory, hoursFromMapboxPeriods, hoursFromOsm, inGeorgia, normalizePhone, normalizeWebsite, distanceKm } from '../src/lib/book/catalog.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const OUT = new URL('../src/data/medibook-ge.json', import.meta.url);
const MAPBOX_CATEGORIES = [...new Set(CATEGORIES.flatMap((c) => c.mapbox))];

const CITIES = [
  { name: 'Tbilisi', ka: 'თბილისი', lat: 41.7151, lng: 44.8271, grid: { minLat: 41.62, maxLat: 41.84, minLng: 44.68, maxLng: 44.96, step: 0.024 } },
  { name: 'Batumi', ka: 'ბათუმი', lat: 41.6168, lng: 41.6367, grid: { minLat: 41.58, maxLat: 41.68, minLng: 41.58, maxLng: 41.72, step: 0.03 } },
  { name: 'Kutaisi', ka: 'ქუთაისი', lat: 42.2679, lng: 42.718, grid: { minLat: 42.22, maxLat: 42.31, minLng: 42.66, maxLng: 42.78, step: 0.03 } },
  { name: 'Rustavi', ka: 'რუსთავი', lat: 41.5495, lng: 44.993 },
  { name: 'Gori', ka: 'გორი', lat: 41.9842, lng: 44.1158 },
  { name: 'Zugdidi', ka: 'ზუგდიდი', lat: 42.5088, lng: 41.8709 },
  { name: 'Poti', ka: 'ფოთი', lat: 42.1462, lng: 41.6718 },
  { name: 'Telavi', ka: 'თელავი', lat: 41.9198, lng: 45.4733 },
  { name: 'Kobuleti', ka: 'ქობულეთი', lat: 41.8203, lng: 41.7753 },
  { name: 'Akhaltsikhe', ka: 'ახალციხე', lat: 41.6392, lng: 42.9826 },
  { name: 'Ozurgeti', ka: 'ოზურგეთი', lat: 41.9247, lng: 42.0066 },
  { name: 'Marneuli', ka: 'მარნეული', lat: 41.476, lng: 44.8094 },
  { name: 'Gardabani', ka: 'გარდაბანი', lat: 41.4616, lng: 45.0932 },
  { name: 'Mtskheta', ka: 'მცხეთა', lat: 41.8454, lng: 44.7206 },
  { name: 'Samtredia', ka: 'სამტრედია', lat: 42.1537, lng: 42.336 },
  { name: 'Khashuri', ka: 'ხაშური', lat: 41.9975, lng: 43.598 },
  { name: 'Senaki', ka: 'სენაკი', lat: 42.27, lng: 42.067 },
  { name: 'Zestafoni', ka: 'ზესტაფონი', lat: 42.1097, lng: 43.0463 },
  { name: 'Tskaltubo', ka: 'წყალტუბო', lat: 42.3432, lng: 42.5976 },
  { name: 'Borjomi', ka: 'ბორჯომი', lat: 41.839, lng: 43.3827 },
  { name: 'Sighnaghi', ka: 'სიღნაღი', lat: 41.6166, lng: 45.9227 },
  { name: 'Bolnisi', ka: 'ბოლნისი', lat: 41.4474, lng: 44.5383 },
  { name: 'Kaspi', ka: 'კასპი', lat: 41.9256, lng: 44.4263 },
  { name: 'Lagodekhi', ka: 'ლაგოდეხი', lat: 41.8264, lng: 46.2764 },
  { name: 'Kvareli', ka: 'ყვარელი', lat: 41.9542, lng: 45.8147 },
  { name: 'Ambrolauri', ka: 'ამბროლაური', lat: 42.5203, lng: 43.1492 },
  { name: 'Chiatura', ka: 'ჭიათურა', lat: 42.2893, lng: 43.2976 },
  { name: 'Tkibuli', ka: 'ტყიბული', lat: 42.3503, lng: 42.9999 },
  { name: 'Sachkhere', ka: 'საჩხერე', lat: 42.3461, lng: 43.4038 },
  { name: 'Dusheti', ka: 'დუშეთი', lat: 42.0865, lng: 44.6978 },
  { name: 'Gurjaani', ka: 'გურჯაანი', lat: 41.7461, lng: 45.7978 },
  { name: 'Dedoplistskaro', ka: 'დედოფლისწყარო', lat: 41.4636, lng: 46.1056 },
  { name: 'Tsalenjikha', ka: 'წალენჯიხა', lat: 42.6, lng: 42.0667 },
  { name: 'Khoni', ka: 'ხონი', lat: 42.3222, lng: 42.4208 },
  { name: 'Terjola', ka: 'თერჯოლა', lat: 42.1958, lng: 42.9956 },
  { name: 'Vani', ka: 'ვანი', lat: 42.0847, lng: 42.5103 },
  { name: 'Mestia', ka: 'მესტია', lat: 43.0458, lng: 42.7297 },
  { name: 'Stepantsminda', ka: 'სტეფანწმინდა', lat: 42.6567, lng: 44.6428 },
];

async function token() {
  const env = String(process.env.MAPBOX_PUBLIC_TOKEN ?? '').trim();
  if (env.startsWith('pk.')) return env;
  const res = await fetch('https://medicard.ge/api/app/status?version=1.0.0.25.5');
  const json = await res.json();
  if (!String(json.mapboxToken ?? '').startsWith('pk.')) throw new Error('No Mapbox public token (set MAPBOX_PUBLIC_TOKEN)');
  return json.mapboxToken;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, tries = 3) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json', 'User-Agent': 'Medicard.GE/1.0 (MEDIBOOK catalogue; contact@medicard.ge)' } });
      if (res.status === 429) { await sleep(1500 * (i + 1)); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      await sleep(600 * (i + 1));
    }
  }
  return null;
}

/** One Mapbox category call for one point (and bbox when given). */
async function mapboxCategory(tok, category, { lat, lng, bbox }) {
  const url = new URL(`https://api.mapbox.com/search/searchbox/v1/category/${category}`);
  url.searchParams.set('access_token', tok);
  url.searchParams.set('limit', '25');
  url.searchParams.set('country', 'ge');
  url.searchParams.set('proximity', `${lng},${lat}`);
  if (bbox) url.searchParams.set('bbox', `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`);
  const json = await fetchJson(url.toString());
  return json?.features ?? [];
}

function cells(grid) {
  const out = [];
  for (let lat = grid.minLat; lat < grid.maxLat; lat += grid.step) {
    for (let lng = grid.minLng; lng < grid.maxLng; lng += grid.step * 1.3) {
      out.push({ lat: lat + grid.step / 2, lng: lng + (grid.step * 1.3) / 2, bbox: { minLat: lat, maxLat: Math.min(grid.maxLat, lat + grid.step), minLng: lng, maxLng: Math.min(grid.maxLng, lng + grid.step * 1.3) } });
    }
  }
  return out;
}

async function pool(items, limit, worker) {
  let i = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i;
      i += 1;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

function fromMapbox(f, cityHint) {
  const p = f.properties ?? {};
  const meta = p.metadata ?? {};
  const [lng, lat] = f.geometry?.coordinates ?? [];
  if (!inGeorgia(lat, lng) || !p.name) return null;
  const cats = p.poi_category_ids ?? [];
  return {
    source: 'MAPBOX',
    ref: p.mapbox_id,
    name: String(p.name).trim().slice(0, 120),
    nameKa: null,
    category: guessCategory({ mapbox: cats, name: p.name }),
    tags: (p.poi_category ?? []).slice(0, 6),
    phone: normalizePhone(meta.phone),
    website: normalizeWebsite(meta.website),
    instagram: null,
    address: p.full_address ?? p.place_formatted ?? null,
    addressKa: null,
    city: p.context?.place?.name ?? cityHint ?? null,
    district: p.context?.neighborhood?.name ?? p.context?.locality?.name ?? null,
    lat,
    lng,
    hours: meta.open_hours?.periods ? hoursFromMapboxPeriods(meta.open_hours.periods) : {},
  };
}

async function overpass() {
  const q = `[out:json][timeout:120];(nwr["amenity"="dentist"](41.05,39.95,43.59,46.73);nwr["healthcare"="dentist"](41.05,39.95,43.59,46.73);nwr["shop"="beauty"](41.05,39.95,43.59,46.73);nwr["shop"="hairdresser"](41.05,39.95,43.59,46.73);nwr["shop"="massage"](41.05,39.95,43.59,46.73);nwr["amenity"="clinic"](41.05,39.95,43.59,46.73);nwr["amenity"="doctors"](41.05,39.95,43.59,46.73);nwr["leisure"="fitness_centre"](41.05,39.95,43.59,46.73);nwr["shop"="tattoo"](41.05,39.95,43.59,46.73);nwr["amenity"="spa"](41.05,39.95,43.59,46.73);nwr["leisure"="spa"](41.05,39.95,43.59,46.73);nwr["shop"="optician"](41.05,39.95,43.59,46.73);nwr["healthcare"="physiotherapist"](41.05,39.95,43.59,46.73);nwr["healthcare"="psychotherapist"](41.05,39.95,43.59,46.73);nwr["healthcare"="laboratory"](41.05,39.95,43.59,46.73););out tags center;`;
  for (const host of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
    try {
      const res = await fetch(host, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: '*/*', 'User-Agent': 'Medicard.GE/1.0 (MEDIBOOK catalogue; contact@medicard.ge)' }, body: `data=${encodeURIComponent(q)}`, signal: AbortSignal.timeout(180000) });
      if (!res.ok) { console.warn(`[osm] ${host} → ${res.status}`); continue; }
      const json = await res.json();
      console.log(`[osm] ${host}: ${json.elements?.length ?? 0} elements`);
      return json.elements ?? [];
    } catch (e) {
      console.warn(`[osm] ${host} failed: ${e?.message}`);
    }
  }
  return [];
}

function fromOsm(e) {
  const tags = e.tags ?? {};
  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  const name = tags['name:ka'] || tags.name || tags['name:en'];
  if (!name || !inGeorgia(lat, lng)) return null;
  const kind = tags.amenity || tags.shop || tags.leisure || tags.healthcare;
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  return {
    source: 'OSM',
    ref: `${e.type[0]}${e.id}`,
    name: String(tags['name:en'] || tags.name || name).trim().slice(0, 120),
    nameKa: tags['name:ka'] || (/[ა-ჿ]/.test(tags.name || '') ? tags.name : null),
    category: guessCategory({ osm: [kind], name: `${tags.name ?? ''} ${tags['name:en'] ?? ''}` }),
    tags: [kind].filter(Boolean),
    phone: normalizePhone(tags.phone || tags['contact:phone']),
    website: normalizeWebsite(tags.website || tags['contact:website']),
    instagram: tags['contact:instagram'] ? String(tags['contact:instagram']).replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/^@/, '').split(/[/?]/)[0] : null,
    address: street || null,
    addressKa: /[ა-ჿ]/.test(street) ? street : null,
    city: tags['addr:city'] || null,
    district: tags['addr:suburb'] || null,
    lat,
    lng,
    hours: tags.opening_hours ? hoursFromOsm(tags.opening_hours) : {},
  };
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

async function main() {
  const tok = await token();
  const existing = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : { businesses: [] };
  const byRef = new Map(existing.businesses.map((b) => [`${b.source}|${b.ref}`, b]));
  const cityFilter = args.city ? String(args.city).toLowerCase() : null;
  const cities = CITIES.filter((c) => !cityFilter || c.name.toLowerCase() === cityFilter);
  const jobs = [];
  for (const city of cities) {
    const points = city.grid ? cells(city.grid) : [{ lat: city.lat, lng: city.lng, bbox: null }];
    for (const pt of points) for (const cat of MAPBOX_CATEGORIES) jobs.push({ city, pt, cat });
  }
  console.log(`[mapbox] ${jobs.length} calls over ${cities.length} cities`);
  let done = 0;
  let added = 0;
  await pool(jobs, 6, async ({ city, pt, cat }) => {
    const feats = await mapboxCategory(tok, cat, pt);
    for (const f of feats) {
      const row = fromMapbox(f, city.name);
      if (!row) continue;
      const key = `${row.source}|${row.ref}`;
      if (!byRef.has(key)) added += 1;
      byRef.set(key, { ...(byRef.get(key) ?? {}), ...row, hours: Object.keys(row.hours).length ? row.hours : byRef.get(key)?.hours ?? {} });
    }
    done += 1;
    if (done % 100 === 0) console.log(`[mapbox] ${done}/${jobs.length} · ${byRef.size} places`);
  });
  console.log(`[mapbox] done: ${byRef.size} places (${added} new)`);

  if (!args['no-osm']) {
    const elements = await overpass();
    let merged = 0;
    let fresh = 0;
    const mapboxRows = [...byRef.values()].filter((b) => b.source === 'MAPBOX');
    for (const e of elements) {
      const row = fromOsm(e);
      if (!row) continue;
      // The same place from both sources: keep the Mapbox row, borrow what it lacks (Georgian name, hours, phone).
      const twin = mapboxRows.find((b) => (distanceKm(b, row) ?? 9) < 0.08 && (norm(b.name) === norm(row.name) || norm(b.name).includes(norm(row.name)) || norm(row.name).includes(norm(b.name)) || (norm(row.nameKa) && norm(b.name) === norm(row.nameKa))));
      if (twin) {
        twin.nameKa ||= row.nameKa;
        twin.phone ||= row.phone;
        twin.website ||= row.website;
        twin.instagram ||= row.instagram;
        twin.addressKa ||= row.addressKa;
        if (!Object.keys(twin.hours ?? {}).length && Object.keys(row.hours).length) twin.hours = row.hours;
        merged += 1;
        continue;
      }
      const key = `${row.source}|${row.ref}`;
      if (!byRef.has(key)) fresh += 1;
      byRef.set(key, row);
    }
    console.log(`[osm] merged ${merged} into Mapbox rows, added ${fresh} new`);
  }

  const businesses = [...byRef.values()].sort((a, b) => `${a.city}|${a.name}`.localeCompare(`${b.city}|${b.name}`));
  const byCategory = {};
  for (const b of businesses) byCategory[b.category] = (byCategory[b.category] ?? 0) + 1;
  await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
  await writeFile(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), count: businesses.length, byCategory, businesses }, null, 1)}\n`, 'utf8');
  console.log(`[medibook] wrote ${businesses.length} businesses →`, byCategory);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
