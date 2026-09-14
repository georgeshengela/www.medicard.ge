export const HUNT_MAP_HTML_REV = 2;

export function buildHuntMapHtml(opts: { token: string; center: { lat: number; lng: number }; dark: boolean }) {
  const token = JSON.stringify(opts.token);
  const center = JSON.stringify([opts.center.lng, opts.center.lat]);
  const dark = opts.dark ? 'true' : 'false';
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<link href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css" rel="stylesheet"/>
<script src="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js"></script>
<style>
html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${opts.dark ? '#030712' : '#e5eef0'}}
.mapboxgl-ctrl-attrib{font-size:10px}
.user{width:28px;height:28px;border-radius:14px;background:#14B8A6;border:3px solid #fff;box-shadow:0 0 0 4px rgba(20,184,166,.35)}
.enemy{width:22px;height:22px;border-radius:8px;background:#FB7185;border:2px solid #fff}
.enemy.chaser{background:#FB7185}
.enemy.interceptor{background:#F97316;border-radius:11px}
.enemy.patroller{background:#A78BFA;border-radius:4px}
.enemy.hunt{box-shadow:0 0 0 4px rgba(251,191,36,.45);background:#FBBF24}
.capsule{width:16px;height:16px;border-radius:8px;background:#38BDF8;border:2px solid #fff}
</style></head>
<body>
<div id="map"></div>
<script>
mapboxgl.accessToken = ${token};
var dark = ${dark};
var map = new mapboxgl.Map({
  container:'map',
  style: dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12',
  center: ${center},
  zoom: 16.2,
  attributionControl: true
});
var userM = new mapboxgl.Marker({element: el('user')});
var enemyMs = {};
var capsuleMs = {};
var pending = null;
var lastCenter = null;
function el(cls){ var d=document.createElement('div'); d.className=cls; return d; }
function post(o){ if(window.ReactNativeWebView) ReactNativeWebView.postMessage(JSON.stringify(o)); }
function apply(msg){
  if(!msg || msg.type!=='state' || !map.isStyleLoaded()) { pending = msg; return; }
  if(msg.streets){
    var src = map.getSource('streets');
    if(src) src.setData({
      type:'FeatureCollection',
      features: msg.streets.map(function(line){ return {type:'Feature', geometry:{type:'LineString', coordinates: line}}; })
    });
  }
  if(msg.bounds){
    var b = msg.bounds;
    var area = map.getSource('area');
    if(area) area.setData({type:'Feature', geometry:{type:'Polygon', coordinates:[[
      [b.west,b.south],[b.east,b.south],[b.east,b.north],[b.west,b.north],[b.west,b.south]
    ]]}});
  }
  if(msg.player){
    userM.setLngLat([msg.player.lng, msg.player.lat]).addTo(map);
    var moved = !lastCenter || Math.abs(lastCenter[0]-msg.player.lng)+Math.abs(lastCenter[1]-msg.player.lat) > 0.00008;
    if(moved){
      lastCenter = [msg.player.lng, msg.player.lat];
      map.easeTo({center:[msg.player.lng, msg.player.lat], duration: 380});
    }
  }
  var seenE = {};
  (msg.enemies||[]).forEach(function(e){
    seenE[e.id]=1;
    if(e.state==='captured' || e.lat==null){ if(enemyMs[e.id]) { enemyMs[e.id].remove(); delete enemyMs[e.id]; } return; }
    var cls = 'enemy ' + (e.kind||'chaser') + (msg.hunting ? ' hunt' : '');
    if(!enemyMs[e.id]) {
      enemyMs[e.id] = new mapboxgl.Marker({element:el(cls)}).setLngLat([e.lng,e.lat]).addTo(map);
    } else {
      enemyMs[e.id].getElement().className = cls;
      enemyMs[e.id].setLngLat([e.lng,e.lat]);
    }
  });
  Object.keys(enemyMs).forEach(function(id){ if(!seenE[id]){ enemyMs[id].remove(); delete enemyMs[id]; } });
  var seenC = {};
  (msg.capsules||[]).forEach(function(c){
    seenC[c.id]=1;
    if(c.state==='taken' || c.lat==null){ if(capsuleMs[c.id]) { capsuleMs[c.id].remove(); delete capsuleMs[c.id]; } return; }
    if(!capsuleMs[c.id]) capsuleMs[c.id] = new mapboxgl.Marker({element:el('capsule')}).setLngLat([c.lng,c.lat]).addTo(map);
    else capsuleMs[c.id].setLngLat([c.lng,c.lat]);
  });
  Object.keys(capsuleMs).forEach(function(id){ if(!seenC[id]){ capsuleMs[id].remove(); delete capsuleMs[id]; } });
}
map.on('load', function(){
  map.addSource('streets', {type:'geojson', data:{type:'FeatureCollection', features:[]}});
  map.addLayer({id:'streets', type:'line', source:'streets', paint:{'line-color':'#14B8A6','line-width':4,'line-opacity':0.85}});
  map.addSource('area', {type:'geojson', data:{type:'FeatureCollection', features:[]}});
  map.addLayer({id:'area', type:'line', source:'area', paint:{'line-color':'#FBBF24','line-width':2,'line-dasharray':[2,2]}});
  post({type:'ready'});
  if(pending) apply(pending);
});
window.__hunt = function(msg){
  if(!msg) return;
  if(msg.type==='theme'){
    map.setStyle(msg.dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12');
    return;
  }
  apply(msg);
};
</script>
</body></html>`;
}
