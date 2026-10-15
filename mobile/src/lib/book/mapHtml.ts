import { tx } from '../../i18n/locale.js';

export const BOOK_MAP_HTML_REV = 1;

/**
 * MEDIBOOK map page for the WebView: Mapbox GL JS with the light/dark street style, the person's blue
 * dot, one coloured dot per business (category colour, a ring for claimed places that take bookings)
 * clustered when dense. Only rendering lives here — data, filters and navigation are native and arrive
 * as messages (`window.__book(msg)`); taps come back through postMessage.
 */
export function buildBookMapHtml(opts: { token: string; center: { lat: number; lng: number }; zoom?: number; dark: boolean; colors: Record<string, string> }): string {
  const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js"></script>
<style>html,body,#map{margin:0;width:100%;height:100%;overflow:hidden;background:${opts.dark ? '#0b1220' : '#e9eef0'}}
.mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right{bottom:150px}.mapboxgl-ctrl-logo,.mapboxgl-ctrl-attrib{opacity:.4}
.me{width:18px;height:18px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25),0 2px 6px rgba(0,0,0,.35)}
.me.pulse::after{content:'';position:absolute;inset:-14px;border-radius:50%;border:2px solid rgba(37,99,235,.45);animation:p 1.8s ease-out infinite}
@keyframes p{0%{transform:scale(.5);opacity:1}100%{transform:scale(1.4);opacity:0}}
</style></head><body><div id="map"></div><script>
(function(){
 var TOKEN=${json(opts.token)},center=${json([opts.center.lng, opts.center.lat])},COLORS=${json(opts.colors)},dark=${json(opts.dark)};
 function post(d){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(d));}catch(e){}}
 if(typeof mapboxgl==='undefined'){post({type:'error',message:${json(tx('რუკის ჩატვირთვა ვერ მოხერხდა. შეამოწმე ინტერნეტი.', 'The map couldn’t load. Check your internet connection.'))}});return;}
 mapboxgl.accessToken=TOKEN;
 var style=dark?'mapbox://styles/mapbox/dark-v11':'mapbox://styles/mapbox/light-v11';
 var map=new mapboxgl.Map({container:'map',style:style,center:center,zoom:${json(opts.zoom ?? 13)},attributionControl:false,projection:'mercator'});
 map.addControl(new mapboxgl.AttributionControl({compact:true}));
 var me=null,ready=false,queue=[],selected=null,pending=null;
 function colorExpr(){var e=['match',['get','category']];for(var k in COLORS){e.push(k,COLORS[k]);}e.push('#64748B');return e;}
 function layers(){
  if(!map.getSource('pins'))map.addSource('pins',{type:'geojson',data:{type:'FeatureCollection',features:[]},cluster:true,clusterMaxZoom:15,clusterRadius:44});
  if(!map.getLayer('clusters'))map.addLayer({id:'clusters',type:'circle',source:'pins',filter:['has','point_count'],paint:{'circle-color':dark?'#BEF264':'#4D7C0F','circle-opacity':.92,'circle-radius':['step',['get','point_count'],16,10,20,50,26],'circle-stroke-width':3,'circle-stroke-color':dark?'rgba(190,242,100,.3)':'rgba(77,124,15,.25)'}});
  if(!map.getLayer('cluster-count'))map.addLayer({id:'cluster-count',type:'symbol',source:'pins',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':13,'text-font':['DIN Pro Bold','Arial Unicode MS Bold']},paint:{'text-color':dark?'#14230A':'#FFFFFF'}});
  if(!map.getLayer('pin-ring'))map.addLayer({id:'pin-ring',type:'circle',source:'pins',filter:['all',['!',['has','point_count']],['==',['get','bookable'],1]],paint:{'circle-color':'transparent','circle-radius':['interpolate',['linear'],['zoom'],11,9,16,15],'circle-stroke-width':2,'circle-stroke-color':colorExpr(),'circle-stroke-opacity':.55}});
  if(!map.getLayer('pin'))map.addLayer({id:'pin',type:'circle',source:'pins',filter:['!',['has','point_count']],paint:{'circle-color':colorExpr(),'circle-radius':['interpolate',['linear'],['zoom'],11,5,16,9],'circle-stroke-width':2,'circle-stroke-color':dark?'#0b1220':'#ffffff','circle-opacity':['case',['==',['get','id'],['literal',selected||'']],1,.92]}});
  if(!map.getLayer('pin-selected'))map.addLayer({id:'pin-selected',type:'circle',source:'pins',filter:['==',['get','id'],selected||''],paint:{'circle-color':'transparent','circle-radius':['interpolate',['linear'],['zoom'],11,12,16,20],'circle-stroke-width':3,'circle-stroke-color':colorExpr()}});
  if(!map.getLayer('pin-label'))map.addLayer({id:'pin-label',type:'symbol',source:'pins',minzoom:14.5,filter:['!',['has','point_count']],layout:{'text-field':['get','name'],'text-size':11,'text-offset':[0,1.4],'text-anchor':'top','text-max-width':9,'text-font':['DIN Pro Medium','Arial Unicode MS Regular'],'text-optional':true},paint:{'text-color':dark?'#E5E7EB':'#1F2937','text-halo-color':dark?'#0b1220':'#ffffff','text-halo-width':1.2}});
 }
 function setPins(features){var s=map.getSource('pins');if(s)s.setData({type:'FeatureCollection',features:features});}
 function setSelected(id){selected=id||null;if(map.getLayer('pin-selected'))map.setFilter('pin-selected',['==',['get','id'],selected||'']);}
 function placeMe(lng,lat){if(!me){var el=document.createElement('div');el.className='me pulse';me=new mapboxgl.Marker({element:el}).setLngLat([lng,lat]).addTo(map);}else me.setLngLat([lng,lat]);}
 function bounds(){var b=map.getBounds();return {minLat:b.getSouth(),maxLat:b.getNorth(),minLng:b.getWest(),maxLng:b.getEast(),zoom:map.getZoom()};}
 var moveTimer=null;
 map.on('load',function(){layers();ready=true;queue.forEach(handle);queue=[];post({type:'ready'});post({type:'bounds',bounds:bounds()});});
 map.on('moveend',function(){clearTimeout(moveTimer);moveTimer=setTimeout(function(){post({type:'bounds',bounds:bounds()});},120);});
 map.on('click','clusters',function(e){var f=map.queryRenderedFeatures(e.point,{layers:['clusters']})[0];if(!f)return;map.getSource('pins').getClusterExpansionZoom(f.properties.cluster_id,function(err,z){if(err)return;map.easeTo({center:f.geometry.coordinates,zoom:z+0.4});});});
 map.on('click','pin',function(e){var f=e.features&&e.features[0];if(!f)return;setSelected(f.properties.id);post({type:'select',id:f.properties.id});map.easeTo({center:f.geometry.coordinates,offset:[0,-80],duration:350});});
 map.on('click',function(e){var hit=map.queryRenderedFeatures(e.point,{layers:['pin','clusters']});if(!hit.length){setSelected(null);post({type:'select',id:null});}});
 ['pin','clusters'].forEach(function(l){map.on('mouseenter',l,function(){map.getCanvas().style.cursor='pointer';});map.on('mouseleave',l,function(){map.getCanvas().style.cursor='';});});
 function handle(m){
  if(!m)return;
  if(m.type==='pins'){setPins(m.features||[]);return;}
  if(m.type==='me'){placeMe(m.lng,m.lat);if(m.fly)map.easeTo({center:[m.lng,m.lat],zoom:Math.max(map.getZoom(),14),duration:600});return;}
  if(m.type==='flyTo'){map.easeTo({center:[m.lng,m.lat],zoom:m.zoom||map.getZoom(),duration:600});return;}
  if(m.type==='select'){setSelected(m.id);return;}
  if(m.type==='padding'){map.setPadding({top:m.top||0,bottom:m.bottom||0,left:0,right:0});return;}
  if(m.type==='theme'){dark=!!m.dark;map.setStyle(dark?'mapbox://styles/mapbox/dark-v11':'mapbox://styles/mapbox/light-v11');map.once('style.load',function(){layers();if(pending)setPins(pending);});return;}
 }
 window.__book=function(m){if(m&&m.type==='pins')pending=m.features||[];if(!ready){queue.push(m);return;}handle(m);};
})();
</script></body></html>`;
}
