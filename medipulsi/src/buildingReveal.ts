// Walked-city effect: buildings near the player's trail rise to their real height and take a colour;
// the rest of the city stays low and grey. Pure presentation — it never changes progress or missions.
import type mapboxgl from 'mapbox-gl';
import type {Coordinate} from './engine';

export const REVEAL_LAYER = 'explorer-buildings';
const RADIUS = 55;          // metres from the trail to a building's centre (wide blocks sit far back)
const REST = .28;           // undiscovered buildings stand at this share of their height
const RISE_MS = 900;
const PALETTE = ['#FB7185', '#F59E0B', '#FCD34D', '#34D399', '#22D3EE', '#818CF8', '#E879F9', '#2DD4BF', '#F97316'];
const SOURCE = {source: 'composite', sourceLayer: 'building'};

const lit = ['boolean', ['feature-state', 'lit'], false] as const;
const share = ['case', lit, ['+', REST, ['*', 1 - REST, ['coalesce', ['feature-state', 'rise'], 1]]], REST];

export function addRevealLayer(m: mapboxgl.Map, dark: boolean) {
  if (!m.getSource('composite') || m.getLayer(REVEAL_LAYER)) return;
  // 3D lights make the emissive glow of walked buildings visible on the classic dark/light styles
  m.setLights([{id: 'ambient', type: 'ambient', properties: {color: '#ffffff', intensity: dark ? .45 : .8}}, {id: 'sun', type: 'directional', properties: {direction: [210, 45], color: '#ffffff', intensity: dark ? .55 : .7, 'cast-shadows': false}}]);
  const colour: unknown[] = ['match', ['%', ['to-number', ['id'], 0], PALETTE.length]];
  PALETTE.forEach((c, i) => colour.push(i, c));
  colour.push(PALETTE[0]);
  m.addLayer({
    id: REVEAL_LAYER, type: 'fill-extrusion', source: 'composite', 'source-layer': 'building', minzoom: 13,
    filter: ['==', 'extrude', 'true'],
    paint: {
      'fill-extrusion-color': ['case', lit, colour, dark ? '#1E2735' : '#C7D0CE'] as never,
      'fill-extrusion-height': ['*', ['coalesce', ['get', 'height'], 9], share] as never,
      'fill-extrusion-base': ['*', ['coalesce', ['get', 'min_height'], 0], share] as never,
      'fill-extrusion-emissive-strength': ['case', lit, dark ? .7 : .35, 0] as never,
      'fill-extrusion-opacity': .92,
      'fill-extrusion-vertical-gradient': true,
    },
  });
}

const M_LAT = 110540;
const toXY = (p: Coordinate, cos: number) => [p[0] * 111320 * cos, p[1] * M_LAT];

export class BuildingReveal {
  private lit = new Set<number | string>();
  private rising = new Map<number | string, number>();
  private grid = new Map<string, number[][]>();
  private cos = 1;
  private points = 0;
  private dirty = true;
  private first = true;
  private lastScan = 0;
  constructor(private m: mapboxgl.Map) {
    m.on('sourcedata', e => { if (e.sourceId === 'composite' && e.isSourceLoaded) this.dirty = true; });
  }
  /** Feed the whole walked trail (all chunks). Cheap to call often; re-indexes only when it grew. */
  setTrail(trail: Coordinate[][]) {
    const count = trail.reduce((n, c) => n + c.length, 0);
    if (count === this.points) return;
    this.points = count; this.dirty = true;
    const first = trail.find(c => c.length)?.[0];
    if (!first) { this.grid.clear(); return; }
    this.cos = Math.cos(first[1] * Math.PI / 180);
    this.grid.clear();
    for (const chunk of trail) for (let i = 0; i < chunk.length; i++) {
      const a = chunk[i], b = chunk[i + 1] || a, [ax, ay] = toXY(a, this.cos), [bx, by] = toXY(b, this.cos);
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 10));
      for (let k = 0; k < steps; k++) {
        const x = ax + (bx - ax) * k / steps, y = ay + (by - ay) * k / steps, key = Math.floor(x / RADIUS) + ',' + Math.floor(y / RADIUS);
        (this.grid.get(key) || this.grid.set(key, []).get(key)!).push([x, y]);
      }
    }
  }
  private near(p: Coordinate) {
    const [x, y] = toXY(p, this.cos), cx = Math.floor(x / RADIUS), cy = Math.floor(y / RADIUS);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const [px, py] of this.grid.get((cx + i) + ',' + (cy + j)) || []) if ((px - x) ** 2 + (py - y) ** 2 < RADIUS * RADIUS) return true;
    }
    return false;
  }
  private scan(now: number) {
    if (!this.dirty || now - this.lastScan < 500 || !this.m.getLayer(REVEAL_LAYER)) return;
    this.dirty = false; this.lastScan = now;
    if (!this.grid.size) return;
    const animate = !this.first;
    for (const f of this.m.querySourceFeatures('composite', {sourceLayer: 'building'}) as unknown as Array<{id?: number | string; geometry: import('geojson').Geometry}>) {
      const id = f.id;
      if (id === undefined || this.lit.has(id)) continue;
      const g = f.geometry, ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null;
      if (!ring?.length) continue;
      let sx = 0, sy = 0; for (const [x, y] of ring) { sx += x; sy += y; }
      if (!this.near([sx / ring.length, sy / ring.length])) continue;
      this.lit.add(id);
      this.m.setFeatureState({...SOURCE, id}, {lit: true, rise: animate ? 0 : 1});
      if (animate) this.rising.set(id, now + Math.random() * 250);
    }
    this.first = false;
  }
  /** Call every animation frame. */
  tick(now = performance.now()) {
    this.scan(now);
    for (const [id, start] of this.rising) {
      const p = Math.min(1, Math.max(0, (now - start) / RISE_MS));
      const c = 1.9, e = p <= 0 ? 0 : 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);   // ease-out-back
      this.m.setFeatureState({...SOURCE, id}, {rise: e});
      if (p >= 1) this.rising.delete(id);
    }
  }
  /** After a style reload feature states are gone; put them back. */
  restore() {
    for (const id of this.lit) this.m.setFeatureState({...SOURCE, id}, {lit: true, rise: 1});
    this.rising.clear(); this.dirty = true;
  }
  get count() { return this.lit.size; }
}
