// The ground under the XR city. In the app Mapbox GL draws it (glowStyle in the engine); here there is no
// Mapbox map, so the same night streets, water and parks are built from the very tiles the engine streams
// (the engine's fetch is teed — nothing is downloaded twice). One mesh per tile, layers in draw order,
// no depth writes: the ground is drawn first and everything in the city stands on top of it.
import * as THREE from 'three';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];   // raw, like Mapbox paints it
const C = { base: hex(0x111723), green: hex(0x15211d), water: hex(0x1d2b42), edge: hex(0x3a4c68), casing: hex(0x2c3649), road: hex(0x212a39), path: hex(0x19212e) };
const GREEN = new Set(['park', 'grass', 'wood', 'scrub', 'cemetery', 'pitch']);
const NOT_ROAD = new Set(['major_rail', 'minor_rail', 'service_rail', 'ferry', 'aerialway', 'golf', 'construction']);
const PATHS = new Set(['path', 'pedestrian', 'track']);
function roadWidth(cls) {
  if (cls === 'motorway' || cls === 'trunk' || cls === 'primary') return 14;
  if (cls === 'secondary' || cls === 'tertiary') return 11;
  if (cls === 'street' || cls === 'street_limited') return 7;
  if (cls === 'service') return 5;
  return 2.6;
}

/** Sutherland–Hodgman against the tile square [0, E]². */
function clipRing(ring, E) {
  let out = ring;
  const edges = [[(p) => p[0] >= 0, (a, b) => { const t = a[0] / (a[0] - b[0]); return [0, a[1] + (b[1] - a[1]) * t]; }],
    [(p) => p[0] <= E, (a, b) => { const t = (E - a[0]) / (b[0] - a[0]); return [E, a[1] + (b[1] - a[1]) * t]; }],
    [(p) => p[1] >= 0, (a, b) => { const t = a[1] / (a[1] - b[1]); return [a[0] + (b[0] - a[0]) * t, 0]; }],
    [(p) => p[1] <= E, (a, b) => { const t = (E - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, E]; }]];
  for (const [inside, cut] of edges) {
    const src = out; out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[(i + src.length - 1) % src.length], b = src[i];
      if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); } else if (inside(a)) out.push(cut(a, b));
    }
    if (out.length < 3) return [];
  }
  return out;
}
const area = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

/** Polygons of a vector-tile feature: outer rings (clockwise in tile space) with their holes. */
function polygons(feature) {
  const polys = [];
  for (const ring of feature.loadGeometry()) {
    const r = ring.map((p) => [p.x, p.y]);
    if (r.length < 3) continue;
    const a = area(r);
    if (a > 0) polys.push([r]); else if (polys.length) polys[polys.length - 1].push(r);
  }
  return polys;
}

export function createGround({ U, scene, tileToLocal, Z = 16 }) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uFog: U.uFog, uRefW: U.uRefW },
    depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 aCol; varying vec3 vC; varying float vW;
      void main(){ vC = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }`,
    fragmentShader: `uniform float uRefW; uniform vec3 uFog; varying vec3 vC; varying float vW;
      void main(){ gl_FragColor = vec4(mix(vC, uFog, smoothstep(1.7, 5.5, vW / uRefW) * 0.85), 1.0); }`,
  });
  const group = new THREE.Group(); group.renderOrder = -20; scene.add(group);
  const meshes = new Map();

  function build(key, buf) {
    const [tx, ty] = key.split('/').map(Number);
    const tile = new VectorTile(new Pbf(new Uint8Array(buf)));
    const pos = [], col = [];
    const E0 = 4096;
    const L = (x, y, E) => tileToLocal(tx + x / E, ty + y / E);
    const tri = (a, b, c, colour, z) => { pos.push(a[0], a[1], z, b[0], b[1], z, c[0], c[1], z); for (let k = 0; k < 3; k++) col.push(...colour); };
    // the tile's own square, so streets never float over the void
    { const a = L(0, 0, 1), b = L(1, 0, 1), c = L(1, 1, 1), d = L(0, 1, 1); tri(a, b, c, C.base, 0); tri(a, c, d, C.base, 0); }
    const fill = (layer, test, colour, z) => {
      if (!layer) return;
      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i);
        if (f.type !== 3 || !test(f)) continue;
        for (const poly of polygons(f)) {
          const rings = poly.map((r) => clipRing(r, f.extent || E0)).filter((r) => r.length >= 3);
          if (!rings.length || rings[0].length < 3) continue;
          const local = rings.map((r) => r.map((p) => L(p[0], p[1], f.extent || E0)));
          const contour = local[0].map((p) => new THREE.Vector2(p[0], p[1]));
          const holes = local.slice(1).map((r) => r.map((p) => new THREE.Vector2(p[0], p[1])));
          const all = contour.concat(...holes);
          for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, holes)) tri([all[a].x, all[a].y], [all[b].x, all[b].y], [all[c].x, all[c].y], colour, z);
        }
      }
    };
    const strokes = (layer, test, widthOf, colourOf, z) => {
      if (!layer) return;
      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i);
        if (f.type !== 2 || !test(f)) continue;
        const w = widthOf(f) / 2, colour = colourOf(f), E = f.extent || E0;
        for (const line of f.loadGeometry()) {
          const pts = line.map((p) => L(p.x, p.y, E));
          for (let k = 0; k < pts.length; k++) {
            const p = pts[k];
            if (k > 0) {
              const q = pts[k - 1], dx = p[0] - q[0], dy = p[1] - q[1], len = Math.hypot(dx, dy);
              if (len > 0.01) {
                const nx = (-dy / len) * w, ny = (dx / len) * w;
                const a = [q[0] + nx, q[1] + ny], b = [q[0] - nx, q[1] - ny], c = [p[0] - nx, p[1] - ny], d = [p[0] + nx, p[1] + ny];
                tri(a, b, c, colour, z); tri(a, c, d, colour, z);
              }
            }
            // round caps at the ends and round joins only where the line really turns (a headset draws every triangle twice)
            const prev = pts[k - 1], next = pts[k + 1];
            let turn = Math.PI;
            if (prev && next) {
              const a = Math.atan2(p[1] - prev[1], p[0] - prev[0]), b = Math.atan2(next[1] - p[1], next[0] - p[0]);
              turn = Math.abs(((b - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
            }
            if (turn > 0.3) for (let s = 0; s < 6; s++) {
              const a0 = (s / 6) * Math.PI * 2, a1 = ((s + 1) / 6) * Math.PI * 2;
              tri(p, [p[0] + Math.cos(a0) * w, p[1] + Math.sin(a0) * w], [p[0] + Math.cos(a1) * w, p[1] + Math.sin(a1) * w], colour, z);
            }
          }
        }
      }
    };
    const { landuse, water, road } = tile.layers;
    fill(landuse, (f) => GREEN.has(f.properties.class), C.green, 0.02);
    fill(water, () => true, C.water, 0.04);
    const isRoad = (f) => f.properties.structure !== 'bridge' && !NOT_ROAD.has(f.properties.class);
    strokes(road, isRoad, (f) => roadWidth(f.properties.class) + 1.4, () => C.casing, 0.06);
    strokes(road, isRoad, (f) => roadWidth(f.properties.class), (f) => (PATHS.has(f.properties.class) ? C.path : C.road), 0.08);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.renderOrder = -20;
    return mesh;
  }

  return {
    /** Keep the ground in step with the engine's street tiles: build what it has, drop what it dropped. */
    sync(engineTiles, buffers) {
      for (const [key, t] of engineTiles) {
        if (meshes.has(key) || !t.group) continue;
        const buf = buffers.get(key);
        if (!buf) continue;
        try { const mesh = build(key, buf); meshes.set(key, mesh); group.add(mesh); } catch (err) { meshes.set(key, null); console.warn('ground tile', key, err); }
      }
      for (const [key, mesh] of meshes) {
        if (engineTiles.has(key)) continue;
        if (mesh) { group.remove(mesh); mesh.geometry.dispose(); }
        meshes.delete(key); buffers.delete(key);
      }
    },
    count: () => meshes.size,
  };
}
