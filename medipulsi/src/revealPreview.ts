// Dev-only preview of the walked-city effect (no account needed): a simulated walk through Vake on real
// Mapbox streets. Open /medipulsi/reveal.html on the Vite dev server.
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';
import {addRevealLayer, BuildingReveal} from './buildingReveal';
import type {Coordinate} from './engine';

const token = import.meta.env.VITE_MAPBOX_TOKEN as string;
const WAYPOINTS: Coordinate[] = [[44.7532, 41.7121], [44.7598, 41.7111], [44.7641, 41.7102], [44.7652, 41.7074], [44.7590, 41.7068], [44.7556, 41.7090]];
const params = new URLSearchParams(location.search);
const SPEED = Number(params.get('speed') || 14);   // metres per second of simulated walking
const dark = params.get('theme') !== 'light';

const hud = document.getElementById('hud')!;
const m = new mapboxgl.Map({container: 'map', accessToken: token, style: dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
  center: WAYPOINTS[0], zoom: 16.6, pitch: 62, bearing: -20, antialias: true, attributionControl: false});
const reveal = new BuildingReveal(m);

async function walkRoute(): Promise<Coordinate[]> {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${WAYPOINTS.map(p => p.join(',')).join(';')}?geometries=geojson&overview=full&access_token=${token}`;
    const r = await fetch(url); const j = await r.json();
    return j.routes[0].geometry.coordinates;
  } catch { return WAYPOINTS; }
}
const metres = (a: Coordinate, b: Coordinate) => Math.hypot((b[0] - a[0]) * 111320 * Math.cos(a[1] * Math.PI / 180), (b[1] - a[1]) * 110540);

m.on('style.load', async () => {
  for (const l of m.getStyle().layers || []) {
    if (l.type === 'background') m.setPaintProperty(l.id, 'background-color', dark ? '#0a1424' : '#e7eeed');
    if (l.type === 'fill' && /landuse|landcover/.test(l.id)) m.setPaintProperty(l.id, 'fill-color', dark ? '#152238' : '#d7e6dc');
    if (l.type === 'line' && /road/.test(l.id) && !l.id.includes('label')) m.setPaintProperty(l.id, 'line-color', dark ? (l.id.includes('case') ? '#152336' : '#34475a') : (l.id.includes('case') ? '#ccd9d5' : '#f8fcfa'));
  }
  if (m.getLayer('water')) m.setPaintProperty('water', 'fill-color', dark ? '#0d253e' : '#b7d9de');
  addRevealLayer(m, dark);
  m.addSource('trail', {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: []}}});
  for (const l of [{id: 'glow', w: 18, b: 6, o: .35, c: '#14b8a6'}, {id: 'line', w: 5, b: 0, o: .95, c: '#2dd4bf'}, {id: 'core', w: 1.4, b: 0, o: .9, c: '#ccfbf1'}])
    m.addLayer({id: 'trail-' + l.id, type: 'line', source: 'trail', layout: {'line-cap': 'round', 'line-join': 'round'}, paint: {'line-color': l.c, 'line-width': l.w, 'line-blur': l.b, 'line-opacity': l.o}});

  const route = await walkRoute(), cum = [0];
  for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + metres(route[i - 1], route[i]));
  const total = cum[cum.length - 1];
  const el = document.createElement('div'); el.className = 'puck';
  const puck = new mapboxgl.Marker({element: el}).setLngLat(route[0]).addTo(m);
  let t0 = performance.now() + 1500;
  document.getElementById('restart')!.onclick = () => location.reload();
  const frame = (now: number) => {
    const s = Math.min(total, Math.max(0, (now - t0) / 1000 * SPEED));
    let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
    const k = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), a = route[i - 1], b = route[i];
    const head: Coordinate = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    const walked = [...route.slice(0, i), head];
    (m.getSource('trail') as mapboxgl.GeoJSONSource).setData({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: walked}});
    reveal.setTrail([walked]); reveal.tick(now);
    puck.setLngLat(head);
    m.jumpTo({center: head, bearing: -20 + (now - t0) / 1000 * 2.2});
    hud.textContent = `${Math.round(s)} მ · გაცოცხლებული შენობა: ${reveal.count}`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
});
