import type { LatLng } from '@/lib/run/geo';

/**
 * Mapbox GL JS (v3 Standard style, 3D buildings, night/day light presets) rendered inside a WebView.
 * RN → web: `window.__run(msg)` via injectJavaScript. Web → RN: `ReactNativeWebView.postMessage`.
 *
 * Game-style "chase cam": while following, the camera sits low behind the runner
 * (high pitch, close zoom, bottom padding) and rotates with the heading so the
 * route lane always stretches ahead — racing-game navigation feel.
 *
 * Messages in:
 *  { type:'init', origin, pin, route:[[lng,lat]...]|null, radiusM }
 *  { type:'fix', lat, lng, heading }        — live position
 *  { type:'trail', coords:[[lng,lat]...] }  — full trail (sent throttled)
 *  { type:'fit' }                           — frame origin+pin+route
 *  { type:'follow' }                        — recenter + chase-cam follow
 *  { type:'reached' }                       — pin captured
 *  { type:'theme', dark:boolean }
 * Messages out: { type:'ready' } | { type:'error', message } | { type:'follow', value:boolean }
 */
export function buildRunMapHtml(opts: { token: string; center: LatLng; dark: boolean }): string {
  const token = JSON.stringify(opts.token);
  const center = JSON.stringify([opts.center.lng, opts.center.lat]);
  const dark = opts.dark ? 'true' : 'false';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css" rel="stylesheet" />
<script src="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: ${opts.dark ? '#030712' : '#e5eef0'}; }
  .mapboxgl-ctrl-logo { opacity: .35; transform: scale(.8); transform-origin: left bottom; }
  .mapboxgl-ctrl-attrib { display: none; }
  .mapboxgl-canvas { outline: none; }

  /* ── Runner puck: glossy teal disc + white navigation chevron ─────────── */
  .user { position: relative; width: 52px; height: 52px; }
  .user .ring {
    position: absolute; left: 50%; top: 50%; width: 24px; height: 24px; border-radius: 50%;
    transform: translate(-50%, -50%); border: 2.5px solid rgba(94,234,212,.95);
    animation: ring 2.1s ease-out infinite;
  }
  @keyframes ring { 0% { width: 24px; height: 24px; opacity: .95; } 100% { width: 76px; height: 76px; opacity: 0; } }
  .user .puck {
    position: absolute; left: 50%; top: 50%; width: 38px; height: 38px; border-radius: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle at 32% 26%, #5EEAD4 0%, #14B8A6 42%, #0B7C71 100%);
    border: 3px solid #fff;
    box-shadow: 0 0 0 4px rgba(20,184,166,.30), 0 6px 20px rgba(6,78,74,.6), 0 0 26px rgba(20,184,166,.85);
  }
  .user .chev {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -54%);
  }

  /* ── Destination pin: glossy 3D marker + beam + halo ──────────────────── */
  .pin { position: relative; width: 84px; height: 110px; }
  .pin .beam {
    position: absolute; left: 50%; bottom: 26px; width: 26px; height: 62px;
    transform: translateX(-50%);
    background: linear-gradient(to top, rgba(251,191,36,.5), rgba(251,191,36,0));
    clip-path: polygon(28% 100%, 72% 100%, 100% 0, 0 0);
    animation: beam 2.4s ease-in-out infinite;
  }
  @keyframes beam { 0%, 100% { opacity: .85; } 50% { opacity: .35; } }
  .pin .halo {
    position: absolute; left: 50%; bottom: 20px; width: 26px; height: 26px; border-radius: 50%;
    transform: translate(-50%, 50%) rotateX(68deg); border: 2.5px solid rgba(251,191,36,.9);
    animation: halo 1.9s ease-out infinite;
  }
  @keyframes halo { 0% { width: 26px; height: 26px; opacity: .95; } 100% { width: 96px; height: 96px; opacity: 0; } }
  .pin .shadow {
    position: absolute; left: 50%; bottom: 22px; width: 22px; height: 8px; border-radius: 50%;
    transform: translate(-50%, 50%); background: rgba(0,0,0,.4); filter: blur(3px);
    animation: shad 1.7s ease-in-out infinite;
  }
  @keyframes shad { 0%, 100% { transform: translate(-50%, 50%) scale(1); opacity: .55; } 50% { transform: translate(-50%, 50%) scale(.72); opacity: .3; } }
  .pin svg.body { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); animation: bob 1.7s ease-in-out infinite; filter: drop-shadow(0 10px 14px rgba(180,83,9,.45)); }
  @keyframes bob { 0%, 100% { bottom: 24px; } 50% { bottom: 38px; } }
  .pin.captured svg.body { filter: hue-rotate(96deg) saturate(1.05) drop-shadow(0 10px 14px rgba(5,150,105,.5)); animation: pop .5s ease-out 1; }
  .pin.captured .beam { background: linear-gradient(to top, rgba(52,211,153,.55), rgba(52,211,153,0)); }
  .pin.captured .halo { border-color: rgba(52,211,153,.95); }
  @keyframes pop { 0% { transform: translateX(-50%) scale(1); } 45% { transform: translateX(-50%) scale(1.25); } 100% { transform: translateX(-50%) scale(1); } }

  /* ── 3D Character canvas — tall enough for full stride (legs + head) ───── */
  #char3d {
    position: absolute; pointer-events: none; z-index: 20;
    width: 132px; height: 210px;
    left: -600px; top: -600px;
    opacity: 0;
    transition: opacity 0.55s ease;
    filter: drop-shadow(0 8px 16px rgba(0,0,0,0.45));
  }
  #char3d.ready { opacity: 1; }

  /* Soft oval under the feet — sits on the map GPS point */
  #char-shadow {
    position: absolute; pointer-events: none; z-index: 19;
    width: 52px; height: 18px; border-radius: 50%;
    background: radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, transparent 70%);
    transform: translate(-50%, -50%);
    left: -600px; top: -600px;
    opacity: 0;
    transition: opacity 0.55s ease;
  }
  #char-shadow.ready { opacity: 1; }
</style>
</head>
<body>
<div id="map"></div>

<!-- 3D character canvas (populated by Three.js module below) -->
<canvas id="char3d"></canvas>
<div id="char-shadow"></div>

<!-- Three.js UMD loaded below via sequential <script> tags -->

<script>
(function () {
  var post = function (m) { try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} };
  var DARK = ${dark};
  var TOKEN = ${token};
  var CENTER = ${center};
  var follow = true;
  var ready = false;
  var queue = [];
  var userMarker = null, pinMarker = null, pinEl = null;
  var standard = true;
  var fullRoute = null;   // [[lng,lat]...] as generated
  var routePtr = 0;       // index of the last vertex already passed
  var lastHeading = 0;

  // Chase camera tuning — racing-game navigation feel.
  var CHASE = { zoom: 18.3, pitch: 67, durMs: 950 };

  if (!TOKEN) { post({ type: 'error', message: 'no-token' }); return; }
  mapboxgl.accessToken = TOKEN;

  function styleFor(dark) { return standard ? 'mapbox://styles/mapbox/standard' : (dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11'); }

  var map = new mapboxgl.Map({
    container: 'map',
    style: styleFor(DARK),
    center: CENTER,
    zoom: 16.4,
    pitch: 62,
    bearing: 20,
    antialias: true,
    attributionControl: false,
    logoPosition: 'bottom-left',
    config: { basemap: { lightPreset: DARK ? 'night' : 'day', showPointOfInterestLabels: false, showTransitLabels: false, showPlaceLabels: true, showRoadLabels: true } }
  });

  // ── Expose map for the Three.js module (deferred, runs after this IIFE) ─
  window.__mapbox = map;

  var COLORS = {
    laneCasing: DARK ? 'rgba(4,47,46,0.85)' : 'rgba(15,76,72,0.55)',
    lane: DARK ? 'rgba(20,184,166,0.85)' : 'rgba(13,148,136,0.88)',
    laneGlow: DARK ? 'rgba(45,212,191,0.5)' : 'rgba(20,184,166,0.4)',
    trail: '#F59E0B',
    trailGlow: DARK ? 'rgba(251,191,36,0.55)' : 'rgba(245,158,11,0.45)',
    zone: DARK ? 'rgba(251,191,36,0.16)' : 'rgba(245,158,11,0.18)',
    zoneLine: DARK ? 'rgba(251,191,36,0.75)' : 'rgba(217,119,6,0.8)'
  };

  function empty() { return { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} }; }
  function line(coords) { return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }; }
  function circle(center, radiusM) {
    var pts = [], steps = 48, lat = center[1], lng = center[0];
    var dLat = radiusM / 111320, dLng = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
    for (var i = 0; i <= steps; i++) { var a = (i / steps) * Math.PI * 2; pts.push([lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat]); }
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts] }, properties: {} };
  }
  function distM(a, b) {
    var dLat = (b[1] - a[1]) * Math.PI / 180, dLng = (b[0] - a[0]) * Math.PI / 180;
    var la1 = a[1] * Math.PI / 180, la2 = b[1] * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // Lane width scales with zoom so it reads as a road-lane up close.
  var laneWidth = ['interpolate', ['exponential', 1.6], ['zoom'], 13, 4, 16, 8, 18.5, 22];
  var casingWidth = ['interpolate', ['exponential', 1.6], ['zoom'], 13, 7, 16, 13, 18.5, 32];
  var trailWidth = ['interpolate', ['exponential', 1.6], ['zoom'], 13, 3, 16, 5, 18.5, 12];

  function addLayers() {
    if (map.getSource('route')) return;
    var slot = standard ? { slot: 'middle' } : {};
    map.addSource('route', { type: 'geojson', data: empty() });
    map.addSource('trail', { type: 'geojson', data: empty() });
    map.addSource('zone', { type: 'geojson', data: empty() });
    map.addLayer(Object.assign({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': COLORS.zone } }, slot));
    map.addLayer(Object.assign({ id: 'zone-line', type: 'line', source: 'zone', paint: { 'line-color': COLORS.zoneLine, 'line-width': 2, 'line-dasharray': [1, 1.2] } }, slot));
    map.addLayer(Object.assign({ id: 'route-glow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': COLORS.laneGlow, 'line-width': casingWidth, 'line-blur': 10 } }, slot));
    map.addLayer(Object.assign({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': COLORS.laneCasing, 'line-width': casingWidth } }, slot));
    map.addLayer(Object.assign({ id: 'route-lane', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': COLORS.lane, 'line-width': laneWidth } }, slot));
    map.addLayer(Object.assign({ id: 'trail-glow', type: 'line', source: 'trail', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': COLORS.trailGlow, 'line-width': trailWidth, 'line-blur': 6 } }, slot));
    map.addLayer(Object.assign({ id: 'trail-line', type: 'line', source: 'trail', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': COLORS.trail, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 13, 2, 16, 3.5, 18.5, 7] } }, slot));
  }

  // ── User marker: puck stays visible until the 3D character canvas is ready ──
  // Once window.__loadCharacter fires, the puck is hidden via id="user-puck".
  function userEl() {
    var el = document.createElement('div'); el.className = 'user';
    el.innerHTML =
      '<div class="ring"></div>' +
      '<div class="puck" id="user-puck"></div>' +
      '<svg class="chev" id="user-chev" width="20" height="20" viewBox="0 0 24 24">' +
        '<path d="M12 3 L20 20 L12 15.6 L4 20 Z" fill="#fff" stroke="rgba(4,47,46,.35)" stroke-width="1"/>' +
      '</svg>';
    return el;
  }

  // ── Smooth marker: glide between GPS fixes (nav-app style) ────────────────
  var curPos = null, curRot = 0, anim = null, rafOn = false;
  function lerpAngle(a, b, t) { var d = ((b - a + 540) % 360) - 180; return a + d * t; }
  function snapUser(lng, lat, rot) {
    anim = null; curPos = [lng, lat]; if (typeof rot === 'number') curRot = rot;
    if (userMarker) { userMarker.setLngLat(curPos); userMarker.setRotation(curRot); }
  }
  function glideUser(lng, lat, rot, dur) {
    if (!curPos) { snapUser(lng, lat, rot); return; }
    // Teleport (reroll / GPS jump) → snap, don't slide across the map.
    if (distM(curPos, [lng, lat]) > 120) { snapUser(lng, lat, rot); return; }
    anim = {
      t0: performance.now(), dur: dur || 1000,
      fLng: curPos[0], fLat: curPos[1], tLng: lng, tLat: lat,
      fRot: curRot, tRot: typeof rot === 'number' ? rot : curRot
    };
    if (!rafOn) { rafOn = true; requestAnimationFrame(markerTick); }
  }
  function markerTick(now) {
    if (!anim || !userMarker) { rafOn = false; return; }
    var t = Math.min(1, (now - anim.t0) / anim.dur);
    curPos = [anim.fLng + (anim.tLng - anim.fLng) * t, anim.fLat + (anim.tLat - anim.fLat) * t];
    curRot = lerpAngle(anim.fRot, anim.tRot, t);
    userMarker.setLngLat(curPos);
    userMarker.setRotation(curRot);
    // Also expose the live interpolated position for the 3D canvas
    window.__curPos = curPos;
    if (t >= 1) { anim = null; rafOn = false; return; }
    requestAnimationFrame(markerTick);
  }

  function pinElement() {
    // Racing checkpoint: glossy amber teardrop with a checkered-flag core.
    var checks = '';
    var C0 = 17, R0 = 14, SQ = 5.5;
    for (var r = 0; r < 4; r++) {
      for (var q = 0; q < 4; q++) {
        if ((r + q) % 2 === 0) continue;
        checks += '<rect x="' + (C0 + q * SQ) + '" y="' + (R0 + r * SQ) + '" width="' + SQ + '" height="' + SQ + '" fill="#111827"/>';
      }
    }
    var el = document.createElement('div'); el.className = 'pin';
    el.innerHTML =
      '<div class="beam"></div><div class="halo"></div><div class="shadow"></div>' +
      '<svg class="body" width="56" height="68" viewBox="0 0 56 68">' +
        '<defs>' +
          '<linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="#FCD34D"/><stop offset=".45" stop-color="#F59E0B"/><stop offset="1" stop-color="#C2610C"/>' +
          '</linearGradient>' +
          '<radialGradient id="ph" cx=".3" cy=".2" r=".85">' +
            '<stop offset="0" stop-color="rgba(255,255,255,.9)"/><stop offset=".32" stop-color="rgba(255,255,255,.16)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/>' +
          '</radialGradient>' +
          '<clipPath id="pc"><circle cx="28" cy="25" r="11"/></clipPath>' +
        '</defs>' +
        '<path d="M28 66.5 C14 48.5 3.5 37.5 3.5 25 C3.5 11.8 14.6 2.5 28 2.5 C41.4 2.5 52.5 11.8 52.5 25 C52.5 37.5 42 48.5 28 66.5 Z" fill="url(#pg)" stroke="#fff" stroke-width="3"/>' +
        '<path d="M28 66.5 C14 48.5 3.5 37.5 3.5 25 C3.5 11.8 14.6 2.5 28 2.5 C41.4 2.5 52.5 11.8 52.5 25 C52.5 37.5 42 48.5 28 66.5 Z" fill="url(#ph)"/>' +
        '<circle cx="28" cy="25" r="13" fill="#fff"/>' +
        '<g clip-path="url(#pc)"><rect x="15" y="12" width="26" height="26" fill="#fff"/>' + checks + '</g>' +
        '<circle cx="28" cy="25" r="11" fill="none" stroke="rgba(17,24,39,.18)" stroke-width="1"/>' +
        '<ellipse cx="19" cy="12.5" rx="6.5" ry="3.8" fill="rgba(255,255,255,.7)" transform="rotate(-26 19 12.5)"/>' +
      '</svg>';
    return el;
  }

  // ── Chase cam ─────────────────────────────────────────────────────────────
  function chasePadding() { return { top: 0, left: 0, right: 0, bottom: Math.round(window.innerHeight * 0.44) }; }

  function engageChase(center, heading) {
    map.setPadding(chasePadding());
    map.easeTo({
      center: center,
      bearing: typeof heading === 'number' ? heading : lastHeading,
      zoom: CHASE.zoom,
      pitch: CHASE.pitch,
      duration: 800,
      essential: true
    });
  }

  // Remaining lane ahead of the runner: advance a pointer along the route and
  // redraw [current position → rest of route].
  function updateAhead(c) {
    if (!fullRoute || fullRoute.length < 2 || !map.getSource('route')) return;
    var bestI = routePtr, bestD = distM(c, fullRoute[routePtr]);
    var maxI = Math.min(fullRoute.length - 1, routePtr + 12);
    for (var i = routePtr + 1; i <= maxI; i++) {
      var d = distM(c, fullRoute[i]);
      if (d <= bestD) { bestD = d; bestI = i; }
    }
    if (bestD < 60) routePtr = bestI;
    var ahead = fullRoute.slice(routePtr + 1);
    if (bestD < 120) ahead.unshift(c);
    map.getSource('route').setData(ahead.length > 1 ? line(ahead) : empty());
  }

  function handle(msg) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'init': {
        addLayers();
        var o = [msg.origin.lng, msg.origin.lat];
        window.__curPos = o;
        if (!userMarker) { userMarker = new mapboxgl.Marker({ element: userEl(), rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(o).addTo(map); }
        snapUser(o[0], o[1]);
        if (msg.pin) {
          var p = [msg.pin.lng, msg.pin.lat];
          if (!pinMarker) { pinEl = pinElement(); pinMarker = new mapboxgl.Marker({ element: pinEl, anchor: 'bottom', offset: [0, 26] }).setLngLat(p).addTo(map); }
          else pinMarker.setLngLat(p);
          map.getSource('zone').setData(circle(p, msg.radiusM || 28));
        }
        if (msg.route && msg.route.length > 1) { fullRoute = msg.route; routePtr = 0; map.getSource('route').setData(line(fullRoute)); }
        else { fullRoute = null; map.getSource('route').setData(empty()); }
        map.getSource('trail').setData(empty());
        if (msg.fit !== false) fit(msg);
        break;
      }
      case 'fix': {
        var c = [msg.lng, msg.lat];
        if (typeof msg.heading === 'number') lastHeading = msg.heading;
        glideUser(msg.lng, msg.lat, lastHeading, CHASE.durMs);
        // Update 3D character heading
        window.__curPos = c;
        if (window.__setCharHeading) window.__setCharHeading(lastHeading);
        updateAhead(c);
        if (follow) {
          map.easeTo({
            center: c,
            bearing: lastHeading,
            zoom: CHASE.zoom,
            pitch: CHASE.pitch,
            duration: CHASE.durMs,
            easing: function (t) { return t; },
            essential: true
          });
        }
        break;
      }
      case 'trail': {
        if (map.getSource('trail')) map.getSource('trail').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: msg.coords || [] }, properties: {} });
        break;
      }
      case 'fit': fit(msg); break;
      case 'follow': {
        follow = true; post({ type: 'follow', value: true });
        if (userMarker) { var ll = userMarker.getLngLat(); engageChase([ll.lng, ll.lat], lastHeading); }
        break;
      }
      case 'reached': if (pinEl) pinEl.classList.add('captured'); break;
      case 'theme': {
        if (standard) { try { map.setConfigProperty('basemap', 'lightPreset', msg.dark ? 'night' : 'day'); } catch (e) {} }
        break;
      }
    }
  }

  function fit(msg) {
    var pts = [];
    if (userMarker) { var u = userMarker.getLngLat(); pts.push([u.lng, u.lat]); }
    if (pinMarker) { var p = pinMarker.getLngLat(); pts.push([p.lng, p.lat]); }
    if (fullRoute) pts = pts.concat(fullRoute);
    map.setPadding({ top: 0, left: 0, right: 0, bottom: 0 });
    if (pts.length < 2) { if (pts.length === 1) map.easeTo({ center: pts[0], zoom: 16.4, pitch: 62 }); return; }
    var b = pts.reduce(function (bb, c) { return bb.extend(c); }, new mapboxgl.LngLatBounds(pts[0], pts[0]));
    follow = false; post({ type: 'follow', value: false });
    map.fitBounds(b, { padding: { top: 120, bottom: (msg && msg.bottom) || 300, left: 56, right: 56 }, pitch: 48, bearing: 0, duration: 1100, maxZoom: 17 });
  }

  window.__run = function (msg) { if (!ready) { queue.push(msg); return; } handle(msg); };

  map.on('style.load', function () {
    addLayers();
    if (!ready) { ready = true; post({ type: 'ready' }); queue.forEach(handle); queue = []; }
  });
  // Only USER gestures break the chase cam — programmatic easeTo also fires
  // dragstart/rotatestart, so require an originalEvent (touch) to disengage.
  function userInterrupt(e) {
    if (!e || !e.originalEvent || !follow) return;
    follow = false;
    map.setPadding({ top: 0, left: 0, right: 0, bottom: 0 });
    post({ type: 'follow', value: false });
  }
  map.on('dragstart', userInterrupt);
  map.on('rotatestart', userInterrupt);
  map.on('pitchstart', userInterrupt);

  var fellBack = false;
  map.on('error', function (e) {
    var m = (e && e.error && e.error.message) || '';
    // Standard style unavailable (old WebView / token scope) → classic dark/light.
    if (!fellBack && standard && !ready) { fellBack = true; standard = false; try { map.setStyle(styleFor(DARK)); } catch (err) {} return; }
    if (/token|Unauthorized|401|403/i.test(m)) post({ type: 'error', message: m });
  });
})();
</script>

<!-- ═══════════════════════════════════════════════════════════════════════════
     THREE.JS 3D CHARACTER — classic <script> only (RN WebView kills type=module).
     Libs load from URLs injected by RunMap (Metro-served .bin) or CDN fallback
     three@0.147 (last release that still ships examples/js UMD GLTFLoader).
     ═══════════════════════════════════════════════════════════════════════════ -->
<script>
(function () {
  var dbg = function (msg) {
    try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'char_debug', msg: msg })); } catch (e) {}
    console.log('[char]', msg);
  };
  window.__charDbg = dbg;

  window.__charPendingUrl = null;
  window.__loadCharacter = function (url) { window.__charPendingUrl = url; dbg('queued character (libs not ready)'); };
  window.__setCharHeading = function () {};

  var c3d = document.getElementById('char3d');
  var shadowEl = document.getElementById('char-shadow');
  var W = 132, H = 210;
  var dpr = Math.min(window.devicePixelRatio || 2, 2);
  var booted = false;

  function loadScript(src, cb) {
    dbg('loadScript ' + String(src).slice(0, 90));
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = function () { dbg('loaded ok: ' + String(src).slice(0, 60)); cb(null); };
    s.onerror = function () { dbg('load FAIL: ' + String(src).slice(0, 90)); cb(new Error('fail ' + src)); };
    document.head.appendChild(s);
  }

  function setupChar() {
    try {
      if (typeof THREE === 'undefined') { dbg('ERROR: THREE missing'); return; }
      if (!THREE.GLTFLoader) { dbg('ERROR: GLTFLoader missing'); return; }
      dbg('setupChar THREE r' + THREE.REVISION + ' meshopt=' + (typeof MeshoptDecoder !== 'undefined'));

      c3d.width = W * dpr; c3d.height = H * dpr;
      var renderer = new THREE.WebGLRenderer({ canvas: c3d, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setSize(W, H, false);
      renderer.setPixelRatio(dpr);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;

      var scene = new THREE.Scene();
      var aspect = W / H;
      var camBottom = -0.32;
      var camTop = 1.95;
      var frH = camTop - camBottom;
      var frW = frH * aspect;
      /* Ortho: feet on baseline, head fully in frame — no float, no clip */
      var camera = new THREE.OrthographicCamera(-frW / 2, frW / 2, camTop, camBottom, 0.1, 40);
      camera.position.set(0, 0.85, 8);
      camera.lookAt(0, 0.85, 0);

      scene.add(new THREE.HemisphereLight(0xd0e8ff, 0x3d5c3a, 0.55));
      scene.add(new THREE.AmbientLight(0xffffff, 0.35));
      var key = new THREE.DirectionalLight(0xfff2d6, 1.45); key.position.set(3, 7, 4); scene.add(key);
      var brand = new THREE.DirectionalLight(0x2DD4BF, 0.55); brand.position.set(-4, 2, 2); scene.add(brand);
      var rim = new THREE.DirectionalLight(0xffffff, 0.95); rim.position.set(-1, 4, -5); scene.add(rim);

      var loader = new THREE.GLTFLoader();
      var pivot = new THREE.Group();
      scene.add(pivot);
      var mixer = null, model = null, charReady = false, curHeading = 0;
      var clock = new THREE.Clock();
      var basePos = new THREE.Vector3();
      var runAction = null;

      /**
       * Remove linear Hip/Root/Pelvis translation drift (baked into GLB already,
       * but safe to re-apply). Keeps cyclic bob so the run still looks alive.
       */
      function makeInPlaceClip(clip) {
        var c = clip.clone();
        for (var t = 0; t < c.tracks.length; t++) {
          var track = c.tracks[t];
          var name = track.name || '';
          if (!/\.position$/.test(name)) continue;
          var bone = name.split('.')[0];
          if (!/^(hip|hips|pelvis|root|armature)$/i.test(bone)) continue;
          var v = track.values;
          var times = track.times;
          if (!v || !times || times.length < 2) continue;
          var stride = track.getValueSize ? track.getValueSize() : 3;
          var nKeys = times.length;
          var x0 = v[0], y0 = v[1], z0 = v[2];
          var x1 = v[(nKeys - 1) * stride];
          var y1 = v[(nKeys - 1) * stride + 1];
          var z1 = v[(nKeys - 1) * stride + 2];
          var span = Math.max(1e-6, times[nKeys - 1] - times[0]);
          var mag = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0) + (z1 - z0) * (z1 - z0));
          if (mag < 0.001) continue;
          for (var i = 0; i < nKeys; i++) {
            var u = (times[i] - times[0]) / span;
            var o = i * stride;
            v[o] -= x0 + (x1 - x0) * u;
            v[o + 1] -= y0 + (y1 - y0) * u;
            v[o + 2] -= z0 + (z1 - z0) * u;
          }
          dbg('de-drift ' + bone + ' mag=' + mag.toFixed(3));
        }
        return c;
      }

      function fitCameraToModel() {
        if (!model) return;
        model.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(model);
        var h = Math.max(0.5, box.max.y - box.min.y);
        camBottom = -0.32;
        camTop = h + 0.16;
        frH = camTop - camBottom;
        frW = frH * aspect;
        camera.left = -frW / 2;
        camera.right = frW / 2;
        camera.top = camTop;
        camera.bottom = camBottom;
        camera.position.set(0.15, h * 0.45, 8);
        camera.lookAt(0, h * 0.45, 0);
        camera.updateProjectionMatrix();
      }

      function groundPixelFromTop() {
        return H * (1 - (0 - camBottom) / (camTop - camBottom));
      }

      function plantFeet() {
        if (!model) return;
        model.position.set(0, 0, 0);
        model.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(model);
        model.position.x = -((box.min.x + box.max.x) * 0.5);
        model.position.z = -((box.min.z + box.max.z) * 0.5);
        model.position.y = -box.min.y;
        basePos.copy(model.position);
      }

      function wireMeshopt(next) {
        var dec = window.MeshoptDecoder;
        if (!dec || !loader.setMeshoptDecoder) { next(); return; }
        if (dec.ready && dec.ready.then) {
          dec.ready.then(function () { loader.setMeshoptDecoder(dec); dbg('meshopt ready'); next(); })
            .catch(function (e) { dbg('meshopt ready fail ' + e); next(); });
        } else {
          loader.setMeshoptDecoder(dec);
          next();
        }
      }

      function actualLoad(url) {
        dbg('actualLoad ' + String(url).slice(0, 100));
        loader.load(url, function (gltf) {
          var names = (gltf.animations || []).map(function (a) { return a.name; });
          dbg('GLB parsed! anims=' + names.length + ' [' + names.join(', ') + ']');

          while (pivot.children.length) pivot.remove(pivot.children[0]);
          if (mixer) { mixer.stopAllAction(); mixer = null; }
          runAction = null;

          model = gltf.scene;
          model.traverse(function (n) {
            if (n.isMesh) n.frustumCulled = false;
          });

          var box0 = new THREE.Box3().setFromObject(model);
          var s = 1.7 / Math.max(box0.max.y - box0.min.y, 0.01);
          model.scale.setScalar(s);
          pivot.add(model);
          plantFeet();
          fitCameraToModel();

          if (gltf.animations && gltf.animations.length) {
            mixer = new THREE.AnimationMixer(model);
            var clip = null;
            for (var i = 0; i < gltf.animations.length; i++) {
              if (/run|jog|sprint/i.test(gltf.animations[i].name)) { clip = gltf.animations[i]; break; }
            }
            if (!clip) clip = gltf.animations[0];
            var inPlace = makeInPlaceClip(clip);
            runAction = mixer.clipAction(inPlace);
            runAction.reset();
            runAction.setLoop(THREE.LoopRepeat, Infinity);
            runAction.clampWhenFinished = false;
            runAction.enabled = true;
            runAction.setEffectiveWeight(1);
            runAction.setEffectiveTimeScale(1.0);
            runAction.play();
            dbg('playing LoopRepeat: ' + clip.name + ' dur=' + inPlace.duration);
            mixer.update(0);
            plantFeet();
            fitCameraToModel();
          }

          var p = document.getElementById('user-puck');
          var v = document.getElementById('user-chev');
          var ring = document.querySelector('.user .ring');
          if (p) p.style.display = 'none';
          if (v) v.style.display = 'none';
          if (ring) ring.style.display = 'none';

          charReady = true;
          c3d.classList.add('ready');
          shadowEl.classList.add('ready');
        }, undefined, function (err) {
          dbg('GLB ERROR: ' + String(err && err.message ? err.message : err));
        });
      }

      wireMeshopt(function () {
        window.__setCharHeading = function (h) { curHeading = h; };
        window.__loadCharacter = function (url) { actualLoad(url); };
        dbg('ready pending=' + (window.__charPendingUrl ? 'YES' : 'none'));
        if (window.__charPendingUrl) {
          var u = window.__charPendingUrl;
          window.__charPendingUrl = null;
          actualLoad(u);
        }
      });

      (function tick() {
        requestAnimationFrame(tick);
        var dt = clock.getDelta();
        if (mixer) mixer.update(dt);
        if (model) {
          model.position.x = basePos.x;
          model.position.y = basePos.y;
          model.position.z = basePos.z;
        }
        if (charReady && window.__curPos && window.__mapbox) {
          try {
            var pt = window.__mapbox.project(window.__curPos);
            c3d.style.left = (pt.x - W * 0.5) + 'px';
            c3d.style.top = (pt.y - groundPixelFromTop()) + 'px';
            shadowEl.style.left = pt.x + 'px';
            shadowEl.style.top = pt.y + 'px';
            pivot.rotation.y = Math.PI + (curHeading - window.__mapbox.getBearing()) * (Math.PI / 180);
          } catch (e) {}
        }
        renderer.render(scene, camera);
      })();
    } catch (err) {
      dbg('setupChar CRASH: ' + String(err && err.message ? err.message : err));
    }
  }

  /** Called from RunMap with Metro-served script URLs (preferred) or falls back to CDN. */
  window.__bootCharacterLibs = function (urls) {
    if (booted) {
      if (urls && urls.character) window.__loadCharacter(urls.character);
      return;
    }
    booted = true;
    urls = urls || {};
    var threeUrl = urls.three || 'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js';
    var gltfUrl = urls.gltf || 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js';
    var meshUrl = urls.meshopt || 'https://cdn.jsdelivr.net/npm/meshoptimizer@0.22.0/meshopt_decoder.js';
    if (urls.character) window.__charPendingUrl = urls.character;

    dbg('boot libs…');
    loadScript(threeUrl, function (e1) {
      if (e1) { dbg('three failed, abort'); return; }
      loadScript(gltfUrl, function (e2) {
        if (e2) { dbg('gltfloader failed, abort'); return; }
        loadScript(meshUrl, function () {
          /* meshopt optional — still setup even if it fails */
          setupChar();
        });
      });
    });
  };

  dbg('char stubs ready — waiting for __bootCharacterLibs');
})();
</script>

</body>
</html>`;
}
