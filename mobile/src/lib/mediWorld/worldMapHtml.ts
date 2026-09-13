export const WORLD_MAP_HTML_REV = 2;

type BuildArgs = {
  token: string;
  dark: boolean;
  reduceMotion: boolean;
  center: { lat: number; lng: number };
  zoom?: number;
  pitch?: number;
  hereLabel?: string;
};

/**
 * Mapbox GL JS v3.8.0 Standard — same engine as Running (`run/mapHtml.ts`).
 * Day/night `lightPreset`. Care Spark markers follow the Stitch Explore screens.
 */
export function buildWorldMapHtml({
  token,
  dark,
  reduceMotion,
  center,
  zoom = 16.15,
  pitch = 42,
  hereLabel = 'აქ ხარ',
}: BuildArgs) {
  const tokenJson = JSON.stringify(token);
  const centerJson = JSON.stringify([center.lng, center.lat]);
  const hereJson = JSON.stringify(hereLabel);
  const darkJs = dark ? 'true' : 'false';
  const reduceJs = reduceMotion ? 'true' : 'false';
  const bg = dark ? '#0B1E1C' : '#DDF0EC';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css" rel="stylesheet" />
<script src="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background: ${bg}; }
  .mapboxgl-ctrl-logo { opacity: .28; transform: scale(.72); transform-origin: left bottom; }
  .mapboxgl-ctrl-attrib { display: none; }
  .mapboxgl-canvas { outline: none; }
  .user { position: relative; width: 72px; height: 72px; }
  .user .beam {
    position: absolute; left: 50%; top: 6px; width: 54px; height: 54px; margin-left: -27px;
    border-radius: 50%; background: radial-gradient(circle at 50% 80%, rgba(0,183,166,.28), transparent 70%);
    transform: rotate(-28deg);
  }
  .user .ring {
    position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; border-radius: 50%;
    transform: translate(-50%, -50%); background: rgba(45,212,191,.32);
    animation: ${reduceMotion ? 'none' : 'pulse 2.4s ease-in-out infinite'};
  }
  @keyframes pulse {
    0% { transform: translate(-50%,-50%) scale(.95); opacity: .8; }
    50% { transform: translate(-50%,-50%) scale(1.45); opacity: .18; }
    100% { transform: translate(-50%,-50%) scale(.95); opacity: .8; }
  }
  .user .puck {
    position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; border-radius: 50%;
    transform: translate(-50%, -50%);
    background: #00B7A6; border: 2.5px solid #fff;
    box-shadow: 0 2px 8px rgba(16,54,48,.28);
  }
  .user .puck i {
    display: block; width: 6px; height: 6px; margin: 3px auto 0; border-radius: 50%; background: #fff;
  }
  .user .tag {
    position: absolute; left: 50%; top: 58px; transform: translateX(-50%);
    font: 700 9px/1.2 "Noto Sans Georgian", sans-serif; color: #115E59;
    background: rgba(255,255,255,.95); border: 1px solid rgba(204,251,241,.85);
    padding: 2px 6px; border-radius: 999px; white-space: nowrap;
    box-shadow: 0 1px 4px rgba(16,54,48,.08);
  }
  .mk { position: relative; width: 44px; height: 58px; }
  .mk button {
    position: absolute; left: 50%; bottom: 0; width: 36px; height: 36px; margin-left: -18px;
    border: 0; padding: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 10px rgba(16,54,48,.16);
  }
  .mk .ic { width: 18px; height: 18px; }
  .mk.care button { background: #FFF1F2; border: 2px solid #FECDD3; }
  .mk.care .ic { color: #FB7185; }
  .mk.calm button { background: #F5F3FF; border: 2px solid #DDD6FE; }
  .mk.calm .ic { color: #8B5CF6; }
  .mk.movement button { background: #FFFBEB; border: 2px solid #FDE68A; }
  .mk.movement .ic { color: #F59E0B; }
  .mk.hydration button { background: #ECFEFF; border: 2px solid #A5F3FC; }
  .mk.hydration .ic { color: #22D3EE; }
  .mk.connection button { background: #F0FDFA; border: 2px solid #99F6E4; }
  .mk.connection .ic { color: #00B7A6; }
  .mk.collected button { background: #F3F4F6; border: 2px solid #E5E7EB; }
  .mk.collected .ic { color: #9CA3AF; }
  .mk.sel { width: 88px; height: 86px; }
  .mk.sel .float {
    position: absolute; left: 50%; top: 0; transform: translateX(-50%);
    display: flex; align-items: center; gap: 4px;
    background: rgba(19,78,74,.92); color: #fff; font: 700 10px/1 "Noto Sans Georgian", sans-serif;
    padding: 4px 10px; border-radius: 999px; white-space: nowrap; max-width: 86px;
    overflow: hidden; text-overflow: ellipsis;
    border: 1px solid rgba(94,234,212,.4);
    animation: ${reduceMotion ? 'none' : 'bob .9s ease-in-out infinite alternate'};
  }
  .mk.sel .float b { width: 6px; height: 6px; border-radius: 50%; background: #5EEAD4; flex: 0 0 auto; }
  @keyframes bob { from { transform: translateX(-50%) translateY(0); } to { transform: translateX(-50%) translateY(-3px); } }
  .mk.sel button {
    width: 40px; height: 40px; margin-left: -20px; bottom: 2px; border-radius: 16px;
    background: linear-gradient(135deg, #00B7A6, #2DD4BF); border: 0;
    box-shadow: 0 0 18px rgba(0,183,166,.55);
    animation: ${reduceMotion ? 'none' : 'glow 2s ease-in-out infinite'};
  }
  .mk.sel .ic { color: #fff; }
  .mk.sel .halo {
    position: absolute; left: 50%; bottom: 0; width: 48px; height: 48px; margin-left: -24px;
    border-radius: 50%; background: rgba(0,183,166,.28);
    animation: ${reduceMotion ? 'none' : 'ping 1.6s cubic-bezier(0,0,.2,1) infinite'};
  }
  @keyframes glow {
    0%,100% { transform: scale(1); filter: drop-shadow(0 4px 10px rgba(0,183,166,.5)); }
    50% { transform: scale(1.05); filter: drop-shadow(0 6px 16px rgba(0,183,166,.75)); }
  }
  @keyframes ping { 0% { transform: scale(.9); opacity: .7; } 100% { transform: scale(1.35); opacity: 0; } }
</style>
</head>
<body>
<div id="map"></div>
<script>
(function () {
  var post = function (m) { try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} };
  var DARK = ${darkJs};
  var TOKEN = ${tokenJson};
  var CENTER = ${centerJson};
  var REDUCE = ${reduceJs};
  var HERE = ${hereJson};
  var ZOOM = ${Number(zoom)};
  var PITCH = ${Number(pitch)};
  var ready = false;
  var queue = [];
  var userMarker = null;
  var placeMarkers = {};
  var following = true;
  var userMoved = false;
  var standard = true;
  var firstUser = true;

  if (!TOKEN) { post({ type: 'error', message: 'no-token' }); return; }
  mapboxgl.accessToken = TOKEN;

  function styleFor(dark) {
    return standard ? 'mapbox://styles/mapbox/standard' : (dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11');
  }

  var map = new mapboxgl.Map({
    container: 'map',
    style: styleFor(DARK),
    center: CENTER,
    zoom: ZOOM,
    pitch: PITCH,
    bearing: 8,
    antialias: true,
    attributionControl: false,
    logoPosition: 'bottom-left',
    config: {
      basemap: {
        lightPreset: DARK ? 'night' : 'day',
        showPointOfInterestLabels: false,
        showTransitLabels: false,
        showPlaceLabels: true,
        showRoadLabels: true
      }
    }
  });

  map.on('error', function (e) {
    var msg = (e && e.error && e.error.message) || 'map-error';
    if (/standard/i.test(msg) && standard) {
      standard = false;
      map.setStyle(styleFor(DARK));
      return;
    }
    post({ type: 'provider-error', message: msg });
  });

  map.on('dragstart', function () { userMoved = true; following = false; post({ type: 'follow', following: false }); });

  function userEl() {
    var el = document.createElement('div');
    el.className = 'user';
    el.innerHTML = '<div class="beam"></div><div class="ring"></div><div class="puck"><i></i></div><div class="tag"></div>';
    el.querySelector('.tag').textContent = HERE;
    return el;
  }

  function glyph(kind) {
    if (kind === 'care') return '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
    if (kind === 'calm') return '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C12 2 13.5 8 16 9.5C18.5 11 22 12 22 12C22 12 18.5 13 16 14.5C13.5 16 12 22 12 22C12 22 10.5 16 8 14.5C5.5 13 2 12 2 12C2 12 5.5 11 8 9.5C10.5 8 12 2 12 2Z"/></svg>';
    return '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C10.5 5 7 7.5 4 8c0 5 3.5 10 8 13c4.5-3 8-8 8-13c-3-.5-6.5-3-8-6z"/></svg>';
  }

  function pinEl(place, selectedId) {
    var spark = place.spark || {};
    var cat = String(spark.category || 'care');
    var selected = selectedId === place.id;
    var el = document.createElement('div');
    el.className = 'mk ' + cat + (spark.collected ? ' collected' : '') + (selected ? ' sel' : '');
    var name = place.nameKa || place.nameEn || '';
    el.innerHTML = (selected ? '<div class="float"><b></b><span></span></div><span class="halo"></span>' : '') + '<button type="button"></button>';
    el.querySelector('button').innerHTML = glyph(cat);
    if (selected) el.querySelector('.float span').textContent = name;
    el.querySelector('button').addEventListener('click', function (ev) {
      ev.stopPropagation();
      post({ type: 'select', id: place.id });
    });
    return el;
  }

  function setUser(lat, lng, fly) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    var ll = [lng, lat];
    if (!userMarker) userMarker = new mapboxgl.Marker({ element: userEl(), anchor: 'center' }).setLngLat(ll).addTo(map);
    else userMarker.setLngLat(ll);
    if (fly && following && !userMoved) {
      var duration = REDUCE ? 0 : (firstUser ? 0 : 450);
      firstUser = false;
      map.easeTo({ center: ll, duration: duration, pitch: PITCH, zoom: Math.max(map.getZoom(), 16.05) });
    }
  }

  function apply(payload) {
    var nextIds = {};
    (payload.places || []).forEach(function (place) {
      if (!place || !Number.isFinite(place.publicLat) || !Number.isFinite(place.publicLng)) return;
      nextIds[place.id] = true;
      var existing = placeMarkers[place.id];
      if (existing) existing.remove();
      var marker = new mapboxgl.Marker({ element: pinEl(place, payload.selectedId), anchor: 'bottom' })
        .setLngLat([place.publicLng, place.publicLat])
        .addTo(map);
      placeMarkers[place.id] = marker;
    });
    Object.keys(placeMarkers).forEach(function (id) {
      if (!nextIds[id]) {
        placeMarkers[id].remove();
        delete placeMarkers[id];
      }
    });
    if (payload.user && Number.isFinite(payload.user.lat) && Number.isFinite(payload.user.lng)) {
      setUser(payload.user.lat, payload.user.lng, true);
    }
  }

  function handle(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === 'state') apply(msg);
    if (msg.type === 'center' && msg.lat != null) {
      following = true; userMoved = false;
      map.easeTo({ center: [msg.lng, msg.lat], zoom: 16.3, pitch: PITCH, duration: REDUCE ? 0 : 500 });
      post({ type: 'follow', following: true });
    }
    if (msg.type === 'theme') {
      DARK = !!msg.dark;
      if (standard) { try { map.setConfigProperty('basemap', 'lightPreset', DARK ? 'night' : 'day'); } catch (e) {} }
      else { map.setStyle(styleFor(DARK)); }
    }
  }

  map.on('load', function () {
    ready = true;
    post({ type: 'ready' });
    queue.forEach(handle);
    queue = [];
  });

  window.__world = function (msg) { if (!ready) { queue.push(msg); return; } handle(msg); };
})();
</script>
</body>
</html>`;
}
