// MEDIRUN Glow engine — a dark miniature city that lights up around the runner.
// Shared by the prototype (brand/medirun/glow) and the app's map WebView (mobile/src/lib/run/mapHtml.ts),
// which loads the bundle from https://medicard.ge/medirun/glow/engine.js (node build.mjs).
// Mapbox GL draws the ground from glowStyle(); this module adds one three.js custom layer in the same
// WebGL context: buildings and trees from Mapbox streets-v8 z16 tiles streamed around the camera, the
// current trail, street lamps, sparks and the rigged runner. Lighting is time based: a building lights
// when a trail point (or an earlier walk) passes within LIGHT_R, delayed by distance / WAVE.
// The lighting pass (owner-approved 2026-10-04, live in the browser and on the phone):
//   · post-process: the finished frame is copied once, the lights are blurred at 1/4 and 1/8 size and added
//     back (bloom), with a soft shoulder instead of clipping and a gentle vignette — the night haze around
//     every light. No second geometry pass; the pass drops itself on a phone that cannot hold the frame rate.
//   · facades: plaster colours, lit by the nearest stretch of the trail as a street light with real falloff
//     (bright at the pavement, dark at the cornice); the windows come on from the street upward
//   · windows: tungsten / warm white / cool LED / TV flicker / curtains / balcony doors, light spilling onto
//     the sill, neon shop signs on some ground floors, a few sleepless windows in the dark city
//   · street lamps: a real post (plinth, pole, arm, hanging lantern with glass) that warms up like a sodium
//     lamp, a soft light cone and a pool on the pavement; a post never stands inside a building
//   · ignition: golden motes rise from a facade the moment it lights; red aviation beacons on tall buildings
//   · ground: road casings (curbs) in the Mapbox style
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

const Z = 16, NT = 2 ** Z;
const MIN_RADIUS = 650, MAX_RADIUS = 1600, MAX_TILES = 72;
const LIGHT_R = 72, WAVE = 26, CELL = 50;
const NEVER = 1e7, ALWAYS = -1e4;
const MAX_LAMPS = 1500, LAMP_EVERY = 26, LAMP_SIDE = 3.6, LANTERN_Z = 4.52, SEG_MAX = 60;
const MOTES = 700, BEACON_H = 32;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash1 = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
const lerpRad = (a, b, t) => a + ((((b - a) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * t;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** The ground: night streets, water, parks and flat footprints under the 3D city. */
export function glowStyle() {
  const roadWidth = ['interpolate', ['exponential', 1.7], ['zoom'],
    13, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 2.2, ['secondary', 'tertiary'], 1.6, 0.6],
    18, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 34, ['secondary', 'tertiary'], 26, ['street', 'street_limited', 'service'], 16, 7]];
  const roadFilter = ['all', ['==', ['geometry-type'], 'LineString'], ['!', ['match', ['get', 'class'], ['major_rail', 'minor_rail', 'service_rail', 'ferry', 'aerialway', 'golf', 'construction'], true, false]]];
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
      // curbs: a hairline either side of every street, so roads read as streets instead of fat lines
      {
        id: 'roads-casing', type: 'line', source: 'streets', 'source-layer': 'road', filter: roadFilter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2C3649', 'line-gap-width': roadWidth, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.4, 18, 1.4], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16.5, 0.9] },
      },
      {
        id: 'roads', type: 'line', source: 'streets', 'source-layer': 'road', filter: roadFilter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['match', ['get', 'class'], ['path', 'pedestrian', 'track'], '#19212E', '#212A39'], 'line-width': roadWidth },
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
// sodium-lamp warm-up: a short flicker, then amber ramping to warm white over ~2 s
const WARMUP = `
  float warmFlick(float since, float seed){ return since < 0.4 ? step(0.5, fract(since * 16.0 + seed * 7.0)) : 1.0; }
  float warmRamp(float since){ return smoothstep(0.0, 1.8, since); }
  vec3 lampColour(float ramp){ return mix(vec3(1.0, 0.52, 0.18), vec3(1.0, 0.80, 0.50), ramp); }`;

function materials(U) {
  const building = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 aFace; attribute vec2 aLit; attribute vec4 aSeg; attribute vec2 aBld;
      varying vec3 vN; varying vec3 vFace; varying vec2 vLit; varying vec4 vSeg; varying vec2 vBld; varying float vW; varying vec3 vPos;
      void main(){
        vN = normal; vFace = aFace; vLit = aLit; vSeg = aSeg; vBld = aBld; vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vW = gl_Position.w;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uRunner; uniform float uCut;
      ${FOGFN}
      varying vec3 vN; varying vec3 vFace; varying vec2 vLit; varying vec4 vSeg; varying vec2 vBld; varying float vW; varying vec3 vPos;
      ${HASH}
      // Tbilisi plaster: cream, ochre, terracotta, dusty rose, sage, grey — one per building
      vec3 plaster(float s){
        float k = floor(s * 6.0);
        vec3 c = k < 1.0 ? vec3(0.91, 0.84, 0.70) : k < 2.0 ? vec3(0.85, 0.66, 0.42) : k < 3.0 ? vec3(0.78, 0.51, 0.37)
               : k < 4.0 ? vec3(0.80, 0.64, 0.58) : k < 5.0 ? vec3(0.68, 0.72, 0.60) : vec3(0.76, 0.76, 0.78);
        return c * (0.92 + 0.16 * hash(vec2(s, 8.8)));
      }
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
        float lit = on * smoothstep(0.0, 1.6, since);
        float moon = max(dot(n, ${MOON}), 0.0);

        // The street light: the nearest point of the stretch of trail that lit this building, at lantern height.
        vec2 ba = vSeg.zw - vSeg.xy;
        float hh = clamp(dot(vPos.xy - vSeg.xy, ba) / max(dot(ba, ba), 1e-3), 0.0, 1.0);
        vec3 Lp = vec3(vSeg.xy + ba * hh, 4.6);
        vec3 toL = Lp - vPos;
        float d = length(toL);
        vec3 ldir = toL / max(d, 1e-3);
        float atten = 1.0 / (1.0 + d * d / 90.0);
        float lam = clamp(dot(n, ldir) * 0.8 + 0.25, 0.0, 1.0);

        vec3 albedo = plaster(seed);
        vec3 sky = vec3(0.16, 0.20, 0.29) * (0.5 + 0.6 * moon);
        if (roof > 0.5) { sky *= 1.35; albedo = mix(albedo, vec3(0.62, 0.64, 0.70), 0.6); }
        vec3 col = albedo * sky;
        float g = (v - 0.5) / 3.3, fl = floor(g), fy = fract(g);
        if (roof < 0.5) {
          col *= mix(0.55, 1.0, smoothstep(0.0, 9.0, v));   // the sky lights the upper floors first
          if (fl >= 1.0 && v < top - 0.6) col *= 1.0 - (1.0 - smoothstep(0.0, 0.05, fy)) * 0.22 * (1.0 - smoothstep(0.1, 0.3, fwidth(g)));
        }
        // warm light: the lamp with falloff, plus a soft bounce from the pavement that fades up the wall
        vec3 warmL = vec3(1.0, 0.70, 0.42);
        float street = roof > 0.5 ? 0.0 : 1.15 * atten * lam;
        float bounce = roof > 0.5 ? 0.08 : 0.38 * exp(-v / 15.0);
        col += albedo * warmL * min(street + bounce, 1.1) * lit;
        if (roof < 0.5 && v > top - 0.5) col *= 1.0 + 0.3 * lit;              // the cornice catches the light
        col += vec3(1.0, 0.62, 0.3) * on * exp(-max(since, 0.0) * 2.4) * 0.4;  // the ignition flash
        if (roof > 0.5 && hash(floor(vPos.xy / 2.5) + seed) > 0.94) col *= 0.86;   // roof clutter (vents, skylights)

        if (roof < 0.5 && vFace.x >= 0.0 && fl >= 0.0 && v < top - 1.0) {
          float cx = floor(vFace.x), fx = fract(vFace.x);
          bool shop = fl < 0.5;
          float h = hash(vec2(cx + seed * 97.0, fl + seed * 31.0));
          float kind = hash(vec2(cx * 3.1 + seed * 13.0, fl * 1.7 + seed * 5.0));
          bool door = !shop && kind > 0.86;                       // balcony door: tall, down to the floor
          bool tv = !shop && kind < 0.07;
          bool cool = !shop && kind >= 0.07 && kind < 0.19;
          bool curtain = !shop && kind >= 0.19 && kind < 0.40;
          vec2 hs = shop ? vec2(0.38, 0.36) : door ? vec2(0.14, 0.36) : vec2(0.17, 0.27);
          vec2 c = vec2(fx - 0.5, fy - (door ? 0.40 : 0.48));
          vec2 aa = fwidth(vec2(vFace.x, g)) * 1.2;
          float lod = 1.0 - smoothstep(0.12, 0.35, max(aa.x, aa.y));
          float win = (1.0 - smoothstep(hs.x - aa.x, hs.x + aa.x, abs(c.x))) * (1.0 - smoothstep(hs.y - aa.y, hs.y + aa.y, abs(c.y))) * lod;
          // the windows come on from the street upward: nearest the runner's path first, floor by floor
          float order = d / 13.0 + h * 1.1 + fl * 0.18 + (shop ? 0.0 : 0.3);
          // most shops are shut at night: fewer ground-floor windows, and dimmer than the homes above
          float wOn = on * step(order, since) * step(h, shop ? 0.2 + 0.4 * strength : 0.3 + 0.65 * strength);
          float age = since - order;
          float flick = age < 0.3 ? step(0.45, fract(age * 18.0 + h)) : 1.0;
          float level = (0.75 + 0.5 * hash(vec2(h, 3.3))) * (shop ? 0.55 : 1.0);
          vec3 glow = shop ? vec3(1.0, 0.74, 0.40)
            : tv ? mix(vec3(0.45, 0.68, 1.0), vec3(0.85, 0.90, 1.0), hash(vec2(floor(uTime * 2.3) + h * 17.0, 1.0)))
            : cool ? vec3(0.80, 0.89, 1.0)
            : mix(vec3(1.0, 0.62, 0.27), vec3(1.0, 0.86, 0.56), hash(vec2(h, 9.1)));
          glow *= level;
          if (tv) glow *= 0.55 + 0.45 * hash(vec2(floor(uTime * 3.7) + h * 23.0, 2.0));
          float shade = curtain ? 0.45 + 0.55 * (1.0 - smoothstep(0.0, hs.x, abs(c.x))) : 1.0;   // light through a curtain
          float mull = (shop || door) ? 1.0 : 1.0 - (1.0 - smoothstep(0.01, 0.03, abs(c.x))) * 0.55;
          // a few windows are lit in the dark city too — someone is up
          float sleepless = step(0.965, h) * 0.5;
          vec3 off = mix(vec3(0.05, 0.07, 0.11), mix(vec3(1.0, 0.72, 0.40), vec3(0.50, 0.70, 1.0), step(0.5, hash(vec2(h, 5.5)))) * 0.9, sleepless);
          float light = wOn * flick;
          col = mix(col, mix(off, glow * 1.6 * mull * shade, light), win * 0.95);
          // light spills onto the wall around the window, strongest on the sill below it
          vec2 outside = max(abs(c) - hs, 0.0) * vec2(3.1, 3.3);
          float below = max(-c.y - hs.y, 0.0);
          float spill = exp(-length(outside) * (shop ? 1.3 : 2.0)) * 0.25 + exp(-below * 6.0) * (1.0 - smoothstep(hs.x, hs.x + 0.12, abs(c.x))) * step(0.001, below) * 0.4;
          col += glow * spill * (1.0 - win) * light * lod;
          col += glow * light * (1.0 - lod) * 0.35;
          // a neon sign above some shop fronts
          if (shop) {
            float sg = hash(vec2(cx * 7.7 + seed * 41.0, 2.5));
            if (sg > 0.72) {
              float sy = c.y - 0.36;
              float band = (1.0 - smoothstep(0.045 - aa.y, 0.045 + aa.y, abs(sy))) * (1.0 - smoothstep(0.42 - aa.x, 0.42 + aa.x, abs(c.x))) * lod;
              vec3 neon = sg > 0.93 ? vec3(0.98, 0.45, 0.55) : sg > 0.86 ? vec3(0.37, 0.65, 1.0) : sg > 0.79 ? vec3(1.0, 0.76, 0.26) : vec3(0.25, 0.86, 0.78);
              float signOn = on * step(order + 0.4, since);
              col = mix(col, neon * mix(0.12, 2.2, signOn), band * 0.9);
              col += neon * exp(-abs(sy) * 9.0) * signOn * 0.25 * lod;
            }
          }
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
          gl_FragColor = vec4(vec3(0.16, 0.85, 0.72), pow(1.0 - abs(vAcross), 2.4) * (0.18 + 0.5 * exp(-behind / 30.0))); }`,
    }),
    warm: new THREE.ShaderMaterial({
      ...additive, uniforms: U, vertexShader: ribbonVert,
      fragmentShader: `
        uniform float uHead; varying float vAlong; varying float vAcross;
        void main(){ float behind = uHead - vAlong; if (behind < 0.0) discard;
          gl_FragColor = vec4(vec3(1.0, 0.55, 0.22), pow(1.0 - abs(vAcross), 1.6) * smoothstep(4.0, 60.0, behind) * 0.16); }`,
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
    // the bulb: a small bright core (bloom draws the halo)
    lamp: new THREE.ShaderMaterial({
      ...additive, uniforms: U,
      vertexShader: `
        attribute float aT; attribute float aSeed; uniform float uTime, uRefW, uPxM, uPR; varying float vOn; varying float vRamp;
        ${WARMUP}
        void main(){
          float since = uTime - aT;
          vRamp = warmRamp(since);
          vOn = step(0.0, since) * warmFlick(since, aSeed) * (0.35 + 0.65 * vRamp);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 2.4 * ${sizeFromMetres};
        }`,
      fragmentShader: `
        varying float vOn; varying float vRamp;
        ${WARMUP}
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
          float core = 1.0 - smoothstep(0.0, 0.32, r), halo = pow(1.0 - r, 2.4);
          gl_FragColor = vec4(lampColour(vRamp) * (core * 1.8 + halo * 0.5), (core + halo * 0.5) * vOn); }`,
    }),
    // the post: dark metal under the moon, the lantern glass glowing when on, the top of the pole warmed by its own lamp
    post: new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: `
        attribute float aGlass; attribute float iT; attribute float iSeed; uniform float uTime;
        varying vec3 vN; varying float vW; varying float vGlass; varying float vOn; varying float vRamp; varying float vZ;
        ${WARMUP}
        void main(){
          float since = uTime - iT;
          vRamp = warmRamp(since);
          vOn = step(0.0, since) * warmFlick(since, iSeed) * (0.35 + 0.65 * vRamp);
          vGlass = aGlass; vZ = position.z;
          vN = normalize(mat3(instanceMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); vW = gl_Position.w; }`,
      fragmentShader: `${FOGFN} varying vec3 vN; varying float vW; varying float vGlass; varying float vOn; varying float vRamp; varying float vZ;
        ${WARMUP}
        void main(){
          vec3 n = normalize(vN); float moon = max(dot(n, ${MOON}), 0.0);
          vec3 col;
          if (vGlass > 0.5) col = mix(vec3(0.12, 0.14, 0.19) * (0.5 + moon), lampColour(vRamp) * 2.6, vOn);
          else col = vec3(0.10, 0.11, 0.14) * (0.45 + 0.9 * moon) + vec3(1.0, 0.70, 0.42) * vOn * exp(-abs(vZ - 4.5) * 1.3) * 0.8;
          gl_FragColor = vec4(fogged(col, vW), 1.0); }`,
    }),
    // the light cone under the lantern: brightest where you look through the most of it, fading to the ground
    cone: new THREE.ShaderMaterial({
      ...additive, uniforms: U, depthTest: true,
      vertexShader: `
        attribute float iT; attribute float iSeed; uniform float uTime;
        varying vec3 vN; varying vec3 vP; varying float vH; varying float vOn;
        ${WARMUP}
        void main(){
          float since = uTime - iT;
          vOn = step(0.0, since) * warmFlick(since, iSeed) * (0.35 + 0.65 * warmRamp(since));
          vH = clamp((position.z - 0.1) / 4.3, 0.0, 1.0);
          vec4 wp = instanceMatrix * vec4(position, 1.0); vP = wp.xyz;
          vN = normalize(mat3(instanceMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * wp; }`,
      fragmentShader: `
        varying vec3 vN; varying vec3 vP; varying float vH; varying float vOn;
        void main(){
          vec3 V = normalize(cameraPosition - vP);
          float cen = pow(abs(dot(normalize(vN), V)), 1.3);
          float fall = smoothstep(0.0, 0.1, vH) * pow(vH, 1.4) * (1.0 - smoothstep(0.93, 1.0, vH));
          float a = fall * (0.42 * cen + 0.08) * vOn;
          gl_FragColor = vec4(vec3(1.0, 0.68, 0.38), a); }`,
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
        void main(){ float r = length(vUV); if (r > 1.0) discard; gl_FragColor = vec4(vec3(1.0, 0.64, 0.32), (pow(1.0 - r, 2.2) * 0.6 + pow(1.0 - r, 7.0) * 0.4) * vOn); }`,
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
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(vec3(1.0, 0.6, 0.28), pow(1.0 - r, 2.6) * 0.07 * vOn); }`,
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
    // golden motes that rise from a facade the moment it lights
    mote: new THREE.ShaderMaterial({
      ...additive, uniforms: U,
      vertexShader: `
        attribute vec3 aVel; attribute float aBirth; attribute float aLife; attribute float aSize; attribute float aSeed;
        uniform float uTime, uRefW, uPxM, uPR; varying float vA;
        void main(){
          float age = uTime - aBirth, t = clamp(age / aLife, 0.0, 1.0);
          vA = (age < 0.0 || t >= 1.0) ? 0.0 : smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.55, 1.0, t));
          vec3 p = position + aVel * age + vec3(sin(age * 1.6 + aSeed * 6.3) * 0.35, cos(age * 1.1 + aSeed * 9.1) * 0.35, 0.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = vA <= 0.0 ? 0.0 : aSize * ${sizeFromMetres} * (0.7 + 0.3 * (1.0 - t));
        }`,
      fragmentShader: `varying float vA;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; float core = pow(1.0 - r, 1.6);
          gl_FragColor = vec4(vec3(1.0, 0.86, 0.55) * (0.8 + 0.6 * core), core * vA); }`,
    }),
    // red aviation beacons on the tallest buildings — on all night, lit city or not
    beacon: new THREE.ShaderMaterial({
      ...additive, uniforms: U,
      vertexShader: `
        attribute float aPhase; uniform float uTime, uRefW, uPxM, uPR; varying float vB;
        void main(){
          vB = smoothstep(0.3, 0.5, 0.5 + 0.5 * sin(uTime * 2.4 + aPhase * 6.2832));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.1 * ${sizeFromMetres}, 3.0 * uPR);
        }`,
      fragmentShader: `varying float vB;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard;
          float core = 1.0 - smoothstep(0.0, 0.35, r), halo = pow(1.0 - r, 2.5);
          gl_FragColor = vec4(vec3(1.0, 0.25, 0.2) * (core * 1.6 + halo * 0.6), (core + halo * 0.5) * (0.15 + 0.85 * vB)); }`,
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
          col += lit * (vec3(0.95, 0.52, 0.22) * 0.34 * (0.4 + under) + vec3(0.2, 0.9, 0.75) * 0.3 * exp(-vLit.z / 9.0));
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
// The street lamp: plinth, tapered pole, a short arm toward the street and a hanging hexagonal lantern.
// Local +y points at the path; aGlass marks the lantern glass for the shader.
const POST = (() => {
  const parts = [];
  const up = (g) => g.rotateX(Math.PI / 2);          // cylinder axis Y → Z
  const add = (g, glass) => { g.setAttribute('aGlass', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(glass), 1)); parts.push(g); };
  add(up(new THREE.CylinderGeometry(0.2, 0.27, 0.45, 8)).translate(0, 0, 0.225), 0);       // plinth
  add(up(new THREE.CylinderGeometry(0.055, 0.085, 4.55, 8)).translate(0, 0, 2.725), 0);    // pole, up to 5.0 m
  add(new THREE.SphereGeometry(0.1, 8, 6).translate(0, 0, 5.02), 0);                        // knob
  add(new THREE.CylinderGeometry(0.035, 0.045, 0.85, 6).translate(0, 0.42, 4.95), 0);       // the arm (axis Y = toward the street)
  add(up(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 5)).translate(0, 0.8, 4.84), 0);       // hanger
  add(up(new THREE.ConeGeometry(0.27, 0.2, 6)).translate(0, 0.8, 4.83), 0);                 // cap
  add(up(new THREE.CylinderGeometry(0.2, 0.17, 0.42, 6)).translate(0, 0.8, LANTERN_Z), 1);   // the glass
  add(up(new THREE.CylinderGeometry(0.17, 0.11, 0.07, 6)).translate(0, 0.8, 4.28), 0);       // lantern base
  return mergeGeometries(parts);
})();
// The light cone: open, from the lantern down to the ground (local z 4.4 → 0.1).
const CONE = new THREE.CylinderGeometry(0.22, 3.4, 4.3, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0.8, 2.25);

/**
 * createGlow({ mapboxgl, map, token, assetBase, hero, onLit, lite, bloom, adaptive, onQuality }) — call after the map's 'load'.
 * Returns { setTrail, setPaint, setRunner, setActivity, setHero, setRunnerVisible, setBloom, runner(), litCount(), dispose }.
 */
export function createGlow({ mapboxgl, map, token, assetBase = '', hero = 'm', onLit, lite = false, bloom = true, adaptive = true, onQuality }) {
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
  let postOn = bloom && !lite;

  // ---------- spatial index of lightable things (buildings, trees) and of walked points ----------
  const grid = new Map();             // cell → records
  const walkedTrail = new Map(), walkedPaint = new Map();   // cell → [x, y, ...] of this session / earlier walks
  const cellKey = (x, y) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL);
  const litKeys = new Set();          // buildings lit by this session's trail (the pill count)
  const ignitions = [];               // records whose light moment is still ahead (motes rise when it comes)
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
  // The stretch of trail nearest a building is its street light (the shader lights the facade from there).
  function writeSeg(rec) {
    const s = rec.seg;
    for (const r of rec.segRanges) {
      const a = r.attr.array;
      for (let i = r.start; i < r.start + r.count; i++) { a[i * 4] = s[0]; a[i * 4 + 1] = s[1]; a[i * 4 + 2] = s[2]; a[i * 4 + 3] = s[3]; }
      r.attr.addUpdateRange(r.start * 4, r.count * 4);
      r.attr.needsUpdate = true;
    }
    rec.segWritten = [s[2], s[3]];
  }
  function touchSeg(rec, px, py) {
    if (!rec.segRanges || px == null) return;
    let s = rec.seg, fresh = false;
    if (!s || Math.hypot(px - s[2], py - s[3]) > 40) { s = rec.seg = [px, py, px, py]; fresh = true; }
    else {
      s[2] = px; s[3] = py;
      const L = Math.hypot(s[2] - s[0], s[3] - s[1]);
      if (L > SEG_MAX) { s[0] = s[2] - ((s[2] - s[0]) * SEG_MAX) / L; s[1] = s[3] - ((s[3] - s[1]) * SEG_MAX) / L; }
    }
    const w = rec.segWritten;
    if (fresh || !w || Math.hypot(s[2] - w[0], s[3] - w[1]) > 2) writeSeg(rec);
  }
  function light(rec, time, d, fromTrail, px, py) {
    const strength = 1 - smooth(rec.tree ? 10 : 14, rec.tree ? 60 : LIGHT_R, d);
    if (fromTrail && rec.key && strength > 0.25 && !litKeys.has(rec.key)) { litKeys.add(rec.key); litDirty = true; }
    if (strength <= 0.02) return;
    touchSeg(rec, px, py);
    if (strength <= rec.strength + 0.08) return;
    if (rec.strength <= 0) { rec.time = time; if (time > ALWAYS + 1 && ignitions.length < 600) ignitions.push(rec); }
    rec.strength = strength; rec.dist = Math.min(rec.dist ?? 1e9, d);
    writeLit(rec);
  }
  function lightAround(x, y, time, fromTrail, instant) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), span = Math.ceil(LIGHT_R / CELL);
    for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) {
      const list = grid.get(cx + i + ',' + (cy + j));
      if (!list) continue;
      for (const rec of list) { const d = recDist(rec, x, y); if (d < LIGHT_R) light(rec, instant ? ALWAYS : time + d / WAVE, d, fromTrail, x, y); }
    }
  }
  function addWalked(store, x, y) { const k = cellKey(x, y); if (!store.has(k)) store.set(k, []); store.get(k).push(x, y); }
  function nearestWalked(store, rec) {
    const cx = Math.floor(rec.cx / CELL), cy = Math.floor(rec.cy / CELL), span = Math.ceil(LIGHT_R / CELL);
    const best = { d: 1e9, x: 0, y: 0 };
    for (let i = -span; i <= span; i++) for (let j = -span; j <= span; j++) {
      const p = store.get(cx + i + ',' + (cy + j));
      if (p) for (let k = 0; k < p.length; k += 2) { const d = recDist(rec, p[k], p[k + 1]); if (d < best.d) { best.d = d; best.x = p[k]; best.y = p[k + 1]; } }
    }
    return best;
  }
  function lightFromHistory(rec) {      // a tile arriving after we walked there lights at once
    const t = nearestWalked(walkedTrail, rec), p = nearestWalked(walkedPaint, rec);
    if (t.d < LIGHT_R) light(rec, ALWAYS, t.d, true, t.x, t.y);
    if (p.d < LIGHT_R) light(rec, ALWAYS, p.d, false, p.x, p.y);
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
    // buildings (+ a spill pool and a haze point each, a beacon on the tall ones)
    if (tile.layers.building) {
      const layer = tile.layers.building;
      const P = [], N = [], F = [], B = [], idx = [], owners = [];
      const poolP = [], poolUV = [], poolC = [], poolIdx = [], hazeP = [], hazeS = [], beaconP = [], beaconPh = [];
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
          if (h >= BEACON_H) { beaconP.push(cx, cy, h + 1.2); beaconPh.push(seed); }
          owners.push({ key: f.id != null ? 'id' + f.id : null, cx, cy, pts, h, first, count: n - first, pool, haze: hazeS.length - 1 });
        }
      }
      if (n) {
        const geo = new THREE.BufferGeometry();
        const lit = new THREE.Float32BufferAttribute(new Float32Array(n * 2).map((_, i) => (i % 2 ? 0 : NEVER)), 2);
        lit.setUsage(THREE.DynamicDrawUsage);
        const seg = new THREE.Float32BufferAttribute(new Float32Array(n * 4), 4);
        seg.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        geo.setAttribute('aFace', new THREE.Float32BufferAttribute(F, 3));
        geo.setAttribute('aBld', new THREE.Float32BufferAttribute(B, 2));
        geo.setAttribute('aLit', lit);
        geo.setAttribute('aSeg', seg);
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
        if (beaconP.length) {
          const bg = new THREE.BufferGeometry();
          bg.setAttribute('position', new THREE.Float32BufferAttribute(beaconP, 3));
          bg.setAttribute('aPhase', new THREE.Float32BufferAttribute(beaconPh, 1));
          const bp = new THREE.Points(bg, M.beacon); bp.renderOrder = 9; bp.frustumCulled = false; g.add(bp);
        }
        for (const o of owners) {
          const ranges = [{ attr: lit, start: o.first, count: o.count }, { attr: plit, start: o.pool, count: 4 }];
          if (hlit) ranges.push({ attr: hlit, start: o.haze, count: 1 });
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (let k = 0; k < o.pts.length; k += 2) { x0 = Math.min(x0, o.pts[k]); x1 = Math.max(x1, o.pts[k]); y0 = Math.min(y0, o.pts[k + 1]); y1 = Math.max(y1, o.pts[k + 1]); }
          recs.push({ key: o.key, cx: o.cx, cy: o.cy, pts: o.pts, h: o.h, bb: [x0, y0, x1, y1], strength: 0, time: NEVER, ranges, segRanges: [{ attr: seg, start: o.first, count: o.count }], seg: null, segWritten: null });
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

  // Lamps: preallocated, filled as the trail grows. Each lamp = bulb sprite + post + light cone + ground pool.
  const lampGeo = new THREE.BufferGeometry();
  lampGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS * 3), 3));
  lampGeo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS).fill(NEVER), 1));
  lampGeo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS).map((_, i) => hash1(i)), 1));
  lampGeo.setDrawRange(0, 0);
  const lamps = new THREE.Points(lampGeo, M.lamp); lamps.renderOrder = 8; lamps.frustumCulled = false; scene.add(lamps);
  const instancedTimes = (geo) => {
    const g = geo.clone();
    const iT = new THREE.InstancedBufferAttribute(new Float32Array(MAX_LAMPS).fill(NEVER), 1); iT.setUsage(THREE.DynamicDrawUsage);
    const iSeed = new THREE.InstancedBufferAttribute(new Float32Array(MAX_LAMPS).map((_, i) => hash1(i + 7)), 1);
    g.setAttribute('iT', iT); g.setAttribute('iSeed', iSeed);
    return g;
  };
  const postGeo = instancedTimes(POST), coneGeo = instancedTimes(CONE);
  const posts = new THREE.InstancedMesh(postGeo, M.post, MAX_LAMPS); posts.count = 0; posts.renderOrder = 1; posts.frustumCulled = false; scene.add(posts);
  const cones = new THREE.InstancedMesh(coneGeo, M.cone, MAX_LAMPS); cones.count = 0; cones.renderOrder = 3; cones.frustumCulled = false; scene.add(cones);
  const lampPoolGeo = new THREE.BufferGeometry();
  lampPoolGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS * 12), 3));
  lampPoolGeo.setAttribute('aUV', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS * 8), 2));
  lampPoolGeo.setAttribute('aC', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS * 12), 3));
  lampPoolGeo.setAttribute('aLit', new THREE.BufferAttribute(new Float32Array(MAX_LAMPS * 8).map((_, i) => (i % 2 ? 0 : NEVER)), 2));
  lampPoolGeo.setIndex(Array.from({ length: MAX_LAMPS * 6 }, (_, i) => { const q = Math.floor(i / 6) * 4; return q + [0, 1, 2, 0, 2, 3][i % 6]; }));
  lampPoolGeo.setDrawRange(0, 0);
  const lampPools = new THREE.Mesh(lampPoolGeo, M.pool); lampPools.renderOrder = 2; lampPools.frustumCulled = false; scene.add(lampPools);
  const tmpM = new THREE.Matrix4();
  /** A lamp at (x, y); (ax, ay) is the unit direction from the post to the path — the arm and lantern reach that way. */
  function addLamp(x, y, t, ax, ay) {
    const i = trail.lampCount++;
    const lx = x + ax * 0.8, ly = y + ay * 0.8;                 // the lantern hangs at the end of the arm
    lampGeo.attributes.position.setXYZ(i, lx, ly, LANTERN_Z); lampGeo.attributes.aT.setX(i, t);
    lampGeo.attributes.position.needsUpdate = lampGeo.attributes.aT.needsUpdate = true;
    lampGeo.setDrawRange(0, trail.lampCount);
    tmpM.makeRotationZ(Math.atan2(-ax, ay)).setPosition(x, y, 0);  // local +y → (ax, ay)
    posts.setMatrixAt(i, tmpM); posts.count = trail.lampCount; posts.instanceMatrix.needsUpdate = true;
    cones.setMatrixAt(i, tmpM); cones.count = trail.lampCount; cones.instanceMatrix.needsUpdate = true;
    postGeo.attributes.iT.setX(i, t); postGeo.attributes.iT.needsUpdate = true;
    coneGeo.attributes.iT.setX(i, t); coneGeo.attributes.iT.needsUpdate = true;
    const P = lampPoolGeo.attributes.position, UV = lampPoolGeo.attributes.aUV, C = lampPoolGeo.attributes.aC, LT = lampPoolGeo.attributes.aLit, R = 8;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], k) => { P.setXYZ(i * 4 + k, lx + u * R, ly + v * R, 0.15); UV.setXY(i * 4 + k, u, v); C.setXYZ(i * 4 + k, lx, ly, 0.15); LT.setXY(i * 4 + k, t, 0.36); });
    P.needsUpdate = UV.needsUpdate = C.needsUpdate = LT.needsUpdate = true;
    lampPoolGeo.setDrawRange(0, trail.lampCount * 6);
  }
  function clearLamps() { trail.lampCount = 0; trail.lampNext = 12; lampGeo.setDrawRange(0, 0); posts.count = 0; cones.count = 0; lampPoolGeo.setDrawRange(0, 0); }

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
      for (const rec of list) { const d = recDist(rec, x, y); if (d < LIGHT_R) light(rec, t + d / WAVE, d, true, x, y); }
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

  // ---------- sparks, motes and the heartbeat ring ----------
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
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
  moteGeo.setAttribute('aVel', new THREE.BufferAttribute(new Float32Array(MOTES * 3), 3));
  moteGeo.setAttribute('aBirth', new THREE.BufferAttribute(new Float32Array(MOTES).fill(-99), 1));
  moteGeo.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(MOTES).fill(1), 1));
  moteGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MOTES), 1));
  moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(MOTES), 1));
  const motes = new THREE.Points(moteGeo, M.mote); motes.renderOrder = 9; motes.frustumCulled = false; scene.add(motes);
  let moteNext = 0;
  function emitMotes(x, y, zMax, n, spread) {
    const P = moteGeo.attributes.position, V = moteGeo.attributes.aVel, B = moteGeo.attributes.aBirth, L = moteGeo.attributes.aLife, SZ = moteGeo.attributes.aSize, SD = moteGeo.attributes.aSeed;
    for (let i = 0; i < n; i++) {
      const k = moteNext; moteNext = (moteNext + 1) % MOTES;
      P.setXYZ(k, x + (Math.random() - 0.5) * spread * 2, y + (Math.random() - 0.5) * spread * 2, 0.6 + Math.random() * zMax);
      V.setXYZ(k, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.7);
      B.setX(k, now() + Math.random() * 0.8); L.setX(k, 3 + Math.random() * 2.5); SZ.setX(k, 0.22 + Math.random() * 0.22); SD.setX(k, Math.random());
    }
    P.needsUpdate = V.needsUpdate = B.needsUpdate = L.needsUpdate = SZ.needsUpdate = SD.needsUpdate = true;
  }
  /** The moment a building lights: a handful of golden motes rise from the facade nearest the trail. */
  function ignite(rec) {
    if (rec.tree) { emitMotes(rec.cx, rec.cy, 3.5, 2, 1.5); return; }
    let lx = rec.cx, ly = rec.cy;
    const s = rec.seg;
    if (s) {
      const bx = s[2] - s[0], by = s[3] - s[1], bb = bx * bx + by * by || 1e-3, t = clamp(((rec.cx - s[0]) * bx + (rec.cy - s[1]) * by) / bb, 0, 1);
      lx = s[0] + bx * t; ly = s[1] + by * t;
    }
    emitMotes(lx + (rec.cx - lx) * 0.6, ly + (rec.cy - ly) * 0.6, Math.min(rec.h, 9), 5 + Math.min(6, Math.floor(rec.h / 6)), 4);
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

  // ---------- post: bloom, a soft shoulder and a vignette on the finished frame ----------
  // The frame (Mapbox ground + the 3D city) is copied once; the lights are kept by a soft threshold, blurred at
  // 1/4 and 1/8 size and added back. One full-screen pass writes the result — no second geometry pass.
  function createPost(renderer) {
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const mk = (fs, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: fs, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
    const bright = mk(`uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
               + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
        c *= 0.25;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        gl_FragColor = vec4(c * smoothstep(0.55, 0.95, l), 1.0); }`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    const blur = mk(`uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
        c += (texture2D(tSrc, vUv + uDir * 1.3846153846).rgb + texture2D(tSrc, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
        c += (texture2D(tSrc, vUv + uDir * 3.2307692308).rgb + texture2D(tSrc, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
        gl_FragColor = vec4(c, 1.0); }`, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    const composite = mk(`uniform sampler2D tFrame; uniform sampler2D tB1; uniform sampler2D tB2; uniform float uBloom; uniform float uVignette; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tFrame, vUv).rgb;
        vec3 b = texture2D(tB1, vUv).rgb * 0.55 + texture2D(tB2, vUv).rgb * 0.45;
        c += b * vec3(1.0, 0.95, 0.88) * uBloom;
        c = c / (1.0 + max(c - 0.85, 0.0) * 1.6);
        float vig = smoothstep(1.35, 0.35, length((vUv - 0.5) * vec2(1.0, 1.15)) * 1.7);
        c *= mix(1.0 - uVignette, 1.0, vig);
        gl_FragColor = vec4(c, 1.0); }`, { tFrame: { value: null }, tB1: { value: null }, tB2: { value: null }, uBloom: { value: 1.0 }, uVignette: { value: 0.18 } });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bright); quad.frustumCulled = false;
    const qs = new THREE.Scene(); qs.add(quad);
    const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const rt = () => new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
    const p = { w: 0, h: 0, frame: null, a4: rt(), b4: rt(), a8: rt(), b8: rt(), d4: [1, 1], d8: [1, 1], composite };
    function resize(w, h) {
      p.w = w; p.h = h;
      if (p.frame) p.frame.dispose();
      p.frame = new THREE.FramebufferTexture(w, h); p.frame.minFilter = p.frame.magFilter = THREE.LinearFilter;
      p.d4 = [Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4))]; p.d8 = [Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 8))];
      p.a4.setSize(p.d4[0], p.d4[1]); p.b4.setSize(p.d4[0], p.d4[1]); p.a8.setSize(p.d8[0], p.d8[1]); p.b8.setSize(p.d8[0], p.d8[1]);
    }
    function pass(mat, src, dst, dir) { quad.material = mat; mat.uniforms.tSrc.value = src; if (dir) mat.uniforms.uDir.value.set(dir[0], dir[1]); renderer.setRenderTarget(dst); renderer.render(qs, qc); }
    // The first frames are checked: a GL error on the copy, or a black centre pixel after the composite
    // (the ground is never black), means this WebView cannot do the pass — it is switched off for good.
    let checks = 0, black = 0;
    const px = new Uint8Array(4);
    p.verify = (gl) => {
      if (checks >= 20) return true;
      checks++;
      if (gl.getError() !== gl.NO_ERROR) return false;
      gl.readPixels(Math.floor(p.w / 2), Math.floor(p.h / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      black = px[0] + px[1] + px[2] === 0 ? black + 1 : 0;
      return black < 4;
    };
    p.run = (gl) => {
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      if (w !== p.w || h !== p.h) resize(w, h);
      const fbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      renderer.copyFramebufferToTexture(p.frame);
      bright.uniforms.uTexel.value.set(1 / w, 1 / h);
      pass(bright, p.frame, p.a4);
      pass(blur, p.a4.texture, p.b4, [1 / p.d4[0], 0]);
      pass(blur, p.b4.texture, p.a4, [0, 1 / p.d4[1]]);
      pass(blur, p.a4.texture, p.b8, [1 / p.d8[0], 0]);
      pass(blur, p.b8.texture, p.a8, [0, 1 / p.d8[1]]);
      renderer.setRenderTarget(null);
      if (fbo) gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);     // Mapbox may be drawing into its own framebuffer
      renderer.setViewport(0, 0, w, h);
      quad.material = composite;
      composite.uniforms.tFrame.value = p.frame; composite.uniforms.tB1.value = p.a4.texture; composite.uniforms.tB2.value = p.a8.texture;
      renderer.render(qs, qc);
    };
    p.dispose = () => { for (const r of [p.a4, p.b4, p.a8, p.b8]) r.dispose(); if (p.frame) p.frame.dispose(); };
    return p;
  }

  // ---------- render ----------
  const P = new THREE.Matrix4(), PI = new THREE.Matrix4(), TC = new THREE.Matrix4(), EYE = new THREE.Vector4();
  let renderer = null, post = null, disposed = false, litDirty = false, lastLit = -1, raf = 0, last = performance.now(), streamAt = 0;
  let frameEma = 16, slowSince = 0;
  map.addLayer({
    id: 'medirun-glow', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) { renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true }); renderer.autoClear = false; post = createPost(renderer); },
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
      renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.render(scene, camera);
      if (postOn && post) {
        try {
          post.run(gl);
          if (!post.verify(gl)) { postOn = false; if (onQuality) onQuality('lite', 'post pass unverified'); }
        } catch (err) { postOn = false; if (onQuality) onQuality('lite', err); }
      }
      map.triggerRepaint();
    },
  });

  function tick(nowMs) {
    if (disposed) return;
    const dt = Math.min(0.1, (nowMs - last) / 1000);
    frameEma += ((nowMs - last) - frameEma) * 0.08;
    last = nowMs;
    U.uTime.value += dt;
    // A phone that cannot hold the frame rate drops the post pass for good (the city itself stays).
    if (adaptive && postOn) {
      if (frameEma > 30) { if (!slowSince) slowSince = nowMs; else if (nowMs - slowSince > 3000) { postOn = false; if (onQuality) onQuality('lite'); } }
      else slowSince = 0;
    }
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
      if (moving && runner.visible) { sparkDebt += dt * (activity === 'run' ? 30 + 10 * v : 10); const n = Math.floor(sparkDebt); sparkDebt -= n; if (n) emitSparks(n, x, y); }
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
      // a street lamp every 26 m, switched on as the runner reaches it; it stands on the pavement, never in a wall
      while (trail.path && trail.lampNext < trail.head && trail.lampCount < MAX_LAMPS) {
        const p = sampleAt(trail.path, trail.lampNext), q = sampleAt(trail.path, trail.lampNext + 2), len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        const nx = -(q.y - p.y) / len, ny = (q.x - p.x) / len;
        const side = trail.lampCount % 2 ? 1 : -1;
        for (const s of [side, -side]) {
          const lx = p.x + nx * LAMP_SIDE * s, ly = p.y + ny * LAMP_SIDE * s;
          if (insideBuilding(lx, ly)) continue;
          addLamp(lx, ly, now(), -nx * s, -ny * s);
          break;
        }
        trail.lampNext += LAMP_EVERY;
      }
    }
    // buildings whose light moment has come: golden motes rise from the facade
    if (ignitions.length) {
      const t = now();
      for (let i = ignitions.length - 1; i >= 0; i--) {
        const rec = ignitions[i];
        if (rec.time <= t) { ignitions[i] = ignitions[ignitions.length - 1]; ignitions.pop(); ignite(rec); }
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
    /** The post pass (bloom + vignette) on or off; `strength` scales the bloom. */
    setBloom(on, strength) { postOn = Boolean(on) && !lite; if (post && typeof strength === 'number') post.composite.uniforms.uBloom.value = strength; },
    quality: () => (postOn ? 'full' : 'lite'),
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
    debug: { THREE, scene, camera, U, tiles, heroes, runner, grid, insideBuilding, toLngLat, post: () => post },
    dispose() { disposed = true; cancelAnimationFrame(raf); if (post) post.dispose(); try { map.removeLayer('medirun-glow'); } catch { /* map already gone */ } },
  };
}
