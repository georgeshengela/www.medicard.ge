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
// Water (2026-10-05): every river, canal and lake is one surface — moving waves, the night sky and the moon's track
// reflected at a glancing angle, and the lit city on the water: each nearby lit building, lamp, bridge and landmark
// leaves a shimmering path along the waves (up to WATER_LIGHTS of them). Rivers Mapbox only has as lines get the
// same water as ribbons.
// City detail (2026-10-05): bridges rise from the river (Mapbox `structure: bridge`, every city) with fascia, piers,
// parapets and lamps that come on in a wave; the trail and the runner climb onto the deck. Where a detail tile exists
// (OSM, detail/build-detail.mjs → server/public/medirun/glow/detail/), roof shapes replace flat caps by OSM way id
// (domes, onions, cones, pyramids, hipped and gabled roofs; churches in stone, floodlit), and monuments, fountains,
// city walls and lattice towers stand where OSM puts them — dark under the moon, floodlit once the runner passes.
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
const WATER_LIGHTS = 24;

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
  const roadFilter = ['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get', 'structure'], 'bridge'], ['!', ['match', ['get', 'class'], ['major_rail', 'minor_rail', 'service_rail', 'ferry', 'aerialway', 'golf', 'construction'], true, false]]];
  return {
    version: 8,
    glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    sources: { streets: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' } },
    fog: { range: [1.2, 7], color: '#121926', 'high-color': '#0D1421', 'horizon-blend': 0.12, 'space-color': '#0B111C', 'star-intensity': 0 },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#111723' } },
      { id: 'green', type: 'fill', source: 'streets', 'source-layer': 'landuse', filter: ['match', ['get', 'class'], ['park', 'grass', 'wood', 'scrub', 'cemetery', 'pitch'], true, false], paint: { 'fill-color': '#15211D' } },
      { id: 'water', type: 'fill', source: 'streets', 'source-layer': 'water', paint: { 'fill-color': '#0A1322' } },
      {
        id: 'waterway', type: 'line', source: 'streets', 'source-layer': 'waterway',
        filter: ['match', ['get', 'class'], ['river', 'canal', 'stream', 'stream_intermittent', 'drain', 'ditch'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0A1322', 'line-width': ['interpolate', ['exponential', 1.7], ['zoom'], 13, ['match', ['get', 'class'], ['river', 'canal'], 2, 0.8], 18, ['match', ['get', 'class'], ['river', 'canal'], 44, ['stream', 'stream_intermittent'], 14, 8]] },
      },
      { id: 'water-edge', type: 'line', source: 'streets', 'source-layer': 'water', paint: { 'line-color': '#2A3A55', 'line-width': 0.8, 'line-blur': 0.8, 'line-opacity': 0.7 } },
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
      { id: 'footprints', type: 'fill', source: 'streets', 'source-layer': 'building', filter: ['!=', ['get', 'type'], 'roof'], paint: { 'fill-color': '#151C28' } },
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
      attribute vec3 aFace; attribute vec2 aLit; attribute vec4 aSeg; attribute vec2 aBld; attribute vec4 aRoof;
      varying vec3 vN; varying vec3 vFace; varying vec2 vLit; varying vec4 vSeg; varying vec2 vBld; varying float vW; varying vec3 vPos; varying vec4 vRoof;
      void main(){
        vN = normal; vFace = aFace; vLit = aLit; vSeg = aSeg; vBld = aBld; vPos = position; vRoof = aRoof;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vW = gl_Position.w;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uRunner; uniform float uCut;
      ${FOGFN}
      varying vec3 vN; varying vec3 vFace; varying vec2 vLit; varying vec4 vSeg; varying vec2 vBld; varying float vW; varying vec3 vPos; varying vec4 vRoof;
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
        vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
        float roof = vFace.z, v = vFace.y, seed = vBld.x, top = vBld.y, strength = vLit.y;
        bool shaped = roof > 1.5, mark = vRoof.w > 0.5;   // a pitched / domed roof · a church or landmark
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

        vec3 albedo = mark ? vec3(0.82, 0.77, 0.66) * (0.92 + 0.12 * hash(vec2(seed, 4.4))) : plaster(seed);
        vec3 sky = vec3(0.16, 0.20, 0.29) * (0.5 + 0.6 * moon);
        bool metal = false;
        if (shaped) {
          // OSM roof colour when tagged; otherwise grey-green stone on churches, red tin on houses
          albedo = dot(vRoof.rgb, vec3(1.0)) > 0.0 ? vRoof.rgb : mark ? vec3(0.44, 0.50, 0.47) : vec3(0.60, 0.31, 0.23);
          metal = vRoof.r > 0.6 && vRoof.b < 0.45 && vRoof.r - vRoof.b > 0.3;
          sky *= 1.2;
        } else if (roof > 0.5) { sky *= 1.35; albedo = mix(albedo, vec3(0.62, 0.64, 0.70), 0.6); }
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
        // landmarks are floodlit from the ground: bright at the foot of the wall, the light climbing the drum and dome
        if (mark && !shaped && roof < 0.5) col += albedo * vec3(1.0, 0.86, 0.66) * lit * (0.16 + 0.55 * exp(-v / 14.0));
        if (shaped) {
          col += albedo * vec3(1.0, 0.84, 0.62) * lit * (mark ? 0.75 : 0.28) * (0.55 + 0.45 * (1.0 - n.z));
          if (metal) { vec3 V = normalize(cameraPosition - vPos); float rim = pow(1.0 - abs(dot(n, V)), 2.0);
            col += vec3(1.0, 0.78, 0.36) * (0.12 * moon + lit * (0.55 + 0.9 * rim)); }
        }
        if (roof < 0.5 && v > top - 0.5) col *= 1.0 + 0.3 * lit;              // the cornice catches the light
        col += vec3(1.0, 0.62, 0.3) * on * exp(-max(since, 0.0) * 2.4) * 0.4;  // the ignition flash
        if (roof > 0.5 && !shaped && hash(floor(vPos.xy / 2.5) + seed) > 0.94) col *= 0.86;   // roof clutter (vents, skylights)

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
    // Night water: waves (five directional trains, the fine ones fade out with distance so they never shimmer as
    // noise), the sky and the moon reflected by fresnel, and the lit city's glitter paths along the waves.
    water: new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: 'varying vec3 vP; varying float vW; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }',
      fragmentShader: `
        uniform float uTime; uniform vec4 uWL[${WATER_LIGHTS}]; uniform vec3 uWC[${WATER_LIGHTS}]; uniform int uWN;
        ${FOGFN}
        varying vec3 vP; varying float vW;
        vec2 wave(vec2 p, vec2 d, float k, float w, float a, float px){ return d * k * a * cos(dot(d, p) * k + uTime * w) * (1.0 - smoothstep(0.5, 1.8, px * k)); }
        void main(){
          float px = length(fwidth(vP.xy));
          vec2 g = wave(vP.xy, vec2(0.94, 0.33), 0.9, 1.3, 0.06, px) + wave(vP.xy, vec2(-0.51, 0.86), 1.7, 1.9, 0.035, px)
                 + wave(vP.xy, vec2(0.2, -0.98), 3.1, 2.7, 0.02, px) + wave(vP.xy, vec2(-0.96, -0.29), 5.3, 3.6, 0.012, px)
                 + wave(vP.xy, vec2(0.66, 0.75), 9.7, 5.0, 0.006, px);
          vec3 N = normalize(vec3(-g * 1.6, 1.0));
          vec3 V = normalize(vP - cameraPosition);
          vec3 R = reflect(V, N);
          float fres = 0.03 + 0.97 * pow(1.0 - clamp(dot(-V, N), 0.0, 1.0), 5.0);
          // the night sky in the water: the city's haze near the horizon, dark overhead
          vec3 sky = mix(vec3(0.16, 0.16, 0.21), vec3(0.035, 0.05, 0.09), smoothstep(0.0, 0.5, R.z));
          vec3 col = mix(vec3(0.012, 0.024, 0.045), sky, fres);
          float mr = max(dot(R, ${MOON}), 0.0);
          col += vec3(0.75, 0.82, 1.0) * (pow(mr, 400.0) * 1.4 + pow(mr, 30.0) * 0.04);
          // Each light lays a streak on the water from the shore toward the viewer, widening with distance and
          // broken up by the waves that face the light; the water only shows where it is (the streak starts at the shore).
          vec3 lights = vec3(0.0);
          for (int i = 0; i < ${WATER_LIGHTS}; i++) {
            if (i >= uWN) break;
            vec2 lg = uWL[i].xy, toCam = cameraPosition.xy - lg;
            float lc = length(toCam);
            if (lc < 1.0) continue;
            vec2 dir = toCam / lc, rel = vP.xy - lg;
            float along = dot(rel, dir), across = dot(rel, vec2(-dir.y, dir.x));
            if (along < 0.0) continue;
            float wid = 1.0 + along * 0.03 + uWL[i].z * 0.05, len = 16.0 + uWL[i].z * 5.0;
            float band = exp(-across * across / (wid * wid)) * exp(-along / len);
            float broken = smoothstep(0.15, 0.85, 0.45 + 4.5 * dot(g, dir));
            lights += uWC[i] * uWL[i].w * band * broken;
          }
          col += lights * 1.1;
          gl_FragColor = vec4(fogged(col, vW), 1.0);
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
    // bridges: deck (0), stone fascia and piers (1, aM.y = 0 bottom → 1 top of the fascia), metal parapets and posts (2)
    deck: new THREE.ShaderMaterial({
      uniforms: U, side: THREE.DoubleSide,
      vertexShader: `
        attribute vec2 aLit; attribute vec3 aM; varying vec3 vN; varying vec2 vLit; varying vec3 vM; varying float vW;
        void main(){ vN = normal; vLit = aLit; vM = aM; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }`,
      fragmentShader: `
        uniform float uTime; ${FOGFN}
        varying vec3 vN; varying vec2 vLit; varying vec3 vM; varying float vW;
        void main(){
          vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
          float since = uTime - vLit.x, lit = step(0.0, since) * vLit.y * smoothstep(0.0, 1.4, since);
          float moon = max(dot(n, ${MOON}), 0.0), m = vM.x, h = vM.y, s = vM.z;
          vec3 base = m < 0.5 ? vec3(0.24, 0.26, 0.31) : m < 1.5 ? vec3(0.62, 0.58, 0.52) : vec3(0.12, 0.13, 0.16);
          vec3 col = base * vec3(0.16, 0.20, 0.29) * (0.6 + 0.8 * moon);
          vec3 warm = vec3(1.0, 0.72, 0.44);
          if (m < 0.5) {            // the deck: pools of lamplight every 20 m
            float d = mod(s, 20.0) - 10.0;
            col += base * warm * lit * (0.35 + 1.6 * exp(-d * d / 22.0));
          } else if (m < 1.5) {     // stone: washed from below, an LED line along the top of the fascia
            col += base * warm * lit * (0.25 + 0.75 * exp(-h * 2.0));
            col += vec3(0.35, 0.95, 0.84) * lit * smoothstep(0.86, 0.97, h) * (1.0 - step(1.5, h)) * 1.3;
          } else col += base * warm * lit * 0.6 + warm * lit * 0.05;
          gl_FragColor = vec4(fogged(col, vW), 1.0);
        }`,
    }),
    // monuments, fountains, walls, towers: 0 stone · 1 bronze · 2 gold · 3 lattice steel · 4 water; aM.y = height within the object 0 → 1
    mon: new THREE.ShaderMaterial({
      uniforms: U, side: THREE.DoubleSide,
      vertexShader: `
        attribute vec2 aLit; attribute vec2 aM; varying vec3 vN; varying vec2 vLit; varying vec2 vM; varying float vW; varying vec3 vPos;
        void main(){ vN = normal; vLit = aLit; vM = aM; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }`,
      fragmentShader: `
        uniform float uTime; ${FOGFN}
        varying vec3 vN; varying vec2 vLit; varying vec2 vM; varying float vW; varying vec3 vPos;
        void main(){
          vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
          float since = uTime - vLit.x, lit = step(0.0, since) * vLit.y * smoothstep(0.0, 1.8, since);
          float moon = max(dot(n, ${MOON}), 0.0), m = vM.x, h = vM.y;
          vec3 V = normalize(cameraPosition - vPos);
          float rim = pow(1.0 - abs(dot(n, V)), 2.4);
          vec3 base = m < 0.5 ? vec3(0.80, 0.76, 0.68) : m < 1.5 ? vec3(0.34, 0.25, 0.16) : m < 2.5 ? vec3(0.88, 0.68, 0.28) : m < 3.5 ? vec3(0.13, 0.14, 0.17) : vec3(0.10, 0.17, 0.24);
          vec3 col = base * vec3(0.16, 0.20, 0.29) * (0.55 + 0.8 * moon) + base * rim * 0.06;
          float flood = 0.22 + 0.72 * exp(-h * 2.4);     // floodlights stand on the ground and shine up
          vec3 warm = vec3(1.0, 0.85, 0.64);
          if (m < 0.5) col += base * warm * flood * lit;
          else if (m < 1.5) col += base * warm * flood * lit * 1.5 + vec3(1.0, 0.72, 0.42) * rim * lit * 0.55;
          else if (m < 2.5) col += vec3(1.0, 0.78, 0.36) * (0.10 * moon + lit * (0.45 + 1.1 * rim));
          else if (m < 3.5) {     // the tower's LED lattice: a slow wave of light climbing the steel
            float wave = 0.55 + 0.45 * sin(h * 26.0 - uTime * 1.6);
            col = mix(col, mix(vec3(0.30, 0.92, 0.82), vec3(0.95, 0.98, 1.0), wave * 0.5) * (0.6 + 0.8 * wave), lit * 0.92);
          } else col += vec3(0.32, 0.85, 0.95) * lit * (0.45 + 0.35 * sin(uTime * 2.2 + vPos.x * 1.3 + vPos.y * 0.9));
          gl_FragColor = vec4(fogged(col, vW), 1.0);
        }`,
    }),
    // MEDIRUN lamps on a landmark: always on, teal with mint waves climbing (faster while running) and a bright
    // ring rising every few seconds; each lamp twinkles a little on its own
    towerLed: new THREE.ShaderMaterial({
      ...additive, uniforms: U,
      vertexShader: `
        attribute float aH; attribute float aSeed; uniform float uTime, uRun, uRefW, uPxM, uPR; varying vec3 vC; varying float vA;
        void main(){
          float wave = pow(0.5 + 0.5 * sin(aH * 30.0 - uTime * (1.4 + 1.6 * uRun)), 4.0);
          float ring = 1.0 - smoothstep(0.0, 0.03, abs(fract(uTime * 0.11) - aH));
          float tw = 0.75 + 0.25 * sin(uTime * (1.5 + 2.0 * aSeed) + aSeed * 40.0);
          vC = mix(vec3(0.08, 0.78, 0.68), vec3(0.55, 1.0, 0.90), wave) * (0.7 + 0.8 * wave + 1.6 * ring) * tw;
          vA = 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          // never smaller than a few pixels: the tower is seen from across the city
          gl_PointSize = clamp(3.0 * ${sizeFromMetres}, 7.0 * uPR, 24.0 * uPR);
        }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; float core = 1.0 - smoothstep(0.15, 0.55, r), halo = pow(1.0 - r, 2.0);
          gl_FragColor = vec4(vC * (core * 1.6 + halo * 0.6), (core + halo * 0.6) * vA); }`,
    }),
    // fountain water: droplets thrown up and falling back, only while the fountain is lit
    jet: new THREE.ShaderMaterial({
      ...additive, uniforms: U,
      vertexShader: `
        attribute vec2 aLit; attribute vec4 aJet; uniform float uTime, uRefW, uPxM, uPR; varying float vA;
        void main(){
          float on = smoothstep(0.0, 1.5, uTime - aLit.x) * aLit.y;
          float T = 1.5, age = fract(uTime / T + aJet.w) * T;
          vec3 p = position + vec3(aJet.xy * age, aJet.z * age - 4.9 * age * age);
          p.z = max(p.z, position.z);
          vA = on * (1.0 - age / T);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = vA < 0.01 ? 0.0 : 0.32 * ${sizeFromMetres};
        }`,
      fragmentShader: `varying float vA;
        void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(vec3(0.55, 0.92, 1.0), pow(1.0 - r, 1.5) * vA * 0.8); }`,
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

// ---------- city detail geometry ----------
// One accumulator per mesh: positions, normals and the material's extra attribute (aM), indexed triangles.
// `cur` describes the part being added (material code, the object's base z and height for the floodlight).
class Acc {
  constructor(mSize = 2) { this.P = []; this.N = []; this.M = []; this.I = []; this.n = 0; this.mSize = mSize; this.cur = { mat: 0, z0: 0, H: 1 }; }
  v(x, y, z, nx, ny, nz, m) {
    this.P.push(x, y, z); this.N.push(nx, ny, nz);
    if (m) this.M.push(...m);
    else { this.M.push(this.cur.mat, clamp((z - this.cur.z0) / this.cur.H, 0, 1)); if (this.mSize === 3) this.M.push(this.cur.s || 0); }
    return this.n++;
  }
  tri(a, b, c) { this.I.push(a, b, c); }
  /** A flat-shaded polygon face (3 or 4 points, any winding): the normal is chosen to face away from `out`. */
  face(pts, out, m) {
    const [a, b, c] = pts;
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (out) { const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length, cz = pts.reduce((s, p) => s + p[2], 0) / pts.length;
      if (nx * (cx - out[0]) + ny * (cy - out[1]) + nz * (cz - out[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; } }
    const ids = pts.map((p) => this.v(p[0], p[1], p[2], nx, ny, nz, m));
    for (let k = 1; k < ids.length - 1; k++) this.tri(ids[0], ids[k], ids[k + 1]);
  }
  geometry(extra = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('aM', new THREE.Float32BufferAttribute(this.M, this.mSize));
    for (const [k, a] of Object.entries(extra)) g.setAttribute(k, a);
    g.setIndex(this.I);
    return g;
  }
}
/** A box standing on z0: centre (cx, cy), size w (along `ang`) × d × h. No bottom face. */
function box(acc, cx, cy, z0, w, d, h, ang = 0) {
  const c = Math.cos(ang), s = Math.sin(ang), pt = (u, v, z) => [cx + u * c - v * s, cy + u * s + v * c, z];
  const q = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]], mid = [cx, cy, z0 + h / 2];
  for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; acc.face([pt(a[0], a[1], z0), pt(b[0], b[1], z0), pt(b[0], b[1], z0 + h), pt(a[0], a[1], z0 + h)], mid); }
  acc.face(q.map((p) => pt(p[0], p[1], z0 + h)), mid);
}
/** A tapered square shaft from z0 (half-size r0) to z1 (half-size r1), with an optional pyramid cap of height cap. */
function shaft(acc, cx, cy, z0, z1, r0, r1, cap = 0, ang = 0) {
  const c = Math.cos(ang), s = Math.sin(ang), pt = (u, v, z) => [cx + u * c - v * s, cy + u * s + v * c, z];
  const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]], mid = [cx, cy, (z0 + z1) / 2];
  for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; acc.face([pt(a[0] * r0, a[1] * r0, z0), pt(b[0] * r0, b[1] * r0, z0), pt(b[0] * r1, b[1] * r1, z1), pt(a[0] * r1, a[1] * r1, z1)], mid); }
  if (cap > 0) for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; acc.face([pt(a[0] * r1, a[1] * r1, z1), pt(b[0] * r1, b[1] * r1, z1), [cx, cy, z1 + cap]], [cx, cy, z1]); }
  else acc.face(q.map((p) => pt(p[0] * r1, p[1] * r1, z1)), mid);
}
/** A thin square beam between two 3D points. */
function beam(acc, a, b, t) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1, dn = d.map((x) => x / L);
  let u = Math.abs(dn[2]) > 0.95 ? [1, 0, 0] : [-dn[1], dn[0], 0];
  const ul = Math.hypot(...u); u = u.map((x) => x / ul);
  const w = [dn[1] * u[2] - dn[2] * u[1], dn[2] * u[0] - dn[0] * u[2], dn[0] * u[1] - dn[1] * u[0]];
  const off = (p, su, sw) => [p[0] + (u[0] * su + w[0] * sw) * t / 2, p[1] + (u[1] * su + w[1] * sw) * t / 2, p[2] + (u[2] * su + w[2] * sw) * t / 2];
  const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  for (let i = 0; i < 4; i++) { const p = q[i], r = q[(i + 1) % 4]; acc.face([off(a, p[0], p[1]), off(a, r[0], r[1]), off(b, r[0], r[1]), off(b, p[0], p[1])], mid); }
}
/** A surface of revolution: profile [[radius, z], …] bottom → top, scaled by k, standing on (cx, cy, z0). */
function lathe(acc, cx, cy, z0, profile, k, seg = 12) {
  const rows = profile.map(([r, z], i) => {
    const p = profile[Math.max(0, i - 1)], q = profile[Math.min(profile.length - 1, i + 1)];
    const dr = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dr, dz) || 1;   // outward normal of the profile: (dz, -dr)
    const ids = [];
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      ids.push(acc.v(cx + ca * r * k, cy + sa * r * k, z0 + z * k, ca * dz / l, sa * dz / l, -dr / l));
    }
    return ids;
  });
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < seg; j++) { const a = rows[i][j], b = rows[i][j + 1], c = rows[i + 1][j + 1], d = rows[i + 1][j]; acc.tri(a, b, c); acc.tri(a, c, d); }
}
// a robed standing figure and a bust, in metres (the figure is 2.9 m tall at k = 1)
const FIGURE = [[0.2, 0], [0.22, 0.08], [0.15, 0.5], [0.17, 0.95], [0.2, 1.3], [0.19, 1.5], [0.24, 1.85], [0.32, 2.02], [0.33, 2.1], [0.26, 2.16], [0.09, 2.22], [0.1, 2.3], [0.15, 2.44], [0.14, 2.62], [0.08, 2.74], [0, 2.78], [0, 2.9]];
const BUST = [[0.44, 0], [0.42, 0.22], [0.2, 0.36], [0.12, 0.43], [0.16, 0.56], [0.155, 0.74], [0.08, 0.85], [0, 0.88]];
const ROOF_COLOURS = { red: 'a8473a', darkred: '7c2e27', brown: '7a5236', grey: '8a8f96', gray: '8a8f96', darkgrey: '5a5f66', green: '4f7a5a', darkgreen: '35553f', blue: '4d6a8f', gold: 'd6a640', golden: 'd6a640', yellow: 'c9a240', silver: 'b8bec6', white: 'd8d8d4', black: '2a2c30', orange: 'b8673a' };
function roofColour(c) {
  const hex = /^[0-9a-f]{6}$/i.test(c || '') ? c : ROOF_COLOURS[String(c || '').toLowerCase()];
  return hex ? [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255] : [0, 0, 0];
}
/** Roof shapes on a counter-clockwise footprint ring [[x, y], …] from z0 to z1. emit(x, y, z, nx, ny, nz) → index. */
function roofGeometry(shape, ring, z0, z1, ridgeAcross, emit, tri) {
  const H = z1 - z0;
  let cx = 0, cy = 0, A = 0;
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length], c = p[0] * q[1] - q[0] * p[1]; A += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c; }
  if (Math.abs(A) < 1e-6) return;
  cx /= 3 * A; cy /= 3 * A;
  const flat = (pts, out) => {           // flat-shaded face, normal away from (out)
    const [a, b, c] = pts;
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length, mz = pts.reduce((s, p) => s + p[2], 0) / pts.length;
    if (nx * (mx - out[0]) + ny * (my - out[1]) + nz * (mz - out[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const ids = pts.map((p) => emit(p[0], p[1], p[2], nx, ny, nz));
    for (let k = 1; k < ids.length - 1; k++) tri(ids[0], ids[k], ids[k + 1]);
  };
  const inside = [cx, cy, z0 - H];
  if (shape === 1 || shape === 2) {     // dome / onion: the footprint shrinks toward the centre as it rises
    const prof = shape === 1
      ? Array.from({ length: 7 }, (_, k) => { const f = (k / 6) * Math.PI / 2; return [Math.cos(f), Math.sin(f)]; })
      : [[1, 0], [1.12, 0.1], [1.18, 0.22], [1.1, 0.36], [0.9, 0.5], [0.62, 0.64], [0.36, 0.77], [0.16, 0.88], [0.05, 0.96], [0, 1]];
    const rows = prof.map(([s, t], k) => {
      const p = prof[Math.max(0, k - 1)], q = prof[Math.min(prof.length - 1, k + 1)], ds = q[0] - p[0], dt = q[1] - p[1];
      return ring.map(([x, y]) => {
        const ux = x - cx, uy = y - cy, a = Math.hypot(ux, uy) || 1;
        // outward normal of (a·s(t), H·t): (H·dt / a … , −a·ds) in the radial plane
        let nr = H * dt, nz = -a * ds; const l = Math.hypot(nr, nz) || 1; nr /= l; nz /= l;
        return emit(cx + ux * s, cy + uy * s, z0 + H * t, (ux / a) * nr, (uy / a) * nr, nz);
      });
    });
    for (let k = 0; k < rows.length - 1; k++) for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length; tri(rows[k][i], rows[k][j], rows[k + 1][j]); tri(rows[k][i], rows[k + 1][j], rows[k + 1][i]);
    }
    return;
  }
  if (shape === 3) {                     // cone: smooth sides to the apex
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const nrm = (x, y) => { const ux = x - cx, uy = y - cy, a = Math.hypot(ux, uy) || 1, l = Math.hypot(H, a); return [(ux / a) * H / l, (uy / a) * H / l, a / l]; };
      const np = nrm(p[0], p[1]), nq = nrm(q[0], q[1]), nm = nrm((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      tri(emit(p[0], p[1], z0, ...np), emit(q[0], q[1], z0, ...nq), emit(cx, cy, z1, ...nm));
    }
    return;
  }
  // hipped / gabled on a near-rectangle; anything else becomes a pyramid
  let rect = null;
  if ((shape === 5 || shape === 6) && ring.length === 4) {
    const L = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [a, b, c, d] = ring, ab = L(a, b), bc = L(b, c), cd = L(c, d), da = L(d, a);
    if (Math.abs(ab - cd) < 0.2 * Math.max(ab, cd) && Math.abs(bc - da) < 0.2 * Math.max(bc, da)) {
      const longFirst = (ab + cd >= bc + da) !== ridgeAcross;
      rect = longFirst ? [a, b, c, d] : [b, c, d, a];
    }
  }
  if (!rect) {
    for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; flat([[p[0], p[1], z0], [q[0], q[1], z0], [cx, cy, z1]], inside); }
    return;
  }
  const [a, b, c, d] = rect, mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let m1 = mid(d, a), m2 = mid(b, c);
  if (shape === 5) {
    const lx = m2[0] - m1[0], ly = m2[1] - m1[1], len = Math.hypot(lx, ly) || 1, inset = Math.min(Math.hypot(a[0] - d[0], a[1] - d[1]) / 2, len * 0.45);
    m1 = [m1[0] + (lx / len) * inset, m1[1] + (ly / len) * inset]; m2 = [m2[0] - (lx / len) * inset, m2[1] - (ly / len) * inset];
  }
  const P = (p, z) => [p[0], p[1], z], R1 = P(m1, z1), R2 = P(m2, z1);
  flat([P(a, z0), P(b, z0), R2, R1], inside);
  flat([P(c, z0), P(d, z0), R1, R2], inside);
  flat([P(b, z0), P(c, z0), R2], inside);
  flat([P(d, z0), P(a, z0), R1], inside);
}
/** Clip a polyline [[x, y], …] to the box [0, E]²: pieces with flags for ends that were cut by the tile edge. */
function clipLine(line, E) {
  const pieces = [];
  let cur = null;
  for (let i = 0; i < line.length - 1; i++) {
    let [x0, y0] = line[i], [x1, y1] = line[i + 1], t0 = 0, t1 = 1;
    const dx = x1 - x0, dy = y1 - y0;
    let ok = true;
    for (const [p, q] of [[-dx, x0], [dx, E - x0], [-dy, y0], [dy, E - y0]]) {
      if (p === 0) { if (q < 0) { ok = false; break; } continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; } else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; }
    }
    if (!ok) { cur = null; continue; }
    const a = [x0 + dx * t0, y0 + dy * t0], b = [x0 + dx * t1, y0 + dy * t1];
    if (!cur || t0 > 0) { cur = { pts: [a], openStart: t0 > 0, openEnd: false }; pieces.push(cur); }
    cur.pts.push(b);
    if (t1 < 1) { cur.openEnd = true; cur = null; }
  }
  return pieces.filter((p) => p.pts.length >= 2);
}
const NO_ROOF = [0, 0, 0, 0];
const LANDMARK_TYPES = new Set(['church', 'cathedral', 'chapel', 'monastery', 'mosque', 'synagogue', 'temple', 'shrine', 'castle', 'bell_tower']);
const WATERWAY_W = { river: 14, canal: 10, stream: 4, stream_intermittent: 3, drain: 2.5, ditch: 2 };
const BRIDGE_W = { motorway: 20, trunk: 20, primary: 18, secondary: 14, tertiary: 12, street: 9, street_limited: 8, service: 6, pedestrian: 6, path: 4, track: 4, major_rail: 7, minor_rail: 6, service_rail: 5 };

/**
 * createGlow({ mapboxgl, map, token, assetBase, detailBase, hero, onLit, lite, bloom, adaptive, onQuality }) — call after the map's 'load'.
 * detailBase: where the city detail tiles live (default `${assetBase}detail/`; '' turns them off).
 * Returns { setTrail, setPaint, setRunner, setActivity, setHero, setRunnerVisible, setBloom, runner(), litCount(), dispose }.
 */
export function createGlow({ mapboxgl, map, token, assetBase = '', detailBase, hero = 'm', onLit, lite = false, bloom = true, adaptive = true, onQuality }) {
  if (detailBase == null) detailBase = `${assetBase}detail/`;
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
    uWL: { value: Array.from({ length: WATER_LIGHTS }, () => new THREE.Vector4()) }, uWC: { value: Array.from({ length: WATER_LIGHTS }, () => new THREE.Vector3()) }, uWN: { value: 0 },
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
      // long things (bridges, walls) light in a wave that runs away from where the runner reached them
      const xy = r.xy && rec.lp && rec.time > ALWAYS + 1 ? r.xy : null;
      for (let i = r.start; i < r.start + r.count; i++) {
        const t = xy ? rec.time + Math.max(0, Math.hypot(xy[(i - r.start) * 2] - rec.lp[0], xy[(i - r.start) * 2 + 1] - rec.lp[1]) - rec.dist) / WAVE : rec.time;
        a[i * n] = t; if (n > 1) a[i * n + 1] = rec.strength; if (n > 2) a[i * n + 2] = rec.dist;
      }
      r.attr.addUpdateRange(r.start * n, r.count * n);
      r.attr.needsUpdate = true;
    }
    if (rec.onLit) rec.onLit(rec);
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
    if (rec.strength <= 0) { rec.time = time; rec.lp = [px ?? rec.cx, py ?? rec.cy]; if (time > ALWAYS + 1 && ignitions.length < 600) ignitions.push(rec); }
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

  // ---------- bridge decks: the height of the ground under (x, y) ----------
  const bridgeGrid = new Map();       // cell → deck segments { ax, ay, bx, by, za, zb, hw }
  function addDeckSeg(seg, owner) {
    const r = seg.hw + 2, x0 = Math.floor((Math.min(seg.ax, seg.bx) - r) / CELL), x1 = Math.floor((Math.max(seg.ax, seg.bx) + r) / CELL);
    const y0 = Math.floor((Math.min(seg.ay, seg.by) - r) / CELL), y1 = Math.floor((Math.max(seg.ay, seg.by) + r) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { const k = i + ',' + j; if (!bridgeGrid.has(k)) bridgeGrid.set(k, []); bridgeGrid.get(k).push(seg); owner.push(k); }
  }
  /** Deck height at (x, y) when moving along (dx, dy): a road under a bridge stays on the ground. */
  function deckZ(x, y, dx, dy) {
    const list = bridgeGrid.get(cellKey(x, y));
    if (!list) return 0;
    let best = 0;
    const dl = dx == null ? 0 : Math.hypot(dx, dy);
    for (const s of list) {
      const ex = s.bx - s.ax, ey = s.by - s.ay, L2 = ex * ex + ey * ey || 1e-6, t = clamp(((x - s.ax) * ex + (y - s.ay) * ey) / L2, 0, 1);
      if (Math.hypot(s.ax + ex * t - x, s.ay + ey * t - y) > s.hw + 1.5) continue;
      if (dl > 0.01 && Math.abs((ex * dx + ey * dy) / (Math.sqrt(L2) * dl)) < 0.5) continue;
      best = Math.max(best, s.za + (s.zb - s.za) * t);
    }
    return best;
  }

  // ---------- city detail (OSM, optional): roof shapes by way id, monuments, fountains, walls, towers ----------
  const roofInfo = new Map();         // OSM way id → [id, shape, roofH, colour, dir, ring]
  const roofOwner = new Map();        // OSM way id → street tile key that drew the roof
  const replaced = new Set();         // OSM way ids whose Mapbox extrusion a detail object replaces
  const marked = new Set();           // OSM way ids of church parts: floodlit stone, no apartment windows
  const details = new Map();          // 'x/y' (z14) → { ready, group, recs }
  const detailIndex = detailBase ? fetch(`${detailBase}index.json`).then((r) => (r.ok ? r.json() : null)).then((j) => new Set(j && j.v === 1 ? j.tiles : [])).catch(() => new Set()) : Promise.resolve(new Set());

  // ---------- hero models (detail/landmarks.json): one real 3D model per landmark ----------
  // A bridge (from/to) is fitted to its OSM canopy axis; a placed object (at) stands on its real spot, turned to `facing`.
  const heroModels = [];              // { spec, ax, ay, bx, by, state: null | 'loading' | 'ready' | 'failed', group, rec, ready: Promise }
  const landmarksReady = detailBase ? fetch(`${detailBase}landmarks.json`).then((r) => (r.ok ? r.json() : null)).then((j) => {
    for (const spec of (j && j.v === 1 && j.models) || []) {
      const a = spec.from || spec.at, b = spec.to || spec.at;
      const [ax, ay] = toLocal(a[0], a[1]), [bx, by] = toLocal(b[0], b[1]);
      const h = { spec, ax, ay, bx, by, state: null, group: null, rec: null };
      h.ready = new Promise((res) => { h.resolve = res; });
      heroModels.push(h);
      for (const id of spec.replaces || []) replaced.add(id);
    }
  }).catch(() => {}) : Promise.resolve();
  /** A generic monument that a hero model replaces (it stands within `replacesMonument` metres of the hero's spot). */
  const heroMonument = (x, y) => heroModels.some((h) => h.spec.replacesMonument && Math.hypot(x - h.ax, y - h.ay) < h.spec.replacesMonument);
  /** Tall extrusions (OSM building parts modelling the landmark itself) inside a hero's `clearsTall` radius. */
  const heroClears = (x, y, h) => heroModels.some((m) => (m.spec.clearsAll && Math.hypot(x - m.ax, y - m.ay) < m.spec.clearsAll)
    || (h >= 25 && m.spec.clearsTall && Math.hypot(x - m.ax, y - m.ay) < m.spec.clearsTall));
  /** Inside a rebuilt plaza: no generic trees there. */
  const inPlaza = (x, y) => heroModels.some((m) => m.spec.plaza && Math.hypot(x - m.ax, y - m.ay) < m.spec.plaza.road[1] + 1);
  const heroTower = (x, y) => heroModels.some((h) => h.spec.replacesTower && Math.hypot(x - h.ax, y - h.ay) < h.spec.replacesTower);
  /** The hero model whose footprint (its canopy axis, a little longer and wider) covers (x, y); it replaces generic bridge parts there. */
  function heroBridge(x, y) {
    for (const h of heroModels) {
      if (!h.spec.replacesBridge) continue;
      const ex = h.bx - h.ax, ey = h.by - h.ay, L = Math.hypot(ex, ey) || 1, ux = ex / L, uy = ey / L, pad = 4;
      if (segDist(x, y, h.ax - ux * pad, h.ay - uy * pad, h.bx + ux * pad, h.by + uy * pad) < (h.spec.canopyWidth || 12) / 2 + 2) return h;
    }
    return null;
  }
  // quantized models (int16 positions) are expanded to floats first, or reshaping would clip them
  const toFloat = (attr) => { const out = new Float32Array(attr.count * attr.itemSize); for (let i = 0; i < attr.count; i++) for (let c = 0; c < attr.itemSize; c++) out[i * attr.itemSize + c] = attr.getComponent(i, c); return new THREE.BufferAttribute(out, attr.itemSize); };
  /** Bake every mesh into the model frame (glTF, Y up) so its vertices can be refitted in metres. */
  function bakeModel(model) {
    model.updateMatrixWorld(true);
    const meshes = [];
    model.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const o of meshes) {
      const geo = o.geometry.clone();
      for (const name of ['position', 'normal']) if (geo.attributes[name]) geo.setAttribute(name, toFloat(geo.attributes[name]));
      geo.applyMatrix4(o.matrixWorld);
      o.geometry = geo;
    }
    model.traverse((o) => { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); });
    const box3 = new THREE.Box3();
    for (const o of meshes) { o.geometry.computeBoundingBox(); box3.union(o.geometry.boundingBox); }
    return { meshes, box3, size: box3.getSize(new THREE.Vector3()), centre: box3.getCenter(new THREE.Vector3()) };
  }
  function eachVertex(meshes, fn) { const v = new THREE.Vector3(); for (const o of meshes) { const pos = o.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); fn(v, pos, i); } } }
  function finishMeshes(meshes) { for (const o of meshes) { o.geometry.attributes.position.needsUpdate = true; o.geometry.computeVertexNormals(); o.geometry.computeBoundingBox(); o.geometry.computeBoundingSphere(); } }
  /** A bridge: the deck runs the OSM axis, the canopy (whatever is wider than the deck) is fitted to the OSM canopy outline. */
  function fitBridge(h, meshes, box3, size, centre) {
    const sp = h.spec, alongX = size.x >= size.z, lenM = alongX ? size.x : size.z;
    const A = (q) => (alongX ? q.x - centre.x : q.z - centre.z), Cx = (q) => (alongX ? q.z - centre.z : centre.x - q.x);
    // The deck stubs past the canopy tell the deck's top and half width. The canopy's curling ends reach in there too,
    // so the deck is the densest flat level among those points, not a percentile of them.
    const stub = [];
    eachVertex(meshes, (v) => { if (Math.abs(A(v)) > lenM * 0.47) stub.push([v.y, Math.abs(Cx(v))]); });
    const pct = (arr, f) => { arr.sort((a, b) => a - b); return arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * f))] : 0; };
    let deckTop = box3.min.y, deckHalf = size.z * 0.1;
    if (stub.length) {
      const bin = size.y / 40, counts = new Map();
      for (const [y] of stub) { const b = Math.floor((y - box3.min.y) / bin); counts.set(b, (counts.get(b) || 0) + 1); }
      const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0], lo = box3.min.y + (mode - 1) * bin, hi = box3.min.y + (mode + 2) * bin;
      const deck = stub.filter(([y]) => y >= lo && y <= hi);
      deckTop = Math.max(...deck.map(([y]) => y));
      deckHalf = Math.max(1e-4, pct(deck.map(([, w]) => w), 0.75));
    }
    const halfMax = (alongX ? size.z : size.x) / 2, L = Math.hypot(h.bx - h.ax, h.by - h.ay);
    let cLo = Infinity, cHi = -Infinity;
    eachVertex(meshes, (v) => { if (Math.abs(Cx(v)) > deckHalf * 2) { const a = A(v); if (a < cLo) cLo = a; if (a > cHi) cHi = a; } });
    const canopyM = cHi > cLo ? cHi - cLo : lenM, shift = cHi > cLo ? (cHi + cLo) / 2 : 0;
    const kx = L / canopyM, ky = (sp.rise || 8) / Math.max(1e-4, box3.max.y - deckTop);
    const dW = (sp.deckWidth || 5) / 2, cW = (sp.canopyWidth || 12) / 2;
    const widen = (r) => (r <= deckHalf ? (r / deckHalf) * dW : dW + ((r - deckHalf) / Math.max(1e-4, halfMax - deckHalf)) * Math.max(0, cW - dW));
    eachVertex(meshes, (v, pos, i) => { const c = Cx(v); pos.setXYZ(i, (A(v) - shift) * kx, (v.y - deckTop) * ky, Math.sign(c) * widen(Math.abs(c))); });
    finishMeshes(meshes);
    const mx = (h.ax + h.bx) / 2, my = (h.ay + h.by) / 2, deck = sp.deck || deckZ(mx, my, h.bx - h.ax, h.by - h.ay) || 4.2;
    const np = Math.max(2, Math.ceil(L / 10) + 1), pts = new Float32Array(np * 2);
    for (let k = 0; k < np; k++) { const f = k / (np - 1); pts[k * 2] = h.ax + (h.bx - h.ax) * f; pts[k * 2 + 1] = h.ay + (h.by - h.ay) * f; }
    return { x: mx, y: my, z: deck + 0.06, turn: Math.atan2(h.by - h.ay, h.bx - h.ax), pts, top: deck + (sp.rise || 8), base: deck };
  }
  /**
   * A placed object: the part of the model above `fitAbove` (a fraction of its height — the church above its rock)
   * is scaled to `fitWidth` metres across and centred on the spot; or the whole model is scaled to `height` metres.
   * The level `levelAt` (fraction of the model's height, e.g. the terrace) sits at `level` metres; `front` ('x' | 'z')
   * is the model's facing axis, turned to the compass bearing `facing`. `squash` lowers it without narrowing it.
   */
  function fitPlace(h, meshes, box3, size) {
    const sp = h.spec, yCut = box3.min.y + (sp.fitAbove || 0) * size.y;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    eachVertex(meshes, (v) => { if (v.y > yCut) { x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z); } });
    const k = sp.fitWidth ? sp.fitWidth / Math.max(x1 - x0, z1 - z0) : sp.height ? sp.height / size.y : 1, ky = k * (sp.squash || 1);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, yRef = box3.min.y + (sp.levelAt || 0) * size.y;
    eachVertex(meshes, (v, pos, i) => pos.setXYZ(i, (v.x - cx) * k, (v.y - yRef) * ky, (v.z - cz) * k));
    // `reachGround`: an object raised to the plateau (`level`) keeps its pedestal standing on the street below
    if (sp.reachGround && sp.level > 0) eachVertex(meshes, (v, pos, i) => { if (v.y < 0.3) pos.setY(i, -sp.level); });
    finishMeshes(meshes);
    // model +x → east (bearing 90), model +z → south (bearing 180) once stood up; turn the front to `facing`
    const turn = (-((sp.facing ?? 0) - (sp.front === 'x' ? 90 : 180)) * Math.PI) / 180;
    const hx = Math.max(box3.max.x - cx, cx - box3.min.x) * k, hz = Math.max(box3.max.z - cz, cz - box3.min.z) * k;
    const c = Math.cos(turn), s2 = Math.sin(turn), pts = [];
    for (const [u, w] of [[0, 0], [hx, 0], [-hx, 0], [0, hz], [0, -hz], [hx, hz], [-hx, -hz], [hx, -hz], [-hx, hz]]) pts.push(h.ax + u * c + w * s2, h.ay + u * s2 - w * c);
    return { x: h.ax, y: h.ay, z: sp.level || 0, turn, pts: new Float32Array(pts), top: (sp.level || 0) + (box3.max.y - yRef) * ky, base: sp.reachGround ? 0 : (sp.level || 0) - (yRef - box3.min.y) * ky };
  }
  /** The top of another hero model under (x, y) — a statue standing on the church's rock. */
  function surfaceOf(other, x, y) {
    if (!other || !other.group) return null;
    other.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 500), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(other.group, true)[0];
    return hit ? hit.point.z : null;
  }
  /**
   * A plaza rebuilt from OSM measurements (Freedom Square): the stepped granite platform of its monument, lawn
   * quarters crossed by paths, the ring road of granite setts laid in fans, a curb, lamps around it, and the monument's
   * column (granite shaft, golden ring and capital). The statue on top is a separate hero (standOn).
   */
  function buildPlaza(h) {
    const sp = h.spec, P = sp.plaza, cx = h.ax, cy = h.ay, SEG = 160;
    const pos = [], nor = [], idx = [];
    const v = (x, y, z, nx, ny, nz) => { pos.push(x, y, z); nor.push(nx, ny, nz); return pos.length / 3 - 1; };
    const annulus = (r0, r1, z) => {
      for (let i = 0; i < SEG; i++) {
        const a0 = (i / SEG) * Math.PI * 2, a1 = ((i + 1) / SEG) * Math.PI * 2;
        const q = [v(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0, z, 0, 0, 1), v(cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0, z, 0, 0, 1),
          v(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1, z, 0, 0, 1), v(cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1, z, 0, 0, 1)];
        idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
      }
    };
    const riser = (r, z0, z1) => {
      for (let i = 0; i < SEG; i++) {
        const a0 = (i / SEG) * Math.PI * 2, a1 = ((i + 1) / SEG) * Math.PI * 2, am = (a0 + a1) / 2;
        const q = [v(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, z0, Math.cos(am), Math.sin(am), 0), v(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, z0, Math.cos(am), Math.sin(am), 0),
          v(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, z1, Math.cos(am), Math.sin(am), 0), v(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, z1, Math.cos(am), Math.sin(am), 0)];
        idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
      }
    };
    const G = 0.12, steps = P.steps, outer = P.road[1] + 0.6;
    annulus(steps[0][0], outer, G);
    steps.forEach(([r, top], k) => { riser(r, k ? steps[k - 1][1] : G, top); annulus(k + 1 < steps.length ? steps[k + 1][0] : 0, r, top); });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setIndex(idx);
    const lamps = P.lamps || 12, lampR = P.road[1] + 1.6;
    const own = { uC: { value: new THREE.Vector2(cx, cy) }, uZ: { value: new THREE.Vector4(steps[0][0], P.lawn[0], P.lawn[1], P.road[1]) },
      uPathW: { value: P.pathWidth || 3.5 }, uLamps: { value: lamps }, uLampR: { value: lampR }, uLitT: { value: NEVER }, uLitS: { value: 0 } };
    const ground = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { ...U, ...own },
      vertexShader: 'varying vec3 vP; varying vec3 vN; varying float vW; void main(){ vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); vW = gl_Position.w; }',
      fragmentShader: `
        uniform float uTime, uLitT, uLitS, uPathW, uLamps, uLampR; uniform vec2 uC; uniform vec4 uZ;
        ${FOGFN}
        ${HASH}
        varying vec3 vP; varying vec3 vN; varying float vW;
        // joints between stones: thin lines at the cell borders, faded out where they would alias
        float joints(vec2 f, vec2 w){ vec2 e = min(f, 1.0 - f); vec2 j = 1.0 - smoothstep(vec2(0.0), w, e); return max(j.x, j.y); }
        void main(){
          vec2 d = vP.xy - uC; float r = length(d), a = atan(d.y, d.x) / 6.2832 + 0.5;
          if (r > uZ.w + 0.6) discard;
          vec3 n = normalize(vN), base; float j = 0.0;
          float since = uTime - uLitT, lit = step(0.0, since) * uLitS * smoothstep(0.0, 2.0, since);
          if (n.z < 0.5) base = vec3(0.60, 0.58, 0.54);                                     // the risers of the steps
          else if (r < uZ.x) {                                                             // the platform: granite in rings
            float rw = 1.15, ring = floor(r / rw), arc = max(3.0, floor(6.2832 * (ring + 0.5) * rw / 1.5)), off = mod(ring, 2.0) * 0.5;
            float sa = a * arc + off;
            base = mix(vec3(0.58, 0.55, 0.50), vec3(0.74, 0.70, 0.64), hash(vec2(ring, floor(sa))));
            j = joints(vec2(fract(r / rw), fract(sa)), vec2(0.035, 0.035 * arc / max(r, 0.5)));
          } else if (r < uZ.z) {                                                           // lawns, paths on the four axes
            vec2 q = abs(d);
            if (min(q.x, q.y) < uPathW * 0.5 || r < uZ.y) {
              base = mix(vec3(0.55, 0.53, 0.49), vec3(0.66, 0.63, 0.58), hash(floor(vP.xy / 0.9)));
              j = joints(fract(vP.xy / 0.9), vec2(0.04));
            } else base = vec3(0.07, 0.12, 0.08) * (0.8 + 0.4 * hash(floor(vP.xy * 1.5)));
          } else if (r < uZ.w - 0.35) {                                                    // the ring road: granite setts in fans
            float sw = 0.55, row = floor((r - uZ.z) / sw), sa = a * 6.2832 * r / sw + row * 0.5;
            base = mix(vec3(0.20, 0.20, 0.21), vec3(0.34, 0.33, 0.32), hash(vec2(row, floor(sa))));
            j = joints(vec2(fract((r - uZ.z) / sw), fract(sa)), vec2(0.07));
          } else base = vec3(0.58, 0.57, 0.55);                                            // the curb
          float aa = 1.0 - smoothstep(0.08, 0.3, fwidth(r));
          base *= 1.0 - j * 0.5 * aa;
          float moon = max(dot(n, ${MOON}), 0.0);
          vec3 col = base * vec3(0.20, 0.24, 0.33) * (0.85 + 0.7 * moon);
          float pools = 0.0;
          for (int i = 0; i < 24; i++) { if (float(i) >= uLamps) break; float ang = 6.2832 * (float(i) + 0.5) / uLamps; vec2 lp = vec2(cos(ang), sin(ang)) * (uLampR - 2.5); vec2 dd = d - lp; pools += exp(-dot(dd, dd) / 70.0); }
          col += base * vec3(1.0, 0.76, 0.48) * lit * (0.35 + 1.5 * pools + 1.0 * exp(-r / 9.0));
          gl_FragColor = vec4(fogged(col, vW), 1.0);
        }`,
    }));
    ground.renderOrder = 1; ground.frustumCulled = false;
    const g = new THREE.Group(); g.add(ground);
    // the column, to the OSM part heights: pedestal, granite shaft, golden ring, golden capital
    const C = sp.column, acc = new Acc(2), top = steps[steps.length - 1][1];
    acc.cur = { mat: 0, z0: top, H: C.top - top };
    box(acc, cx, cy, top, C.pedestal, C.pedestal, C.pedestalTop - top - 0.4); box(acc, cx, cy, C.pedestalTop - 0.4, C.pedestal + 0.4, C.pedestal + 0.4, 0.4);
    const lat = (z0, prof, mat) => { acc.cur.mat = mat; lathe(acc, cx, cy, z0, prof, 1, 32); };
    lat(C.pedestalTop, [[C.r + 0.35, 0], [C.r + 0.35, 0.35], [C.r + 0.1, 0.6], [C.r, 0.8], [C.r * 0.86, C.band[0] - C.pedestalTop]], 0);
    lat(C.band[0], [[C.r * 0.86, 0], [C.bandR, 0.25], [C.bandR, C.band[1] - C.band[0] - 0.25], [C.r * 0.82, C.band[1] - C.band[0]]], 2);
    lat(C.band[1], [[C.r * 0.82, 0], [C.r * 0.78, C.top - 2.2 - C.band[1]]], 0);
    lat(C.top - 2.2, [[C.r * 0.78, 0], [C.r * 1.15, 1.2], [C.r * 1.25, 1.7], [C.r * 1.1, 2.2], [0, 2.2]], 2);
    const lit = new THREE.Float32BufferAttribute(new Float32Array(acc.n * 2).map((_, i) => (i % 2 ? 0 : NEVER)), 2); lit.setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.Mesh(acc.geometry({ aLit: lit }), M.mon); col.renderOrder = 1; col.frustumCulled = false; g.add(col);
    // lamps around the ring, their arms toward the monument
    const pg = POST.clone(), iT = new THREE.InstancedBufferAttribute(new Float32Array(lamps).fill(NEVER), 1); iT.setUsage(THREE.DynamicDrawUsage);
    pg.setAttribute('iT', iT); pg.setAttribute('iSeed', new THREE.InstancedBufferAttribute(Float32Array.from({ length: lamps }, (_, i) => hash1(i + 3)), 1));
    const posts = new THREE.InstancedMesh(pg, M.post, lamps); posts.renderOrder = 1; posts.frustumCulled = false;
    const bp = [], bs = [], bt = new THREE.Float32BufferAttribute(new Float32Array(lamps).fill(NEVER), 1), pxy = new Float32Array(lamps * 2);
    for (let i = 0; i < lamps; i++) {
      const ang = (Math.PI * 2 * (i + 0.5)) / lamps, ux = Math.cos(ang), uy = Math.sin(ang), x = cx + ux * lampR, y = cy + uy * lampR;
      posts.setMatrixAt(i, new THREE.Matrix4().makeRotationZ(Math.atan2(ux, -uy)).setPosition(x, y, 0));
      bp.push(x - ux * 0.8, y - uy * 0.8, LANTERN_Z); bs.push(hash1(i + 5)); pxy[i * 2] = x; pxy[i * 2 + 1] = y;
    }
    g.add(posts);
    const bg = new THREE.BufferGeometry(); bt.setUsage(THREE.DynamicDrawUsage);
    bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setAttribute('aT', bt); bg.setAttribute('aSeed', new THREE.Float32BufferAttribute(bs, 1));
    const bulbs = new THREE.Points(bg, M.lamp); bulbs.renderOrder = 8; bulbs.frustumCulled = false; g.add(bulbs);
    group.add(g);
    h.group = g; h.state = 'ready';
    const cxy = new Float32Array(acc.n * 2); for (let k = 0; k < acc.n; k++) { cxy[k * 2] = acc.P[k * 3]; cxy[k * 2 + 1] = acc.P[k * 3 + 1]; }
    const ring = new Float32Array(18); for (let k = 0; k < 8; k++) { ring[k * 2] = cx + Math.cos((k / 8) * Math.PI * 2) * P.lawn[1]; ring[k * 2 + 1] = cy + Math.sin((k / 8) * Math.PI * 2) * P.lawn[1]; } ring[16] = cx; ring[17] = cy;
    const rec = { cx, cy, pts: ring, h: C.top, strength: 0, time: NEVER, waterColor: [1.0, 0.8, 0.55], waterZ: 12,
      ranges: [{ attr: lit, start: 0, count: acc.n, xy: cxy }, { attr: iT, start: 0, count: lamps, xy: pxy }, { attr: bt, start: 0, count: lamps, xy: pxy }],
      onLit: (r) => { own.uLitT.value = r.time; own.uLitS.value = r.strength; } };
    addRecord(rec); lightFromHistory(rec);
    h.rec = rec;
    h.resolve();
  }
  function loadHeroModel(h) {
    if (h.spec.plaza) { h.state = 'loading'; buildPlaza(h); return; }
    h.state = 'loading';
    new GLTFLoader().load(`${detailBase}${h.spec.file}`, async (gltf) => {
      if (disposed) return;
      const sp = h.spec, model = gltf.scene;
      const { meshes, box3, size, centre } = bakeModel(model);
      const fit = sp.from ? fitBridge(h, meshes, box3, size, centre) : fitPlace(h, meshes, box3, size);
      if (sp.standOn) {          // stand on another landmark (its rock) when it reaches under this spot
        const other = heroModels.find((o) => o.spec.id === sp.standOn);
        if (other) { if (!other.state) loadHeroModel(other); await Promise.race([other.ready, new Promise((r) => setTimeout(r, 15000))]); }
        const top = surfaceOf(other, fit.x, fit.y);
        if (top != null) { fit.base += top - fit.z; fit.top += top - fit.z; fit.z = top; }
      }
      if (disposed) return;
      const upright = new THREE.Group(); upright.rotation.x = Math.PI / 2; upright.add(model);   // model frame Y-up → map Z-up
      const holder = new THREE.Group(); holder.position.set(fit.x, fit.y, fit.z); holder.rotation.z = fit.turn; holder.add(upright);
      // Night look. 'canopy': dark glass, the frame glows and LEDs twinkle. 'flood': stone and bronze lit from the
      // ground up, with a warm rim on the silhouette. Both come on in a wave from where the runner reached them.
      // Nothing is drawn below the ground (a rock base reaches under the street).
      const lit = { uLitT: { value: NEVER }, uLitS: { value: 0 }, uLitP: { value: new THREE.Vector2(fit.x, fit.y) }, uLitD: { value: 0 },
        uBaseZ: { value: Math.max(0, fit.base) }, uSpanZ: { value: Math.max(2, fit.top - Math.max(0, fit.base)) } };
      const look = sp.look || (sp.from ? 'canopy' : 'flood');
      const glow = new THREE.Color(...(sp.glow || [0.55, 0.85, 1.0])), flood = look === 'flood';
      const emissive = look === 'paint' ? `
              totalEmissiveRadiance += heroBase * 0.16;   // its own paint under the night sky, nothing added` : look === 'medirun' ? `
              {
                // its own paint under the night sky, and the teal of its lamps reflected on the steel
                float hz = clamp((vHeroW.z - uBaseZ) / uSpanZ, 0.0, 1.0);
                float wave = pow(0.5 + 0.5 * sin(hz * 30.0 - uTime * (1.4 + 1.6 * uRun)), 6.0);
                totalEmissiveRadiance += heroBase * 0.16 + vec3(0.06, 0.45, 0.40) * (0.10 + 0.22 * wave) * smoothstep(0.25, 0.7, dot(heroBase, vec3(0.333)));
              }` : flood ? `
              {
                float hz = clamp((vHeroW.z - uBaseZ) / uSpanZ, 0.0, 1.0);
                totalEmissiveRadiance += heroBase * vec3(1.0, 0.84, 0.62) * heroLit * (0.12 + 0.8 * exp(-hz * 2.4));
                float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
                totalEmissiveRadiance += vec3(1.0, 0.78, 0.5) * rim * heroLit * 0.4 + vec3(0.35, 0.45, 0.65) * rim * 0.05;
              }` : `
              {
                float lum = dot(heroBase, vec3(0.333));
                float frame = smoothstep(0.62, 0.9, lum);
                totalEmissiveRadiance += uGlow * heroLit * (0.05 + 0.85 * frame);
                // small round LEDs over the canopy, each twinkling on its own beat
                vec2 q = vHeroW.xy * 1.3 + vHeroW.z * 0.7, cell = floor(q);
                float dotMask = 1.0 - smoothstep(0.07, 0.17, length(fract(q) - 0.5));
                float led = step(0.7, heroHash(cell)) * dotMask * (0.45 + 0.55 * frame) * (0.5 + 0.5 * sin(uTime * (1.2 + 2.5 * heroHash(cell + 3.1)) + heroHash(cell) * 40.0));
                totalEmissiveRadiance += vec3(0.85, 0.95, 1.0) * led * heroLit * 1.6;
              }`;
      const dim = look === 'medirun' || look === 'paint' ? 'diffuseColor.rgb *= 0.55;' : flood ? 'diffuseColor.rgb *= mix(0.40, 0.55, heroLit);'
        : 'diffuseColor.rgb *= mix(0.30, 0.42, heroLit) * mix(vec3(0.75, 0.85, 1.0), vec3(1.0), smoothstep(0.55, 0.85, dot(heroBase, vec3(0.333))));';
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false; o.renderOrder = 2;
        for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
          mat.onBeforeCompile = (sh) => {
            Object.assign(sh.uniforms, lit, { uTime: U.uTime, uRun: U.uRun, uGlow: { value: glow } });
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHeroW;')
              .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvHeroW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
              varying vec3 vHeroW; uniform float uTime, uRun, uLitT, uLitS, uLitD, uBaseZ, uSpanZ; uniform vec2 uLitP; uniform vec3 uGlow;
              float heroHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
              .replace('#include <clipping_planes_fragment>', 'if (vHeroW.z < -0.05) discard;\n#include <clipping_planes_fragment>')
              .replace('#include <map_fragment>', `#include <map_fragment>
              float heroSince = uTime - uLitT - max(0.0, distance(vHeroW.xy, uLitP) - uLitD) / ${WAVE.toFixed(1)};
              float heroLit = step(0.0, heroSince) * uLitS * smoothstep(0.0, 1.6, heroSince);
              vec3 heroBase = diffuseColor.rgb;
              ${dim}`)
              .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${emissive}`);
          };
          // three.js caches programs by the onBeforeCompile source, which is the same for every look: key it by the look
          mat.customProgramCacheKey = () => `hero-${look}`;
          mat.needsUpdate = true;
        }
      });
      if (sp.leds) {           // MEDIRUN lamps on the structure: sampled from its own vertices, teal and mint, waves climbing
        holder.position.set(fit.x, fit.y, fit.z); group.add(holder); holder.updateMatrixWorld(true);
        const lp = [], lh = [], ls = [], w = new THREE.Vector3(), nrm = new THREE.Vector3(), span = Math.max(1, fit.top - fit.base);
        let seen = 0;
        model.traverse((o) => {
          if (!o.isMesh) return;
          const pos = o.geometry.attributes.position, nor = o.geometry.attributes.normal, nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
          for (let i = 0; i < pos.count; i++) {
            if (hash1(i * 1.37 + 0.5) > sp.leds / Math.max(1, pos.count)) continue;
            w.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
            if (nor) w.addScaledVector(nrm.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(), 0.8);   // just off the steel
            lp.push(w.x, w.y, w.z); lh.push(clamp((w.z - fit.base) / span, 0, 1)); ls.push(hash1(i + 7.7)); seen++;
          }
        });
        group.remove(holder);
        if (seen) {
          const lg = new THREE.BufferGeometry();
          lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
          lg.setAttribute('aH', new THREE.Float32BufferAttribute(lh, 1)); lg.setAttribute('aSeed', new THREE.Float32BufferAttribute(ls, 1));
          const leds = new THREE.Points(lg, M.towerLed); leds.renderOrder = 9; leds.frustumCulled = false; group.add(leds);
        }
      }
      if (sp.beacons) {        // red aviation lights at the given fractions of the height, on all night
        const bp = [], ph = [];
        for (const f of sp.beacons) { bp.push(fit.x, fit.y, fit.base + (fit.top - fit.base) * f); ph.push(f * 4.1); }
        const bg = new THREE.BufferGeometry();
        bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1));
        const pts2 = new THREE.Points(bg, M.beacon); pts2.renderOrder = 9; pts2.frustumCulled = false; group.add(pts2);
      }
      group.add(holder);
      h.group = holder; h.state = 'ready';
      const rec = { cx: fit.x, cy: fit.y, pts: fit.pts, h: fit.top, strength: 0, time: NEVER, ranges: [],
        waterColor: flood ? [1.0, 0.82, 0.58] : [glow.r, glow.g, glow.b], waterZ: (fit.top + Math.max(0, fit.base)) / 2, waterGain: sp.from ? 0.7 : 1.6, line: Boolean(sp.from),
        onLit: (r) => { lit.uLitT.value = r.time; lit.uLitS.value = r.strength; lit.uLitD.value = r.dist || 0; if (r.lp) lit.uLitP.value.set(r.lp[0], r.lp[1]); } };
      if (sp.alwaysLit) { rec.time = ALWAYS; rec.strength = 1; lit.uLitT.value = ALWAYS; lit.uLitS.value = 1; }   // lit all night, runner or not
      addRecord(rec); lightFromHistory(rec);
      h.rec = rec;
      h.resolve();
    }, undefined, () => { h.state = 'failed'; h.resolve(); });
  }

  // ---------- the lit city on the water ----------
  const waterCells = new Set();       // CELL keys that hold water
  const waterTris = new Map();        // CELL key → water triangles [ax, ay, bx, by, cx, cy] (the shore search)
  function inWater(x, y) {
    const list = waterTris.get(cellKey(x, y));
    if (list) for (const [ax, ay, bx, by, cx, cy] of list) {
      const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by), d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy), d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return true;
    }
    return false;
  }
  /** Where the water begins between a light and the viewer: its streak on the water starts there. */
  function shoreToward(x, y) {
    const dx = camera.position.x - x, dy = camera.position.y - y, L = Math.hypot(dx, dy);
    if (L < 1) return null;
    for (let s = 0; s <= Math.min(240, L); s += 3) { const px = x + (dx / L) * s, py = y + (dy / L) * s; if (inWater(px, py)) return [px, py]; }
    return null;
  }
  const WARM = [1.0, 0.72, 0.42], SODIUM = [1.0, 0.74, 0.44];
  function nearWater(x, y) {
    const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (waterCells.has(i + a + ',' + (j + b))) return true;
    return false;
  }
  function gatherWaterLights(cx, cy) {
    const t = now(), cand = [], R = 650, ci = Math.floor(cx / CELL), cj = Math.floor(cy / CELL), span = Math.ceil(R / CELL);
    for (let a = -span; a <= span; a++) for (let b = -span; b <= span; b++) {
      const k = ci + a + ',' + (cj + b), list = grid.get(k);
      if (!list) continue;
      for (const rec of list) {
        if (rec.tree || rec.strength < 0.2 || rec.time > t || !nearWater(rec.cx, rec.cy)) continue;
        const col = rec.waterColor || WARM, z = rec.waterZ ?? Math.min((rec.h || 8) * 0.55, 14);
        if (rec.line) {   // a bridge or a wall: a light every few samples along it
          let added = 0;
          for (let q = 0; q < rec.pts.length && added < 5; q += 6) if (nearWater(rec.pts[q], rec.pts[q + 1])) { cand.push([rec.pts[q], rec.pts[q + 1], rec.waterZ ?? (rec.h || 4) + 4, rec.strength * (rec.waterGain || 0.8), col]); added++; }
        } else cand.push([rec.cx, rec.cy, z, rec.strength * (rec.waterGain || 1), col]);
      }
    }
    const P = lampGeo.attributes.position, T = lampGeo.attributes.aT;
    for (let i = 0; i < trail.lampCount; i++) if (T.getX(i) <= t && nearWater(P.getX(i), P.getY(i))) cand.push([P.getX(i), P.getY(i), P.getZ(i), 1.3, SODIUM]);
    for (const c of cand) c.push(Math.hypot(c[0] - cx, c[1] - cy));
    cand.sort((p, q) => p[5] - q[5]);
    const max = lite ? 8 : WATER_LIGHTS;
    let n = 0;
    for (let i = 0; i < cand.length && i < 90 && n < max; i++) {
      const c = cand[i], sh = shoreToward(c[0], c[1]);
      if (!sh) continue;
      U.uWL.value[n].set(sh[0], sh[1], c[2], c[3]); U.uWC.value[n].set(c[4][0], c[4][1], c[4][2]); n++;
    }
    U.uWN.value = n;
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
    // water: lakes and wide rivers (polygons) and the rivers, canals and streams Mapbox only has as lines (ribbons)
    {
      const pos = [], idx = [];
      const markWater = (x0, y0, x1, y1) => { for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++) waterCells.add(i + ',' + j); };
      const addTri = (ax, ay, bx, by, cx, cy) => {
        const tri = [ax, ay, bx, by, cx, cy];
        for (let i = Math.floor(Math.min(ax, bx, cx) / CELL); i <= Math.floor(Math.max(ax, bx, cx) / CELL); i++) for (let j = Math.floor(Math.min(ay, by, cy) / CELL); j <= Math.floor(Math.max(ay, by, cy) / CELL); j++) {
          const k = i + ',' + j; if (!waterTris.has(k)) waterTris.set(k, []); waterTris.get(k).push(tri); t.waterKeys.add(k); t.waterTriSet.add(tri);
        }
      };
      t.waterKeys = new Set(); t.waterTriSet = new Set();
      if (tile.layers.water) for (let i = 0; i < tile.layers.water.length; i++) {
        const f = tile.layers.water.feature(i);
        if (f.type !== 3) continue;
        for (const poly of polygons(f)) {
          const { verts, tris } = triangulate(localRings(poly, f.extent, toL)), s0 = pos.length / 3;
          verts.forEach((v) => pos.push(v.x, v.y, 0.1));
          tris.forEach((q) => {
            idx.push(s0 + q[0], s0 + q[1], s0 + q[2]);
            const a = verts[q[0]], b = verts[q[1]], c = verts[q[2]];
            addTri(a.x, a.y, b.x, b.y, c.x, c.y);
            markWater(Math.min(a.x, b.x, c.x), Math.min(a.y, b.y, c.y), Math.max(a.x, b.x, c.x), Math.max(a.y, b.y, c.y));
          });
        }
      }
      if (tile.layers.waterway) for (let i = 0; i < tile.layers.waterway.length; i++) {
        const f = tile.layers.waterway.feature(i), w = WATERWAY_W[f.properties.class];
        if (f.type !== 2 || !w) continue;
        for (const line of f.loadGeometry()) {
          const pts = line.map((q) => toL(q.x, q.y, f.extent)), n = pts.length;
          if (n < 2) continue;
          const s0 = pos.length / 3;
          pts.forEach((q, k) => {
            const a = pts[Math.max(0, k - 1)], c = pts[Math.min(n - 1, k + 1)], dl = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
            const nx = (-(c[1] - a[1]) / dl) * w / 2, ny = ((c[0] - a[0]) / dl) * w / 2;
            pos.push(q[0] + nx, q[1] + ny, 0.08, q[0] - nx, q[1] - ny, 0.08);
            if (k) {
              const v = s0 + k * 2;
              idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
              addTri(q[0] + nx, q[1] + ny, q[0] - nx, q[1] - ny, a[0] - nx, a[1] - ny);
              addTri(q[0] + nx, q[1] + ny, a[0] - nx, a[1] - ny, a[0] + nx, a[1] + ny);
              markWater(Math.min(q[0], a[0]) - w, Math.min(q[1], a[1]) - w, Math.max(q[0], a[0]) + w, Math.max(q[1], a[1]) + w); }
          });
        }
      }
      if (pos.length) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
        const m = new THREE.Mesh(geo, M.water); m.renderOrder = 0; m.frustumCulled = false; g.add(m);
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
              if (inPlaza(x, y)) continue;
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
      const P = [], N = [], F = [], B = [], R = [], idx = [], owners = [];
      const poolP = [], poolUV = [], poolC = [], poolIdx = [], hazeP = [], hazeS = [], beaconP = [], beaconPh = [];
      let n = 0, rf = NO_ROOF;
      const vert = (x, y, z, nx, ny, nz, u, v, roof, seed, h) => { P.push(x, y, z); N.push(nx, ny, nz); F.push(u, v, roof); B.push(seed, h); R.push(rf[0], rf[1], rf[2], rf[3]); return n++; };
      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i);
        if (f.type !== 3) continue;
        const p = f.properties;
        if (p.underground === 'true' || p.extrude === 'false') continue;
        const osmId = f.id != null ? Number(f.id) : null;
        if (osmId != null && replaced.has(osmId)) continue;
        const info = osmId != null ? roofInfo.get(osmId) : null;
        for (const poly of polygons(f)) {
          const rings = localRings(poly, f.extent, toL), outer = rings[0];
          let cx = 0, cy = 0;
          outer.forEach((q) => { cx += q.l[0]; cy += q.l[1]; });
          cx /= outer.length; cy /= outer.length;
          const seed = hash1(f.id != null ? Number(f.id) % 100000 : cx * 0.37 + cy * 0.61);
          let h = Number(p.height) || 0;
          const base = Number(p.min_height) || 0;
          if (h < 4) h = 6 + seed * 8;
          if (heroClears(cx, cy, h)) continue;
          // a shaped roof (OSM roof:shape): the walls stop where the roof begins, the roof is drawn once from the OSM outline
          let wallTop = h, roofRing = null;
          const mark = (info && info[1] <= 3) || LANDMARK_TYPES.has(p.type) || marked.has(osmId);
          if (info) {
            const rr = []; const fl = info[5];
            for (let k = 0; k < fl.length; k += 2) { const q = toLocal(fl[k], fl[k + 1]), l = rr[rr.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.3) rr.push(q); }
            if (rr.length > 2 && Math.hypot(rr[0][0] - rr[rr.length - 1][0], rr[0][1] - rr[rr.length - 1][1]) < 0.3) rr.pop();
            if (rr.length >= 3) {
              if (ringArea(rr) < 0) rr.reverse();
              let per = 0; for (let k = 0; k < rr.length; k++) per += Math.hypot(rr[(k + 1) % rr.length][0] - rr[k][0], rr[(k + 1) % rr.length][1] - rr[k][1]);
              const w = (4 * ringArea(rr)) / (per || 1), shape = info[1];
              let rh = info[2] > 0 ? info[2] : shape === 1 ? w * 0.5 : shape === 2 ? w * 0.95 : shape === 3 ? w * 0.8 : shape === 4 ? w * 0.45 : Math.min(w * 0.2, 6);
              if (rh > (h - base) * 0.75) rh = Math.max(0.8, (h - base) * 0.5);
              wallTop = h - rh;
              const owner = roofOwner.get(osmId);
              if (!owner || !tiles.has(owner) || owner === t.key) { roofOwner.set(osmId, t.key); roofRing = rr; }
            }
          }
          rf = mark ? [0, 0, 0, 1] : NO_ROOF;
          const first = n;
          rings.forEach((ring) => {
            for (let k = 0; k < ring.length; k++) {
              const a = ring[k], b = ring[(k + 1) % ring.length];
              if (onTileEdge(a.t, b.t, f.extent)) continue;
              const dx = b.l[0] - a.l[0], dy = b.l[1] - a.l[1], len = Math.hypot(dx, dy);
              if (len < 0.3) continue;
              const nx = dy / len, ny = -dx / len;
              const cells = len >= 2.4 && !mark ? Math.max(1, Math.round(len / 3.1)) : 0;
              const u0 = cells ? (k * 7) % 997 : -1, u1 = cells ? u0 + cells : -1;
              const v0 = vert(a.l[0], a.l[1], base, nx, ny, 0, u0, base, 0, seed, wallTop);
              const v1 = vert(b.l[0], b.l[1], base, nx, ny, 0, u1, base, 0, seed, wallTop);
              const v2 = vert(b.l[0], b.l[1], wallTop, nx, ny, 0, u1, wallTop, 0, seed, wallTop);
              const v3 = vert(a.l[0], a.l[1], wallTop, nx, ny, 0, u0, wallTop, 0, seed, wallTop);
              idx.push(v0, v1, v2, v0, v2, v3);
            }
          });
          const { verts, tris } = triangulate(rings);
          const s0 = n;
          verts.forEach((v) => vert(v.x, v.y, wallTop, 0, 0, 1, -1, wallTop, 1, seed, wallTop));
          tris.forEach((q) => idx.push(s0 + q[0], s0 + q[1], s0 + q[2]));
          if (roofRing) {
            const col = roofColour(info[3]);
            rf = [col[0], col[1], col[2], mark ? 1 : 0];
            roofGeometry(info[1], roofRing, wallTop, h, info[4] === -2, (x, y, z, nx, ny, nz) => vert(x, y, z, nx, ny, nz, -1, z, 2, seed, h), (a, b, c) => idx.push(a, b, c));
          }
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
        geo.setAttribute('aRoof', new THREE.Float32BufferAttribute(R, 4));
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
    // bridges: the deck rises off the river with ramps at its real ends, fascia, parapets, piers and lamps
    t.deckCells = []; t.deckSegSet = new Set();
    if (tile.layers.road) buildBridges(tile.layers.road, toL, g, recs, t);
    for (const rec of recs) { addRecord(rec); lightFromHistory(rec); }
    group.add(g);
    t.group = g; t.recs = recs;
    if (t.deckCells.length && trail.raw.length > 1) trail.dirty = true;   // the trail climbs onto the new decks
  }
  function buildBridges(layer, toL, g, recs, t) {
    const pieces = [];
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i), p = f.properties;
      if (p.structure !== 'bridge' || f.type !== 2) continue;
      const cls = String(p.class || '').replace(/_link$/, '');
      const w = BRIDGE_W[cls] || (/_link$/.test(p.class) ? 8 : 0);
      if (!w) continue;
      const rail = /rail/.test(cls), foot = cls === 'path' || cls === 'pedestrian' || cls === 'track';
      const deck = (rail ? 6 : foot ? 4.2 : 5.5) + (Number(p.layer) >= 2 ? 4 : 0);
      for (const line of f.loadGeometry()) {
        for (const pc of clipLine(line.map((q) => [q.x, q.y]), f.extent)) {
          pieces.push({ pts: pc.pts.map((q) => toL(q[0], q[1], f.extent)), openStart: pc.openStart, openEnd: pc.openEnd, w, deck, rail, key: cls + deck });
        }
      }
    }
    if (!pieces.length) return;
    // join pieces that meet end to end (OSM splits a bridge at every tag change)
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1.2;
    for (let merged = true; merged;) {
      merged = false;
      for (let i = 0; i < pieces.length && !merged; i++) for (let j = 0; j < pieces.length && !merged; j++) {
        if (i === j) continue;
        const A = pieces[i], Bp = pieces[j];
        if (A.key !== Bp.key || A.openEnd || Bp.openStart && Bp.openEnd) continue;
        let B = null;
        if (near(A.pts[A.pts.length - 1], Bp.pts[0]) && !Bp.openStart) B = Bp;
        else if (near(A.pts[A.pts.length - 1], Bp.pts[Bp.pts.length - 1]) && !Bp.openEnd) B = { ...Bp, pts: Bp.pts.slice().reverse(), openStart: Bp.openEnd, openEnd: Bp.openStart };
        if (!B) continue;
        A.pts = A.pts.concat(B.pts.slice(1)); A.openEnd = B.openEnd;
        pieces.splice(j, 1); merged = true;
      }
    }
    const acc = new Acc(3), bulbs = [], bulbT = [], bulbSeed = [], owners = [];
    for (const b of pieces) {
      // resample every ~3 m
      const path = [];
      let acc_s = 0;
      for (let i = 0; i < b.pts.length; i++) {
        const q = b.pts[i];
        if (i) {
          const pq = b.pts[i - 1], len = Math.hypot(q[0] - pq[0], q[1] - pq[1]), steps = Math.max(1, Math.ceil(len / 3));
          for (let k = 1; k <= steps; k++) { acc_s += len / steps; path.push({ x: pq[0] + ((q[0] - pq[0]) * k) / steps, y: pq[1] + ((q[1] - pq[1]) * k) / steps, s: acc_s }); }
        } else path.push({ x: q[0], y: q[1], s: 0 });
      }
      const L = acc_s;
      if (L < 4) continue;
      const open = b.openStart || b.openEnd, n0 = path.length;
      const inHero = path.map((p) => heroBridge(p.x, p.y)), hero = inHero.find(Boolean);
      if (hero) {      // stairs and ramps that meet a landmark at an angle are the landmark's own: none of the generic parts there
        const ex = hero.bx - hero.ax, ey = hero.by - hero.ay, dx = path[n0 - 1].x - path[0].x, dy = path[n0 - 1].y - path[0].y;
        if (Math.abs((ex * dx + ey * dy) / ((Math.hypot(ex, ey) || 1) * (Math.hypot(dx, dy) || 1))) < 0.8) inHero.fill(hero);
      }
      const Hd = hero && hero.spec.deck ? hero.spec.deck : open || L >= 40 ? b.deck : clamp((L - 6) * 0.14, 0.6, b.deck), ramp = Math.min(30, L * 0.35), hw = b.w / 2;
      const zAt = (s) => Hd * Math.min(b.openStart ? 1 : smooth(0, ramp, s), b.openEnd ? 1 : smooth(0, ramp, L - s));
      const first = acc.n, n = path.length;
      const L_ = [], R_ = [], Z_ = [];
      path.forEach((p, i) => {
        const a = path[Math.max(0, i - 1)], c = path[Math.min(n - 1, i + 1)], dl = Math.hypot(c.x - a.x, c.y - a.y) || 1;
        const nx = -(c.y - a.y) / dl, ny = (c.x - a.x) / dl;
        p.z = zAt(p.s); p.nx = nx; p.ny = ny;
        L_.push([p.x + nx * hw, p.y + ny * hw]); R_.push([p.x - nx * hw, p.y - ny * hw]); Z_.push(p.z);
      });
      const strip = (fn, m) => {      // a quad strip along the bridge: fn(i) → [[x, y, z] lower, [x, y, z] upper, normal]
        let prev = null;
        for (let i = 0; i < n; i++) {
          if (inHero[i]) { prev = null; continue; }        // a hero model stands here (detail/landmarks.json)
          const [lo, up, nr] = fn(i);
          const ids = [acc.v(lo[0], lo[1], lo[2], nr[0], nr[1], nr[2], [m, 0, path[i].s]), acc.v(up[0], up[1], up[2], nr[0], nr[1], nr[2], [m, 1, path[i].s])];
          if (prev) { acc.tri(prev[0], ids[0], ids[1]); acc.tri(prev[0], ids[1], prev[1]); }
          prev = ids;
        }
      };
      strip((i) => [[R_[i][0], R_[i][1], Z_[i] + 0.05], [L_[i][0], L_[i][1], Z_[i] + 0.05], [0, 0, 1]], 0);   // deck
      if (Hd > 0.5) {
        const fz = Math.min(1.1, Hd * 0.4);
        strip((i) => [[L_[i][0], L_[i][1], Z_[i] - fz], [L_[i][0], L_[i][1], Z_[i] + 0.05], [path[i].nx, path[i].ny, 0]], 1);    // fascia
        strip((i) => [[R_[i][0], R_[i][1], Z_[i] - fz], [R_[i][0], R_[i][1], Z_[i] + 0.05], [-path[i].nx, -path[i].ny, 0]], 1);
        strip((i) => [[R_[i][0], R_[i][1], Z_[i] - fz], [L_[i][0], L_[i][1], Z_[i] - fz], [0, 0, -1]], 2);                      // soffit
      }
      const ph = b.rail ? 0.6 : 1.05, inset = 0.25;
      strip((i) => { const p = path[i]; return [[L_[i][0] - p.nx * inset, L_[i][1] - p.ny * inset, Z_[i]], [L_[i][0] - p.nx * inset, L_[i][1] - p.ny * inset, Z_[i] + ph], [p.nx, p.ny, 0]]; }, 2);
      strip((i) => { const p = path[i]; return [[R_[i][0] + p.nx * inset, R_[i][1] + p.ny * inset, Z_[i]], [R_[i][0] + p.nx * inset, R_[i][1] + p.ny * inset, Z_[i] + ph], [-p.nx, -p.ny, 0]]; }, 2);
      // piers under the high part, every ~32 m
      for (let s = 16; s < L - 8; s += 32) {
        const i = path.findIndex((p) => p.s >= s);
        const p = path[i];
        if (!p || inHero[i] || p.z < Hd * 0.9 || p.z < 2) continue;
        acc.cur = { mat: 1, z0: 0, H: p.z * 1.25, s: p.s };
        box(acc, p.x, p.y, 0, b.w * 0.75, 1.6, p.z - Math.min(1.1, Hd * 0.4), Math.atan2(p.ny, p.nx));
      }
      // lamp posts on both parapets every 22 m (not on rail bridges)
      const bulbStart = bulbT.length;
      if (!b.rail && L > 14) for (let s = 8, side = 1; s < L - 4; s += 22, side = -side) {
        const i = path.findIndex((p) => p.s >= s), p = path[i];
        if (!p || inHero[i]) continue;
        for (const sd of [1, -1]) {
          const ex = p.x + p.nx * (hw - inset) * sd, ey = p.y + p.ny * (hw - inset) * sd;
          acc.cur = { mat: 2, z0: p.z, H: 5, s: p.s };
          beam(acc, [ex, ey, p.z], [ex, ey, p.z + 4.6], 0.14);
          beam(acc, [ex, ey, p.z + 4.5], [ex - p.nx * 0.7 * sd, ey - p.ny * 0.7 * sd, p.z + 4.6], 0.08);
          bulbs.push(ex - p.nx * 0.7 * sd, ey - p.ny * 0.7 * sd, p.z + 4.45); bulbT.push(NEVER); bulbSeed.push(hash1(p.s + sd));
        }
      }
      // the walkable deck for the trail and the runner
      for (let i = 1; i < n; i++) {
        const sg = { ax: path[i - 1].x, ay: path[i - 1].y, bx: path[i].x, by: path[i].y, za: path[i - 1].z, zb: path[i].z, hw };
        t.deckSegSet.add(sg); addDeckSeg(sg, t.deckCells);
      }
      const pts = new Float32Array(Math.ceil(n / 3) * 2);
      for (let i = 0, j = 0; i < n; i += 3, j++) { pts[j * 2] = path[i].x; pts[j * 2 + 1] = path[i].y; }
      const mid = path[Math.floor(n / 2)];
      if (acc.n === first && bulbT.length === bulbStart) continue;   // wholly under a hero model: only the walkable deck
      owners.push({ first, count: acc.n - first, bulbStart, bulbCount: bulbT.length - bulbStart, pts, cx: mid.x, cy: mid.y, h: Hd });
    }
    if (!acc.n) return;
    const lit = new THREE.Float32BufferAttribute(new Float32Array(acc.n * 2).map((_, i) => (i % 2 ? 0 : NEVER)), 2);
    lit.setUsage(THREE.DynamicDrawUsage);
    const mesh = new THREE.Mesh(acc.geometry({ aLit: lit }), M.deck); mesh.renderOrder = 1; mesh.frustumCulled = false; g.add(mesh);
    let bt = null;
    if (bulbs.length) {
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(bulbs, 3));
      bt = new THREE.Float32BufferAttribute(new Float32Array(bulbT), 1); bt.setUsage(THREE.DynamicDrawUsage);
      bg.setAttribute('aT', bt); bg.setAttribute('aSeed', new THREE.Float32BufferAttribute(bulbSeed, 1));
      const pb = new THREE.Points(bg, M.lamp); pb.renderOrder = 8; pb.frustumCulled = false; g.add(pb);
    }
    for (const o of owners) {
      const xy = new Float32Array(o.count * 2);
      for (let k = 0; k < o.count; k++) { xy[k * 2] = acc.P[(o.first + k) * 3]; xy[k * 2 + 1] = acc.P[(o.first + k) * 3 + 1]; }
      const ranges = [{ attr: lit, start: o.first, count: o.count, xy }];
      if (bt && o.bulbCount > 0) {
        const bxy = new Float32Array(o.bulbCount * 2);
        for (let k = 0; k < o.bulbCount; k++) { bxy[k * 2] = bulbs[(o.bulbStart + k) * 3]; bxy[k * 2 + 1] = bulbs[(o.bulbStart + k) * 3 + 1]; }
        ranges.push({ attr: bt, start: o.bulbStart, count: o.bulbCount, xy: bxy });
      }
      recs.push({ cx: o.cx, cy: o.cy, pts: o.pts, h: o.h, strength: 0, time: NEVER, ranges, line: true });
    }
  }
  function dropTile(key) {
    const t = tiles.get(key);
    tiles.delete(key);
    if (!t || !t.group) return;
    for (const rec of t.recs) { const list = grid.get(rec.cell); if (list) { const i = list.indexOf(rec); if (i >= 0) list.splice(i, 1); } }
    for (const k of t.deckCells || []) { const list = bridgeGrid.get(k); if (list) { const keep = list.filter((sg) => !t.deckSegSet.has(sg)); if (keep.length) bridgeGrid.set(k, keep); else bridgeGrid.delete(k); } }
    for (const [id, owner] of roofOwner) if (owner === key) roofOwner.delete(id);
    for (const k of t.waterKeys || []) { const list = waterTris.get(k); if (list) { const keep = list.filter((tri) => !t.waterTriSet.has(tri)); if (keep.length) waterTris.set(k, keep); else waterTris.delete(k); } }
    group.remove(t.group);
    t.group.traverse((o) => glassMeshes.delete(o));
    t.group.traverse((o) => { if (o.geometry && o.geometry !== TREE) o.geometry.dispose(); });
  }

  // ---------- city detail tiles ----------
  /** Resolves once the z14 detail tile is known (built, or not part of the index). */
  function ensureDetail(dx, dy) {
    const key = dx + '/' + dy;
    if (details.has(key)) return details.get(key).ready;
    const d = { dx, dy, group: null, recs: [], ready: null };
    d.ready = Promise.all([detailIndex, landmarksReady]).then(([index]) => {
      if (!index.has(key)) return;
      return fetch(`${detailBase}14/${key}.json`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && !disposed && details.get(key) === d) buildDetail(d, j); }).catch(() => {});
    });
    details.set(key, d);
    return d.ready;
  }
  function buildDetail(d, j) {
    for (const r of j.roofs || []) roofInfo.set(r[0], r);
    for (const tw of j.towers || []) if (tw[4]) replaced.add(tw[4]);
    for (const id of j.marks || []) marked.add(id);
    const g = new THREE.Group(), recs = [], acc = new Acc(2), jets = [], jetV = [], beacons = [], beaconPh = [];
    const objects = [];
    const begin = (cx, cy, h) => ({ first: acc.n, cx, cy, h, jetStart: jets.length / 3 });
    const end = (o, extra) => { o.count = acc.n - o.first; o.jetCount = jets.length / 3 - o.jetStart; objects.push(Object.assign(o, extra)); };
    for (const [kind, hTag, lng, lat] of j.monuments || []) {
      const [x, y] = toLocal(lng, lat);
      if (heroMonument(x, y)) continue;
      const o = begin(x, y, 0), ang = hash1(x * 0.13 + y * 0.71) * Math.PI * 2;
      const H = hTag > 0 ? hTag : [6, 2.6, 15, 8, 3, 3.2, 4, 35][kind];
      acc.cur = { mat: 0, z0: 0, H };
      if (kind === 0) {                       // statue on a pedestal
        const T = Math.max(H, 3), ped = T * 0.42, w = clamp(T * 0.3, 1.2, 7);
        box(acc, x, y, 0, w, w, ped * 0.12, ang); box(acc, x, y, ped * 0.12, w * 0.8, w * 0.8, ped * 0.88, ang);
        acc.cur.mat = 1; lathe(acc, x, y, ped, FIGURE, (T * 0.58) / 2.9);
      } else if (kind === 1) {                // bust on a plinth
        const T = Math.max(H, 1.8);
        box(acc, x, y, 0, 0.75, 0.75, T * 0.62, ang);
        acc.cur.mat = 1; lathe(acc, x, y, T * 0.62, BUST, (T * 0.38) / 0.88);
      } else if (kind === 2) {                // column with a golden figure on top (Freedom Monument)
        const r = Math.max(0.6, H * 0.035);
        box(acc, x, y, 0, r * 6, r * 6, H * 0.05, ang); box(acc, x, y, H * 0.05, r * 4, r * 4, H * 0.07, ang);
        lathe(acc, x, y, H * 0.12, [[r, 0], [r * 0.82, H * 0.66], [r * 1.3, H * 0.68], [r * 1.3, H * 0.71], [0, H * 0.71]], 1, 16);
        acc.cur.mat = 2; lathe(acc, x, y, H * 0.83, FIGURE, (H * 0.17) / 2.9);
      } else if (kind === 3) {                // obelisk
        const b = Math.max(0.7, H * 0.09);
        box(acc, x, y, 0, b * 3, b * 3, H * 0.06, ang);
        shaft(acc, x, y, H * 0.06, H * 0.92, b, b * 0.62, H * 0.08, ang);
      } else if (kind === 4) {                // stele / memorial stone
        box(acc, x, y, 0, Math.max(1.2, H * 0.45), 0.45, H, ang);
      } else if (kind === 5) {                // sculpture: a few turned blocks in bronze
        acc.cur.mat = 1;
        for (let k = 0; k < 3; k++) box(acc, x, y, (H / 3) * k, H * (0.32 - k * 0.06), H * (0.2 - k * 0.03), H / 3, ang + k * 0.6);
      } else if (kind === 6) {                // cross
        box(acc, x, y, 0, 0.35, 0.35, H, ang); box(acc, x, y, H * 0.66, H * 0.48, 0.3, 0.32, ang);
      } else if (kind === 7) {                // Chronicle of Georgia: a ring of tall pillars
        for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; box(acc, x + Math.cos(a) * 22, y + Math.sin(a) * 22, 0, 4.2, 1.6, H * (0.85 + 0.15 * hash1(k)), a + Math.PI / 2); }
      }
      end(o, { h: H });
    }
    for (const [lng, lat, r] of j.fountains || []) {
      const [x, y] = toLocal(lng, lat), o = begin(x, y, 1);
      acc.cur = { mat: 0, z0: 0, H: 2 };
      lathe(acc, x, y, 0, [[r, 0], [r + 0.15, 0.45], [r - 0.25, 0.5], [r - 0.3, 0.3]], 1, 24);
      acc.cur = { mat: 4, z0: 0, H: 2 };
      lathe(acc, x, y, 0.3, [[r - 0.3, 0], [0, 0.0001]], 1, 24);
      const nJ = Math.round(clamp(r * 10, 18, 70)), up = clamp(r * 1.6, 3, 9);
      for (let k = 0; k < nJ; k++) {
        const a = (k / nJ) * Math.PI * 2, sp = 0.25 + 0.5 * hash1(k * 3.1 + x);
        jets.push(x, y, 0.35); jetV.push(Math.cos(a) * sp * r * 0.45, Math.sin(a) * sp * r * 0.45, up * (0.8 + 0.3 * hash1(k + y)), hash1(k * 7.7));
      }
      end(o, { h: 2 });
    }
    for (const [lng, lat, H] of j.towers || []) {
      const [x, y] = toLocal(lng, lat);
      if (heroTower(x, y)) continue;
      const o = begin(x, y, H);
      acc.cur = { mat: 3, z0: 0, H };
      const levels = 12, legAt = (k, z) => { const half = (H * 0.075) * (1 - (z / H) * 0.86), a = Math.PI / 4 + (k * Math.PI) / 2; return [x + Math.cos(a) * half * 1.414, y + Math.sin(a) * half * 1.414, z]; };
      const t = Math.max(0.5, H * 0.006), top = H * 0.86;
      for (let l = 0; l < levels; l++) {
        const z0 = (top * l) / levels, z1 = (top * (l + 1)) / levels;
        for (let k = 0; k < 4; k++) {
          beam(acc, legAt(k, z0), legAt(k, z1), t * 1.6);
          beam(acc, legAt(k, z1), legAt((k + 1) % 4, z1), t);
          beam(acc, legAt(k, z0), legAt((k + 1) % 4, z1), t * 0.7);
        }
      }
      beam(acc, [x, y, top], [x, y, H], t * 1.2);           // the antenna
      for (const f of [0.3, 0.55, 0.86, 1]) { beacons.push(x, y, H * f + 0.6); beaconPh.push(f * 3.1); }
      end(o, { h: H });
    }
    for (const [H, T, line] of j.walls || []) {
      const pts = [];
      for (let k = 0; k < line.length; k += 2) pts.push(toLocal(line[k], line[k + 1]));
      if (pts.length < 2) continue;
      let cx = 0, cy = 0; pts.forEach((q) => { cx += q[0]; cy += q[1]; }); cx /= pts.length; cy /= pts.length;
      const o = begin(cx, cy, H);
      acc.cur = { mat: 0, z0: 0, H: H * 1.1 };
      const samp = [];
      for (let k = 1; k < pts.length; k++) {
        const [ax, ay] = pts[k - 1], [bx, by] = pts[k], len = Math.hypot(bx - ax, by - ay);
        if (len < 0.2) continue;
        const ang = Math.atan2(by - ay, bx - ax);
        box(acc, (ax + bx) / 2, (ay + by) / 2, 0, len + T * 0.5, T, H, ang);
        for (let s2 = 1.1; s2 < len - 0.5; s2 += 2.4) {        // merlons along the top
          const f = s2 / len; box(acc, ax + (bx - ax) * f, ay + (by - ay) * f, H, 1.2, T, 0.9, ang);
        }
        for (let s2 = 0; s2 < len; s2 += 8) samp.push(ax + ((bx - ax) * s2) / len, ay + ((by - ay) * s2) / len);
      }
      end(o, { h: H, pts: new Float32Array(samp), along: true });
    }
    if (acc.n) {
      const lit = new THREE.Float32BufferAttribute(new Float32Array(acc.n * 2).map((_, i) => (i % 2 ? 0 : NEVER)), 2);
      lit.setUsage(THREE.DynamicDrawUsage);
      const mesh = new THREE.Mesh(acc.geometry({ aLit: lit }), M.mon); mesh.renderOrder = 1; mesh.frustumCulled = false; g.add(mesh);
      let jl = null;
      if (jets.length) {
        const jg = new THREE.BufferGeometry();
        jg.setAttribute('position', new THREE.Float32BufferAttribute(jets, 3));
        jg.setAttribute('aJet', new THREE.Float32BufferAttribute(jetV, 4));
        jl = new THREE.Float32BufferAttribute(new Float32Array((jets.length / 3) * 2).map((_, i) => (i % 2 ? 0 : NEVER)), 2); jl.setUsage(THREE.DynamicDrawUsage);
        jg.setAttribute('aLit', jl);
        const jp = new THREE.Points(jg, M.jet); jp.renderOrder = 9; jp.frustumCulled = false; g.add(jp);
      }
      if (beacons.length) {
        const bg = new THREE.BufferGeometry();
        bg.setAttribute('position', new THREE.Float32BufferAttribute(beacons, 3));
        bg.setAttribute('aPhase', new THREE.Float32BufferAttribute(beaconPh, 1));
        const bp = new THREE.Points(bg, M.beacon); bp.renderOrder = 9; bp.frustumCulled = false; g.add(bp);
      }
      for (const o of objects) {
        if (!o.count) continue;
        const ranges = [{ attr: lit, start: o.first, count: o.count }];
        if (o.along) { const xy = new Float32Array(o.count * 2); for (let k = 0; k < o.count; k++) { xy[k * 2] = acc.P[(o.first + k) * 3]; xy[k * 2 + 1] = acc.P[(o.first + k) * 3 + 1]; } ranges[0].xy = xy; }
        if (jl && o.jetCount) ranges.push({ attr: jl, start: o.jetStart, count: o.jetCount });
        recs.push({ cx: o.cx, cy: o.cy, pts: o.pts && o.pts.length ? o.pts : null, h: o.h, strength: 0, time: NEVER, ranges, line: Boolean(o.along) });
      }
    }
    for (const rec of recs) { addRecord(rec); lightFromHistory(rec); }
    group.add(g);
    d.group = g; d.recs = recs;
  }
  function dropDetail(key) {
    const d = details.get(key);
    details.delete(key);
    if (!d || !d.group) return;
    for (const rec of d.recs) { const list = grid.get(rec.cell); if (list) { const i = list.indexOf(rec); if (i >= 0) list.splice(i, 1); } }
    group.remove(d.group);
    d.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
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
    for (const h of heroModels) if (!h.state && Math.hypot((h.ax + h.bx) / 2 - cx, (h.ay + h.by) / 2 - cy) < radius + (h.spec.farLoad || 900)) loadHeroModel(h);
    for (const [key, d] of details) {
      const m = fromMerc((d.dx + 0.5) / 2 ** 14, (d.dy + 0.5) / 2 ** 14);
      if (d.group && Math.hypot(m[0] - cx, m[1] - cy) > radius + 2600) dropDetail(key);
    }
    want.sort((a, b) => a.d - b.d);
    for (const w of want) {
      if (loading >= 4 || tiles.size >= MAX_TILES) break;
      const t = { tx: w.tx, ty: w.ty, key: w.tx + '/' + w.ty, group: null, recs: [] };
      tiles.set(w.tx + '/' + w.ty, t);
      loading++;
      // the street tile waits for its z14 detail tile: roof shapes are matched while the buildings are extruded
      const detail = ensureDetail(w.tx >> (Z - 14), w.ty >> (Z - 14));
      fetch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${Z}/${w.tx}/${w.ty}.vector.pbf?access_token=${token}`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((buf) => Promise.all([detail, landmarksReady]).then(() => buf))
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
    path.forEach((p, i) => { const a = path[Math.max(0, i - 1)], c = path[Math.min(n - 1, i + 1)]; p.z = deckZ(p.x, p.y, c.x - a.x, c.y - a.y); });
    for (const [halfW, z, mat, order] of RIBBONS) {
      const pos = new Float32Array(n * 6), along = new Float32Array(n * 2), across = new Float32Array(n * 2), idx = [];
      const win = Math.max(2, halfW * 1.3);
      const line = halfW > 3 ? rounded(path, halfW * 1.6) : path;   // wide glows round the corners so they never fold
      line.forEach((p, i) => {
        const a = sampleAt(line, p.s - win), b = sampleAt(line, p.s + win);
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
        const zz = z + path[i].z;
        pos.set([p.x + nx * halfW, p.y + ny * halfW, zz, p.x - nx * halfW, p.y - ny * halfW, zz], i * 6);
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
      pos.set([p.x, p.y, 0.3 + p.z, p.x, p.y, 2.6 + p.z], i * 6);
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
  function addLamp(x, y, t, ax, ay, z0 = 0) {
    const i = trail.lampCount++;
    const lx = x + ax * 0.8, ly = y + ay * 0.8;                 // the lantern hangs at the end of the arm
    lampGeo.attributes.position.setXYZ(i, lx, ly, LANTERN_Z + z0); lampGeo.attributes.aT.setX(i, t);
    lampGeo.attributes.position.needsUpdate = lampGeo.attributes.aT.needsUpdate = true;
    lampGeo.setDrawRange(0, trail.lampCount);
    tmpM.makeRotationZ(Math.atan2(-ax, ay)).setPosition(x, y, z0);  // local +y → (ax, ay)
    posts.setMatrixAt(i, tmpM); posts.count = trail.lampCount; posts.instanceMatrix.needsUpdate = true;
    cones.setMatrixAt(i, tmpM); cones.count = trail.lampCount; cones.instanceMatrix.needsUpdate = true;
    postGeo.attributes.iT.setX(i, t); postGeo.attributes.iT.needsUpdate = true;
    coneGeo.attributes.iT.setX(i, t); coneGeo.attributes.iT.needsUpdate = true;
    const P = lampPoolGeo.attributes.position, UV = lampPoolGeo.attributes.aUV, C = lampPoolGeo.attributes.aC, LT = lampPoolGeo.attributes.aLit, R = 8;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], k) => { P.setXYZ(i * 4 + k, lx + u * R, ly + v * R, 0.15 + z0); UV.setXY(i * 4 + k, u, v); C.setXYZ(i * 4 + k, lx, ly, 0.15 + z0); LT.setXY(i * 4 + k, t, 0.36); });
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
  function emitSparks(n, x, y, z = 0) {
    const P = sparkGeo.attributes.position, V = sparkGeo.attributes.aVel, B = sparkGeo.attributes.aBirth;
    for (let i = 0; i < n; i++) {
      const k = sparkNext; sparkNext = (sparkNext + 1) % SPARKS;
      P.setXYZ(k, x + (Math.random() - 0.5) * 1.8, y + (Math.random() - 0.5) * 1.8, 0.5 + z);
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
  const runner = { root: new THREE.Group(), raw: null, target: null, pos: null, from: null, t0: 0, dur: 1, interval: 0, angle: 0, heading: null, moveHeading: null, speed: 0, speedIn: 0, lastFix: 0, z: 0, scale: 3.5, gait: 'idle', activity: 'idle', forced: null, visible: true };
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
  let frameEma = 16, slowSince = 0, waterAt = 0;
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
    if (nowMs - waterAt > 250) { waterAt = nowMs; gatherWaterLights(cl[0], cl[1]); }
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
      // on a bridge the runner walks on the deck (a road passing under it keeps the runner on the ground)
      const mh = runner.moveHeading, dz = deckZ(x, y, mh == null ? null : Math.sin(mh), mh == null ? null : -Math.cos(mh));
      runner.z += (dz - runner.z) * Math.min(1, dt * 5);
      const rz = runner.z;
      runner.root.position.set(x, y, 0.3 + rz); runner.root.rotation.z = runner.angle;
      // on the map the runner keeps a readable size; in the close-up it fills about a third of the screen
      const want = heroView ? clamp((map.getCanvas().clientHeight * 0.3) / (U.uPxM.value * 1.75), 1.4, 6) : clamp(44 / (U.uPxM.value * 1.75), 2.2, 6);
      runner.scale += (want - runner.scale) * Math.min(1, dt * 3); runner.root.scale.setScalar(runner.scale);
      runner.root.visible = runner.visible;
      ring.visible = runner.visible; ring.position.set(x, y, 0.33 + rz); ring.scale.setScalar(runner.scale * 6.3);
      // open a window through buildings only while one actually hides the runner from the camera
      const mid = 0.3 + rz + 1.75 * runner.scale * 0.55;
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
      warmLight.position.set(x + 4, y - 3, 6 + rz); warmLight.intensity = 30 * U.uRun.value;
      if (moving && runner.visible) { sparkDebt += dt * (activity === 'run' ? 30 + 10 * v : 10); const n = Math.floor(sparkDebt); sparkDebt -= n; if (n) emitSparks(n, x, y, rz); }
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
        const side = trail.lampCount % 2 ? 1 : -1, z0 = deckZ(p.x, p.y, q.x - p.x, q.y - p.y);
        if (z0 > 0.5 && heroBridge(p.x, p.y)) { trail.lampNext += LAMP_EVERY; continue; }
        for (const s of [side, -side]) {
          const lx = p.x + nx * LAMP_SIDE * s, ly = p.y + ny * LAMP_SIDE * s;
          if (insideBuilding(lx, ly)) continue;
          addLamp(lx, ly, now(), -nx * s, -ny * s, z0);
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
      const feet = at(0.3 + runner.z), head = at(0.3 + runner.z + 1.75 * runner.scale);
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
    debug: { THREE, scene, camera, U, tiles, details, roofInfo, heroModels, heroes, runner, grid, insideBuilding, deckZ, toLngLat, toLocal, post: () => post },
    dispose() { disposed = true; cancelAnimationFrame(raf); if (post) post.dispose(); try { map.removeLayer('medirun-glow'); } catch { /* map already gone */ } },
  };
}
