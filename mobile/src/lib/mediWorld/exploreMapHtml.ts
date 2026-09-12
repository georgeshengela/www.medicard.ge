export const EXPLORE_MAP_HTML_REV = 2;

type BuildArgs = {
  dark: boolean;
  reduceMotion: boolean;
};

export function buildExploreMapHtml({ dark, reduceMotion }: BuildArgs) {
  const tiles = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; background: ${dark ? '#111827' : '#F3F4F6'}; }
  .spark { width: 18px; height: 18px; border-radius: 999px; background: #14B8A6; border: 2px solid #99F6E4; }
  .spark.pulse { animation: ${reduceMotion ? 'none' : 'pulse 1.8s ease-in-out infinite'}; }
  .spark.collected { background: #6B7280; animation: none; }
  .place { width: 12px; height: 12px; border-radius: 999px; background: #0D9488; }
  .me { width: 16px; height: 16px; border-radius: 999px; background: #14B8A6; box-shadow: 0 0 0 6px rgba(20,184,166,0.25); }
  .sel { outline: 3px solid #99F6E4; }
  @keyframes pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.18); opacity: 0.75; } }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  function send(msg) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {}
  }
  if (!window.L) { send({ type: 'provider-error' }); }
  else {
    var map = L.map('map', { zoomControl: false, attributionControl: true });
    L.tileLayer(${JSON.stringify(tiles)}, {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);
    var markers = L.layerGroup().addTo(map);
    var me = null;
    var following = true;
    var userMoved = false;
    map.on('dragstart', function() { userMoved = true; following = false; send({ type: 'follow', following: false }); });
    function icon(cls) {
      return L.divIcon({ className: '', html: '<div class="' + cls + '"></div>', iconSize: [18, 18] });
    }
    function apply(payload) {
      markers.clearLayers();
      (payload.places || []).forEach(function(place) {
        var spark = place.spark;
        var cls = spark ? ('spark' + (spark.collected ? ' collected' : ' pulse')) : 'place';
        if (payload.selectedId === place.id) cls += ' sel';
        var m = L.marker([place.publicLat, place.publicLng], { icon: icon(cls) });
        m.on('click', function() { send({ type: 'select', id: place.id }); });
        m.addTo(markers);
      });
      if (payload.user && Number.isFinite(payload.user.lat) && Number.isFinite(payload.user.lng)) {
        if (!me) me = L.marker([payload.user.lat, payload.user.lng], { icon: icon('me'), interactive: false }).addTo(map);
        else me.setLatLng([payload.user.lat, payload.user.lng]);
        if (following && !userMoved) map.setView([payload.user.lat, payload.user.lng], payload.zoom || 16, { animate: false });
      } else if (payload.center) {
        map.setView([payload.center.lat, payload.center.lng], payload.zoom || 14, { animate: false });
      }
    }
    window.addEventListener('message', function(event) {
      var data = event.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return; }
      if (!data || !data.type) return;
      if (data.type === 'state') apply(data);
      if (data.type === 'center' && data.lat != null) {
        following = true; userMoved = false;
        map.setView([data.lat, data.lng], 16, { animate: false });
        send({ type: 'follow', following: true });
      }
    });
    document.addEventListener('message', function(event) {
      var data = event.data;
      try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return; }
      if (!data || !data.type) return;
      if (data.type === 'state') apply(data);
      if (data.type === 'center' && data.lat != null) {
        following = true; userMoved = false;
        map.setView([data.lat, data.lng], 16, { animate: false });
        send({ type: 'follow', following: true });
      }
    });
    send({ type: 'ready' });
  }
</script>
</body>
</html>`;
}
