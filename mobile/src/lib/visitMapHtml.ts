/** Inline Leaflet map for WebView — https://leafletjs.com */
export function buildLeafletMapHtml(lat: number, lng: number, label?: string): string {
  const safeLabel = (label ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: #eef2f2; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([${lat}, ${lng}], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    L.marker([${lat}, ${lng}]).addTo(map).bindPopup('${safeLabel || 'Medicard'}').openPopup();
  </script>
</body>
</html>`;
}
