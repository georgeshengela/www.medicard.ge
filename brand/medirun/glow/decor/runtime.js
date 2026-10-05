// MEDIRUN Glow city decor in the app's map WebView. Built by decor/build.mjs into
// server/public/medirun/glow/decor/decor.js (global MedirunDecor); mapHtml.ts loads it after the engine starts and
// calls MedirunDecor.start(glow, …). three.js is the engine's own copy (glow.debug.THREE, see build.mjs).
//   · admin switches (via /api/app/status `features`): medirunDecor (trucks + Mtatsminda wheel, on unless switched
//     off) and medirunPartners (partner buildings such as McDonald's, OFF until an admin switches it on)
//   · Tbilisi only: nothing is fetched or built until the map is over Tbilisi
//   · everything fails quietly: the run map never depends on decor
import { createDecor } from './glow-decor.js';

const TBILISI = { w: 44.62, s: 41.62, e: 45.02, n: 41.84 };
const inTbilisi = (c) => c.lng > TBILISI.w && c.lng < TBILISI.e && c.lat > TBILISI.s && c.lat < TBILISI.n;

export function start(glow, { map, mapboxgl, base, statusUrl = 'https://medicard.ge/api/app/status' } = {}) {
  if (!glow || !glow.debug || !map) return null;
  let decor = null, starting = false;
  const handle = { get decor() { return decor; }, dispose() { map.off('moveend', check); if (decor) decor.dispose(); decor = null; } };
  async function boot() {
    starting = true;
    try {
      const [status, data] = await Promise.all([
        fetch(statusUrl, { credentials: 'omit' }).then((r) => r.json()).catch(() => ({})),
        fetch(`${base}decor.json`).then((r) => r.json()),
      ]);
      const f = status.features || {};
      if (f.medirun === false || f.medirunDecor === false) return;
      decor = createDecor(glow, {
        map, mapboxgl, base,
        trucks: data.trucks ?? 4,
        route: data.route,
        landmarks: data.landmarks || [],
        venues: f.medirunPartners === true ? data.venues || [] : [],
      });
      map.off('moveend', check);
    } catch (e) { /* the map goes on without decor */ } finally { starting = false; }
  }
  function check() { if (!decor && !starting && inTbilisi(map.getCenter())) boot(); }
  map.on('moveend', check);
  check();
  return handle;
}
