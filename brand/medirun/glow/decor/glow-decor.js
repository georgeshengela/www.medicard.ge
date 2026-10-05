// MEDIRUN Glow — city decor (lab, 2026-10-05). Realistic models (Meshy, decor/studio.py) placed on top of the shared
// engine without touching glow-engine.js: it reads the engine's debug handle (scene, uniforms, coordinate helpers).
//   · holiday trucks: the red truck drives the avenues (Mapbox road layer), right-hand lane. The model is cut into
//     tractor and trailer, so it bends through a turn like a real rig (front axle on the road, drive axle and
//     trailer axle trailing behind), and slows before a bend. Outlined in coloured chasing fairy lights, a lit
//     wreath, headlight beams, a twinkling picture on both trailer sides, a warm pool on the road and gold dust
//     rising from the roof.
// Coordinates are the engine's: local metres, x east, y north, z up.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createFerrisWheel } from './ferris.js?v=3';

const ROAD_LANE = { trunk: 3.4, primary: 3.4, secondary: 2.9, tertiary: 2.6, street: 1.9, street_limited: 1.7 };
const CELL = 30;
const MAJOR = 2.5;            // lane offset of a tertiary road: the smallest street a truck turns into
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FOG = 'uniform float uRefW; uniform vec3 uFog; vec3 fogged(vec3 c, float w){ return mix(c, uFog, smoothstep(1.7, 5.5, w / uRefW) * 0.85); }';

// The truck model in its own metres (measured with ray casts on decor/assets/truck/truck.glb scaled to LEN):
// nose at +x, wheels on z = 0. Tractor = everything ahead of the trailer plus the drive axles and fifth wheel under it.
const T = {
  LEN: 21, XF: 9.15, XD: 1.35, XK: 1.6, XT: -7.7,                         // front axle, drive axles, kingpin, trailer axles
  box: { x0: -10.45, x1: 2.75, z0: 1.68, z1: 5.27, w: 1.47 },              // trailer box
  isTractor: (x, z) => x > 2.9 || (z < 1.5 && x > -0.05),
};
const C = { warm: [1.0, 0.74, 0.38], red: [1.0, 0.13, 0.1], green: [0.18, 1.0, 0.32], gold: [1.0, 0.58, 0.1], ice: [0.45, 0.72, 1.0], amber: [1.0, 0.45, 0.05] };
const FESTIVE = [C.red, C.gold, C.green, C.ice, C.warm];

// Fairy lights as points: a hot core and a soft halo, additive; size in metres so they scale with the map.
function bulbMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uRefW: U.uRefW, uFog: U.uFog, uPxM: U.uPxM, uPR: U.uPR },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aCol; attribute vec2 aB;   // x = size (m), y = chase phase (<0 steady)
      uniform float uTime; uniform float uRefW; uniform float uPxM; uniform float uPR;
      varying vec3 vC; varying float vW;
      void main(){
        float k = aB.y < 0.0 ? 1.0 : 0.35 + 0.65 * smoothstep(-0.2, 1.0, sin(uTime * 5.0 - aB.y));
        vC = aCol * (0.5 + 1.3 * k);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vW = gl_Position.w;
        gl_PointSize = clamp(aB.x * uPxM * uPR * uRefW / gl_Position.w, 2.0, 52.0);
      }`,
    fragmentShader: `
      ${FOG}
      varying vec3 vC; varying float vW;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float core = smoothstep(0.42, 0.08, d), halo = exp(-d * d * 4.0) * 0.6;
        vec3 c = vC * halo + mix(vC, vec3(1.0), 0.55) * core * 1.7;
        gl_FragColor = vec4(fogged(c, vW) * (1.0 - smoothstep(0.7, 1.0, d)), 1.0);
      }`,
  });
}

// A soft pool of light on the ground (additive): elliptical falloff; `fwd` pushes it forward like a beam.
function poolMaterial(color, k, fwd = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uK: { value: k }, uFwd: { value: fwd } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uC; uniform float uK; uniform float uFwd; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float a = pow(max(0.0, 1.0 - length(p)), 1.6);
        if (uFwd > 0.0) a *= mix(1.0, smoothstep(-1.0, -0.3, p.x), uFwd);
        gl_FragColor = vec4(uC * a * uK, 1.0);
      }`,
  });
}

// Headlight beam: an open cone, bright at the lamp and fading along its length.
function beamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 2.2) * 0.22; gl_FragColor = vec4(vec3(1.0, 0.88, 0.66) * a, 1.0); }',
  });
}

// The picture on both trailer sides: string lights, a tree of light, snowflakes and „გაანათე თბილისი“, twinkling.
function panelTexture() {
  const W = 2048, H = 540, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const rnd = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  const css = (c, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
  const dot = (x, y, r, c) => { g.shadowColor = css(c, 0.9); g.shadowBlur = r * 3; g.fillStyle = css(c); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0; };
  // scalloped string of lights along the top
  for (let i = 0; i < 9; i++) {
    const x0 = i * (W / 9), x1 = x0 + W / 9;
    g.strokeStyle = 'rgba(30,20,10,.7)'; g.lineWidth = 3; g.beginPath();
    for (let k = 0; k <= 20; k++) { const t = k / 20, x = x0 + (x1 - x0) * t, y = 26 + Math.sin(t * Math.PI) * 46; k ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    for (let k = 1; k < 8; k++) { const t = k / 8; dot(x0 + (x1 - x0) * t, 30 + Math.sin(t * Math.PI) * 46, 9, FESTIVE[(i * 7 + k) % 5]); }
  }
  // snowflakes and little stars
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = 40 + rnd() * (W - 80), y = 120 + rnd() * (H - 160), r = 10 + rnd() * 22;
    if (x > 1450 && x < 1950) continue;
    g.strokeStyle = 'rgba(235,245,255,.85)'; g.lineWidth = 2.5; g.shadowColor = 'rgba(180,220,255,.9)'; g.shadowBlur = 10;
    for (let a = 0; a < 6; a++) { const ang = (a * Math.PI) / 3, cx = Math.cos(ang), sy = Math.sin(ang); g.beginPath(); g.moveTo(x, y); g.lineTo(x + cx * r, y + sy * r);
      g.moveTo(x + cx * r * 0.55, y + sy * r * 0.55); g.lineTo(x + Math.cos(ang + 0.5) * r * 0.8, y + Math.sin(ang + 0.5) * r * 0.8); g.stroke(); }
    g.shadowBlur = 0;
  }
  // the tree of light on the right
  const tx = 1700, ty = 108, th = 380;
  for (let row = 0; row < 15; row++) {
    const t = row / 14, y = ty + 40 + t * th * 0.86, half = 18 + t * 175, n = 2 + Math.round(t * 11);
    for (let k = 0; k <= n; k++) dot(tx - half + (2 * half * k) / n + (row % 2) * 6, y + Math.sin(k * 1.7) * 6, 6.5, k % 3 === 0 ? C.gold : k % 3 === 1 ? C.green : C.red);
  }
  g.fillStyle = 'rgba(90,50,25,1)'; g.fillRect(tx - 18, ty + th * 0.97, 36, 40);
  g.shadowColor = 'rgba(255,200,80,1)'; g.shadowBlur = 40; g.fillStyle = '#FFE08A'; g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 18 : 44, a = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(tx + Math.cos(a) * r, ty + 20 + Math.sin(a) * r); }
  g.fill(); g.shadowBlur = 0;
  // the words
  g.textBaseline = 'alphabetic';
  g.font = '700 150px "Noto Sans Georgian", sans-serif';
  g.shadowColor = 'rgba(255,190,90,.95)'; g.shadowBlur = 34; g.fillStyle = '#FFF4DC';
  g.fillText('გაანათე', 90, 285);
  g.fillText('თბილისი', 90, 440);
  g.shadowBlur = 0;
  g.font = '800 46px "Noto Sans Georgian", sans-serif'; g.fillStyle = '#FFD27A';
  g.fillText('MEDI', 98, 505); const w = g.measureText('MEDI').width; g.fillStyle = '#5EEAD4'; g.fillText('RUN', 98 + w, 505);
  // flipY stays off: the GL context is shared with Mapbox, whose 3D-texture uploads fail while UNPACK_FLIP_Y is set
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.flipY = false;
  return tex;
}
function panelMaterial(U, map) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uMap: { value: map } }, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D uMap; uniform float uTime; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec4 t = texture2D(uMap, vec2(vUv.x, 1.0 - vUv.y));   // the canvas is not flipped on upload
        float tw = 0.7 + 0.55 * sin(uTime * 3.2 + hash(floor(vUv * vec2(150.0, 40.0))) * 6.283);
        gl_FragColor = vec4(t.rgb * 1.35 * tw, t.a);
      }`,
  });
}

/** The engine's local metres from lng/lat, for engine builds whose debug handle has no `toLocal` (≤ 1.0.0.21). */
function localFromLngLat(toLngLat, mapbox) {
  const m0 = mapbox.MercatorCoordinate.fromLngLat(toLngLat(0, 0), 0), S = m0.meterInMercatorCoordinateUnits();
  return (lng, lat) => { const m = mapbox.MercatorCoordinate.fromLngLat([lng, lat], 0); return [(m.x - m0.x) / S, -(m.y - m0.y) / S]; };
}

export function createDecor(engine, { map, mapboxgl: mapbox = globalThis.mapboxgl, base = '', trucks: truckCount = 4, speed = 7, route = null, venues = [], landmarks = [] } = {}) {
  const dbg = engine.debug, { scene, U, camera, tiles, insideBuilding } = dbg;
  const toLocal = dbg.toLocal || localFromLngLat(dbg.toLngLat, mapbox);
  const deckZ = dbg.deckZ || (() => 0);       // bridges arrived with the city-detail engine; older ones are flat
  const root = new THREE.Group(); root.name = 'decor'; scene.add(root);
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const bulbs = bulbMaterial(U);

  // ---------- streets: every drivable line from the loaded Mapbox tiles, indexed by 30 m cells ----------
  let lines = [], cells = new Map();
  function rebuildRoads() {
    const seen = new Set(), out = [];
    for (const f of map.querySourceFeatures('streets', { sourceLayer: 'road' })) {
      const p = f.properties, lane = ROAD_LANE[p.class];
      if (!lane || p.structure === 'tunnel') continue;
      const g = f.geometry, parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const part of parts) {
        if (part.length < 2) continue;
        const a = part[0], b = part[part.length - 1], key = `${a[0].toFixed(6)},${a[1].toFixed(6)},${b[0].toFixed(6)},${b[1].toFixed(6)}`;
        if (seen.has(key)) continue; seen.add(key);
        const pts = [], cum = [];
        for (const [lng, lat] of part) {
          const q = toLocal(lng, lat);
          if (pts.length) { const l = pts[pts.length - 1], d = Math.hypot(q[0] - l[0], q[1] - l[1]); if (d < 0.5) continue; cum.push(cum[cum.length - 1] + d); } else cum.push(0);
          pts.push(q);
        }
        const len = cum[cum.length - 1];
        if (len >= 10) out.push({ pts, cum, len, lane, oneway: p.oneway === 'true' || p.oneway === true });
      }
    }
    const idx = new Map();
    out.forEach((l, li) => {
      for (let i = 0; i + 1 < l.pts.length; i++) {
        const [ax, ay] = l.pts[i], [bx, by] = l.pts[i + 1];
        for (let cx = Math.floor(Math.min(ax, bx) / CELL); cx <= Math.floor(Math.max(ax, bx) / CELL); cx++)
          for (let cy = Math.floor(Math.min(ay, by) / CELL); cy <= Math.floor(Math.max(ay, by) / CELL); cy++) {
            const k = cx + ',' + cy; if (!idx.has(k)) idx.set(k, []); idx.get(k).push(li, i);
          }
      }
    });
    lines = out; cells = idx;
  }
  function seg(l, s) { let lo = 0, hi = l.cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (l.cum[m] <= s) lo = m; else hi = m; } return lo; }
  function pointAt(l, s) {
    s = clamp(s, 0, l.len); const i = seg(l, s), a = l.pts[i], b = l.pts[i + 1], t = (s - l.cum[i]) / Math.max(1e-6, l.cum[i + 1] - l.cum[i]);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  function tangentAt(l, s) { const i = seg(l, clamp(s, 0, l.len)), a = l.pts[i], b = l.pts[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; }
  /** The road's direction averaged over ±r metres, so a lane offset never jumps at a polyline corner. */
  function smoothTangent(l, s, r = 5) {
    const a = pointAt(l, s - r), b = pointAt(l, s + r), d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return d > 0.3 ? [(b[0] - a[0]) / d, (b[1] - a[1]) / d] : tangentAt(l, s);
  }
  function nearLines(x, y, r) {
    const res = new Map();
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
      for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++) {
        const c = cells.get(cx + ',' + cy); if (!c) continue;
        for (let k = 0; k < c.length; k += 2) {
          const l = lines[c[k]], i = c[k + 1], [ax, ay] = l.pts[i], [bx, by] = l.pts[i + 1];
          const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, t = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1);
          const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
          if (d < r && (!res.has(l) || d < res.get(l).d)) res.set(l, { d, s: l.cum[i] + Math.sqrt(L2) * t });
        }
      }
    return res;
  }

  // ---------- a fixed loop (e.g. Rustaveli Avenue): the polyline twice over, so look-ahead never runs off the end ----------
  let loop = null;
  if (route && route.length > 2) {
    const P = route.map(([lng, lat]) => toLocal(lng, lat)), pts = [...P, ...P, P[0]], cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    loop = { pts, cum, len: cum[cum.length - 1], lane: 0, oneway: true, period: cum[P.length] };
  }

  // ---------- the truck: model → truck space (Z-up metres) → tractor and trailer meshes ----------
  let proto = null;
  const trucks = [];
  let panelMat = null;
  const fontsReady = document.fonts ? document.fonts.load('700 150px "Noto Sans Georgian"').catch(() => {}) : Promise.resolve();
  loader.load(`${base}truck/truck.glb`, async (gltf) => {
    const model = gltf.scene;
    model.rotation.x = Math.PI / 2;                     // glTF is Y-up
    const holder = new THREE.Group(); holder.add(model);
    holder.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    model.scale.setScalar(T.LEN / (box.max.x - box.min.x)); holder.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    model.position.set(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -box.min.z);
    holder.updateMatrixWorld(true);
    const tractor = [], trailer = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      // bake into truck space (float copies: the optimised file stores quantised positions/normals)
      const src = o.geometry, n = src.attributes.position.count, P = new Float32Array(n * 3), N = new Float32Array(n * 3);
      const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < n; i++) {
        // the Meshy file has the nose at -x: turn it half round so the nose points along +x
        v.fromBufferAttribute(src.attributes.position, i).applyMatrix4(o.matrixWorld); P.set([-v.x, -v.y, v.z], i * 3);
        v.fromBufferAttribute(src.attributes.normal, i).applyMatrix3(nm).normalize(); N.set([-v.x, -v.y, v.z], i * 3);
      }
      const pos = new THREE.BufferAttribute(P, 3), nor = new THREE.BufferAttribute(N, 3), idx = src.index.array, A = [], B = [];
      for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
        (T.isTractor((P[a] + P[b] + P[c]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3) ? A : B).push(idx[i], idx[i + 1], idx[i + 2]);
      }
      const m = o.material;
      m.color?.multiplyScalar(0.85); m.emissive = new THREE.Color(0x4a0a07); m.envMapIntensity = 0.3;
      for (const [list, out] of [[A, tractor], [B, trailer]]) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', pos); g.setAttribute('normal', nor); g.setAttribute('uv', src.attributes.uv); g.setIndex(list);
        g.computeBoundingSphere();
        out.push(new THREE.Mesh(g, m));
      }
    });
    await fontsReady;
    panelMat = panelMaterial(U, panelTexture());
    proto = { tractor, trailer };
    for (let i = 0; i < truckCount; i++) trucks.push(makeTruck(i));
  });

  /** Points along a straight run of bulbs; colours from `pal` in turn, the chase phase running along the run. */
  function bulbRun(out, a, c, { pal = FESTIVE, every = 0.62, size = 0.85, phase = 0, steady = false } = {}) {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]), n = Math.max(1, Math.round(len / every));
    for (let i = 0; i <= n; i++) {
      const t = i / n, s = phase + len * t;
      out.pos.push(a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t);
      out.col.push(...pal[Math.round(s / every) % pal.length]); out.b.push(size, steady ? -1 : s * 1.1);
    }
    return phase + len;
  }
  function pointsOf(out) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(out.col, 3));
    g.setAttribute('aB', new THREE.Float32BufferAttribute(out.b, 2));
    const p = new THREE.Points(g, bulbs); p.frustumCulled = false; p.renderOrder = 4;
    return p;
  }

  function makeTruck(i) {
    const tractor = new THREE.Group(), trailer = new THREE.Group();
    for (const m of proto.tractor) tractor.add(m.clone());
    for (const m of proto.trailer) trailer.add(m.clone());

    // trailer: coloured chase round the roof, warm white along the lower edges and up the corners
    const { x0, x1, z0, z1, w } = T.box, W = w + 0.05, zt = z1 + 0.05, tb = { pos: [], col: [], b: [] };
    let ph = bulbRun(tb, [x1, W, zt], [x0, W, zt]); ph = bulbRun(tb, [x0, W, zt], [x0, -W, zt], { phase: ph });
    ph = bulbRun(tb, [x0, -W, zt], [x1, -W, zt], { phase: ph }); bulbRun(tb, [x1, -W, zt], [x1, W, zt], { phase: ph });
    for (const y of [W, -W]) bulbRun(tb, [x1, y, z0], [x0, y, z0], { pal: [C.warm, C.warm, C.gold], size: 0.7 });
    for (const [x, y] of [[x0, W], [x0, -W], [x1, W], [x1, -W]]) bulbRun(tb, [x, y, z0], [x, y, zt], { pal: [C.red, C.warm], size: 0.7 });
    for (const y of [-1.2, 1.2]) { tb.pos.push(x0 - 0.06, y, 1.05); tb.col.push(1.0, 0.07, 0.05); tb.b.push(1.6, -1); }   // tail lights
    trailer.add(pointsOf(tb));
    // the picture on both sides
    const pw = x1 - x0 - 0.7, phh = z1 - z0 - 0.35, pcx = (x0 + x1) / 2, pcz = (z0 + z1) / 2;
    const right = new THREE.Mesh(new THREE.PlaneGeometry(pw, phh).rotateX(Math.PI / 2).translate(pcx, -w - 0.03, pcz), panelMat);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(pw, phh).rotateX(Math.PI / 2).rotateZ(Math.PI).translate(pcx, w + 0.03, pcz), panelMat);
    right.renderOrder = left.renderOrder = 3; trailer.add(right, left);
    // a warm pool on the road under the trailer that slowly changes colour
    const under = new THREE.Mesh(new THREE.PlaneGeometry(T.LEN * 1.2, 11), poolMaterial('#ff9a4a', 0.42));
    under.position.set((x0 + x1) / 2, 0, 0.05); under.renderOrder = 2; trailer.add(under);

    // tractor: sleeper, cab roof and hood outlined, amber roof markers, the wreath, headlights
    const cb = { pos: [], col: [], b: [] }, cab = [[3.45, 5.75, 4.34, 1.45], [6.1, 7.35, 3.7, 1.08], [7.85, 10.0, 2.66, 0.92]];
    for (const [a, b, z, y] of cab) { let p = bulbRun(cb, [a, y, z], [b, y, z], { every: 0.5 }); p = bulbRun(cb, [b, y, z], [b, -y, z], { every: 0.5, phase: p }); bulbRun(cb, [b, -y, z], [a, -y, z], { every: 0.5, phase: p }); }
    for (const y of [1.45, -1.45]) bulbRun(cb, [3.45, y, 1.8], [3.45, y, 4.34], { every: 0.5, pal: [C.gold, C.warm] });
    for (let k = -2; k <= 2; k++) { cb.pos.push(7.42, k * 0.38, 3.74); cb.col.push(...C.amber); cb.b.push(0.7, -1); }
    for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; cb.pos.push(10.28, Math.cos(a) * 0.44, 1.62 + Math.sin(a) * 0.44); cb.col.push(...(k % 2 ? C.green : k % 4 ? C.gold : C.red)); cb.b.push(0.55, k * 0.9); }
    for (const y of [-1.02, 1.02]) { cb.pos.push(10.05, y, 1.45); cb.col.push(1.0, 0.95, 0.82); cb.b.push(2.6, -1); }
    tractor.add(pointsOf(cb));
    const beamGeo = new THREE.CylinderGeometry(2.2, 0.14, 12, 20, 1, true).rotateZ(-Math.PI / 2).translate(6, 0, 0).rotateY(0.1);
    for (const y of [-1.02, 1.02]) { const m = new THREE.Mesh(beamGeo, beamMaterial()); m.position.set(10.1, y, 1.45); m.renderOrder = 3; tractor.add(m); }
    const road = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), poolMaterial('#ffe2b0', 0.6, 1));
    road.position.set(T.XF + 11, 0, 0.06); road.renderOrder = 2; tractor.add(road);

    tractor.visible = trailer.visible = false;
    root.add(tractor, trailer);
    return { tractor, trailer, underMat: under.material, hue: i * 0.23, line: null, s: 0, dir: 1, v: speed, F: null, R: null, T: null, z: 0, dust: 0 };
  }

  // ---------- gold dust rising from the trailer roofs ----------
  const DUST = 900, dustPos = new Float32Array(DUST * 3), dustCol = new Float32Array(DUST * 3), dustB = new Float32Array(DUST * 2);
  const dustVel = new Float32Array(DUST * 3), dustLife = new Float32Array(DUST), dustAge = new Float32Array(DUST).fill(1e9), dustBase = new Float32Array(DUST * 3);
  let dustNext = 0;
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3).setUsage(THREE.DynamicDrawUsage));
  dustGeo.setAttribute('aCol', new THREE.BufferAttribute(dustCol, 3).setUsage(THREE.DynamicDrawUsage));
  dustGeo.setAttribute('aB', new THREE.BufferAttribute(dustB, 2).setUsage(THREE.DynamicDrawUsage));
  const dust = new THREE.Points(dustGeo, bulbs); dust.frustumCulled = false; dust.renderOrder = 5; root.add(dust);
  const DUST_COL = [C.gold, C.warm, [1, 0.95, 0.85], C.gold, C.ice];
  function emitDust(t, n) {
    const a = t.trailer.rotation.z, ca = Math.cos(a), sa = Math.sin(a), p = t.trailer.position;
    for (let k = 0; k < n; k++) {
      const i = dustNext; dustNext = (dustNext + 1) % DUST;
      const lx = T.box.x0 + Math.random() * (T.box.x1 - T.box.x0), ly = (Math.random() * 2 - 1) * T.box.w;
      dustPos[i * 3] = p.x + lx * ca - ly * sa; dustPos[i * 3 + 1] = p.y + lx * sa + ly * ca; dustPos[i * 3 + 2] = p.z + T.box.z1 + 0.2;
      dustVel[i * 3] = (Math.random() - 0.5) * 0.8; dustVel[i * 3 + 1] = (Math.random() - 0.5) * 0.8; dustVel[i * 3 + 2] = 1.1 + Math.random() * 1.6;
      dustLife[i] = 1.8 + Math.random() * 1.6; dustAge[i] = 0;
      dustBase.set(DUST_COL[Math.floor(Math.random() * DUST_COL.length)], i * 3);
      dustB[i * 2] = 0.35 + Math.random() * 0.45; dustB[i * 2 + 1] = Math.random() * 40;
    }
  }
  function emitAt(x, y, z, r, n) {
    for (let k = 0; k < n; k++) {
      const i = dustNext, a = Math.random() * Math.PI * 2, d = Math.random() * r;
      dustNext = (dustNext + 1) % DUST;
      dustPos[i * 3] = x + Math.cos(a) * d; dustPos[i * 3 + 1] = y + Math.sin(a) * d; dustPos[i * 3 + 2] = z + (Math.random() - 0.5) * 3;
      dustVel[i * 3] = Math.cos(a) * 0.6; dustVel[i * 3 + 1] = Math.sin(a) * 0.6; dustVel[i * 3 + 2] = 0.6 + Math.random();
      dustLife[i] = 2 + Math.random() * 1.5; dustAge[i] = 0;
      dustBase.set(Math.random() < 0.7 ? C.gold : [1, 0.95, 0.85], i * 3);
      dustB[i * 2] = 0.45 + Math.random() * 0.5; dustB[i * 2 + 1] = Math.random() * 40;
    }
  }
  function stepDust(dt) {
    for (let i = 0; i < DUST; i++) {
      if (dustAge[i] > dustLife[i]) { if (dustCol[i * 3] || dustCol[i * 3 + 1]) dustCol.fill(0, i * 3, i * 3 + 3); continue; }
      dustAge[i] += dt;
      const u = dustAge[i] / dustLife[i], f = Math.sin(Math.PI * Math.min(1, u * 1.4)) * (1 - u);
      dustPos[i * 3] += dustVel[i * 3] * dt; dustPos[i * 3 + 1] += dustVel[i * 3 + 1] * dt; dustPos[i * 3 + 2] += dustVel[i * 3 + 2] * dt;
      dustVel[i * 3 + 2] *= 1 - dt * 0.4;
      for (let k = 0; k < 3; k++) dustCol[i * 3 + k] = dustBase[i * 3 + k] * f * 1.4;
    }
    dustGeo.attributes.position.needsUpdate = dustGeo.attributes.aCol.needsUpdate = dustGeo.attributes.aB.needsUpdate = true;
  }


  // ---------- partner venues: a real 3D model replaces the plain block, lit like a landmark ----------
  // The engine's own extruded building under the footprint is collapsed (re-checked as tiles stream in and out);
  // the model turns its signature corner (the highest point, e.g. a dome) towards `face` and fills the footprint.
  const venueState = [];
  const attrGeo = new Map();
  function geometryOf(attr) {
    if (!attrGeo.has(attr)) for (const t of tiles.values()) t.group?.traverse((o) => { if (o.geometry) for (const k in o.geometry.attributes) attrGeo.set(o.geometry.attributes[k], o.geometry); });
    return attrGeo.get(attr);
  }
  function hideRecord(rec) {
    if (!rec || rec.decorHidden) return;
    for (const r of rec.ranges) {
      const g = geometryOf(r.attr); if (!g) continue;
      const p = g.attributes.position;
      for (let i = r.start; i < r.start + r.count; i++) p.setXYZ(i, rec.cx, rec.cy, -500);
      p.needsUpdate = true;
    }
    rec.decorHidden = true;
  }
  function hideUnder(st) { for (const [x, y] of st.probe) hideRecord(insideBuilding(x, y)); }
  // Night look for a Meshy (PBR) model: the paint dimmed; yellow signage glows like neon, but only where a whole
  // patch of the texture is yellow (a blurred sample gates the sharp one — per-pixel colour tests on a generated
  // texture light up random speckles); the facade is washed from below by warm floodlights, fading up the walls.
  function nightMaterial(m) {
    if (!m || !m.isMaterial) return;
    m.color?.multiplyScalar(0.62); m.envMapIntensity = 0.25;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = 'varying vec3 vDecorW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vDecorW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float uTime; varying vec3 vDecorW;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_MAP
          vec3 sc = sampledDiffuseColor.rgb, bl = texture2D(map, vMapUv, 3.5).rgb;
          float yelSharp = smoothstep(0.4, 0.65, sc.r) * smoothstep(0.2, 0.4, sc.g) * (1.0 - smoothstep(0.04, 0.12, sc.b));
          float yelArea = smoothstep(0.25, 0.45, bl.r) * smoothstep(0.12, 0.28, bl.g) * (1.0 - smoothstep(0.06, 0.16, bl.b)) * step(bl.b * 2.5, bl.r);
          float flick = 0.94 + 0.06 * sin(uTime * 1.7);
          float flood = exp(-max(vDecorW.z, 0.0) / 9.0);
          totalEmissiveRadiance += vec3(1.0, 0.72, 0.1) * yelSharp * yelArea * 3.0 * flick + diffuseColor.rgb * vec3(1.0, 0.78, 0.55) * (0.55 * flood + 0.12);
        #endif`);
    };
    m.customProgramCacheKey = () => 'decor-night-2';
    m.needsUpdate = true;
  }
  // The golden arches as one bent neon tube: two parabolic arches whose inner legs meet a little below half height.
  function archesCurve(w = 7, h = 5.6) {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const x = -1 + (2 * i) / 48, side = x < 0 ? -1 : 1, xp = side * 0.5, t = (x - xp) / 0.5;
      const inner = (side < 0 && x > xp) || (side > 0 && x < xp);
      pts.push(new THREE.Vector3((x * w) / 2, 0, (1 - t * t * (inner ? 0.55 : 1)) * h));
    }
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  }
  const neonMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime },
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uTime; varying vec3 vN; void main(){ float rim = 0.75 + 0.25 * abs(vN.z); float b = 2.3 + 0.35 * sin(uTime * 2.1); gl_FragColor = vec4(vec3(1.0, 0.76, 0.12) * b * rim, 1.0); }',
  });
  const haloMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); gl_FragColor = vec4(vec3(1.0, 0.55, 0.05) * f * 0.35, 1.0); }',
  });
  function searchlightMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.4) * 0.12 * smoothstep(0.0, 0.04, vUv.y); gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * a, 1.0); }',
    });
  }
  function addVenue(v) {
    const ring = v.footprint.map(([lng, lat]) => toLocal(lng, lat));
    let cx = 0, cy = 0; for (const [x, y] of ring) { cx += x; cy += y; } cx /= ring.length; cy /= ring.length;
    // the tightest rectangle round the footprint (any edge direction): its long side sizes the model
    let best = null;
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length], a = Math.atan2(by - ay, bx - ax), c = Math.cos(a), sn = Math.sin(a);
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (const [x, y] of ring) { const u = x * c + y * sn, w = -x * sn + y * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, w); v1 = Math.max(v1, w); }
      if (!best || (u1 - u0) * (v1 - v0) < best.area) best = { area: (u1 - u0) * (v1 - v0), L: Math.max(u1 - u0, v1 - v0) };
    }
    const face = v.face ? toLocal(v.face[0], v.face[1]) : [cx, cy + 1];
    const st = { v, cx, cy, probe: [[cx, cy], ...ring.map(([x, y]) => [x + (cx - x) * 0.15, y + (cy - y) * 0.15])], group: new THREE.Group(), spin: null, lights: [], top: null };
    venueState.push(st);
    root.add(st.group);
    loader.load(`${base}${v.model}`, (gltf) => {
      const model = gltf.scene; model.rotation.x = Math.PI / 2;
      const holder = new THREE.Group(); holder.add(model); holder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
      // the signature corner: the highest vertex (the dome's crown)
      let top = null; const q = new THREE.Vector3();
      model.traverse((o) => {
        if (!o.isMesh) return;
        const a = o.geometry.attributes.position;
        for (let i = 0; i < a.count; i += 3) { q.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld); if (!top || q.z > top.z) top = q.clone(); }
        nightMaterial(o.material);
      });
      const s = (best.L / Math.max(size.x, size.y)) * (v.scale || 1);
      model.position.set(-mid.x, -mid.y, -box.min.z);
      holder.scale.setScalar(s);
      const domeDir = Math.atan2(top.y - mid.y, top.x - mid.x), want = Math.atan2(face[1] - cy, face[0] - cx);
      holder.rotation.z = want - domeDir + ((v.turn || 0) * Math.PI) / 180;
      const shift = v.shift || [0, 0];
      holder.position.set(cx + shift[0], cy + shift[1], 0);
      st.group.add(holder);
      const H = size.z * s, dome = new THREE.Vector3(top.x - mid.x, top.y - mid.y, 0).multiplyScalar(s).applyAxisAngle(new THREE.Vector3(0, 0, 1), holder.rotation.z);
      st.top = [holder.position.x + dome.x, holder.position.y + dome.y, H];
      // a floating neon M over the crown, turning slowly
      const curve = archesCurve(9, 7.2);
      const spin = new THREE.Group(); spin.position.set(st.top[0], st.top[1], H + 3.2);
      spin.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.34, 10, false), neonMat));
      const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 1.1, 10, false), haloMat); halo.renderOrder = 6; spin.add(halo);
      st.group.add(spin); st.spin = spin;
      // two searchlights sweeping the sky from the roof
      const coneGeo = new THREE.CylinderGeometry(5.5, 0.35, 90, 24, 1, true).translate(0, 45, 0).rotateX(Math.PI / 2);
      for (const k of [0, 1]) {
        const g = new THREE.Group(); g.rotation.order = 'ZXY'; g.position.set(st.top[0] + (k ? 3 : -3), st.top[1], H * 0.72);
        const cone = new THREE.Mesh(coneGeo, searchlightMaterial()); cone.renderOrder = 7; g.add(cone);
        st.group.add(g); st.lights.push(g);
      }
      // the square glows round it
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(best.L * 2.4, best.L * 2.4), poolMaterial('#ffb347', 0.5));
      pool.position.set(cx, cy, 0.07); pool.renderOrder = 2; st.group.add(pool);
      st.info = { scale: s, height: H, footprintL: best.L };
    });
  }
  for (const v of venues) addVenue(v);
  let hideAt = 0;
  function stepVenues(now, dt) {
    if (now - hideAt > 1000) { hideAt = now; attrGeo.clear(); for (const st of venueState) hideUnder(st); }
    const t = U.uTime.value;
    for (const st of venueState) {
      if (st.spin) { st.spin.rotation.z += dt * 0.5; st.spin.position.z = st.top[2] + 3.2 + Math.sin(t * 1.3) * 0.4; }
      st.lights.forEach((g, k) => { g.rotation.z = t * 0.35 + k * Math.PI; g.rotation.x = 0.55 + 0.2 * Math.sin(t * 0.5 + k * 2); });
      if (st.top && Math.random() < dt * 14) emitAt(st.top[0], st.top[1], st.top[2] + 3.5, 4.5, 1);
    }
  }

  // ---------- landmarks built as geometry (the Mtatsminda wheel) ----------
  const marks = [];
  for (const m of landmarks) {
    if (m.type !== 'ferris') continue;
    const w = createFerrisWheel({ U, diameter: m.diameter, hub: m.hub });
    const [x, y] = toLocal(m.lng, m.lat), f = m.face ? toLocal(m.face[0], m.face[1]) : [x + 1, y];
    w.group.position.set(x, y, 0);
    w.group.rotation.z = Math.atan2(f[1] - y, f[0] - x) - Math.PI / 2;     // the axle (local y) points at `face`
    root.add(w.group); marks.push(w);
  }

  // ---------- driving ----------
  function spawn(t, cx, cy, hidden = false) {
    // big trucks keep to the avenues (tertiary and up); side streets only where a city has nothing wider
    const near = [...nearLines(cx, cy, 450)].filter(([l]) => l.len > 60 && l.lane >= MAJOR);
    const pool = near.length ? near : [...nearLines(cx, cy, 320)].filter(([l]) => l.len > 40);
    if (!pool.length) return false;
    const others = trucks.filter((o) => o !== t && o.F);
    const free = pool.filter(([l, h]) => { const p = pointAt(l, h.s); return others.every((o) => Math.hypot(o.F[0] - p[0], o.F[1] - p[1]) > 90) && (!hidden || Math.hypot(p[0] - cx, p[1] - cy) > 220); });
    const list = free.length ? free : pool, [l, h] = list[Math.floor(Math.random() * list.length)];
    t.major = l.lane >= MAJOR; t.line = l; t.dir = l.oneway ? 1 : Math.random() < 0.5 ? 1 : -1; t.s = clamp(h.s, 25, l.len - 6); t.F = null; t.plan = null; t.seen = new Set([l]); t.turn = 0;
    return true;
  }
  // Turns happen at crossings: 18 m ahead the truck looks for an avenue crossing its own and, now and then, plans to
  // take it — it slows down on the approach, swings into the new lane and the trailer follows behind.
  function scanAhead(t) {
    const q = pointAt(t.line, t.s + t.dir * 18), h = smoothTangent(t.line, t.s + t.dir * 18), hd = [h[0] * t.dir, h[1] * t.dir];
    for (const [l, hit] of nearLines(q[0], q[1], 3.5)) {
      if (l === t.line || t.seen.has(l) || (t.major && l.lane < MAJOR)) continue;
      t.seen.add(l);
      const g = tangentAt(l, hit.s), dot = g[0] * hd[0] + g[1] * hd[1];
      if (Math.abs(dot) > 0.75 || Math.random() > 0.55) continue;
      const dirs = (l.oneway ? [1] : [1, -1]).filter((d) => (d > 0 ? l.len - hit.s : hit.s) > 30);
      if (!dirs.length) continue;
      t.plan = { l, s: hit.s, d: dirs[Math.floor(Math.random() * dirs.length)], at: t.s + t.dir * 18 };
      return;
    }
  }
  function advance(t, dt, cx, cy) {
    if (loop) {
      const a = smoothTangent(loop, t.s), b = smoothTangent(loop, t.s + 22), bend = Math.acos(clamp(a[0] * b[0] + a[1] * b[1], -1, 1));
      t.v += (speed * (1 - 0.6 * clamp(bend / 1.1, 0, 1)) - t.v) * (1 - Math.exp(-dt * 1.8));
      t.s += t.v * dt;
      if (t.s >= loop.period * 1.5) t.s -= loop.period;   // same place on the loop, one lap earlier in the doubled line
      return;
    }
    if (!t.plan && (t.scan = (t.scan || 0) + dt) > 0.3) { t.scan = 0; scanAhead(t); }
    // ease off before a bend or a planned turn
    const a = smoothTangent(t.line, t.s), b = smoothTangent(t.line, t.s + t.dir * 22), bend = Math.acos(clamp(a[0] * b[0] + a[1] * b[1], -1, 1));
    let want = speed * (1 - 0.6 * clamp(bend / 1.1, 0, 1));
    if (t.plan) want = Math.min(want, speed * (0.32 + 0.68 * clamp(((t.plan.at - t.s) * t.dir - 3) / 22, 0, 1)));
    t.v += (want - t.v) * (1 - Math.exp(-dt * 1.8));
    t.s += t.dir * t.v * dt;
    if (t.plan && (t.plan.at - t.s) * t.dir <= 0) {
      const p = t.plan; t.plan = null; t.line = p.l; t.s = p.s; t.dir = p.d; t.turn = 1.8; t.seen = new Set([p.l]);
      return;
    }
    if ((t.dir > 0 && t.s < t.line.len - 0.5) || (t.dir < 0 && t.s > 0.5)) return;
    // the end of this line: carry on along whatever continues it (tile seams, the next block of the avenue)
    const endS = t.dir > 0 ? t.line.len : 0, p = pointAt(t.line, endS), tg = tangentAt(t.line, endS), h = [tg[0] * t.dir, tg[1] * t.dir];
    const cands = [];
    for (const [l, hit] of nearLines(p[0], p[1], 4.5)) {
      if (l === t.line || (t.major && l.lane < MAJOR)) continue;
      for (const d of l.oneway ? [1] : [1, -1]) {
        if ((d > 0 ? l.len - hit.s : hit.s) < 15) continue;
        const q = tangentAt(l, hit.s), dot = (q[0] * h[0] + q[1] * h[1]) * d;
        if (dot > -0.3) cands.push({ l, s: hit.s, d, w: (dot + 0.3) ** 3 + 0.02 });
      }
    }
    if (cands.length) {
      let r = Math.random() * cands.reduce((s, c) => s + c.w, 0), c = cands[0];
      for (const k of cands) { r -= k.w; if (r <= 0) { c = k; break; } }
      const sharp = (tangentAt(c.l, c.s)[0] * h[0] + tangentAt(c.l, c.s)[1] * h[1]) * c.d < 0.9;
      t.line = c.l; t.s = c.s; t.dir = c.d; t.seen = new Set([c.l]); if (sharp) t.turn = 1.8;
    } else spawn(t, cx, cy, true);   // a dead end: a rig never turns round on the spot, it reappears out of sight
  }
  // A rig: the front axle follows the lane; the drive axle trails at the wheelbase, the trailer axle trails the kingpin.
  function place(t, dt) {
    const l = t.line, tg = smoothTangent(l, t.s), d = [tg[0] * t.dir, tg[1] * t.dir], lane = l.oneway ? 0 : l.lane, p = pointAt(l, t.s);
    const want = [p[0] + d[1] * lane, p[1] - d[0] * lane];
    const WB = T.XF - T.XD, TL = T.XK - T.XT;
    if (!t.F) { t.F = want.slice(); t.R = [want[0] - d[0] * WB, want[1] - d[1] * WB]; t.T = [t.R[0] - d[0] * TL, t.R[1] - d[1] * TL]; }
    const k = 1 - Math.exp(-dt * (t.turn > 0 ? 2.4 : 9)); t.turn = Math.max(0, (t.turn || 0) - dt);
    t.F[0] += (want[0] - t.F[0]) * k; t.F[1] += (want[1] - t.F[1]) * k;
    let ex = t.F[0] - t.R[0], ey = t.F[1] - t.R[1], el = Math.hypot(ex, ey) || 1;
    ex /= el; ey /= el; t.R[0] = t.F[0] - ex * WB; t.R[1] = t.F[1] - ey * WB;
    const K = [t.R[0] + ex * (T.XK - T.XD), t.R[1] + ey * (T.XK - T.XD)];
    let fx = K[0] - t.T[0], fy = K[1] - t.T[1], fl = Math.hypot(fx, fy) || 1;
    fx /= fl; fy /= fl; t.T[0] = K[0] - fx * TL; t.T[1] = K[1] - fy * TL;
    t.z += (deckZ(t.F[0], t.F[1], ex, ey) - t.z) * (1 - Math.exp(-dt * 6));
    const a1 = Math.atan2(ey, ex), a2 = Math.atan2(fy, fx);
    t.tractor.position.set(t.F[0] - ex * T.XF, t.F[1] - ey * T.XF, t.z); t.tractor.rotation.z = a1;
    t.trailer.position.set(K[0] - fx * T.XK, K[1] - fy * T.XK, t.z); t.trailer.rotation.z = a2;
    t.tractor.visible = t.trailer.visible = true;
  }

  let last = performance.now(), roadsAt = 0, raf = 0, disposed = false;
  function tick(now) {
    if (disposed) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const c = map.getCenter(), [cx, cy] = toLocal(c.lng, c.lat);
    if (!loop && now - roadsAt > 4000) { roadsAt = now; rebuildRoads(); }
    if (lines.length || loop) for (const [i, t] of trucks.entries()) {
      if (loop) { if (!t.line) { t.line = loop; t.dir = 1; t.s = loop.period * (0.5 + i / trucks.length); t.v = speed; t.F = null; } }
      else if (!t.line || (t.F && Math.hypot(t.F[0] - cx, t.F[1] - cy) > 900)) { if (!spawn(t, cx, cy)) continue; }
      advance(t, dt, cx, cy);
      place(t, dt);
      t.hue = (t.hue + dt * 0.05) % 1; t.underMat.uniforms.uC.value.setHSL(0.03 + 0.1 * (0.5 + 0.5 * Math.sin(t.hue * Math.PI * 2)), 1, 0.6);
      t.dust += dt * 26; const n = Math.floor(t.dust); t.dust -= n; if (n) emitDust(t, n);
    }
    stepVenues(now, dt);
    for (const w of marks) w.update(dt, U.uTime.value);
    stepDust(dt);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return {
    trucks,
    venues: venueState,
    landmarks: marks,
    roads: () => lines.length,
    camera,
    dispose() { disposed = true; cancelAnimationFrame(raf); scene.remove(root); },
  };
}
