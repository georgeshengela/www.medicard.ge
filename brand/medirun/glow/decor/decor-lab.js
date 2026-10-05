// Decor lab: the Glow prototype (glow.js) plus the city decor module. Open /decor-lab.html on the glow server.
//   ?trucks=N   how many trucks (default 4)
//   ?follow=K   the camera rides with truck K (a slow chase view from the front-left)
//   ?route=free trucks roam the avenues; default: the Rustaveli loop, Freedom Square ⇄ Philharmonic (build-route.py)
import { createDecor } from './glow-decor.js?v=13';

const g = await new Promise((resolve) => { const t = setInterval(() => { if (window.glow?.engine) { clearInterval(t); resolve(window.glow); } }, 100); });
const params = new URLSearchParams(location.search);
const route = params.get('route') === 'free' ? null : (await fetch('decor/rustaveli-loop.json').then((r) => r.json())).coords;
const places = params.has('novenues') ? {} : await fetch('decor/venues.json?v=2').then((r) => r.json());
const venues = places.venues || [], landmarks = places.landmarks || [];
const decor = createDecor(g.engine, { map: g.map, base: 'decor/assets/', trucks: Number(params.get('trucks') ?? 4), route, venues, landmarks });
window.decor = decor;

const cam = { off: 120, zoom: 19.2, pitch: 48, bearing: null };
window.decorCam = cam;
if (params.has('follow')) {
  g.state.manual = true;
  const k = Number(params.get('follow')) || 0;
  const step = () => {
    const t = decor.trucks[k];
    if (t && t.F) {
      const x = (t.tractor.position.x + t.trailer.position.x) / 2, y = (t.tractor.position.y + t.trailer.position.y) / 2;
      const want = 90 - (t.tractor.rotation.z * 180) / Math.PI + cam.off;
      cam.bearing = cam.bearing == null ? want : cam.bearing + ((((want - cam.bearing) % 360) + 540) % 360 - 180) * 0.03;
      g.map.jumpTo({ center: g.engine.debug.toLngLat(x, y), zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing });
    }
    requestAnimationFrame(step);
  };
  step();
}
