// MEDIRUN Glow engine — a dark miniature city that lights up around the runner.
// Shared by the prototype (brand/medirun/glow) and the app's map WebView (mobile/src/lib/run/mapHtml.ts),
// which loads the bundle from https://medicard.ge/medirun/glow/engine.js (node build.mjs).
// Mapbox GL draws the ground from glowStyle(); this module adds one three.js custom layer in the same
// WebGL context: buildings and trees from Mapbox streets-v8 z16 tiles streamed around the camera, the
// current trail, street lamps, sparks and the rigged runner. Lighting is time based: a building lights
// when a trail point (or an earlier walk) passes within LIGHT_R, delayed by distance / WAVE.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

const Z = 16, NT = 2 ** Z;
const MIN_RADIUS = 650, MAX_RADIUS = 1600, MAX_TILES = 72;
const LIGHT_R = 72, WAVE = 26, CELL = 50;
const NEVER = 1e7, ALWAYS = -1e4;
const MAX_LAMPS = 1500;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash1 = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const lerpRad = (a, b, t) => a + ((((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * t;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** The ground: night streets, water, parks and flat footprints under the 3D city. */
export function glowStyle() {
  return {
    version: 8,
    glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    sources: { streets: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' } },
    fog: { range: [1.2, 7], color: '#121926', 'high-color': '#0D1421', 'horizon-blend': 0.12, 'space-color': '#0B111C', 'star-intensity': 0 },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#111723' } },
      { id: 'green', type: 'fill', source: 'streets', 'source-layer': 'landuse', filter: ['match', ['get', 'class'], ['park', 'grass', 'wood', 'scrub', 'cemetery', 'pitch'], true, false], paint: { 'fill-color': '#15211D' } },
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
}

// ---------- shaders ----------
const HASH = 'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }';
const FOGFN = 'uniform float uRefW; uniform vec3 uFog; vec3 fogged(vec3 c, float w){ return mix(c, uFog, smoothstep(1.7, 5.5, w / uRefW) * 0.85); }';
const MOON = 'normalize(vec3(-0.45, 0.55, 0.72))';
const sizeFromMetres = 'uPxM * uPR * uRefW / gl_Position.w';
const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };

function materials(U) {
  const building = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 aFace; attribute vec2 aLit; attribute vec2 aBld;
      varying vec3 vN; varying vec3 vFace; varying vec2 vLit; varying vec2 vBld; varying float vW; varying vec3 vPos;
      void main(){
        vN = normal; vFace = aFace; vLit = aLit; vBld = aBld; vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vW = gl_Position.w;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uRunner; uniform float uCut;
      ${FOGFN}
      varying vec3 vN; varying vec3 vFace; varying vec2 vLit; varying vec2 vBld; varying float vW; varying vec3 vPos;
      ${HASH}
      void main(){
        // See-through: walls between the camera and the runner open up around it; the hole is filled with faint glass.
        float cutFade = 0.0;
        if (uCut > 0.0) {
          vec3 seg = uRunner - cameraPosition;
          float t = clamp(dot(vPos - cameraPosition, seg) / dot(seg, seg), 0.0, 1.0);
          float d = length(vPos - (cameraPosition + seg * t)), r = uCut * t;
          cutFade = (1.0 - smoothstep(r * 0.8, r, d)) * (1.0 - smoothstep(0.97, 0.995, t));
        }
        #ifdef GHOST
          if (cutFade < 0.02) discard;      // the glass pass only draws what the opaque pass cut away
        #else
          if (cutFade > 0.5) discard;       // a clean hole where a wall would hide the runner
        #endif
        vec3 n = normalize(vN);
        float roof = vFace.z, v = vFace.y, seed = vBld.x, top = vBld.y, strength = vLit.y;
        float since = uTime - vLit.x;
        float on = step(0.0, since) * strength;
        float lit = on * smoothstep(0.0, 1.4, since);
        float moon = max(dot(n, ${MOON}), 0.0);

        vec3 slate = mix(vec3(0.13, 0.16, 0.22), vec3(0.19, 0.22, 0.29), hash(vec2(seed, 1.7)));
        if (roof > 0.5) slate *= 1.3;
        vec3 col = slate * (0.4 + 0.85 * moon);
        float g = (v - 0.5) / 3.3, fl = floor(g), fy = fract(g);
        if (roof < 0.5) {
          col *= mix(0.42, 1.0, smoothstep(0.0, 9.0, v));
          if (fl >= 1.0 && v < top - 0.6) col *= 1.0 - (1.0 - smoothstep(0.0, 0.05, fy)) * 0.22 * (1.0 - smoothstep(0.1, 0.3, fwidth(g)));
        }
        vec3 warmWall = mix(vec3(0.60, 0.29, 0.13), vec3(0.84, 0.50, 0.25), hash(vec2(seed, 4.2)));
        float street = mix(1.25, 0.55, smoothstep(0.0, 16.0, v));
        vec3 warm = roof > 0.5 ? vec3(0.34, 0.25, 0.21) * (0.8 + 0.4 * moon) : warmWall * street * (0.72 + 0.38 * moon);
        col = mix(col, warm, lit * (roof > 0.5 ? 0.75 : 0.92));
        col += vec3(1.0, 0.62, 0.3) * on * exp(-max(since, 0.0) * 2.4) * 0.45;

        if (roof < 0.5 && vFace.x >= 0.0 && fl >= 0.0 && v < top - 1.0) {
          float cx = floor(vFace.x), fx = fract(vFace.x);
          bool shop = fl < 0.5;
          vec2 hs = shop ? vec2(0.38, 0.36) : vec2(0.17, 0.27);
          vec2 c = vec2(fx - 0.5, fy - 0.48);
          vec2 aa = fwidth(vec2(vFace.x, g)) * 1.2;
          float lod = 1.0 - smoothstep(0.12, 0.35, max(aa.x, aa.y));
          float win = (1.0 - smoothstep(hs.x - aa.x, hs.x + aa.x, abs(c.x))) * (1.0 - smoothstep(hs.y - aa.y, hs.y + aa.y, abs(c.y))) * lod;
          float h = hash(vec2(cx + seed * 97.0, fl + seed * 31.0));
          float order = (shop ? 0.0 : 0.25) + h * 1.8 + fl * 0.12;
          float wOn = on * step(order, since) * step(h, 0.3 + 0.65 * strength);
          float age = since - order;
          float flick = age < 0.35 ? step(0.45, fract(age * 18.0 + h)) : 1.0;
          float level = 0.75 + 0.5 * hash(vec2(h, 3.3));
          vec3 glow = (shop ? vec3(1.0, 0.74, 0.40) : mix(vec3(1.0, 0.62, 0.27), vec3(1.0, 0.86, 0.56), hash(vec2(h, 9.1)))) * level;
          float mull = shop ? 1.0 : 1.0 - (1.0 - smoothstep(0.01, 0.03, abs(c.x))) * 0.55;
          vec3 off = mix(vec3(0.07, 0.09, 0.13), vec3(0.30, 0.42, 0.58), step(0.975, h) * 0.8);
          float light = wOn * flick;
          col = mix(col, mix(off, glow * 1.8 * mull, light), win * 0.95);
          vec2 outside = max(abs(c) - hs, 0.0) * vec2(3.1, 3.3);
          col += glow * exp(-length(outside) * (shop ? 1.3 : 1.8)) * (1.0 - win) * light * 0.38 * lod;
          col += glow * light * (1.0 - lod) * 0.35;
        }
        #ifdef GHOST
          gl_FragColor = vec4(fogged(col, vW) * 1.15, 0.2 * cutFade);
        #else
          gl_FragColor = vec4(fogged(col, vW), 1.0);
        #endif
      }`,
  });
  const buildingGhost = new THREE.ShaderMaterial({ uniforms: U, vertexShader: building.vertexShader, fragmentShader: building.fragmentShader, defines: { GHOST: 1 }, side: THREE.DoubleSide, transparent: true, depthWrite: false });

  const ribbonVert = `
    attribute float aAlong; attribute float aAcross;
    varying float vAlong; varying float vAcross; varying float vW;
    void main(){ vAlong = aAlong; vAcross = aAcross; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }`;
  const coreShader = {
    ...additive, uniforms: U, vertexShader: ribbonVert,
    fragmentShader: `
      uniform float uHead, uTime;
      varying float vAlong; varying float vAcross;
      void main(){
        float behind = uHead - vAlong, a = abs(vAcross);
        if (behind < 0.0) discard;
        float edge = 1.0 - smoothstep(0.55, 1.0, a);
        float center = 1.0 - smoothstep(0.0, 0.5, a);
        float head = exp(-behind / 18.0);
        float pulse = pow(0.5 + 0.5 * sin((vAlong - uTime * 26.0) * 0.18), 6.0);
        vec3 c = mix(vec3(0.30, 0.95, 0.80), vec3(0.90, 1.0, 0.97), center * 0.85) * (0.9 + 0.55 * pulse + 1.7 * head);
        gl_FragColor = vec4(c, edge * XRAY);
      }`,
  };
  return {
    building, buildingGhost,
    core: new THREE.ShaderMaterial({ ...coreShader, defines: { XRAY: '1.0' } }),
    xray: new THREE.ShaderMaterial({ ...coreShader, defines: { XRAY: '0.28' }, depthFunc: THREE.GreaterDepth }),
    aura: new THREE.ShaderMaterial({
      ...additive, uniforms: U, vertexShader: ribbonVert,
      fragmentShader: `
        uniform float uHead; varying float vAlong; varying float vAcross;
        void main(){ float behind = uHead - vAlong; if (behind < 0.0) discard;
          gl_FragColor = vec4(vec3(0.16, 0.85, 0.72), pow(1.0 - abs(vAcross), 2.4) * (0.30 + 0.6 * exp(-behind / 30.0))); }`,
    }),
    warm: new THREE.ShaderMaterial({
      ...additive, uniforms: U, vertexShader: ribbonVert,
      fragmentShader: `
        uniform float uHead; varying float vAlong; varying float vAcross;
        void main(){ float behind = uHead - vAlong; if (behind < 0.0) discard;
          gl_FragColor = vec4(vec3(1.0, 0.55, 0.22), pow(1.0 - abs(vAcross), 1.6) * smoothstep(4.0, 60.0, behind) * 0.2); }`,
    }),
    curtain: new THREE.ShaderMaterial({
      ...additive, uniforms: U,
      vertexShader: `attribute float aAlong; attribute float aH; varying float vAlong; varying float vH;
        void main(){ vAlong = aAlong; vH = aH; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uHead, uTime; varying float vAlong; varying float vH;
        void main(){ float behind = uHead - vAlong; if (behind < 0.0) discard;
          float shimmer = 0.75 + 0.25 * sin(vAlong * 0.9 - uTime * 7.0);
          gl_FragColor = vec4(vec3(0.25, 0.95, 0.8), pow(1.0 - vH, 2.2) * (0.10 + 0.55 * exp(-behind / 22.0)) * shimmer); }`,
    }),
    glint: new THREE.ShaderMaterial({
      ...additive, uniforms: U,
      vertexShader: 'varying vec2 vP; varying float vW; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }',
      fragmentShader: `
        uniform float uTime, uRefW; varying vec2 vP; varying float vW;
        void main(){
          float n = sin(vP.x * 0.045 + uTime * 0.35 + sin(vP.y * 0.05 + uTime * 0.2) * 2.5) * sin(vP.y * 0.07 - uTime * 0.45 + sin(vP.x * 0.04) * 2.0);
          gl_FragColor = vec4(vec3(0.45, 0.6, 0.82), smoothstep(0.35, 1.0, n) * 0.11 * (1.0 - smoothstep(1.7, 5.0, vW / uRefW)));
        }`,
    }),
    lamp: new THREE.ShaderMaterial({
      ...additive, uniforms: U,
      vertexShader: `
        attribute float aT; attribute float aSeed; uniform float uTime, uRefW, uPxM, uPR; varying float vOn;
        void main(){
          float since = uTime - aT;
          vOn = step(0.0, since) * (since < 0.45 ? step(0.5, fract(since * 14.0 + aSeed)) : 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 2.6 * ${sizeFromMetres};
        }`,
      fragmentShader: `
        varying float vOn;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
          float core = 1.0 - smoothstep(0.0, 0.3, r), halo = pow(1.0 - r, 2.2);
          gl_FragColor = vec4(vec3(1.0, 0.8, 0.5) * (core * 1.7 + halo * 0.7), (core + halo * 0.6) * mix(0.05, 1.0, vOn)); }`,
    }),
    pole: new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: 'varying vec3 vN; varying float vW; void main(){ vN = mat3(instanceMatrix) * normal; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); vW = gl_Position.w; }',
      fragmentShader: `${FOGFN} varying vec3 vN; varying float vW;
        void main(){ float m = max(dot(normalize(vN), ${MOON}), 0.0); gl_FragColor = vec4(fogged(vec3(0.09, 0.11, 0.15) * (0.6 + 0.8 * m), vW), 1.0); }`,
    }),
    // Ground pools: under lamps and in front of lit buildings. Unlit quads collapse to nothing.
    pool: new THREE.ShaderMaterial({
      ...additive, uniforms: U,
      vertexShader: `
        attribute vec2 aUV; attribute vec2 aLit; attribute vec3 aC; uniform float uTime;
        varying vec2 vUV; varying float vOn;
        void main(){
          vUV = aUV; vOn = smoothstep(0.0, 0.8, uTime - aLit.x) * aLit.y;
          vec3 p = mix(aC, position, step(0.003, vOn));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `varying vec2 vUV; varying float vOn;
        void main(){ float r = length(vUV); if (r > 1.0) discard; gl_FragColor = vec4(vec3(1.0, 0.64, 0.32), pow(1.0 - r, 2.0) * vOn); }`,
    }),
    haze: new THREE.ShaderMaterial({
      ...additive, uniforms: U,
      vertexShader: `
        attribute vec2 aLit; attribute float aSize; uniform float uTime, uRefW, uPxM, uPR; varying float vOn;
        void main(){
          vOn = smoothstep(0.0, 2.5, uTime - aLit.x) * aLit.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = vOn < 0.01 ? 0.0 : min(aSize * ${sizeFromMetres}, 420.0);
        }`,
      fragmentShader: `varying float vOn;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(vec3(1.0, 0.6, 0.28), pow(1.0 - r, 2.6) * 0.12 * vOn); }`,
    }),
    spark: new THREE.ShaderMaterial({
      ...additive, uniforms: U,
      vertexShader: `
        attribute vec3 aVel; attribute float aBirth; uniform float uTime, uRefW, uPxM, uPR; varying float vLife;
        void main(){
          float age = uTime - aBirth;
          vLife = clamp(1.0 - age / 1.7, 0.0, 1.0);
          vec3 p = position + aVel * age - vec3(0.0, 0.0, 0.7 * age * age);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = vLife <= 0.0 ? 0.0 : (0.35 + 0.7 * vLife) * ${sizeFromMetres};
        }`,
      fragmentShader: `varying float vLife;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(vec3(0.6, 1.0, 0.92), pow(1.0 - r, 1.8) * vLife); }`,
    }),
    tree: new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: `
        attribute vec3 iLit; attribute float iSeed;
        varying vec3 vN; varying float vZ; varying vec3 vLit; varying float vSeed; varying float vW;
        void main(){
          vec4 wp = instanceMatrix * vec4(position, 1.0);
          vN = normalize(mat3(instanceMatrix) * normal); vZ = position.z; vLit = iLit; vSeed = iSeed;
          gl_Position = projectionMatrix * modelViewMatrix * wp; vW = gl_Position.w;
        }`,
      fragmentShader: `
        uniform float uTime;
        ${FOGFN}
        ${HASH}
        varying vec3 vN; varying float vZ; varying vec3 vLit; varying float vSeed; varying float vW;
        void main(){
          vec3 n = normalize(vN);
          float since = uTime - vLit.x;
          float lit = step(0.0, since) * vLit.y * smoothstep(0.0, 1.5, since);
          float moon = max(dot(n, ${MOON}), 0.0);
          bool canopy = vZ > 2.6;
          vec3 base = canopy ? mix(vec3(0.07, 0.13, 0.12), vec3(0.11, 0.18, 0.14), hash(vec2(vSeed, 2.0))) : vec3(0.11, 0.09, 0.08);
          vec3 col = base * (0.5 + 0.9 * moon);
          float under = clamp(0.5 - n.z * 0.5, 0.0, 1.0);
          col += lit * (vec3(0.95, 0.52, 0.22) * 0.32 * (0.4 + under) + vec3(0.2, 0.9, 0.75) * 0.3 * exp(-vLit.z / 9.0));
          gl_FragColor = vec4(fogged(col, vW), 1.0);
        }`,
    }),
    ring: new THREE.ShaderMaterial({
      ...additive, uniforms: U,
      vertexShader: 'varying vec2 vUV; void main(){ vUV = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float uTime, uRun; varying vec2 vUV;
        void main(){
          float r = length(vUV); if (r > 1.0) discard;
          float a = 0.0;
          for (int k = 0; k < 2; k++) {
            float t = fract(uTime / 1.3 - float(k) * 0.16);
            a += exp(-pow((r - t) * 22.0, 2.0)) * (1.0 - t) * (k == 0 ? 1.0 : 0.6);
          }
          gl_FragColor = vec4(vec3(0.3, 0.98, 0.84), a * 0.55 * uRun + pow(1.0 - r, 6.0) * 0.6);
        }`,
    }),
  };
}

// ---------- vector tile geometry ----------
function ringArea(r) { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
function clipRing(r, E) {
  let out = r;
  for (const [ax, v, sd] of [[0, 0, -1], [0, E, 1], [1, 0, -1], [1, E, 1]]) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length];
      const ina = (a[ax] - v) * sd <= 0, inb = (b[ax] - v) * sd <= 0;
      if (ina) out.push(a);
      if (ina !== inb) { const t = (v - a[ax]) / (b[ax] - a[ax]), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; p[ax] = v; out.push(p); }
    }
    if (!out.length) return out;
  }
  return out.filter((p, i) => { const q = out[(i + 1) % out.length]; return p[0] !== q[0] || p[1] !== q[1]; });
}
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
function localRings(poly, E, toL) {
  return poly.map((r, i) => {
    let ring = r.map((t) => ({ t, l: toL(t[0], t[1], E) }));
    const a = ringArea(ring.map((q) => q.l));
    if ((i === 0 && a < 0) || (i > 0 && a > 0)) ring = ring.reverse();
    return ring;
  });
}
function triangulate(rings) {
  const contour = rings[0].map((q) => new THREE.Vector2(q.l[0], q.l[1]));
  const holes = rings.slice(1).map((r) => r.map((q) => new THREE.Vector2(q.l[0], q.l[1])));
  const tris = THREE.ShapeUtils.triangulateShape(contour, holes);
  return { verts: contour.concat(...holes), tris };
}
const TREE = (() => {
  const canopy = new THREE.IcosahedronGeometry(1, 1).scale(2.3, 2.3, 2.6).translate(0, 0, 4.3);
  const trunk = new THREE.CylinderGeometry(0.16, 0.24, 3.2, 6).rotateX(Math.PI / 2).translate(0, 0, 1.6).toNonIndexed();
  return mergeGeometries([canopy, trunk]);
})();
const TREE_CLASSES = { park: 110, wood: 70, scrub: 140, cemetery: 120, grass: 420 };

/**
 * createGlow({ mapboxgl, map, token, assetBase, hero, onLit, lite }) — call after the map's 'load'.
 * Returns { setTrail, setPaint, setRunner, setActivity, setHero, setRunnerVisible, runner(), litCount(), dispose }.
 */
export function createGlow({ mapboxgl, map, token, assetBase = '', hero = 'm', onLit, lite = false }) {
  const start = map.getCenter();
  const ORIGIN = mapboxgl.MercatorCoordinate.fromLngLat([start.lng, start.lat], 0);
  const S = ORIGIN.meterInMercatorCoordinateUnits();
  const fromMerc = (mx, my) => [(mx - ORIGIN.x) / S, -(my - ORIGIN.y) / S];
  const toLocal = (lng, lat) => { const m = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0); return fromMerc(m.x, m.y); };
  const toMerc = (x, y) => ({ x: ORIGIN.x + x * S, y: ORIGIN.y - y * S });
  const toLngLat = (x, y) => { const m = toMerc(x, y); return new mapboxgl.MercatorCoordinate(m.x, m.y, 0).toLngLat(); };
  const MODEL = new THREE.Matrix4().makeTranslation(ORIGIN.x, ORIGIN.y, 0).scale(new THREE.Vector3(S, -S, S));

  const U = {
    uTime: { value: 0 }, uHead: { value: 0 }, uRunner: { value: new THREE.Vector3() }, uCut: { value: 0 }, uRefW: { value: 1 }, uPxM: { value: 2 },
    uPR: { value: Math.min(2, window.devicePixelRatio || 1) }, uFog: { value: new THREE.Color('#121926') }, uRun: { value: 0 },
  };
  const M = materials(U);
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  scene.add(new THREE.HemisphereLight(0x9fb6e0, 0x3a2717, 1.6));
  const moonLight = new THREE.DirectionalLight(0xc9dcff, 1.8); moonLight.position.set(-45, 55, 72); scene.add(moonLight);
  const warmLight = new THREE.PointLight(0xffa860, 0, 60, 1.2); scene.add(warmLight);
  // A soft light from the camera's side so the runner's face and outfit read clearly (stronger in the close-up).
  const faceLight = new THREE.DirectionalLight(0xe6f2ff, 0.5); scene.add(faceLight);
  let heroView = false;
  const now = () => U.uTime.value;

  // ---------- spatial index of lightable things (buildings, trees) and of walked points ----------
  const grid = new Map();             // cell → records
  const walkedTrail = new Map(), walkedPaint = new Map();   // cell → [x, y, ...] of this session / earlier walks
  const cellKey = (x, y) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL);
  const litKeys = new Set();          // buildings lit by this session's trail (the pill count)
  function addRecord(rec) { const k = cellKey(rec.cx, rec.cy); rec.cell = k; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(rec); }
  function recDist(rec, x, y) {
    let d = Math.hypot(rec.cx - x, rec.cy - y);
    const p = rec.pts;
    if (p) for (let i = 0; i < p.length; i += 2) d = Math.min(d, Math.hypot(p[i] - x, p[i + 1] - y));
    return d;
  }
  function writeLit(rec) {
    for (const r of rec.ranges) {
      const a = r.attr.array, n = r.attr.itemSize;
      for (let i = r.start; i < r.start + r.count; i++) { a[i * n] = rec.time; a[i * n + 1] = rec.strength; if (n > 2) a[i * n + 2] = rec.dist; }
      r.attr.addUpdateRange(r.start * n, r.count * n);
      r.attr.needsUpdate = true;
    }
  }
  function light(rec, time, d, fromTrail) {
    const strength = 1 - smooth(rec.tree ? 10 : 14, rec.tree ? 60 : LIGHT_R, d);
    if (fromTrail && rec.key && strength > 0.25 && !litKeys.has(rec.key)) { litKeys.add(rec.key); litDirty = true; }
    if (strength <= 0.02 || strength <= rec.strength + 0.08) return;
    if (rec.strength <= 0) rec.time = time;
    rec.strength = strength; rec.dist = Math.min(rec.dist ?? 1e9, d);
    writeLit(rec);
  }
  function lightAround(x, y, time, fromTrail, instant) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), span = Math.ceil(LIGHT_R / CELL);
    for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) {
      const list = grid.get(cx + i + ',' + (cy + j));
      if (!list) continue;
      for (const rec of list) { const d = recDist(rec, x, y); if (d < LIGHT_R) light(rec, instant ? ALWAYS : time + d / WAVE, d, fromTrail); }
    }
  }
  function addWalked(store, x, y) { const k = cellKey(x, y); if (!store.has(k)) store.set(k, []); store.get(k).push(x, y); }
  function nearestWalked(store, rec) {
    const cx = Math.floor(rec.cx / CELL), cy = Math.floor(rec.cy / CELL), span = Math.ceil(LIGHT_R / CELL);
    let best = 1e9;
    for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) {
      const p = store.get(cx + i + ',' + (cy + j));
      if (p) for (let k = 0; k < p.length; k += 2) best = Math.min(best, recDist(rec, p[k], p[k + 1]));
    }
    return best;
  }
  function lightFromHistory(rec) {      // a tile arriving after we walked there lights at once
    const t = nearestWalked(walkedTrail, rec), p = nearestWalked(walkedPaint, rec);
    if (t < LIGHT_R) light(rec, ALWAYS, t, true);
    if (p < LIGHT_R) light(rec, ALWAYS, p, false);
  }

  // ---------- tiles ----------
  const tiles = new Map();
  const glassMeshes = new Set();
  const group = new THREE.Group(); scene.add(group);

  function buildTile(t, tile) {
    const { tx, ty } = t;
    const toL = (px, py, E) => fromMerc((tx + px / E) / NT, (ty + py / E) / NT);
    const g = new THREE.Group();
    const recs = [];
    // water glints
    if (tile.layers.water) {
      const pos = [], idx = [];
      for (let i = 0; i < tile.layers.water.length; i++) {
        const f = tile.layers.water.feature(i);
        if (f.type !== 3) continue;
        for (const poly of polygons(f)) {
          const { verts, tris } = triangulate(localRings(poly, f.extent, toL)), s0 = pos.length / 3;
          verts.forEach((v) => pos.push(v.x, v.y, 0.1));
          tris.forEach((q) => idx.push(s0 + q[0], s0 + q[1], s0 + q[2]));
        }
      }
      if (pos.length) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
        const m = new THREE.Mesh(geo, M.glint); m.renderOrder = 0; m.frustumCulled = false; g.add(m);
      }
    }
    // trees
    if (tile.layers.landuse) {
      const rand = rng(tx * 7919 + ty), mats = [], seeds = [], spots = [];
      const layer = tile.layers.landuse;
      for (let i = 0; i < layer.length && mats.length < 450; i++) {
        const f = layer.feature(i), per = TREE_CLASSES[f.properties.class];
        if (f.type !== 3 || !per) continue;
        for (const poly of polygons(f)) {
          const { verts, tris } = triangulate(localRings(poly, f.extent, toL));
          for (const q of tris) {
            const a = verts[q[0]], b = verts[q[1]], c = verts[q[2]];
            const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
            let n = Math.floor(area / per + rand());
            while (n-- > 0 && mats.length < 450) {
              const r1 = Math.sqrt(rand()), r2 = rand();
              const x = a.x * (1 - r1) + b.x * r1 * (1 - r2) + c.x * r1 * r2, y = a.y * (1 - r1) + b.y * r1 * (1 - r2) + c.y * r1 * r2;
              const s = 0.75 + rand() * 0.6;
              mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rand() * 6.28), new THREE.Vector3(s, s, s * (0.85 + rand() * 0.4))));
              seeds.push(rand()); spots.push(x, y);
            }
          }
        }
      }
      if (mats.length) {
        const geo = TREE.clone();
        const lit = new THREE.InstancedBufferAttribute(new Float32Array(mats.length * 3), 3);
        for (let i = 0; i < mats.length; i++) { lit.array[i * 3] = NEVER; lit.array[i * 3 + 2] = 99; }
        lit.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('iLit', lit);
        geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1));
        const m = new THREE.InstancedMesh(geo, M.tree, mats.length);
        mats.forEach((mx, i) => m.setMatrixAt(i, mx));
        m.renderOrder = 1; m.frustumCulled = false; g.add(m);
        for (let i = 0; i < mats.length; i++) recs.push({ tree: true, cx: spots[i * 2], cy: spots[i * 2 + 1], strength: 0, time: NEVER, ranges: [{ attr: lit, start: i, count: 1 }] });
      }
    }
    // buildings (+ a spill pool and a haze point each)
    if (tile.layers.building) {
      const layer = tile.layers.building;
      const P = [], N = [], F = [], B = [], idx = [], owners = [];
      const poolP = [], poolUV = [], poolC = [], poolIdx = [], hazeP = [], hazeS = [];
      let n = 0;
      const vert = (x, y, z, nx, ny, nz, u, v, roof, seed, h) => { P.push(x, y, z); N.push(nx, ny, nz); F.push(u, v, roof); B.push(seed, h); return n++; };
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
          const first = n;
          rings.forEach((ring) => {
            for (let k = 0; k < ring.length; k++) {
              const a = ring[k], b = ring[(k + 1) % ring.length];
              if (onTileEdge(a.t, b.t, f.extent)) continue;
              const dx = b.l[0] - a.l[0], dy = b.l[1] - a.l[1], len = Math.hypot(dx, dy);
              if (len < 0.3) continue;
              const nx = dy / len, ny = -dx / len;
              const cells = len >= 2.4 ? Math.max(1, Math.round(len / 3.1)) : 0;
              const u0 = cells ? (k * 7) % 997 : -1, u1 = cells ? u0 + cells : -1;
              const v0 = vert(a.l[0], a.l[1], base, nx, ny, 0, u0, base, 0, seed, h);
              const v1 = vert(b.l[0], b.l[1], base, nx, ny, 0, u1, base, 0, seed, h);
              const v2 = vert(b.l[0], b.l[1], h, nx, ny, 0, u1, h, 0, seed, h);
              const v3 = vert(a.l[0], a.l[1], h, nx, ny, 0, u0, h, 0, seed, h);
              idx.push(v0, v1, v2, v0, v2, v3);
            }
          });
          const { verts, tris } = triangulate(rings);
          const s0 = n;
          verts.forEach((v) => vert(v.x, v.y, h, 0, 0, 1, -1, h, 1, seed, h));
          tris.forEach((q) => idx.push(s0 + q[0], s0 + q[1], s0 + q[2]));
          let r = 0;
          const pts = new Float32Array(outer.length * 2);
          outer.forEach((q, j) => { r = Math.max(r, Math.hypot(q.l[0] - cx, q.l[1] - cy)); pts[j * 2] = q.l[0]; pts[j * 2 + 1] = q.l[1]; });
          const pool = poolP.length / 3, R = r + 9;
          [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v]) => { poolP.push(cx + u * R, cy + v * R, 0.15); poolUV.push(u, v); poolC.push(cx, cy, 0.15); });
          poolIdx.push(pool, pool + 1, pool + 2, pool, pool + 2, pool + 3);
          hazeP.push(cx, cy, Math.min(h, 18) * 0.8); hazeS.push(clamp(r * 2.6, 16, 46));
          owners.push({ key: f.id != null ? 'id' + f.id : null, cx, cy, pts, h, first, count: n - first, pool, haze: hazeS.length - 1 });
        }
      }
      if (n) {
        const geo = new THREE.BufferGeometry();
        const lit = new THREE.Float32BufferAttribute(new Float32Array(n * 2).map((_, i) => (i % 2 ? 0 : NEVER)), 2);
        lit.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        geo.setAttribute('aFace', new THREE.Float32BufferAttribute(F, 3));
        geo.setAttribute('aBld', new THREE.Float32BufferAttribute(B, 2));
        geo.setAttribute('aLit', lit);
        geo.setIndex(idx);
        const mesh = new THREE.Mesh(geo, M.building); mesh.renderOrder = 1; mesh.frustumCulled = false; g.add(mesh);
        const glass = new THREE.Mesh(geo, M.buildingGhost); glass.renderOrder = 4; glass.frustumCulled = false; glass.visible = U.uCut.value > 0; g.add(glass); glassMeshes.add(glass);

        const pg = new THREE.BufferGeometry();
        const plit = new THREE.Float32BufferAttribute(new Float32Array(poolP.length / 3 * 2).map((_, i) => (i % 2 ? 0 : NEVER)), 2);
        plit.setUsage(THREE.DynamicDrawUsage);
        pg.setAttribute('position', new THREE.Float32BufferAttribute(poolP, 3));
        pg.setAttribute('aUV', new THREE.Float32BufferAttribute(poolUV, 2));
        pg.setAttribute('aC', new THREE.Float32BufferAttribute(poolC, 3));
        pg.setAttribute('aLit', plit);
        pg.setIndex(poolIdx);
        const pools = new THREE.Mesh(pg, M.pool); pools.renderOrder = 2; pools.frustumCulled = false; g.add(pools);

        let hlit = null;
        if (!lite) {
          const hg = new THREE.BufferGeometry();
          hlit = new THREE.Float32BufferAttribute(new Float32Array(hazeS.length * 2).map((_, i) => (i % 2 ? 0 : NEVER)), 2);
          hlit.setUsage(THREE.DynamicDrawUsage);
          hg.setAttribute('position', new THREE.Float32BufferAttribute(hazeP, 3));
          hg.setAttribute('aSize', new THREE.Float32BufferAttribute(hazeS, 1));
          hg.setAttribute('aLit', hlit);
          const hz = new THREE.Points(hg, M.haze); hz.renderOrder = 10; hz.frustumCulled = false; g.add(hz);
        }
        for (const o of owners) {
          const ranges = [{ attr: lit, start: o.first, count: o.count }, { attr: plit, start: o.pool, count: 4 }];
          if (hlit) ranges.push({ attr: hlit, start: o.haze, count: 1 });
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (let k = 0; k < o.pts.length; k += 2) { x0 = Math.min(x0, o.pts[k]); x1 = Math.max(x1, o.pts[k]); y0 = Math.min(y0, o.pts[k + 1]); y1 = Math.max(y1, o.pts[k + 1]); }
          recs.push({ key: o.key, cx: o.cx, cy: o.cy, pts: o.pts, h: o.h, bb: [x0, y0, x1, y1], strength: 0, time: NEVER, ranges });
        }
      }
    }
    for (const rec of recs) { addRecord(rec); lightFromHistory(rec); }
    group.add(g);
    t.group = g; t.recs = recs;
  }
  function dropTile(key) {
    const t = tiles.get(key);
    tiles.delete(key);
    if (!t || !t.group) return;
    for (const rec of t.recs) { const list = grid.get(rec.cell); if (list) { const i = list.indexOf(rec); if (i >= 0) list.splice(i, 1); } }
    group.remove(t.group);
    t.group.traverse((o) => glassMeshes.delete(o));
    t.group.traverse((o) => { if (o.geometry && o.geometry !== TREE) o.geometry.dispose(); });
  }
  let loading = 0;
  function streamTiles(cx, cy, radius) {
    const c = toMerc(cx, cy), span = radius * S;
    const x0 = Math.floor((c.x - span) * NT), x1 = Math.floor((c.x + span) * NT), y0 = Math.floor((c.y - span) * NT), y1 = Math.floor((c.y + span) * NT);
    const want = [];
    for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
      const m = fromMerc((tx + 0.5) / NT, (ty + 0.5) / NT), d = Math.hypot(m[0] - cx, m[1] - cy);
      if (d < radius + 250 && !tiles.has(tx + '/' + ty)) want.push({ tx, ty, d });
    }
    for (const [key, t] of tiles) {
      const m = fromMerc((t.tx + 0.5) / NT, (t.ty + 0.5) / NT);
      if (t.group && Math.hypot(m[0] - cx, m[1] - cy) > radius + 700) dropTile(key);
    }
    want.sort((a, b) => a.d - b.d);
    for (const w of want) {
      if (loading >= 4 || tiles.size >= MAX_TILES) break;
      const t = { tx: w.tx, ty: w.ty, group: null, recs: [] };
      tiles.set(w.tx + '/' + w.ty, t);
      loading++;
      fetch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${Z}/${w.tx}/${w.ty}.vector.pbf?access_token=${token}`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((buf) => { if (buf && tiles.get(w.tx + '/' + w.ty) === t && !disposed) buildTile(t, new VectorTile(new Pbf(new Uint8Array(buf)))); })
        .catch(() => { tiles.delete(w.tx + '/' + w.ty); })
        .finally(() => { loading--; });
    }
  }

  // ---------- the current trail ----------
  const trail = { raw: [], path: null, total: 0, end: null, head: 0, meshes: [], dirty: false, lastBuild: 0, lampNext: 12, lampCount: 0, sampled: 0 };
  const RIBBONS = [[16, 0.25, M.warm, 3], [7, 0.3, M.aura, 4], [1.1, 0.4, M.core, 5], [1.1, 0.4, M.xray, 12]];
  // A centripetal Catmull-Rom curve through the GPS points, sampled every ~2 m. Unlike moving-average
  // smoothing, a new point only reshapes the last segment, so the drawn line never shifts under the runner.
  function smoothPath(raw) {
    const pts = [];
    for (const q of raw) { const l = pts[pts.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1.5) pts.push(q); }
    const lastRaw = raw[raw.length - 1];
    if (pts.length && pts[pts.length - 1] !== lastRaw) pts.push(lastRaw);
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const d = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) + 1e-4;
      const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2));
      for (let k = 1; k <= n; k++) {
        const t = t1 + ((t2 - t1) * k) / n, r = [0, 1].map((c) => {
          const a1 = ((t1 - t) * p0[c] + t * p1[c]) / t1;
          const a2 = ((t2 - t) * p1[c] + (t - t1) * p2[c]) / (t2 - t1);
          const a3 = ((t3 - t) * p2[c] + (t - t2) * p3[c]) / (t3 - t2);
          const b1 = ((t2 - t) * a1 + t * a2) / t2;
          const b2 = ((t3 - t) * a2 + (t - t1) * a3) / (t3 - t1);
          return ((t2 - t) * b1 + (t - t1) * b2) / (t2 - t1);
        });
        out.push(r);
      }
    }
    const res = [];
    let acc = 0;
    out.forEach((q, i) => { if (i) acc += Math.hypot(q[0] - out[i - 1][0], q[1] - out[i - 1][1]); res.push({ x: q[0], y: q[1], s: acc }); });
    return res;
  }
  // Moving average over ±w metres (index aligned, ends pinned); keeps each point's original along-distance.
  function rounded(path, w) {
    const n = path.length, k = Math.max(1, Math.round(w / 2)), sx = new Float64Array(n + 1), sy = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) { sx[i + 1] = sx[i] + path[i].x; sy[i + 1] = sy[i] + path[i].y; }
    return path.map((p, i) => {
      const r = Math.min(k, i, n - 1 - i);
      if (r < 1) return p;
      return { x: (sx[i + r + 1] - sx[i - r]) / (2 * r + 1), y: (sy[i + r + 1] - sy[i - r]) / (2 * r + 1), s: p.s };
    });
  }
  function sampleAt(path, s) {
    let lo = 0, hi = path.length - 1;
    if (s <= 0 || hi < 1) return path[0];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (path[m].s <= s) lo = m; else hi = m; }
    const a = path[lo], b = path[hi], t = clamp((s - a.s) / Math.max(1e-6, b.s - a.s), 0, 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  function buildRibbons() {
    trail.meshes.forEach((m) => { scene.remove(m); m.geometry.dispose(); });
    trail.meshes = [];
    if (trail.raw.length < 2) { trail.total = 0; trail.end = null; trail.head = 0; U.uHead.value = 0; return; }
    const path = smoothPath(trail.raw), n = path.length;
    trail.total = path[n - 1].s; trail.end = path[n - 1];
    for (const [halfW, z, mat, order] of RIBBONS) {
      const pos = new Float32Array(n * 6), along = new Float32Array(n * 2), across = new Float32Array(n * 2), idx = [];
      const win = Math.max(2, halfW * 1.3);
      const line = halfW > 3 ? rounded(path, halfW * 1.6) : path;   // wide glows round the corners so they never fold
      line.forEach((p, i) => {
        const a = sampleAt(line, p.s - win), b = sampleAt(line, p.s + win);
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
        pos.set([p.x + nx * halfW, p.y + ny * halfW, z, p.x - nx * halfW, p.y - ny * halfW, z], i * 6);
        along[i * 2] = along[i * 2 + 1] = p.s; across[i * 2] = -1; across[i * 2 + 1] = 1;
        if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
      geo.setAttribute('aAcross', new THREE.BufferAttribute(across, 1));
      geo.setIndex(idx);
      const m = new THREE.Mesh(geo, mat); m.renderOrder = order; m.frustumCulled = false; scene.add(m); trail.meshes.push(m);
    }
    const pos = new Float32Array(n * 6), along = new Float32Array(n * 2), hgt = new Float32Array(n * 2), idx = [];
    path.forEach((p, i) => {
      pos.set([p.x, p.y, 0.3, p.x, p.y, 2.6], i * 6);
      along[i * 2] = along[i * 2 + 1] = p.s; hgt[i * 2 + 1] = 1;
      if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
    geo.setAttribute('aH', new THREE.BufferAttribute(hgt, 1));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, M.curtain); m.renderOrder = 6; m.frustumCulled = false; scene.add(m); trail.meshes.push(m);
    trail.path = path;
  }

  // Lamps: preallocated, filled as the trail grows.
  const lampGeo = new THREE.BufferGeometry();
  lampGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS * 3), 3));
  lampGeo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS).fill(NEVER), 1));
  lampGeo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS).map((_, i) => hash1(i)), 1));
  lampGeo.setDrawRange(0, 0);
  const lamps = new THREE.Points(lampGeo, M.lamp); lamps.renderOrder = 8; lamps.frustumCulled = false; scene.add(lamps);
  const postGeo = mergeGeometries([new THREE.BoxGeometry(0.16, 0.16, 4.4).translate(0, 0, 2.2), new THREE.BoxGeometry(0.5, 0.5, 0.25).translate(0, 0, 4.5)]);
  const posts = new THREE.InstancedMesh(postGeo, M.pole, MAX_LAMPS); posts.count = 0; posts.renderOrder = 1; posts.frustumCulled = false; scene.add(posts);
  const lampPoolGeo = new THREE.BufferGeometry();
  lampPoolGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS * 12), 3));
  lampPoolGeo.setAttribute('aUV', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS * 8), 2));
  lampPoolGeo.setAttribute('aC', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS * 12), 3));
  lampPoolGeo.setAttribute('aLit', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS * 8).map((_, i) => (i % 2 ? 0 : NEVER)), 2));
  lampPoolGeo.setIndex(Array.from({ length: MAX_LAMPS * 6 }, (_, i) => { const q = Math.floor(i / 6) * 4; return q + [0, 1, 2, 0, 2, 3][i % 6]; }));
  lampPoolGeo.setDrawRange(0, 0);
  const lampPools = new THREE.Mesh(lampPoolGeo, M.pool); lampPools.renderOrder = 2; lampPools.frustumCulled = false; scene.add(lampPools);
  const tmpM = new THREE.Matrix4();
  function addLamp(x, y, t) {
    const i = trail.lampCount++;
    lampGeo.attributes.position.setXYZ(i, x, y, 4.5); lampGeo.attributes.aT.setX(i, t);
    lampGeo.attributes.position.needsUpdate = lampGeo.attributes.aT.needsUpdate = true;
    lampGeo.setDrawRange(0, trail.lampCount);
    posts.setMatrixAt(i, tmpM.makeTranslation(x, y, 0)); posts.count = trail.lampCount; posts.instanceMatrix.needsUpdate = true;
    const P = lampPoolGeo.attributes.position, UV = lampPoolGeo.attributes.aUV, C = lampPoolGeo.attributes.aC, LT = lampPoolGeo.attributes.aLit, R = 7.5;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], k) => { P.setXYZ(i * 4 + k, x + u * R, y + v * R, 0.15); UV.setXY(i * 4 + k, u, v); C.setXYZ(i * 4 + k, x, y, 0.15); LT.setXY(i * 4 + k, t, 0.32); });
    P.needsUpdate = UV.needsUpdate = C.needsUpdate = LT.needsUpdate = true;
    lampPoolGeo.setDrawRange(0, trail.lampCount * 6);
  }
  function clearLamps() { trail.lampCount = 0; trail.lampNext = 12; lampGeo.setDrawRange(0, 0); posts.count = 0; lampPoolGeo.setDrawRange(0, 0); }

  /** The session's trail, oldest first, as [lng, lat] pairs. Growing it lights the city; a shorter or new list starts over. */
  function setTrail(coords) {
    const pts = (coords || []).map((c) => toLocal(c[0], c[1]));
    const restart = pts.length < trail.raw.length || (trail.raw.length && pts.length && Math.hypot(pts[0][0] - trail.raw[0][0], pts[0][1] - trail.raw[0][1]) > 1);
    if (restart) { trail.raw = []; trail.sampled = 0; trail.head = 0; clearLamps(); litKeys.clear(); walkedTrail.clear(); litDirty = true; }
    const from = Math.max(1, trail.raw.length);
    trail.raw = pts;
    if (pts.length === 1) { addWalked(walkedTrail, pts[0][0], pts[0][1]); lightAroundTrail(pts[0][0], pts[0][1]); }
    for (let i = from; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(len / 4));
      for (let k = 1; k <= steps; k++) {
        const x = ax + ((bx - ax) * k) / steps, y = ay + ((by - ay) * k) / steps;
        addWalked(walkedTrail, x, y);
        lightAroundTrail(x, y);
      }
    }
    trail.dirty = true;
  }
  function lightAroundTrail(x, y) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), span = Math.ceil(LIGHT_R / CELL), t = now();
    for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) {
      const list = grid.get(cx + i + ',' + (cy + j));
      if (!list) continue;
      for (const rec of list) { const d = recDist(rec, x, y); if (d < LIGHT_R) light(rec, t + d / WAVE, d, true); }
    }
  }
  /** Earlier walks ([[lng, lat], ...] per line): their streets are simply lit, no animation. */
  let paintSig = '';
  function setPaint(lines) {
    const sig = (lines || []).length + ':' + (lines || []).reduce((n, l) => n + l.length, 0);
    if (sig === paintSig) return;
    paintSig = sig;
    for (const line of lines || []) {
      const pts = line.map((c) => toLocal(c[0], c[1]));
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(len / 8));
        for (let k = 0; k <= steps; k++) { const x = ax + ((bx - ax) * k) / steps, y = ay + ((by - ay) * k) / steps; addWalked(walkedPaint, x, y); lightAround(x, y, ALWAYS, false, true); }
      }
    }
  }

  // ---------- sparks and the heartbeat ring ----------
  const SPARKS = 500;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
  sparkGeo.setAttribute('aVel', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
  sparkGeo.setAttribute('aBirth', new THREE.BufferAttribute(new Float32Array(SPARKS).fill(-99), 1));
  const sparks = new THREE.Points(sparkGeo, M.spark); sparks.renderOrder = 9; sparks.frustumCulled = false; scene.add(sparks);
  let sparkNext = 0, sparkDebt = 0;
  function emitSparks(n, x, y) {
    const P = sparkGeo.attributes.position, V = sparkGeo.attributes.aVel, B = sparkGeo.attributes.aBirth;
    for (let i = 0; i < n; i++) {
      const k = sparkNext; sparkNext = (sparkNext + 1) % SPARKS;
      P.setXYZ(k, x + (Math.random() - 0.5) * 1.8, y + (Math.random() - 0.5) * 1.8, 0.5);
      V.setXYZ(k, (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.4, 1.2 + Math.random() * 2.4);
      B.setX(k, now() - Math.random() * 0.05);
    }
    P.needsUpdate = V.needsUpdate = B.needsUpdate = true;
  }
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.ring); ring.renderOrder = 7; ring.frustumCulled = false; ring.scale.setScalar(22); scene.add(ring);

  // ---------- the runner ----------
  const runner = { root: new THREE.Group(), raw: null, target: null, pos: null, from: null, t0: 0, dur: 1, interval: 0, angle: 0, heading: null, moveHeading: null, speed: 0, speedIn: 0, lastFix: 0, scale: 3.5, gait: 'idle', activity: 'idle', forced: null, visible: true };
  scene.add(runner.root);
  const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.ShaderMaterial({
    ...additive, uniforms: U,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vP; void main(){ float r = length(vP); gl_FragColor = vec4(vec3(0.3, 0.98, 0.84), pow(1.0 - r, 2.0) * 0.55); }',
  }));
  glowDisc.position.z = 0.32; glowDisc.renderOrder = 7; glowDisc.frustumCulled = false; runner.root.add(glowDisc);
  const heroes = {};                   // 'm' | 'f' → { holder, mixer, actions, current }
  let heroKey = hero, heroReadyCb = null;
  function patchMaterial(mat) {
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float rim = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.6); totalEmissiveRadiance += vec3(0.22, 0.95, 0.80) * rim * 0.45; }`);
    };
    mat.needsUpdate = true;
  }
  function loadHero(key) {
    if (heroes[key]) return;
    heroes[key] = { loading: true };
    new GLTFLoader().load(`${assetBase}runner-${key}.glb`, (gltf) => {
      const model = gltf.scene, holder = new THREE.Group();
      holder.rotation.x = Math.PI / 2;         // glTF Y-up → local Z-up; the model then faces local -Y
      holder.add(model);
      const xray = new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.4, depthFunc: THREE.GreaterDepth, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
      const skinned = [];
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false; o.renderOrder = 11;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(patchMaterial);
        if (o.isSkinnedMesh) skinned.push(o);
      });
      for (const o of skinned) { const ghost = new THREE.SkinnedMesh(o.geometry, xray); ghost.bind(o.skeleton, o.bindMatrix); ghost.frustumCulled = false; ghost.renderOrder = 13; o.parent.add(ghost); }
      const mixer = new THREE.AnimationMixer(model), actions = {};
      gltf.animations.forEach((clip) => { actions[clip.name] = mixer.clipAction(clip); });
      heroes[key] = { holder, mixer, actions, current: null };
      holder.visible = key === heroKey;
      runner.root.add(holder);
      if (key === heroKey && heroReadyCb) heroReadyCb(key);
    }, undefined, () => { delete heroes[key]; });
  }
  // Gait thresholds in m/s with hysteresis, so GPS noise near a threshold never flickers between clips.
  const GAIT = { walkOn: 0.6, walkOff: 0.35, runOn: 2.5, runOff: 2.1 };
  const CLIP_SPEED = { walk: 1.35, run: 3.0 };     // ground speed each clip looks natural at
  const toAngle = (deg) => Math.atan2(Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180));
  function play(h, name, fade) {
    const next = h.actions[name] || h.actions.idle || Object.values(h.actions)[0];
    if (!next || h.current === next) return;
    next.reset();
    // walk ⇄ run: begin the new cycle at the same point of the stride so the legs don't snap
    const prev = h.current, stride = (a) => a && /walk|run/.test(a.getClip().name);
    if (stride(prev) && stride(next)) next.time = (prev.time / prev.getClip().duration) * next.getClip().duration;
    next.setEffectiveWeight(1).fadeIn(fade).play();
    if (prev) prev.fadeOut(fade);
    h.current = next;
  }
  loadHero(heroKey);

  /**
   * A GPS fix. heading in degrees (null → direction of travel), speed in m/s (null → measured from fixes).
   * The runner walks from where it is drawn to the fix over one fix interval at an even pace.
   */
  function setRunner(lng, lat, heading, speed) {
    const [rx, ry] = toLocal(lng, lat), t = performance.now() / 1000;
    const hasSpeed = typeof speed === 'number' && Number.isFinite(speed) && speed >= 0;
    const hasHeading = typeof heading === 'number' && Number.isFinite(heading);
    if (runner.raw && Math.hypot(rx - runner.raw[0], ry - runner.raw[1]) < 0.05) {
      // same place, new compass reading: only turn (never restart the glide or skew the fix interval)
      if (hasHeading) runner.heading = toAngle(heading);
      if (hasSpeed) runner.speedIn = speed;
      return;
    }
    if (runner.raw) {
      const d = Math.hypot(rx - runner.raw[0], ry - runner.raw[1]), gap = clamp(t - runner.lastFix, 0.2, 3);
      runner.interval = runner.interval ? runner.interval * 0.7 + gap * 0.3 : gap;
      runner.speedIn = hasSpeed ? speed : d / gap;
      if (runner.speedIn < 0.4 && d < 3) {            // standing: GPS wanders a few metres — stay put, just turn
        runner.lastFix = t;
        if (hasHeading) runner.heading = toAngle(heading);
        return;
      }
      if (d > 0.4) runner.moveHeading = Math.atan2(rx - runner.raw[0], -(ry - runner.raw[1]));
    } else if (hasSpeed) runner.speedIn = speed;
    // the runner looks where the phone looks (compass from the app); without one, the way it moves
    if (hasHeading) runner.heading = toAngle(heading);
    else if (runner.moveHeading != null) runner.heading = runner.moveHeading;
    runner.raw = [rx, ry];
    const [x, y] = outdoors(rx, ry);
    const far = !runner.pos || Math.hypot(x - runner.pos[0], y - runner.pos[1]) > 120;
    runner.from = far ? [x, y] : runner.pos.slice();
    runner.target = [x, y]; runner.lastFix = t; runner.t0 = t; runner.dur = clamp(runner.interval || 1, 0.25, 2);
    if (far) { runner.pos = [x, y]; if (runner.heading != null) runner.angle = runner.heading; }
  }
  // GPS indoors puts the runner inside a building, where it melts into the walls: stand it on the street just outside.
  function pointInRing(p, x, y) {
    let inside = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function insideBuilding(x, y) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const list = grid.get(cx + i + ',' + (cy + j));
      if (list) for (const rec of list) if (rec.bb && x >= rec.bb[0] && x <= rec.bb[2] && y >= rec.bb[1] && y <= rec.bb[3] && pointInRing(rec.pts, x, y)) return rec;
    }
    return null;
  }
  let occludedAt = 0, hidden = false, glassShown = false;
  function occluded(rx, ry, rz) {               // walk from the runner towards the camera through the first 70 m
    const c = camera.position, dx = c.x - rx, dy = c.y - ry, dz = c.z - rz, flat = Math.hypot(dx, dy) || 1;
    for (let s = 1.5; s < 70; s += 2) {
      const t = s / flat, z = rz + dz * t;
      if (z > 80) break;
      const rec = insideBuilding(rx + dx * t, ry + dy * t);
      if (rec && z < rec.h) return true;
    }
    return false;
  }
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(ax + dx * t - px, ay + dy * t - py);
  }
  function clearance(x, y) {                    // distance to the nearest wall around (x, y), capped at 25 m
    let best = 25;
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const list = grid.get(cx + i + ',' + (cy + j));
      if (list) for (const rec of list) {
        if (!rec.bb || x < rec.bb[0] - 25 || x > rec.bb[2] + 25 || y < rec.bb[1] - 25 || y > rec.bb[3] + 25) continue;
        const p = rec.pts;
        for (let a = 0, b = p.length - 2; a < p.length; b = a, a += 2) best = Math.min(best, segDist(x, y, p[b], p[b + 1], p[a], p[a + 1]));
      }
    }
    return best;
  }
  /** Inside a building → the spot just outside it that opens onto the most open space (the street), not a back yard. */
  function outdoors(x, y) {
    const rec = insideBuilding(x, y);
    if (!rec) return [x, y];
    const p = rec.pts;
    let best = null;
    for (let a = 0, b = p.length - 2; a < p.length; b = a, a += 2) {
      const ax = p[b], ay = p[b + 1], dx = p[a] - ax, dy = p[a + 1] - ay, len = Math.hypot(dx, dy);
      if (len < 1.5) continue;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / (len * len), 0.15, 0.85);
      const nx = dy / len, ny = -dx / len;                     // outward for the counter-clockwise outer ring
      for (let step = 3; step <= 15; step += 3) {
        const qx = ax + dx * t + nx * step, qy = ay + dy * t + ny * step;
        if (insideBuilding(qx, qy)) continue;
        const score = Math.min(clearance(qx, qy), 12) - 0.35 * Math.hypot(qx - x, qy - y);
        if (!best || score > best.score) best = { qx, qy, score };
        break;
      }
    }
    return best ? [best.qx, best.qy] : [x, y];
  }

  /** 'auto' (speed decides) | 'idle' | 'walk' | 'run' | 'dance' */
  function setActivity(a) { runner.forced = a === 'auto' ? null : a; }

  // ---------- render ----------
  const P = new THREE.Matrix4(), PI = new THREE.Matrix4(), TC = new THREE.Matrix4(), EYE = new THREE.Vector4();
  let renderer = null, disposed = false, litDirty = false, lastLit = -1, raf = 0, last = performance.now(), streamAt = 0;
  map.addLayer({
    id: 'medirun-glow', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) { renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true }); renderer.autoClear = false; },
    render(gl, matrix) {
      if (disposed) return;
      P.fromArray(matrix).multiply(MODEL);
      PI.copy(P).invert();
      EYE.set(0, 0, 1, 0).applyMatrix4(PI);
      camera.position.set(EYE.x / EYE.w, EYE.y / EYE.w, EYE.z / EYE.w);
      camera.updateMatrixWorld(true);
      camera.projectionMatrix.copy(P).multiply(TC.makeTranslation(camera.position.x, camera.position.y, camera.position.z));
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      const c = map.getCenter(), f = toLocal(c.lng, c.lat), e = P.elements;
      U.uRefW.value = Math.max(1e-6, e[3] * f[0] + e[7] * f[1] + e[15]);
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },
  });

  function tick(nowMs) {
    if (disposed) return;
    const dt = Math.min(0.1, (nowMs - last) / 1000);
    last = nowMs;
    U.uTime.value += dt;
    const c = map.getCenter(), cl = toLocal(c.lng, c.lat);
    if (nowMs - streamAt > 500) {
      // load what the camera can see: from the centre to a point high on the screen, within limits
      streamAt = nowMs;
      const cv = map.getCanvas(), far = map.unproject([cv.clientWidth / 2, cv.clientHeight * 0.18]), fl = toLocal(far.lng, far.lat);
      streamTiles(cl[0], cl[1], clamp(Math.hypot(fl[0] - cl[0], fl[1] - cl[1]) * 1.15, MIN_RADIUS, MAX_RADIUS));
      if (runner.raw && runner.pos) {       // a building that loaded after the fix may now contain the runner
        const o = outdoors(runner.raw[0], runner.raw[1]);
        if (Math.hypot(o[0] - runner.target[0], o[1] - runner.target[1]) > 0.5) { runner.from = runner.pos.slice(); runner.target = o; runner.t0 = performance.now() / 1000; runner.dur = 0.8; }
      }
    }
    if (trail.dirty && nowMs - trail.lastBuild > 90) { trail.dirty = false; trail.lastBuild = nowMs; buildRibbons(); }
    const p0 = map.project(c), p1 = map.project(toLngLat(cl[0] + 1, cl[1]));
    U.uPxM.value = Math.max(0.2, Math.hypot(p1.x - p0.x, p1.y - p0.y));

    // runner: even glide to the last fix, gait from speed (stand / walk / run), smooth clip blends
    if (runner.target) {
      const t = performance.now() / 1000;
      if (!runner.pos) { runner.pos = runner.target.slice(); runner.from = runner.target.slice(); }
      const u = clamp((t - runner.t0) / runner.dur, 0, 1);
      runner.pos[0] = runner.from[0] + (runner.target[0] - runner.from[0]) * u;
      runner.pos[1] = runner.from[1] + (runner.target[1] - runner.from[1]) * u;
      if (t - runner.lastFix > 4) runner.speedIn *= Math.exp(-dt * 2);    // fixes stopped: slow to a stop
      runner.speed += (runner.speedIn - runner.speed) * (1 - Math.exp(-dt / 0.6));
      if (runner.heading != null) runner.angle = lerpRad(runner.angle, runner.heading, 1 - Math.exp(-dt * 5));
      const v = runner.speed;
      let gait = runner.gait;
      if (gait === 'idle' && v > GAIT.walkOn) gait = 'walk';
      if (gait === 'walk' && v < GAIT.walkOff) gait = 'idle';
      if (gait !== 'run' && v > GAIT.runOn) gait = 'run';
      if (gait === 'run' && v < GAIT.runOff) gait = 'walk';
      runner.gait = gait;
      const activity = runner.forced || gait;
      runner.activity = activity;
      const [x, y] = runner.pos;
      runner.root.position.set(x, y, 0.3); runner.root.rotation.z = runner.angle;
      // on the map the runner keeps a readable size; in the close-up it fills about a third of the screen
      const want = heroView ? clamp((map.getCanvas().clientHeight * 0.3) / (U.uPxM.value * 1.75), 1.4, 6) : clamp(44 / (U.uPxM.value * 1.75), 2.2, 6);
      runner.scale += (want - runner.scale) * Math.min(1, dt * 3); runner.root.scale.setScalar(runner.scale);
      runner.root.visible = runner.visible;
      ring.visible = runner.visible; ring.position.set(x, y, 0.33); ring.scale.setScalar(runner.scale * 6.3);
      // open a window through buildings only while one actually hides the runner from the camera
      const mid = 0.3 + 1.75 * runner.scale * 0.55;
      U.uRunner.value.set(x, y, mid);
      if (nowMs - occludedAt > 120) { occludedAt = nowMs; hidden = runner.visible && occluded(x, y, mid); }
      U.uCut.value += ((hidden ? 1.75 * runner.scale * 0.8 + 2.5 : 0) - U.uCut.value) * Math.min(1, dt * 6);
      if (U.uCut.value < 0.05) U.uCut.value = 0;
      const glassOn = U.uCut.value > 0;
      if (glassOn !== glassShown) { glassShown = glassOn; for (const m of glassMeshes) m.visible = glassOn; }
      const toCam = camera.position.clone().sub(runner.root.position); toCam.z = Math.max(toCam.z, toCam.length() * 0.35);
      faceLight.target = runner.root; faceLight.position.copy(runner.root.position).add(toCam.normalize().multiplyScalar(10));
      faceLight.intensity += ((heroView ? 1.7 : 0.5) - faceLight.intensity) * Math.min(1, dt * 3);
      const moving = activity === 'run' || activity === 'walk';
      U.uRun.value += ((moving ? 1 : 0) - U.uRun.value) * Math.min(1, dt * 3);
      warmLight.position.set(x + 4, y - 3, 6); warmLight.intensity = 30 * U.uRun.value;
      if (moving && runner.visible) { sparkDebt += dt * (activity === 'run' ? 40 + 12 * v : 12); const n = Math.floor(sparkDebt); sparkDebt -= n; if (n) emitSparks(n, x, y); }
      const h = heroes[heroKey];
      if (h && h.mixer) {
        play(h, activity, activity === 'idle' || h.current === h.actions.idle ? 0.5 : 0.35);
        if (h.actions.walk) h.actions.walk.timeScale = clamp(v / CLIP_SPEED.walk, 0.7, 1.4);
        if (h.actions.run) h.actions.run.timeScale = clamp(v / CLIP_SPEED.run, 0.85, 1.75);
        h.mixer.update(dt);
      }
    } else { runner.root.visible = false; ring.visible = false; }

    // The light reaches exactly the runner every frame: the geometry runs to the latest fix and the shader
    // cuts it at the runner's gliding position, so the trail grows smoothly instead of in steps.
    if (trail.end) {
      const behind = runner.pos && runner.visible ? Math.hypot(runner.pos[0] - trail.end.x, runner.pos[1] - trail.end.y) : 0;
      const want = clamp(trail.total - (behind < 40 ? behind : 0), 0, trail.total);
      trail.head = Math.max(trail.head, want);
      U.uHead.value = trail.head;
      // a street lamp every 26 m, switched on as the runner reaches it
      while (trail.path && trail.lampNext < trail.head && trail.lampCount < MAX_LAMPS) {
        const p = sampleAt(trail.path, trail.lampNext), q = sampleAt(trail.path, trail.lampNext + 2), len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        const side = trail.lampCount % 2 ? 1 : -1;
        addLamp(p.x - ((q.y - p.y) / len) * 3.6 * side, p.y + ((q.x - p.x) / len) * 3.6 * side, now());
        trail.lampNext += 26;
      }
    }
    if (litDirty && litKeys.size !== lastLit) { litDirty = false; lastLit = litKeys.size; if (onLit) onLit(lastLit); }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return {
    setTrail, setPaint, setRunner, setActivity,
    setHero(key) { if (key !== 'm' && key !== 'f') return; heroKey = key; loadHero(key); for (const k of Object.keys(heroes)) if (heroes[k].holder) heroes[k].holder.visible = k === key; },
    setRunnerVisible(v) { runner.visible = Boolean(v); },
    /** Close-up of the runner: bigger character and a light on the face (the host moves the camera). */
    setHeroView(on) { heroView = Boolean(on); },
    /** Where the runner is on screen (CSS px): feet, head and the hit box; null when hidden. */
    runnerScreen() {
      if (!runner.pos || !runner.visible || !renderer) return null;
      const cv = map.getCanvas(), w = cv.clientWidth, h = cv.clientHeight;
      const at = (z) => { const v = new THREE.Vector4(runner.pos[0], runner.pos[1], z, 1).applyMatrix4(P); return v.w > 0 ? { x: ((v.x / v.w + 1) / 2) * w, y: ((1 - v.y / v.w) / 2) * h } : null; };
      const feet = at(0.3), head = at(0.3 + 1.75 * runner.scale);
      if (!feet || !head) return null;
      return { x: feet.x, y: feet.y, headX: head.x, headY: head.y, height: Math.hypot(feet.x - head.x, feet.y - head.y) };
    },
    runnerHit(px, py) {
      const s = this.runnerScreen();
      if (!s) return false;
      const mx = (s.x + s.headX) / 2, my = (s.y + s.headY) / 2, r = Math.max(34, s.height * 0.6);
      return Math.abs(px - mx) < Math.max(34, s.height * 0.4) && Math.abs(py - my) < r;
    },
    onHeroReady(cb) { heroReadyCb = cb; if (heroes[heroKey]?.holder) cb(heroKey); },
    runner() { if (!runner.pos) return null; const ll = toLngLat(runner.pos[0], runner.pos[1]); return { lng: ll.lng, lat: ll.lat, heading: runner.heading == null ? null : ((Math.atan2(Math.sin(runner.heading), -Math.cos(runner.heading)) * 180) / Math.PI + 360) % 360, speed: runner.speed, activity: runner.activity }; },
    litCount: () => litKeys.size,
    debug: { THREE, scene, camera, U, tiles, heroes, runner, grid, insideBuilding, toLngLat },
    dispose() { disposed = true; cancelAnimationFrame(raf); try { map.removeLayer('medirun-glow'); } catch { /* map already gone */ } },
  };
}
