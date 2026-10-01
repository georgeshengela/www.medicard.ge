// MEDIRUN Glow — prototype. A dark miniature city that lights up behind the runner.
// Mapbox GL draws the ground (streets, water, parks); three.js draws everything that glows,
// in the same WebGL context, from Mapbox vector tiles (works for any city, not just Tbilisi).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import Pbf from 'https://cdn.jsdelivr.net/npm/pbf@4/+esm';
import { VectorTile } from 'https://cdn.jsdelivr.net/npm/@mapbox/vector-tile@2/+esm';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash1 = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const lerpAngle = (a, b, t) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;

const ROUTE = await fetch('route.json').then((r) => r.json());
const TOKEN = (await fetch('https://medicard.ge/api/app/status?version=1.0.0.17.34').then((r) => r.json())).mapboxToken;
mapboxgl.accessToken = TOKEN;

// ---------- local metric frame: x east, y north, z up (metres) ----------
const lons = ROUTE.coords.map((c) => c[0]), lats = ROUTE.coords.map((c) => c[1]);
const CENTER = [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
const ORIGIN = mapboxgl.MercatorCoordinate.fromLngLat(CENTER, 0);
const S = ORIGIN.meterInMercatorCoordinateUnits();
const fromMerc = (mx, my) => [(mx - ORIGIN.x) / S, -(my - ORIGIN.y) / S];
const toLocal = (ll) => { const m = mapboxgl.MercatorCoordinate.fromLngLat(ll, 0); return fromMerc(m.x, m.y); };
const toMerc = (x, y) => ({ x: ORIGIN.x + x * S, y: ORIGIN.y - y * S });
const toLngLat = (x, y) => { const m = toMerc(x, y); return new mapboxgl.MercatorCoordinate(m.x, m.y, 0).toLngLat(); };
const MODEL = new THREE.Matrix4().makeTranslation(ORIGIN.x, ORIGIN.y, 0).scale(new THREE.Vector3(S, -S, S));

// ---------- the run: resampled every 2 m and lightly smoothed ----------
function resample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
    let d = step - carry;
    for (; d <= len; d += step) out.push([ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len]);
    carry = len - (d - step);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
let pts = resample(ROUTE.coords.map(toLocal), 2);
for (let pass = 0; pass < 3; pass++) {
  pts = pts.map((p, i) => {
    if (i < 2 || i > pts.length - 3) return p;
    let sx = 0, sy = 0;
    for (let k = -2; k <= 2; k++) { sx += pts[i + k][0]; sy += pts[i + k][1]; }
    return [sx / 5, sy / 5];
  });
}
const PATH = [];
{
  let acc = 0;
  pts.forEach((p, i) => { if (i) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); PATH.push({ x: p[0], y: p[1], s: acc }); });
}
const L = PATH[PATH.length - 1].s;
function sample(s) {
  s = clamp(s, 0, L);
  let lo = 0, hi = PATH.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (PATH[m].s <= s) lo = m; else hi = m; }
  const a = PATH[lo], b = PATH[hi], t = (s - a.s) / Math.max(1e-6, b.s - a.s);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
const CELL = 40, routeGrid = new Map();
PATH.forEach((p, i) => {
  const k = Math.floor(p.x / CELL) + ',' + Math.floor(p.y / CELL);
  if (!routeGrid.has(k)) routeGrid.set(k, []);
  routeGrid.get(k).push(i);
});
function nearestOnRoute(x, y) {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  let best = 1e12, along = 0;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
    const list = routeGrid.get(cx + i + ',' + (cy + j));
    if (list) for (const k of list) { const p = PATH[k], d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < best) { best = d; along = p.s; } }
  }
  return { d: Math.sqrt(best), along };
}

// ---------- shared uniforms ----------
const FOG = new THREE.Color('#141B28');
const U = {
  uHead: { value: 0 }, uPace: { value: 24 }, uTime: { value: 0 },
  uRefW: { value: 1 }, uPxM: { value: 2 }, uPR: { value: Math.min(2, devicePixelRatio || 1) }, uFog: { value: FOG },
};

const HASH = 'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }';

const buildingMat = new THREE.ShaderMaterial({
  uniforms: U,
  side: THREE.DoubleSide,
  vertexShader: `
    attribute vec3 aFace; attribute vec4 aInfo;
    varying vec3 vN; varying vec3 vFace; varying vec4 vInfo; varying float vW;
    void main(){
      vN = normal; vFace = aFace; vInfo = aInfo;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vW = gl_Position.w;
    }`,
  fragmentShader: `
    uniform float uHead, uPace, uTime, uRefW; uniform vec3 uFog;
    varying vec3 vN; varying vec3 vFace; varying vec4 vInfo; varying float vW;
    ${HASH}
    void main(){
      vec3 n = normalize(vN);
      float roof = vFace.z, v = vFace.y, seed = vInfo.z, strength = vInfo.y, top = vInfo.w;
      float since = (uHead - vInfo.x) / uPace;              // seconds since the runner reached this building
      float on = step(0.0, since) * strength;
      float lit = on * smoothstep(0.0, 1.4, since);
      float moon = max(dot(n, normalize(vec3(-0.45, 0.55, 0.72))), 0.0);

      vec3 slate = mix(vec3(0.13, 0.16, 0.22), vec3(0.19, 0.22, 0.29), hash(vec2(seed, 1.7)));
      if (roof > 0.5) slate *= 1.3;
      vec3 col = slate * (0.4 + 0.85 * moon);
      if (roof < 0.5) col *= mix(0.42, 1.0, smoothstep(0.0, 9.0, v));   // soft contact shadow at street level

      vec3 warmWall = mix(vec3(0.60, 0.29, 0.13), vec3(0.82, 0.48, 0.23), hash(vec2(seed, 4.2)));
      float street = roof > 0.5 ? 0.42 : mix(1.2, 0.58, smoothstep(0.0, 16.0, v));
      vec3 warm = roof > 0.5 ? vec3(0.34, 0.25, 0.21) * (0.8 + 0.4 * moon) : warmWall * street * (0.72 + 0.38 * moon);
      col = mix(col, warm, lit * (roof > 0.5 ? 0.75 : 0.92));
      col += vec3(1.0, 0.62, 0.3) * on * exp(-max(since, 0.0) * 2.4) * 0.4;   // ignition flash

      if (roof < 0.5 && vFace.x >= 0.0) {
        float g = (v - 0.5) / 3.3, fl = floor(g), fy = fract(g);
        if (fl >= 0.0 && v < top - 1.0) {
          float cx = floor(vFace.x), fx = fract(vFace.x);
          bool shop = fl < 0.5;
          vec2 hs = shop ? vec2(0.38, 0.36) : vec2(0.17, 0.27);
          vec2 c = vec2(fx - 0.5, fy - 0.48);
          vec2 aa = fwidth(vec2(vFace.x, g)) * 1.2;
          float win = (1.0 - smoothstep(hs.x - aa.x, hs.x + aa.x, abs(c.x))) * (1.0 - smoothstep(hs.y - aa.y, hs.y + aa.y, abs(c.y)));
          float h = hash(vec2(cx + seed * 97.0, fl + seed * 31.0));
          float order = (shop ? 0.0 : 0.25) + h * 1.8 + fl * 0.12;          // shops first, then window by window upwards
          float wOn = on * step(order, since) * step(h, 0.3 + 0.65 * strength);
          float age = since - order;
          float flick = age < 0.35 ? step(0.45, fract(age * 18.0 + h)) : 1.0;
          vec3 glow = shop ? vec3(1.0, 0.74, 0.40) : mix(vec3(1.0, 0.64, 0.28), vec3(1.0, 0.86, 0.56), hash(vec2(h, 9.1)));
          vec3 off = mix(vec3(0.07, 0.09, 0.13), vec3(0.30, 0.42, 0.58), step(0.975, h) * 0.8);
          col = mix(col, mix(off, glow * 1.75, wOn * flick), win * 0.95);
        }
      }
      col = mix(col, uFog, smoothstep(1.7, 5.5, vW / uRefW) * 0.85);
      gl_FragColor = vec4(col, 1.0);
    }`,
});

const ribbonVert = `
  attribute float aAlong; attribute float aAcross;
  varying float vAlong; varying float vAcross; varying float vW;
  void main(){ vAlong = aAlong; vAcross = aAcross; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }`;
const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };

const coreShader = {
  ...additive, uniforms: U, vertexShader: ribbonVert,
  fragmentShader: `
    uniform float uHead, uTime;
    varying float vAlong; varying float vAcross;
    void main(){
      float behind = uHead - vAlong, a = abs(vAcross);
      float edge = 1.0 - smoothstep(0.55, 1.0, a);
      if (behind < 0.0) {                                   // the way ahead: faint dashes
        float dash = step(0.55, fract(vAlong / 5.0)) * (1.0 - smoothstep(0.0, 300.0, -behind));
        gl_FragColor = vec4(vec3(0.35, 0.9, 0.8), edge * dash * 0.22 * XRAY);
        return;
      }
      float center = 1.0 - smoothstep(0.0, 0.5, a);
      float head = exp(-behind / 18.0);
      float pulse = pow(0.5 + 0.5 * sin((vAlong - uTime * 26.0) * 0.18), 6.0);
      vec3 c = mix(vec3(0.30, 0.95, 0.80), vec3(0.88, 1.0, 0.97), center * 0.8) * (0.85 + 0.5 * pulse + 1.6 * head);
      gl_FragColor = vec4(c, edge * XRAY);
    }`,
};
const coreMat = new THREE.ShaderMaterial({ ...coreShader, defines: { XRAY: '1.0' } });
// The same trail seen through buildings, faintly, so the route never disappears in narrow streets.
const xrayMat = new THREE.ShaderMaterial({ ...coreShader, defines: { XRAY: '0.28' }, depthFunc: THREE.GreaterDepth });
const auraMat = new THREE.ShaderMaterial({
  ...additive, uniforms: U, vertexShader: ribbonVert,
  fragmentShader: `
    uniform float uHead;
    varying float vAlong; varying float vAcross;
    void main(){
      float behind = uHead - vAlong; if (behind < 0.0) discard;
      float fall = pow(1.0 - abs(vAcross), 2.4);
      gl_FragColor = vec4(vec3(0.16, 0.85, 0.72), fall * (0.30 + 0.55 * exp(-behind / 30.0)));
    }`,
});
const warmMat = new THREE.ShaderMaterial({
  ...additive, uniforms: U, vertexShader: ribbonVert,
  fragmentShader: `
    uniform float uHead;
    varying float vAlong; varying float vAcross;
    void main(){
      float behind = uHead - vAlong; if (behind < 0.0) discard;
      float fall = pow(1.0 - abs(vAcross), 1.6);
      gl_FragColor = vec4(vec3(1.0, 0.55, 0.22), fall * smoothstep(4.0, 60.0, behind) * 0.2);
    }`,
});
const glintMat = new THREE.ShaderMaterial({
  ...additive, uniforms: U,
  vertexShader: `varying vec2 vP; varying float vW;
    void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }`,
  fragmentShader: `
    uniform float uTime, uRefW; varying vec2 vP; varying float vW;
    void main(){
      float n = sin(vP.x * 0.045 + uTime * 0.35 + sin(vP.y * 0.05 + uTime * 0.2) * 2.5) * sin(vP.y * 0.07 - uTime * 0.45 + sin(vP.x * 0.04) * 2.0);
      float glint = smoothstep(0.35, 1.0, n);
      gl_FragColor = vec4(vec3(0.45, 0.6, 0.82), glint * 0.11 * (1.0 - smoothstep(1.7, 5.0, vW / uRefW)));
    }`,
});
const sizeFromMetres = 'uPxM * uPR * uRefW / gl_Position.w';
const lampMat = new THREE.ShaderMaterial({
  ...additive, uniforms: U,
  vertexShader: `
    attribute float aAlong; attribute float aSeed;
    uniform float uHead, uPace, uRefW, uPxM, uPR;
    varying float vOn;
    void main(){
      float since = (uHead - aAlong) / uPace;
      vOn = step(0.0, since) * (since < 0.45 ? step(0.5, fract(since * 14.0 + aSeed)) : 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = 3.6 * ${sizeFromMetres};
    }`,
  fragmentShader: `
    varying float vOn;
    void main(){
      float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
      float core = 1.0 - smoothstep(0.0, 0.3, r), halo = pow(1.0 - r, 2.2);
      gl_FragColor = vec4(vec3(1.0, 0.78, 0.46) * (core * 1.7 + halo * 0.7), (core + halo * 0.6) * mix(0.06, 1.0, vOn));
    }`,
});
const poolMat = new THREE.ShaderMaterial({
  ...additive, uniforms: U,
  vertexShader: `
    attribute vec2 aUV; attribute float aAlong; uniform float uHead, uPace;
    varying vec2 vUV; varying float vOn;
    void main(){ vUV = aUV; vOn = smoothstep(0.0, 0.6, (uHead - aAlong) / uPace); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    varying vec2 vUV; varying float vOn;
    void main(){ float r = length(vUV); if (r > 1.0) discard; gl_FragColor = vec4(vec3(1.0, 0.66, 0.34), pow(1.0 - r, 2.0) * 0.32 * vOn); }`,
});
const sparkMat = new THREE.ShaderMaterial({
  ...additive, uniforms: U,
  vertexShader: `
    attribute vec3 aVel; attribute float aBirth;
    uniform float uTime, uRefW, uPxM, uPR;
    varying float vLife;
    void main(){
      float age = uTime - aBirth;
      vLife = clamp(1.0 - age / 1.7, 0.0, 1.0);
      vec3 p = position + aVel * age - vec3(0.0, 0.0, 0.7 * age * age);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = (0.6 + 1.1 * vLife) * ${sizeFromMetres};
    }`,
  fragmentShader: `
    varying float vLife;
    void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(vec3(0.6, 1.0, 0.92), pow(1.0 - r, 1.8) * vLife); }`,
});

const hazeMat = new THREE.ShaderMaterial({
  ...additive, uniforms: U,
  vertexShader: `
    attribute float aAlong; attribute float aStrength; attribute float aSize;
    uniform float uHead, uPace, uRefW, uPxM, uPR;
    varying float vOn;
    void main(){
      vOn = smoothstep(0.0, 2.5, (uHead - aAlong) / uPace) * aStrength;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = min(aSize * ${sizeFromMetres}, 420.0);
    }`,
  fragmentShader: `
    varying float vOn;
    void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0 || vOn < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.6, 0.28), pow(1.0 - r, 2.6) * 0.13 * vOn); }`,
});

// ---------- scene ----------
const scene = new THREE.Scene();
const camera = new THREE.Camera();
const groups = { water: new THREE.Group(), city: new THREE.Group() };
scene.add(groups.water, groups.city);

function ribbon(halfW, z, mat, order) {
  const n = PATH.length, pos = new Float32Array(n * 6), along = new Float32Array(n * 2), across = new Float32Array(n * 2), idx = [];
  PATH.forEach((p, i) => {
    const a = PATH[Math.max(0, i - 1)], b = PATH[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    pos.set([p.x + nx * halfW, p.y + ny * halfW, z, p.x - nx * halfW, p.y - ny * halfW, z], i * 6);
    along[i * 2] = along[i * 2 + 1] = p.s;
    across[i * 2] = -1; across[i * 2 + 1] = 1;
    if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  g.setAttribute('aAcross', new THREE.BufferAttribute(across, 1));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = order; m.frustumCulled = false;
  scene.add(m);
}
ribbon(16, 0.25, warmMat, 3);
ribbon(8, 0.3, auraMat, 4);
ribbon(1.5, 0.4, coreMat, 5);
ribbon(1.5, 0.4, xrayMat, 9);

// Street lamps every 26 m, alternating sides, each with a warm pool of light on the ground.
{
  const lampPos = [], lampAlong = [], lampSeed = [], poolPos = [], poolUV = [], poolAlong = [], poolIdx = [];
  for (let s = 12, k = 0; s < L; s += 26, k++) {
    const p = sample(s), q = sample(s + 2), len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const side = k % 2 ? 1 : -1, x = p.x - ((q.y - p.y) / len) * 4.2 * side, y = p.y + ((q.x - p.x) / len) * 4.2 * side;
    lampPos.push(x, y, 4.6); lampAlong.push(s); lampSeed.push(hash1(k));
    const base = poolPos.length / 3, R = 7.5;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v]) => { poolPos.push(x + u * R, y + v * R, 0.2); poolUV.push(u, v); poolAlong.push(s); });
    poolIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3));
  lg.setAttribute('aAlong', new THREE.Float32BufferAttribute(lampAlong, 1));
  lg.setAttribute('aSeed', new THREE.Float32BufferAttribute(lampSeed, 1));
  const lamps = new THREE.Points(lg, lampMat); lamps.renderOrder = 7; lamps.frustumCulled = false; scene.add(lamps);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(poolPos, 3));
  pg.setAttribute('aUV', new THREE.Float32BufferAttribute(poolUV, 2));
  pg.setAttribute('aAlong', new THREE.Float32BufferAttribute(poolAlong, 1));
  pg.setIndex(poolIdx);
  const pools = new THREE.Mesh(pg, poolMat); pools.renderOrder = 2; pools.frustumCulled = false; scene.add(pools);
}

// Sparks thrown up by the runner.
const SPARKS = 600;
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
sparkGeo.setAttribute('aVel', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
sparkGeo.setAttribute('aBirth', new THREE.BufferAttribute(new Float32Array(SPARKS).fill(-99), 1));
const sparks = new THREE.Points(sparkGeo, sparkMat); sparks.renderOrder = 8; sparks.frustumCulled = false; scene.add(sparks);
let sparkNext = 0, sparkDebt = 0;
function emitSparks(n, x, y, t) {
  const P = sparkGeo.attributes.position, V = sparkGeo.attributes.aVel, B = sparkGeo.attributes.aBirth;
  for (let i = 0; i < n; i++) {
    const k = sparkNext; sparkNext = (sparkNext + 1) % SPARKS;
    P.setXYZ(k, x + (Math.random() - 0.5) * 2.4, y + (Math.random() - 0.5) * 2.4, 0.6);
    V.setXYZ(k, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, 1.4 + Math.random() * 2.6);
    B.setX(k, t - Math.random() * 0.05);
  }
  P.needsUpdate = V.needsUpdate = B.needsUpdate = true;
}

// ---------- city from vector tiles ----------
const Z = 16, NT = 2 ** Z, MARGIN = 650;
const litById = new Map();
const haze = [];   // [x, y, z, litAlong, strength, sizeMetres] per lit building
let litSorted = [];

function ringArea(r) { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function clipRing(r, E) {
  let out = r;
  for (const [ax, v, sd] of [[0, 0, -1], [0, E, 1], [1, 0, -1], [1, E, 1]]) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length];
      const ina = (a[ax] - v) * sd <= 0, inb = (b[ax] - v) * sd <= 0;
      if (ina) out.push(a);
      if (ina !== inb) {
        const t = (v - a[ax]) / (b[ax] - a[ax]), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        p[ax] = v; out.push(p);
      }
    }
    if (!out.length) return out;
  }
  return out.filter((p, i) => { const q = out[(i + 1) % out.length]; return p[0] !== q[0] || p[1] !== q[1]; });
}
// Rings of one feature → polygons [outer, ...holes], clipped to the tile so neighbouring tiles meet exactly.
function polygons(f) {
  const E = f.extent, polys = [];
  let exteriorSign = 0;
  for (const ring of f.loadGeometry()) {
    const r = ring.map((p) => [p.x, p.y]);
    if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
    const a = ringArea(r);
    if (r.length < 3 || !a) continue;
    if (!exteriorSign) exteriorSign = Math.sign(a);
    const clipped = clipRing(r, E);
    if (Math.sign(a) === exteriorSign) polys.push(clipped.length >= 3 ? [clipped] : null);
    else if (polys.length && polys[polys.length - 1] && clipped.length >= 3) polys[polys.length - 1].push(clipped);
  }
  return polys.filter(Boolean);
}
const onTileEdge = (a, b, E) => (a[0] === b[0] && (a[0] === 0 || a[0] === E)) || (a[1] === b[1] && (a[1] === 0 || a[1] === E));

class Geo {
  constructor() { this.pos = []; this.nrm = []; this.face = []; this.info = []; this.idx = []; this.n = 0; }
  v(x, y, z, nx, ny, nz, u, vv, roof, info) {
    this.pos.push(x, y, z); this.nrm.push(nx, ny, nz); this.face.push(u, vv, roof); this.info.push(...info);
    return this.n++;
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('aFace', new THREE.Float32BufferAttribute(this.face, 3));
    g.setAttribute('aInfo', new THREE.Float32BufferAttribute(this.info, 4));
    g.setIndex(this.idx);
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    return m;
  }
}

function localRings(poly, E, toL) {
  return poly.map((r, i) => {
    let ring = r.map((t) => ({ t, l: toL(t[0], t[1], E) }));
    const a = ringArea(ring.map((q) => q.l));
    if ((i === 0 && a < 0) || (i > 0 && a > 0)) ring = ring.reverse();   // outer CCW, holes CW in local space
    return ring;
  });
}

function buildBuildings(layer, toL, tileKey) {
  const geo = new Geo();
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    if (f.type !== 3) continue;
    const p = f.properties;
    if (p.underground === 'true' || p.extrude === 'false') continue;
    for (const poly of polygons(f)) {
      const rings = localRings(poly, f.extent, toL), outer = rings[0];
      let cx = 0, cy = 0;
      outer.forEach((q) => { cx += q.l[0]; cy += q.l[1]; });
      cx /= outer.length; cy /= outer.length;
      const seed = hash1(f.id != null ? Number(f.id) % 100000 : cx * 0.37 + cy * 0.61);
      let h = Number(p.height) || 0;
      const base = Number(p.min_height) || 0;
      if (h < 4) h = 6 + seed * 8;

      let best = nearestOnRoute(cx, cy);
      for (const q of outer) { const r = nearestOnRoute(q.l[0], q.l[1]); if (r.d < best.d) best = r; }
      const strength = 1 - smooth(14, 72, best.d);
      const litAlong = strength > 0.02 ? Math.max(0, best.along - 12) : 1e7;
      const info = [litAlong, strength > 0.02 ? strength : 0, seed, h];
      if (strength > 0.3 && !params.has('lite')) {
        let r = 0;
        outer.forEach((q) => { r = Math.max(r, Math.hypot(q.l[0] - cx, q.l[1] - cy)); });
        haze.push(cx, cy, Math.min(h, 18) * 0.8, litAlong, strength, clamp(r * 2.6, 16, 46));
      }
      if (strength > 0.25) {
        const key = f.id != null ? 'id' + f.id : tileKey + ':' + i;
        litById.set(key, Math.min(litById.get(key) ?? 1e9, litAlong));
      }

      rings.forEach((ring) => {
        for (let k = 0; k < ring.length; k++) {
          const a = ring[k], b = ring[(k + 1) % ring.length];
          if (onTileEdge(a.t, b.t, f.extent)) continue;
          const dx = b.l[0] - a.l[0], dy = b.l[1] - a.l[1], len = Math.hypot(dx, dy);
          if (len < 0.3) continue;
          const nx = dy / len, ny = -dx / len;
          const cells = len >= 2.4 ? Math.max(1, Math.round(len / 3.1)) : 0;
          const u0 = cells ? (k * 7) % 997 : -1, u1 = cells ? u0 + cells : -1;
          const v0 = geo.v(a.l[0], a.l[1], base, nx, ny, 0, u0, base, 0, info);
          const v1 = geo.v(b.l[0], b.l[1], base, nx, ny, 0, u1, base, 0, info);
          const v2 = geo.v(b.l[0], b.l[1], h, nx, ny, 0, u1, h, 0, info);
          const v3 = geo.v(a.l[0], a.l[1], h, nx, ny, 0, u0, h, 0, info);
          geo.idx.push(v0, v1, v2, v0, v2, v3);
        }
      });
      const contour = outer.map((q) => new THREE.Vector2(q.l[0], q.l[1]));
      const holes = rings.slice(1).map((r) => r.map((q) => new THREE.Vector2(q.l[0], q.l[1])));
      const tris = THREE.ShapeUtils.triangulateShape(contour, holes);
      const start = geo.n;
      contour.concat(...holes).forEach((v) => geo.v(v.x, v.y, h, 0, 0, 1, -1, h, 1, info));
      tris.forEach((t) => geo.idx.push(start + t[0], start + t[1], start + t[2]));
    }
  }
  if (geo.n) { const m = geo.mesh(buildingMat); m.renderOrder = 1; groups.city.add(m); }
}

function buildWater(layer, toL) {
  const pos = [], idx = [];
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    if (f.type !== 3) continue;
    for (const poly of polygons(f)) {
      const rings = localRings(poly, f.extent, toL);
      const contour = rings[0].map((q) => new THREE.Vector2(q.l[0], q.l[1]));
      const holes = rings.slice(1).map((r) => r.map((q) => new THREE.Vector2(q.l[0], q.l[1])));
      const tris = THREE.ShapeUtils.triangulateShape(contour, holes), start = pos.length / 3;
      contour.concat(...holes).forEach((v) => pos.push(v.x, v.y, 0.1));
      tris.forEach((t) => idx.push(start + t[0], start + t[1], start + t[2]));
    }
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, glintMat); m.renderOrder = 0; m.frustumCulled = false;
  groups.water.add(m);
}

async function loadCity(onProgress) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  PATH.forEach((p) => { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); });
  const nw = toMerc(minx - MARGIN, maxy + MARGIN), se = toMerc(maxx + MARGIN, miny - MARGIN);
  const tiles = [];
  for (let tx = Math.floor(nw.x * NT); tx <= Math.floor(se.x * NT); tx++)
    for (let ty = Math.floor(nw.y * NT); ty <= Math.floor(se.y * NT); ty++) {
      const c = fromMerc((tx + 0.5) / NT, (ty + 0.5) / NT);
      tiles.push({ tx, ty, d: Math.hypot(c[0], c[1]) });
    }
  tiles.sort((a, b) => a.d - b.d);
  let done = 0;
  const work = async ({ tx, ty }) => {
    try {
      const res = await fetch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${Z}/${tx}/${ty}.vector.pbf?access_token=${TOKEN}`);
      if (res.ok) {
        const tile = new VectorTile(new Pbf(new Uint8Array(await res.arrayBuffer())));
        const toL = (px, py, E) => fromMerc((tx + px / E) / NT, (ty + py / E) / NT);
        if (tile.layers.water) buildWater(tile.layers.water, toL);
        if (tile.layers.building) buildBuildings(tile.layers.building, toL, tx + '/' + ty);
      }
    } catch (e) { console.warn('tile', tx, ty, e); }
    onProgress(++done, tiles.length);
  };
  const queue = tiles.slice();
  await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await work(queue.shift()); }));
  litSorted = [...litById.values()].sort((a, b) => a - b);
  if (haze.length) {
    const n = haze.length / 6, pos = new Float32Array(n * 3), along = new Float32Array(n), str = new Float32Array(n), size = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.set(haze.slice(i * 6, i * 6 + 3), i * 3); along[i] = haze[i * 6 + 3]; str[i] = haze[i * 6 + 4]; size[i] = haze[i * 6 + 5]; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
    g.setAttribute('aStrength', new THREE.BufferAttribute(str, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const pts = new THREE.Points(g, hazeMat); pts.renderOrder = 6; pts.frustumCulled = false; scene.add(pts);
  }
}

// ---------- map ----------
const style = {
  version: 8,
  sources: { streets: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' } },
  fog: { range: [1.2, 7], color: '#141B28', 'high-color': '#0E1522', 'horizon-blend': 0.12, 'space-color': '#0B111C', 'star-intensity': 0 },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#111723' } },
    { id: 'green', type: 'fill', source: 'streets', 'source-layer': 'landuse', filter: ['match', ['get', 'class'], ['park', 'grass', 'wood', 'scrub', 'cemetery', 'pitch'], true, false], paint: { 'fill-color': '#16231F' } },
    { id: 'water', type: 'fill', source: 'streets', 'source-layer': 'water', paint: { 'fill-color': '#1D2B42' } },
    { id: 'water-edge', type: 'line', source: 'streets', 'source-layer': 'water', paint: { 'line-color': '#3A4C68', 'line-width': 1.2, 'line-blur': 1 } },
    {
      id: 'roads', type: 'line', source: 'streets', 'source-layer': 'road',
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!', ['match', ['get', 'class'], ['major_rail', 'minor_rail', 'service_rail', 'ferry', 'aerialway', 'golf', 'construction'], true, false]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'class'], ['path', 'pedestrian', 'track'], '#19212E', '#212A39'],
        'line-width': ['interpolate', ['exponential', 1.7], ['zoom'],
          13, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 2.2, ['secondary', 'tertiary'], 1.6, 0.6],
          18, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 34, ['secondary', 'tertiary'], 26, ['street', 'street_limited', 'service'], 16, 7]],
      },
    },
    { id: 'footprints', type: 'fill', source: 'streets', 'source-layer': 'building', paint: { 'fill-color': '#151C28' } },
  ],
};

const narrow = innerWidth < 700;
const CHASE = { zoom: narrow ? 16.9 : 17.15, pitch: 54, skew: -30 };
const PADDING = { top: 0, left: 0, right: 0, bottom: narrow ? 240 : 140 };
const map = new mapboxgl.Map({
  container: 'map', style, center: CENTER, zoom: narrow ? 15.2 : 15.7, pitch: 58, bearing: -30,
  projection: 'mercator', antialias: !params.has('lite'), maxPitch: 75, fadeDuration: 0,
});
let renderer = null;
map.on('load', () => {
  map.addLayer({
    id: 'medirun-glow', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) { renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true }); renderer.autoClear = false; },
    render(gl, matrix) {
      const P = camera.projectionMatrix.fromArray(matrix).multiply(MODEL);
      camera.projectionMatrixInverse.copy(P).invert();
      const e = P.elements, f = state.focus;
      U.uRefW.value = Math.max(1e-6, e[3] * f.x + e[7] * f.y + e[15]);
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },
  });
});

// ---------- runner (DOM, always on top, glows) ----------
const runnerEl = document.createElement('div');
runnerEl.className = 'runner';
const cv = document.createElement('canvas');
cv.width = cv.height = 112;
runnerEl.appendChild(cv);
const rctx = cv.getContext('2d');
const start = sample(0);
const runner = new mapboxgl.Marker({ element: runnerEl, anchor: 'bottom' }).setLngLat(toLngLat(start.x, start.y)).addTo(map);
function drawRunner(ph, face, moving, won) {
  const c = rctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 112, 112);
  c.translate(56, 58); c.scale(face, 1);
  const sw = moving ? 1 : 0.12, lean = moving ? 0.24 : 0.06;
  const seg = (p, ang, len) => [p[0] + Math.sin(ang) * len, p[1] + Math.cos(ang) * len];
  const hip = [0, 6], neck = [Math.sin(lean) * 22, 6 - Math.cos(lean) * 22], head = [neck[0] + Math.sin(lean) * 9.5, neck[1] - Math.cos(lean) * 9.5];
  const lines = [[hip, neck]];
  for (const k of [0, 1]) {
    const s = Math.sin(ph + k * Math.PI), thigh = 0.78 * s * sw;
    const knee = seg(hip, thigh, 15), bend = (0.25 + 1.15 * Math.max(0, -Math.cos(ph + k * Math.PI))) * sw + 0.08;
    lines.push([hip, knee, seg(knee, thigh - bend, 15)]);
    if (won) {                                            // finish: both arms up in a V
      const up = Math.PI - (k ? 0.55 : -0.55), elbow = seg(neck, up, 11);
      lines.push([neck, elbow, seg(elbow, up, 10)]);
      continue;
    }
    const arm = -0.95 * s * sw, elbow = seg(neck, arm, 11);
    lines.push([neck, elbow, seg(elbow, arm + 1.55 * sw + 0.25, 10)]);
  }
  const stroke = (w, col, blur) => {
    c.lineWidth = w; c.strokeStyle = col; c.fillStyle = col; c.shadowColor = '#2DD4BF'; c.shadowBlur = blur; c.lineCap = c.lineJoin = 'round';
    for (const l of lines) { c.beginPath(); c.moveTo(...l[0]); for (let i = 1; i < l.length; i++) c.lineTo(...l[i]); c.stroke(); }
    c.beginPath(); c.arc(head[0], head[1], 6.5, 0, Math.PI * 2); c.fill();
  };
  stroke(10, 'rgba(45,212,191,.5)', 20);
  stroke(5, '#99F6E4', 8);
  stroke(2.2, '#F0FDFA', 0);
}

// ---------- loop ----------
const SPEEDS = [2, 6, 12];
const state = {
  head: 0, running: false, finished: false, pace: 4, mul: Number(params.get('speed')) || 6,
  mode: 'orbit', manual: false, phase: 0, face: 1, focus: { x: 0, y: 0 }, 
};
$('speed').textContent = '×' + state.mul;
window.glow = { state, map, L };   // debug handle for previews

function setPlayLabel() {
  $('play').textContent = state.running ? '❚❚ პაუზა' : state.finished ? '↻ ხელახლა' : state.head > 0 ? '▶ გაგრძელება' : '▶ სირბილი';
}
function play() {
  if (state.finished) restart();
  state.running = !state.running;
  if (state.running) { state.mode = 'chase'; state.manual = false; $('cam').setAttribute('aria-pressed', 'true'); $('cam').textContent = 'მიყოლა'; }
  setPlayLabel();
}
function restart() { state.head = 0; state.finished = false; state.running = true; state.mode = 'chase'; state.manual = false; setPlayLabel(); }
$('play').onclick = play;
$('restart').onclick = restart;
$('speed').onclick = () => { state.mul = SPEEDS[(SPEEDS.indexOf(state.mul) + 1) % SPEEDS.length]; $('speed').textContent = '×' + state.mul; };
$('cam').onclick = () => {
  state.manual = false;
  state.mode = state.mode === 'chase' ? 'orbit' : 'chase';
  $('cam').setAttribute('aria-pressed', String(state.mode === 'chase'));
  $('cam').textContent = state.mode === 'chase' ? 'მიყოლა' : 'ზემოდან';
};
$('tilt').onclick = () => { const flat = document.body.classList.toggle('flat'); $('tilt').setAttribute('aria-pressed', String(!flat)); };
['dragstart', 'rotatestart', 'pitchstart', 'zoomstart'].forEach((ev) => map.on(ev, (e) => { if (e.originalEvent) state.manual = true; }));

let overviewZoom = narrow ? 15.2 : 15.7;
map.once('load', () => {
  const sw = toLngLat(Math.min(...PATH.map((p) => p.x)), Math.min(...PATH.map((p) => p.y)));
  const ne = toLngLat(Math.max(...PATH.map((p) => p.x)), Math.max(...PATH.map((p) => p.y)));
  const cam = map.cameraForBounds(new mapboxgl.LngLatBounds(sw, ne), { padding: narrow ? 30 : 90, pitch: 55 });
  if (cam && cam.zoom) overviewZoom = cam.zoom + (narrow ? 0.45 : 0);
});

let last = performance.now(), frames = 0, fpsAt = last;
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  U.uTime.value += dt;
  const speed = state.pace * state.mul;
  if (state.running) {
    state.head = Math.min(L, state.head + speed * dt);
    if (state.head >= L) { state.running = false; state.finished = true; state.mode = 'orbit'; setPlayLabel(); }
  }
  U.uHead.value = state.finished ? L + 5000 : state.head;
  U.uPace.value = speed;

  const at = sample(state.head), ahead = sample(state.head + 30);
  state.focus = state.mode === 'chase' ? at : { x: 0, y: 0 };
  const ll = toLngLat(at.x, at.y);
  runner.setLngLat(ll);
  if (state.running) {
    state.phase += dt * Math.PI * 2 * 2.9;
    sparkDebt += dt * 110;
    const n = Math.floor(sparkDebt); sparkDebt -= n;
    if (n) emitSparks(n, at.x, at.y, U.uTime.value);
  }
  const p0 = map.project(ll), p1 = map.project(toLngLat(ahead.x, ahead.y));
  if (Math.abs(p1.x - p0.x) > 4) state.face = p1.x >= p0.x ? 1 : -1;
  drawRunner(state.phase, state.face, state.running, state.finished);
  const p2 = map.project(toLngLat(at.x + 1, at.y));
  U.uPxM.value = Math.max(0.2, Math.hypot(p2.x - p0.x, p2.y - p0.y));

  if (!state.manual) {
    const cur = map.getCenter(), c = toLocal([cur.lng, cur.lat]);
    let target, zoom, pitch, bearing;
    if (state.mode === 'chase') {
      const heading = (Math.atan2(ahead.x - at.x, ahead.y - at.y) * 180) / Math.PI;
      target = [at.x, at.y]; zoom = CHASE.zoom; pitch = CHASE.pitch; bearing = heading + CHASE.skew;
    } else {
      target = [0, 0]; zoom = overviewZoom; pitch = 55; bearing = map.getBearing() + dt * 4;
    }
    const k = 1 - Math.exp(-dt * 2.4), kb = 1 - Math.exp(-dt * 1.3);
    map.jumpTo({
      center: toLngLat(c[0] + (target[0] - c[0]) * k, c[1] + (target[1] - c[1]) * k),
      zoom: map.getZoom() + (zoom - map.getZoom()) * k,
      pitch: map.getPitch() + (pitch - map.getPitch()) * k,
      bearing: lerpAngle(map.getBearing(), bearing, state.mode === 'chase' ? kb : 1),
      padding: PADDING,
    });
  }

  $('km').textContent = (state.head / 1000).toFixed(2);
  let lo = 0, hi = litSorted.length;
  const h = U.uHead.value;
  while (lo < hi) { const m = (lo + hi) >> 1; if (litSorted[m] <= h) lo = m + 1; else hi = m; }
  if ($('lit').textContent !== String(lo)) { $('lit').textContent = lo; $('lit').parentElement.classList.remove('pop'); void $('lit').offsetWidth; $('lit').parentElement.classList.add('pop'); }

  frames++;
  if (now - fpsAt > 1000) { $('fps').textContent = Math.round((frames * 1000) / (now - fpsAt)) + ' fps'; frames = 0; fpsAt = now; }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

await loadCity((done, total) => { $('loading').textContent = `ქალაქი იტვირთება… ${done}/${total}`; });
$('loading').classList.add('done');
if (params.has('auto')) play();
setPlayLabel();
