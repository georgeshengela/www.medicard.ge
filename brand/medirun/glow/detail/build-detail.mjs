// MEDIRUN Glow city detail — what Mapbox's vector tiles do not carry, taken from OpenStreetMap once and
// served as small z14 tiles next to the engine:
//   node brand/medirun/glow/detail/build-detail.mjs [city]   →   server/public/medirun/glow/detail/
// The engine (glow-engine.js) reads index.json, then the tiles around the camera:
//   roofs     — roof shapes by OSM way id (Mapbox building ids are OSM way ids): domes, onions, cones, pyramids,
//               hipped and gabled roofs replace the flat cap of the matching building
//   monuments — statues, busts, columns, obelisks, steles, sculptures (no plaques)
//   fountains, towers (communication towers / masts ≥ 40 m), walls (city walls, fortress walls)
//   marks     — OSM ids of the building parts of churches (floodlit stone instead of apartment windows)
// Bridges come from Mapbox itself (road `structure: bridge`), so they work in every city without this file.
// Overpass is asked once per run; re-run after OSM edits worth having. Output is deterministic (sorted).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../../../server/public/medirun/glow/detail');
const CITIES = {
  tbilisi: 'area["name:en"="Tbilisi"]["admin_level"="4"]->.c;',
};
const city = process.argv[2] || 'tbilisi';
if (!CITIES[city]) throw new Error(`unknown city ${city}`);
const Z = 14;

const query = `[out:json][timeout:180];${CITIES[city]}
(way["roof:shape"](area.c););out tags geom;
(nwr["historic"="monument"](area.c);
 nwr["historic"="memorial"]["memorial"~"^(statue|bust|stele|obelisk|war_memorial|sculpture|stone|cross|monument|column)$"](area.c);
 nwr["tourism"="artwork"]["artwork_type"~"^(statue|bust|sculpture|stele|obelisk|monument|installation|column)$"](area.c););out tags center;
(nwr["amenity"="fountain"](area.c););out tags geom;
(nwr["man_made"~"^(tower|mast|communications_tower)$"](area.c););out tags center;
(way["barrier"="city_wall"](area.c);way["historic"="city_walls"](area.c););out tags geom;
(way["building:part"]["height"](area.c););out tags geom;
way["building"~"^(church|cathedral|chapel|monastery|mosque|synagogue|temple)$"](area.c)->.ch;
.ch map_to_area->.cha;
(way["building:part"](area.cha););out ids center;`;

console.log(`asking Overpass for ${city}…`);
let res = null;
for (const url of ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass-api.de/api/interpreter']) {
  res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'medicard-glow-detail/1' }, body: 'data=' + encodeURIComponent(query) }).catch(() => null);
  if (res?.ok) break;
  console.log(`  ${url} → ${res?.status ?? 'failed'}, trying again…`);
  await new Promise((r) => setTimeout(r, 15000));
}
if (!res?.ok) throw new Error(`Overpass ${res?.status}`);
const els = (await res.json()).elements;

const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const tileOf = (lng, lat) => {
  const n = 2 ** Z, x = Math.floor(((lng + 180) / 360) * n);
  const s = Math.sin((lat * Math.PI) / 180), y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n);
  return `${x}/${y}`;
};
const tiles = new Map();
const put = (lng, lat, kind, row) => {
  const k = tileOf(lng, lat);
  if (!tiles.has(k)) tiles.set(k, { roofs: [], monuments: [], fountains: [], towers: [], walls: [], marks: [] });
  tiles.get(k)[kind].push(row);
};
const centre = (e) => {
  if (e.center) return e.center;
  if (e.lat != null) return { lat: e.lat, lon: e.lon };
  if (e.geometry?.length) { const g = e.geometry; return { lat: g.reduce((s, p) => s + p.lat, 0) / g.length, lon: g.reduce((s, p) => s + p.lon, 0) / g.length }; }
  return null;
};

// roof:shape → engine code. Skillion, flat and unknown shapes keep the flat cap.
const SHAPES = { dome: 1, onion: 2, cone: 3, pyramidal: 4, hipped: 5, 'half-hipped': 5, mansard: 5, gambrel: 5, gabled: 6, round: 6, saltbox: 6 };
// a few monuments whose real size the generic shapes should honour (Wikidata id → [kind, height m])
const KNOWN = {
  Q3645634: ['column', 35],      // Freedom Monument — granite column, golden St George on top
  Q1147179: ['statue', 20],      // Mother of Kartli
  Q1188006: ['statue', 12],      // King Vakhtang Gorgasali, equestrian, above Metekhi
  Q65043165: ['chronicle', 35],  // Chronicle of Georgia — a ring of pillars
};
// monument kinds: 0 statue · 1 bust · 2 column · 3 obelisk · 4 stele · 5 sculpture · 6 cross · 7 chronicle
const KIND = { statue: 0, bust: 1, column: 2, obelisk: 3, stele: 4, stone: 4, war_memorial: 4, monument: 3, sculpture: 5, installation: 5, cross: 6, chronicle: 7 };

// Monuments already modelled in 3D (OSM building parts, e.g. the Freedom Monument's column) are drawn by Mapbox:
// a monument point inside a tall enough part is skipped. Two monument points within 8 m are one monument.
const solids = els.filter((e) => e.type === 'way' && e.geometry?.length > 2 && e.tags?.['building:part'] && num(e.tags.height) >= 5);
const inRing = (g, lon, lat) => { let a = false; for (let i = 0, j = g.length - 1; i < g.length; j = i++) { const p = g[i], q = g[j]; if ((p.lat > lat) !== (q.lat > lat) && lon < ((q.lon - p.lon) * (lat - p.lat)) / (q.lat - p.lat) + p.lon) a = !a; } return a; };
const modelled = (lon, lat) => solids.some((e) => { const g = e.geometry; if (lon < Math.min(...g.map((p) => p.lon)) || lon > Math.max(...g.map((p) => p.lon))) return false; return inRing(g, lon, lat); });
const placed = [], towers = [];
const seen = new Set(), marks = new Set();
const count = { roofs: 0, monuments: 0, fountains: 0, towers: 0, walls: 0, marks: 0 };
for (const e of els) {
  if (!e.tags && e.type === 'way' && e.center) {     // a part of a church: drawn as floodlit stone, no flat windows
    if (!marks.has(e.id)) { marks.add(e.id); put(e.center.lon, e.center.lat, 'marks', e.id); count.marks++; }
    continue;
  }
  const t = e.tags || {};
  const key = e.type + e.id;
  if (seen.has(key)) continue;
  seen.add(key);
  if (!t['roof:shape'] && t['building:part'] && !t.man_made && e.type === 'way') continue;
  if (t['roof:shape'] && e.type === 'way' && e.geometry) {
    const shape = SHAPES[t['roof:shape']];
    if (!shape || !(t.building || t['building:part'])) continue;
    const g = e.geometry;
    if (g.length < 4) continue;
    const ring = [];
    for (let i = 0; i < g.length - 1; i++) ring.push(r6(g[i].lon), r6(g[i].lat));
    const rh = num(t['roof:height']) ?? (num(t['roof:levels']) != null ? num(t['roof:levels']) * 3 : null);
    const colour = /^#?[0-9a-f]{6}$/i.test(t['roof:colour'] || '') ? t['roof:colour'].replace('#', '') : (t['roof:colour'] || '');
    const dir = num(t['roof:direction']);
    const lng = ring.reduce((s, v, i) => (i % 2 ? s : s + v), 0) / (ring.length / 2), lat = ring.reduce((s, v, i) => (i % 2 ? s + v : s), 0) / (ring.length / 2);
    // [osm way id, shape, roof height (-1 = from the footprint), colour, ridge direction (-1 = long side), ring lng,lat,…]
    put(lng, lat, 'roofs', [e.id, shape, rh ?? -1, colour, t['roof:orientation'] === 'across' ? -2 : dir ?? -1, ring]);
    count.roofs++;
    continue;
  }
  if ((t.barrier === 'city_wall' || t.historic === 'city_walls') && e.type === 'way' && e.geometry) {
    const line = e.geometry.flatMap((p) => [r6(p.lon), r6(p.lat)]);
    const m = e.geometry[Math.floor(e.geometry.length / 2)];
    // [height, thickness, line lng,lat,…]
    put(m.lon, m.lat, 'walls', [num(t.height) ?? 7, num(t.width) ?? 2.2, line]);
    count.walls++;
    continue;
  }
  const c = centre(e);
  if (!c) continue;
  if (t.historic === 'monument' || t.historic === 'memorial' || t.tourism === 'artwork') {
    const known = KNOWN[t.wikidata];
    const type = known ? known[0] : t.memorial || t.artwork_type || (t.historic === 'monument' ? 'monument' : 'stele');
    const kind = KIND[type];
    if (kind == null) continue;
    if (modelled(c.lon, c.lat)) continue;
    const kx = 111320 * Math.cos((c.lat * Math.PI) / 180);
    const twin = placed.find((q) => Math.hypot((q.lon - c.lon) * kx, (q.lat - c.lat) * 110540) < 8);
    if (twin) { if (!known || twin.known) continue; twin.row[0] = KIND[known[0]]; twin.row[1] = known[1]; continue; }
    const h = known ? known[1] : num(t.height);
    // [kind, height (-1 = default for the kind), lng, lat, name]
    const row = [kind, h ?? -1, r6(c.lon), r6(c.lat), t['name:ka'] || t.name || ''];
    placed.push({ lon: c.lon, lat: c.lat, known: Boolean(known), row });
    put(c.lon, c.lat, 'monuments', row);
    count.monuments++;
  } else if (t.amenity === 'fountain') {
    let r = 2.5;
    if (e.geometry?.length > 2) {
      const g = e.geometry, kx = 111320 * Math.cos((c.lat * Math.PI) / 180);
      const w = (Math.max(...g.map((p) => p.lon)) - Math.min(...g.map((p) => p.lon))) * kx, h = (Math.max(...g.map((p) => p.lat)) - Math.min(...g.map((p) => p.lat))) * 110540;
      r = Math.min(14, Math.max(1.5, Math.min(w, h) / 2));
    }
    put(c.lon, c.lat, 'fountains', [r6(c.lon), r6(c.lat), Math.round(r * 10) / 10]);
    count.fountains++;
  } else if (t.man_made === 'tower' || t.man_made === 'mast' || t.man_made === 'communications_tower') {
    const h = num(t.height);
    const comms = /communication|broadcast|radio|television/.test(t['tower:type'] || '') || t.man_made === 'mast' || t.man_made === 'communications_tower';
    if (!comms || h == null || h < 40) continue;
    // [lng, lat, height, 1 = lattice (communication), OSM way id whose Mapbox extrusion the tower replaces (0 = none)]
    const kx = 111320 * Math.cos((c.lat * Math.PI) / 180), id = e.type === 'way' ? e.id : 0;
    const twin = towers.find((q) => Math.hypot((q[0] - c.lon) * kx, (q[1] - c.lat) * 110540) < 30);   // a node and a way for one tower
    if (twin) { if (id) twin[4] = id; continue; }
    const row = [r6(c.lon), r6(c.lat), h, 1, id];
    towers.push(row);
    put(c.lon, c.lat, 'towers', row);
    count.towers++;
  }
}

rmSync(OUT, { recursive: true, force: true });
const keys = [...tiles.keys()].sort();
let bytes = 0;
for (const k of keys) {
  const [x, y] = k.split('/');
  mkdirSync(path.join(OUT, String(Z), x), { recursive: true });
  const body = tiles.get(k);
  for (const list of Object.values(body)) list.sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1);
  const json = JSON.stringify(body);
  bytes += json.length;
  writeFileSync(path.join(OUT, String(Z), x, `${y}.json`), json);
}
writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ v: 1, z: Z, tiles: keys }));
console.log(count, `${keys.length} tiles, ${Math.round(bytes / 1024)} KB →`, OUT);
