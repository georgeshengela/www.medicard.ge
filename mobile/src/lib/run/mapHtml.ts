import type {LatLng} from './geo';
import {tx} from '../../i18n/locale.js';
import {MAP_FLAG,MAP_GIFT,MAP_PUCK} from './mapArt.js';
import {WEATHER_FX_JS} from './weatherFx.ts';
export const RUN_MAP_HTML_REV=29;
/** MEDIRUN Glow engine + runner models, served with CORS by medicard.ge (built by brand/medirun/glow/engine/build.mjs). */
export const GLOW_BASE='https://medicard.ge/medirun/glow/';

/**
 * Only map rendering lives here. Auth, GPS, game logic and every control are native.
 * The night city, the trail, the lit buildings and the 3D runner come from the Glow engine; without it
 * (offline, blocked) the map falls back to a plain night style with the old puck and Mapbox trail lines.
 */
export function buildRunMapHtml(opts:{token:string;center:LatLng;dark:boolean;channel?:string;glowBase?:string}):string{
 const json=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c');
 const base=(opts.glowBase||GLOW_BASE).replace(/"/g,'');
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
 <link href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css" rel="stylesheet">
 <script src="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js"></script>
 <script src="${base}engine.js?v=${RUN_MAP_HTML_REV}"></script>
 <style>html,body,#map{margin:0;width:100%;height:100%;overflow:hidden;background:#111723}
 .mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right{bottom:156px}
 .mapboxgl-ctrl-logo,.mapboxgl-ctrl-attrib{opacity:.35}
 .puck{width:46px;height:46px;filter:drop-shadow(0 4px 6px #03071277)}
 .puck img,.goal img,.gift img{width:100%;height:100%;display:block}
 .goal{width:44px;height:44px;filter:drop-shadow(0 4px 6px #03071266);transition:filter .3s}.goal.reached{filter:drop-shadow(0 0 12px #5EEAD4)}
 /* Mapbox positions a marker with transform on its element, so the float animation lives on the inner image. */
 .gift{width:72px;height:72px;pointer-events:none}
 .gift .halo{position:absolute;left:50%;bottom:-8%;width:116%;height:39%;transform:translateX(-50%);border-radius:50%;background:radial-gradient(closest-side,rgba(252,211,77,.75),rgba(94,234,212,.25) 60%,transparent);animation:giftHalo 1.6s ease-in-out infinite}
 .gift img{position:relative;filter:drop-shadow(0 8px 10px #03071266) drop-shadow(0 0 14px rgba(252,211,77,.55));animation:giftFloat 2.6s ease-in-out infinite}
 @keyframes giftFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
 @keyframes giftHalo{0%,100%{opacity:.65}50%{opacity:1}}
 @media (prefers-reduced-motion:reduce){.gift img,.gift .halo{animation:none}}
 .hint{position:absolute;z-index:3;left:0;top:0;transform:translate(-50%,-100%);padding:7px 12px;border-radius:14px;background:rgba(17,24,39,.92);color:#fff;font:600 12px/16px system-ui,sans-serif;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .4s;box-shadow:0 6px 14px rgba(3,7,18,.35)}
 .hint.on{opacity:1}.hint b{color:#5EEAD4}
 .zone{display:flex;align-items:center;gap:8px;padding:6px 12px 6px 10px;border-radius:15px;background:rgba(13,18,30,.78);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(252,211,77,.38);color:#FEF3C7;font:700 12px/15px system-ui,sans-serif;white-space:nowrap;pointer-events:none;box-shadow:0 8px 22px rgba(3,7,18,.45),0 0 26px rgba(245,158,11,.28)}
 .zone i{flex:none;width:8px;height:8px;border-radius:50%;background:#FCD34D;animation:zonePing 1.8s ease-out infinite}
 .zone small{display:block;font:600 10px/13px system-ui,sans-serif;color:rgba(254,243,199,.62);letter-spacing:.2px}
 @keyframes zonePing{0%{box-shadow:0 0 0 0 rgba(252,211,77,.75)}100%{box-shadow:0 0 0 11px rgba(252,211,77,0)}}
 @media (prefers-reduced-motion:reduce){.zone i{animation:none}}
 </style></head><body><div id="map"></div><script>${WEATHER_FX_JS}</script><script>
 (function(){
 var PUCK_ART=${json(MAP_PUCK)},FLAG_ART=${json(MAP_FLAG)},GIFT_ART=${json(MAP_GIFT)},GLOW_BASE=${json(base)};
 var channel=${json(opts.channel||'native-map')},center=${json([opts.center.lng,opts.center.lat])},TOKEN=${json(opts.token)};
 function post(data){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(data));else if(window.parent!==window)window.parent.postMessage({channel:channel,data:data},'*');}catch(e){}}
 if(typeof mapboxgl==='undefined'){post({type:'error',message:${json(tx('რუკის ჩატვირთვა ვერ მოხერხდა. შეამოწმე ინტერნეტი.','The map couldn’t load. Check your internet connection.'))}});return;}
 mapboxgl.accessToken=TOKEN;
 var G=window.MedirunGlow||null;
 var map=new mapboxgl.Map({container:'map',style:G?G.glowStyle():'mapbox://styles/mapbox/dark-v11',center:center,zoom:17.5,pitch:55,bearing:0,attributionControl:false,projection:'mercator',antialias:true,maxPitch:75,fadeDuration:0});
 map.addControl(new mapboxgl.AttributionControl({compact:true}));
 var following=true,rotate=true,threeD=true,ready=false,queue=[],glow=null,goal=null,gift=null,puck=null,position=center,heading=null,showRunner=true,hero='m',raf=0,lastT=0,closeUp=false,orbit=0,hintUntil=0;
 var ZONE_SUB=${json(tx('ძებნის ზონა','Search zone'))};
 var HINT=${json(tx('შეეხე <b>მორბენალს</b> და ნახე ახლოდან','Tap <b>your runner</b> for a close-up'))};
 var pad={top:130,bottom:240,left:0,right:0};
 var retained={route:null,trail:null,paint:null,mission:null};
 // Box hunt: zone + way there, and the fly-over that plays once when a hunt is opened.
 var hunt=null,zoneLabel=null,touring=false,tourId=0,comet=null,huntDone=0,lastFx=0;
 var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function empty(){return {type:'FeatureCollection',features:[]};}
 function line(coords){return coords&&coords.length>1?{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}}:empty();}
 function setData(id,data){retained[id]=data;var source=map.getSource(id);if(source)source.setData(data);}
 function zoomed(a,b){return ['interpolate',['linear'],['zoom'],12,a,18,b];}
 function add(id,type,source,paint,layout){if(!map.getSource(source))map.addSource(source,{type:'geojson',data:retained[source]||empty()});if(!map.getLayer(id))map.addLayer({id:id,type:type,source:source,paint:paint,layout:layout||{}});}
 var rounded={'line-cap':'round','line-join':'round'};
 function layers(){
  add('mission-fill','fill','mission',{'fill-color':'#14B8A6','fill-opacity':.08});
  add('mission-ring','line','mission',{'line-color':'#14B8A6','line-width':2,'line-dasharray':[2,3]});
  // Box hunt: the zone is its own streets lit like a schematic (no circle), the way there a warm thread of light
  // (bright at the runner, deep amber at the zone) with chevrons and light pulses; the walked part trims away.
  if(!map.hasImage('hunt-chevron'))map.addImage('hunt-chevron',chevron(),{pixelRatio:2,sdf:true});
  if(!map.hasImage('hunt-bead'))map.addImage('hunt-bead',bead(),{pixelRatio:2});
  zoneLayers();
  if(!map.getSource('huntRoute'))map.addSource('huntRoute',{type:'geojson',lineMetrics:true,data:retained.huntRoute||empty()});
  // The way to the zone is a lane of light: a wide translucent band with crisp edges, and inside it a row of
  // arrows that light up one after another toward the zone (runway / deck lights), only on the part still to walk.
  var warm=['interpolate',['linear'],['line-progress'],0,'#FFF3C4',.5,'#FCD34D',1,'#F59E0B'];
  if(!map.getSource('huntArrows'))map.addSource('huntArrows',{type:'geojson',data:retained.huntArrows||empty()});
  add('hunt-lane-glow','line','huntRoute',{'line-color':'#F59E0B','line-width':zoomed(16,66),'line-opacity':.14,'line-blur':zoomed(6,22),'line-trim-offset':[0,0]},rounded);
  add('hunt-lane','line','huntRoute',{'line-gradient':warm,'line-width':zoomed(6,32),'line-opacity':.28,'line-trim-offset':[0,0]},rounded);
  add('hunt-lane-edge','line','huntRoute',{'line-gradient':warm,'line-width':zoomed(.9,2.2),'line-gap-width':zoomed(6,32),'line-opacity':.9,'line-trim-offset':[0,0]},rounded);
  if(!map.getLayer('hunt-arrows'))map.addLayer({id:'hunt-arrows',type:'symbol',source:'huntArrows',minzoom:14.5,
   layout:{'icon-image':'hunt-chevron','icon-rotate':['get','b'],'icon-rotation-alignment':'map','icon-pitch-alignment':'map','icon-allow-overlap':true,'icon-ignore-placement':true,'icon-size':['interpolate',['linear'],['zoom'],14.5,.4,18,1.15,20,1.7]},
   paint:{'icon-color':'#FFF7DA','icon-halo-color':'rgba(245,158,11,.9)','icon-halo-width':2,'icon-halo-blur':2.5,'icon-opacity':0}});
  add('hunt-aura','line','huntLit',{'line-color':'#F59E0B','line-width':zoomed(8,26),'line-opacity':.35,'line-blur':8},rounded);
  add('hunt-lit','line','huntLit',{'line-color':'#FDE68A','line-width':zoomed(2.5,6)},rounded);
  add('hunt-head-glow','circle','huntHead',{'circle-color':'#FCD34D','circle-radius':22,'circle-opacity':.35,'circle-blur':.9});
  add('hunt-head','circle','huntHead',{'circle-color':'#FFFBEB','circle-radius':6,'circle-blur':.3});
  add('route-line','line','route',{'line-color':'#5EEAD4','line-width':zoomed(1.5,4),'line-opacity':.4,'line-dasharray':[1,2.4]},{'line-cap':'round'});
  // Earlier walks: a calm mint line on the ground; their buildings are lit by the engine.
  add('paint-aura','line','paint',{'line-color':'#14B8A6','line-width':zoomed(4,16),'line-opacity':.16,'line-blur':6},rounded);
  add('paint-line','line','paint',{'line-color':'#2DD4BF','line-width':zoomed(1.2,3.5),'line-opacity':.55},rounded);
 }
 function trailLayers(){
  add('trail-aura','line','trail',{'line-color':'#14B8A6','line-width':zoomed(5,24),'line-opacity':.2,'line-blur':7},rounded);
  add('trail-line','line','trail',{'line-color':'#2DD4BF','line-width':zoomed(2,6)},rounded);
 }
 function startGlow(){
  if(!G||glow)return;
  try{glow=G.createGlow({mapboxgl:mapboxgl,map:map,token:TOKEN,assetBase:GLOW_BASE,hero:hero,onLit:function(n){post({type:'lit',count:n});}});}
  catch(e){glow=null;}
  if(!glow)trailLayers();else startDecor();
 }
 // City decor (holiday trucks on Rustaveli, the Mtatsminda wheel, partner venues) is a separate script next to the
 // engine: it reuses the engine's three.js, builds nothing outside Tbilisi and follows the admin switches
 // medirunDecor / medirunPartners. The map never waits for it and never fails because of it.
 function startDecor(){
  try{
   if(!glow.debug||!glow.debug.THREE)return;
   window.__MEDIRUN_THREE__=glow.debug.THREE;
   var s=document.createElement('script');s.src=GLOW_BASE+'decor/decor.js?v=${RUN_MAP_HTML_REV}';
   s.onload=function(){try{window.MedirunDecor.start(glow,{map:map,mapboxgl:mapboxgl,base:GLOW_BASE+'decor/'});}catch(e){}};
   document.head.appendChild(s);
  }catch(e){}
 }
 function placePuck(){if(glow||!showRunner)return;if(!puck){var el=document.createElement('div');el.className='puck';el.innerHTML='<img alt="" src="'+PUCK_ART+'">';puck=new mapboxgl.Marker({element:el,rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(position).addTo(map);}puck.setLngLat(position);if(heading!=null)puck.setRotation(heading);}
 function lerpAngle(a,b,t){return a+((((b-a)%360)+540)%360-180)*t;}
 // Follow the runner every frame (smooth) while following; any drag hands the camera to the person.
 function frame(t){
  var dt=lastT?Math.min(.1,(t-lastT)/1000):0;lastT=t;
  // never move the camera under a finger: Mapbox cancels a pinch or drag on every programmatic camera move
  if(following&&ready&&!touching){
   var r=glow?glow.runner():null,target=r?[r.lng,r.lat]:position,hd=r&&r.heading!=null?r.heading:heading;
   // 3D: always from behind the runner, looking where it (and the phone) looks; 2D keeps the north-up / rotate setting
   var zoom=threeD?18.2:17.4,pitch=threeD?60:0,bearing=hd!=null&&(threeD||rotate)?hd:(rotate?map.getBearing():0);
   // close-up: low and near, from the front while moving (the face is visible), slowly circling while standing
   var view=pad;
   if(closeUp){zoom=21.2;pitch=60;var moving=r&&(r.activity==='run'||r.activity==='walk');orbit=moving&&hd!=null?hd+155:(orbit||map.getBearing())+dt*9;bearing=orbit;
    var free=Math.max(0,map.getCanvas().clientHeight-pad.top-pad.bottom);view={top:pad.top+free*0.6,bottom:pad.bottom,left:0,right:0};}   // feet low, the whole body in view
   var k=reduced?1:1-Math.exp(-dt*2.4),kb=reduced?1:1-Math.exp(-dt*1.3),c=map.getCenter();
   map.jumpTo({center:[c.lng+(target[0]-c.lng)*k,c.lat+(target[1]-c.lat)*k],zoom:map.getZoom()+(zoom-map.getZoom())*k,pitch:map.getPitch()+(pitch-map.getPitch())*k,bearing:lerpAngle(map.getBearing(),bearing,kb),padding:view});
  }
  if(hunt&&ready&&t-lastFx>33){lastFx=t;zoneFx(t);}
  if(hunt&&ready&&t-lastChase>50){lastChase=t;chase(t);}
  if(comet){
   // the way to the zone lights up from the runner outward — a preview, never the session's lit streets
   var q=Math.max(0,Math.min(1,(t-comet.t0)/comet.dur)),e=q<.5?2*q*q:1-Math.pow(-2*q+2,2)/2,part=slice(comet.coords,e);
   setData('huntLit',line(part));setData('huntHead',part.length?{type:'Feature',properties:{},geometry:{type:'Point',coordinates:part[part.length-1]}}:empty());
   if(q>=1&&!comet.done){comet.done=true;var id=comet.id;setTimeout(function(){if(id===tourId)tourBack(id);},700);}
  }
  if(window.MedirunWeather&&ready)window.MedirunWeather.camera(map.getBearing(),map.getPitch());
  if(hint){var sc=glow&&hintUntil>t?glow.runnerScreen():null;if(sc){hint.style.left=sc.headX+'px';hint.style.top=(sc.headY-10)+'px';hint.classList.add('on');}else hint.classList.remove('on');}
  raf=requestAnimationFrame(frame);
 }
 function setCloseUp(on){closeUp=on;orbit=map.getBearing();if(glow)glow.setHeroView(on);hintUntil=0;if(on&&!following){following=true;post({type:'follow',value:true});}}
 var hint=null;
 function maybeHint(){if(!glow||!showRunner)return;var n=0;try{n=Number(localStorage.getItem('medirun.heroHint')||0);}catch(e){}if(n>=3)return;try{localStorage.setItem('medirun.heroHint',String(n+1));}catch(e){}hint=document.createElement('div');hint.className='hint';hint.innerHTML=HINT;document.body.appendChild(hint);hintUntil=performance.now()+6000;}
 // Markers are screen-sized DOM; shrink them as the map zooms out so a far-away gift never covers the runner.
 function markerSize(full,min){return Math.round(Math.max(min,Math.min(full,full*Math.pow(2,(map.getZoom()-18.2)*0.8))));}
 function sizeMarkers(){if(gift){var g=markerSize(72,22),el=gift.getElement();el.style.width=el.style.height=g+'px';}if(goal){var f=markerSize(44,24),ge=goal.getElement();ge.style.width=ge.style.height=f+'px';}}
 function circle(c,r){var points=[];for(var i=0;i<=64;i++){var angle=i/64*Math.PI*2;points.push([c[0]+Math.cos(angle)*r/(111195*Math.cos(c[1]*Math.PI/180)),c[1]+Math.sin(angle)*r/111195]);}return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[points]}};}
 function fit(bottom,paintOnly,top){var coords=paintOnly?[]:(retained.route&&retained.route.geometry&&retained.route.geometry.coordinates)||[];if(!paintOnly&&!coords.length&&retained.trail&&retained.trail.geometry)coords=retained.trail.geometry.coordinates;if(!coords.length&&retained.paint)coords=retained.paint.features.reduce(function(all,f){return all.concat(f.geometry.coordinates);},[]);if(!coords.length){following=true;return;}var bounds=new mapboxgl.LngLatBounds(coords[0],coords[0]);coords.forEach(function(p){bounds.extend(p);});following=false;post({type:'follow',value:false});map.fitBounds(bounds,{padding:{top:typeof top==='number'?top:120,bottom:bottom||230,left:45,right:45},maxZoom:17,pitch:threeD?45:0,duration:reduced?0:900});}
 // A small chevron pointing along the line (drawn once into an image; Mapbox turns it with the line).
 function chevron(){var c=document.createElement('canvas');c.width=c.height=48;var g=c.getContext('2d');g.lineCap=g.lineJoin='round';g.lineWidth=8;g.strokeStyle='#fff';g.beginPath();g.moveTo(15,10);g.lineTo(31,24);g.lineTo(15,38);g.stroke();return g.getImageData(0,0,48,48);}
 // A soft round bead of light for the zone's streets (no direction — streets are drawn either way).
 function bead(){var c=document.createElement('canvas');c.width=c.height=24;var g=c.getContext('2d'),r=g.createRadialGradient(12,12,0,12,12,12);r.addColorStop(0,'rgba(255,251,235,1)');r.addColorStop(.35,'rgba(253,230,138,.9)');r.addColorStop(1,'rgba(245,158,11,0)');g.fillStyle=r;g.fillRect(0,0,24,24);return g.getImageData(0,0,24,24);}
 // Walkable streets of the map's own road layer inside the zone; 'within' keeps whole street pieces, so the zone's
 // edge is where its streets end — never a drawn circle.
 var zoneR=0,ignite=null,lastIgnite=0,WALL_H=30;
 // The zone's outline: a soft, slightly irregular ring (never a perfect circle), the same for every viewer of
 // that place — the street filter and the wall use it, so the lit streets end exactly at the wall.
 function blobPoints(c,r){var seed=Math.abs(Math.sin(c[0]*12.9898+c[1]*78.233)*43758.5453),p1=seed%6.283,p2=(seed*7.13)%6.283,pts=[];
  for(var i=0;i<=96;i++){var a=i/96*Math.PI*2,k=1+.09*Math.sin(3*a+p1)+.06*Math.sin(5*a+p2)+.03*Math.sin(8*a+p1*2);pts.push([c[0]+Math.cos(a)*r*k/(111195*Math.cos(c[1]*Math.PI/180)),c[1]+Math.sin(a)*r*k/111195]);}
  return pts;}
 function blob(c,r){return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[blobPoints(c,r)]}};}
 // A thin band along the outline, extruded into a see-through wall of light.
 function wall(c,r){var out=blobPoints(c,r),inner=blobPoints(c,Math.max(1,r-5)).reverse();return {type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[out,inner]}}]};}
 function wallOutline(c,r){return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:blobPoints(c,r)}};}
 var WALK=['match',['get','class'],['primary','secondary','tertiary','street','street_limited','pedestrian','path','track','service'],true,false];
 function zoneFilter(){return hunt&&zoneR>0?['all',['==',['geometry-type'],'LineString'],WALK,['within',blob(hunt.center,zoneR)]]:['literal',false];}
 function zoneLayers(){
  var src=map.getSource('streets')?'streets':map.getSource('composite')?'composite':null;if(!src)return;
  function road(id,type,paint,layout){if(!map.getLayer(id))map.addLayer({id:id,type:type,source:src,'source-layer':'road',filter:zoneFilter(),paint:paint,layout:layout||{}});}
  road('hunt-streets-glow','line',{'line-color':'#F59E0B','line-width':zoomed(7,24),'line-opacity':.26,'line-blur':zoomed(4,10)},rounded);
  road('hunt-streets','line',{'line-color':['interpolate',['linear'],['zoom'],13,'#FCD34D',17,'#FDE68A'],'line-width':zoomed(1.7,3.8),'line-opacity':.92},rounded);
  if(!map.getSource('huntWall'))map.addSource('huntWall',{type:'geojson',data:retained.huntWall||empty()});
  if(!map.getSource('huntWallFoot'))map.addSource('huntWallFoot',{type:'geojson',data:retained.huntWallFoot||empty()});
  if(!map.getLayer('hunt-wall-foot'))map.addLayer({id:'hunt-wall-foot',type:'line',source:'huntWallFoot',paint:{'line-color':'#F59E0B','line-width':zoomed(5,22),'line-opacity':.38,'line-blur':zoomed(4,12)},layout:rounded});
  if(!map.getLayer('hunt-wall'))map.addLayer({id:'hunt-wall',type:'fill-extrusion',source:'huntWall',paint:{'fill-extrusion-color':'#FDE68A','fill-extrusion-base':0,'fill-extrusion-height':WALL_H,'fill-extrusion-opacity':.18,'fill-extrusion-vertical-gradient':true,'fill-extrusion-emissive-strength':1}});
  if(!map.getLayer('hunt-wall-rim'))map.addLayer({id:'hunt-wall-rim',type:'fill-extrusion',source:'huntWall',paint:{'fill-extrusion-color':'#FFF3C4','fill-extrusion-base':WALL_H-1.2,'fill-extrusion-height':WALL_H,'fill-extrusion-opacity':.6,'fill-extrusion-emissive-strength':1}});
  road('hunt-beads','symbol',{'icon-opacity':.9},{'symbol-placement':'line','symbol-spacing':['interpolate',['linear'],['zoom'],13,40,18,80],'icon-image':'hunt-bead','icon-size':['interpolate',['linear'],['zoom'],13,.5,18,1.1],'icon-allow-overlap':true,'icon-ignore-placement':true});
 }
 function wallHeight(h){if(map.getLayer('hunt-wall'))map.setPaintProperty('hunt-wall','fill-extrusion-height',Math.max(.1,h));if(map.getLayer('hunt-wall-rim')){map.setPaintProperty('hunt-wall-rim','fill-extrusion-base',Math.max(0,h-1.2));map.setPaintProperty('hunt-wall-rim','fill-extrusion-height',Math.max(.1,h));}}
 function applyZone(){['hunt-streets-glow','hunt-streets','hunt-beads'].forEach(function(id){if(map.getLayer(id))map.setFilter(id,zoneFilter());});}
 // The schematic lights up from the centre outward; afterwards the glow breathes softly.
 function igniteZone(){if(!hunt)return;if(reduced){zoneR=hunt.radius;applyZone();wallHeight(WALL_H);return;}ignite={t0:performance.now(),dur:2200};zoneR=1;applyZone();}
 function zoneFx(t){
  if(ignite&&hunt){if(t-lastIgnite>60){lastIgnite=t;var q=Math.min(1,Math.max(0,(t-ignite.t0)/ignite.dur));zoneR=Math.max(1,hunt.radius*(1-Math.pow(1-q,3)));applyZone();wallHeight(WALL_H*Math.max(0,Math.min(1,(q-.35)/.65)));if(q>=1)ignite=null;}}
  if(hunt&&!reduced&&map.getLayer('hunt-wall'))map.setPaintProperty('hunt-wall','fill-extrusion-opacity',.17+.05*Math.sin(t/900));
  if(hunt&&!reduced&&map.getLayer('hunt-streets-glow'))map.setPaintProperty('hunt-streets-glow','line-opacity',.22+.1*Math.sin(t/700));
 }
 var routeM=0;
 function lengthM(coords){var m=0;for(var i=1;i<(coords||[]).length;i++){var a=coords[i-1],b=coords[i];m+=Math.hypot((b[0]-a[0])*111320*Math.cos(a[1]*Math.PI/180),(b[1]-a[1])*111320);}return m;}
 // Arrows every ~9 m along the way (index, metres from the start, bearing). The lit head runs toward the zone,
 // a fading tail behind it, repeating every ARROW_N arrows; walked arrows go dark.
 var ARROW_N=10,lastChase=0,laneCoords=null;
 function laneProgress(){if(!laneCoords||laneCoords.length<2||!routeM)return;var k=Math.cos(position[1]*Math.PI/180)*111320,M=111320,px=position[0]*k,py=position[1]*M,total=0,best=Infinity,at=0;
  for(var i=1;i<laneCoords.length;i++){var ax=laneCoords[i-1][0]*k,ay=laneCoords[i-1][1]*M,bx=laneCoords[i][0]*k,by=laneCoords[i][1]*M,dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),f=len?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(len*len))):0,d=Math.hypot(ax+dx*f-px,ay+dy*f-py);if(d<best){best=d;at=total+len*f;}total+=len;}
  huntDone=best<60?Math.max(0,Math.min(1,at/routeM)):huntDone;trimWalked();}
 function arrowsAlong(coords){var out=[],step=11,acc=0,next=step*.5,n=0;for(var i=1;i<(coords||[]).length;i++){var a=coords[i-1],b=coords[i],k=Math.cos(a[1]*Math.PI/180),dx=(b[0]-a[0])*111320*k,dy=(b[1]-a[1])*111320,len=Math.hypot(dx,dy);if(!len)continue;var br=Math.atan2(dx,dy)*180/Math.PI;
  while(next<=acc+len){var f=(next-acc)/len;out.push({type:'Feature',properties:{i:n++,d:next,b:br-90},geometry:{type:'Point',coordinates:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]}});next+=step;}acc+=len;}
  return {type:'FeatureCollection',features:out};}
 function chase(t){
  if(!map.getLayer('hunt-arrows'))return;
  if(!hunt||!routeM){map.setPaintProperty('hunt-arrows','icon-opacity',0);return;}
  var N=ARROW_N,ph=reduced?0:(t/80)%N,k=['%',['+',['-',['get','i'],ph],N],N];
  var glow=reduced?.8:['interpolate',['linear'],k,0,1,1,.16,N-4,.16,N-3,.3,N-2,.52,N-1,.8,N,1];
  map.setPaintProperty('hunt-arrows','icon-opacity',['case',['<',['get','d'],huntDone*routeM],0,glow]);
 }
 // The lane ends where it meets the wall: inside, the zone's own streets take over.
 function radiusAt(c,r,p){var seed=Math.abs(Math.sin(c[0]*12.9898+c[1]*78.233)*43758.5453),p1=seed%6.283,p2=(seed*7.13)%6.283,a=Math.atan2((p[1]-c[1])*111195,(p[0]-c[0])*111195*Math.cos(c[1]*Math.PI/180));return r*(1+.09*Math.sin(3*a+p1)+.06*Math.sin(5*a+p2)+.03*Math.sin(8*a+p1*2));}
 function distM(a,b){return Math.hypot((b[0]-a[0])*111195*Math.cos(a[1]*Math.PI/180),(b[1]-a[1])*111195);}
 function cutAtWall(coords,c,r){if(!coords||coords.length<2)return coords||[];var out=[coords[0]];if(distM(c,coords[0])<=radiusAt(c,r,coords[0]))return coords;
  for(var i=1;i<coords.length;i++){var p=coords[i];if(distM(c,p)<=radiusAt(c,r,p)){var q=coords[i-1];for(var s=1;s<=12;s++){var f=s/12,x=[q[0]+(p[0]-q[0])*f,q[1]+(p[1]-q[1])*f];if(distM(c,x)<=radiusAt(c,r,x)){out.push(x);return out;}}out.push(p);return out;}out.push(p);}return out;}
 function trimWalked(){var v=[0,Math.max(0,Math.min(.999,huntDone))];['hunt-lane','hunt-lane-glow','hunt-lane-edge'].forEach(function(id){if(map.getLayer(id))map.setPaintProperty(id,'line-trim-offset',v);});}
 function slice(coords,f){if(!coords||coords.length<2)return coords||[];var total=0,seg=[];for(var i=1;i<coords.length;i++){var a=coords[i-1],b=coords[i],dx=(b[0]-a[0])*Math.cos(a[1]*Math.PI/180),d=Math.hypot(dx,b[1]-a[1]);seg.push(d);total+=d;}var want=total*f,out=[coords[0]];for(var j=0;j<seg.length;j++){if(want<=seg[j]){var k=seg[j]?want/seg[j]:0,p=coords[j],n=coords[j+1];out.push([p[0]+(n[0]-p[0])*k,p[1]+(n[1]-p[1])*k]);return out;}want-=seg[j];out.push(coords[j+1]);}return out;}
 function huntWay(){return hunt&&hunt.route&&hunt.route.length>1?hunt.route:hunt?[position,hunt.center]:[];}
 function endComet(){comet=null;setData('huntLit',empty());setData('huntHead',empty());}
 function stopTour(){if(!touring)return;touring=false;tourId++;endComet();if(hunt&&(ignite||zoneR<hunt.radius)){ignite=null;zoneR=hunt.radius;applyZone();wallHeight(WALL_H);}}
 function zoneZoom(r){return Math.max(13.5,Math.min(16,16.6-Math.log2(Math.max(150,r)/150)));}
 // Fly-over: out to the zone, a slow turn around it, back over the way there while it lights up, home to the runner.
 function tour(){
  if(!hunt)return;var id=++tourId;touring=true;comet=null;
  if(following){following=false;post({type:'follow',value:false});}
  if(closeUp)setCloseUp(false);
  var way=huntWay(),b=map.getBearing();
  if(reduced){igniteZone();overview(id,0);setTimeout(function(){if(id===tourId)tourBack(id);},2500);return;}
  map.flyTo({center:hunt.center,zoom:zoneZoom(hunt.radius),pitch:46,bearing:b+50,duration:2800,padding:pad,essential:true});
  map.once('moveend',function(){if(id!==tourId||!hunt)return;
   igniteZone();
   map.easeTo({bearing:b+140,duration:3400,easing:function(x){return x;},padding:pad});
   map.once('moveend',function(){if(id!==tourId||!hunt)return;overview(id,2400);comet={id:id,t0:performance.now()+300,dur:3600,coords:way,done:false};});
  });
 }
 function overview(id,duration){var way=huntWay();if(!way.length)return;var bounds=new mapboxgl.LngLatBounds(way[0],way[0]);way.forEach(function(p){bounds.extend(p);});bounds.extend(position);
  map.fitBounds(bounds,{padding:{top:pad.top+40,bottom:pad.bottom+30,left:50,right:50},pitch:threeD?32:0,bearing:map.getBearing(),maxZoom:16.5,duration:duration});}
 function tourBack(id){
  map.flyTo({center:position,zoom:threeD?18.2:17.4,pitch:threeD?60:0,duration:reduced?0:2400,padding:pad,essential:true});
  map.once('moveend',function(){if(id!==tourId)return;touring=false;endComet();following=true;post({type:'follow',value:true});post({type:'tour',done:true});});
 }
 function handle(m){switch(m.type){
  case 'init':position=[m.origin.lng,m.origin.lat];hero=m.hero==='f'?'f':'m';showRunner=m.runner!==false;
   if(glow){glow.setHero(hero);glow.setRunnerVisible(showRunner);glow.setRunner(position[0],position[1],null);}else placePuck();
   setData('route',line(m.route));if(goal)goal.remove();goal=null;
   if(m.pin){var el=document.createElement('div');el.className='goal';el.innerHTML='<img alt="" src="'+FLAG_ART+'">';goal=new mapboxgl.Marker({element:el}).setLngLat([m.pin.lng,m.pin.lat]).addTo(map);sizeMarkers();}
   if(m.fit)fit();else if(!touring)following=true;break;
  case 'fix':position=[m.lng,m.lat];if(hunt)laneProgress();if(typeof m.heading==='number')heading=m.heading;if(glow)glow.setRunner(m.lng,m.lat,typeof m.heading==='number'?m.heading:null,typeof m.speed==='number'?m.speed:null);else placePuck();break;
  case 'trail':if(glow){retained.trail=line(m.coords);glow.setTrail(m.coords||[]);}else setData('trail',line(m.coords));break;
  case 'paint':var lines=(m.lines||[]).filter(function(l){return l.length>1;});setData('paint',{type:'FeatureCollection',features:lines.map(function(l){return line(l);})});if(glow)glow.setPaint(lines);break;
  case 'mission':setData('mission',m.center?circle(m.center,m.radius||100):empty());break;
  case 'gift':if(gift)gift.remove();gift=null;if(m.position){var box=document.createElement('div');box.className='gift';box.innerHTML='<span class="halo"></span><img alt="" src="'+GIFT_ART+'">';gift=new mapboxgl.Marker({element:box,anchor:'bottom'}).setLngLat(m.position).addTo(map);sizeMarkers();}break;
  case 'options':rotate=m.rotate;threeD=m.threeD;break;
  case 'follow':stopTour();following=true;if(closeUp)setCloseUp(false);post({type:'follow',value:true});break;
  case 'fit':fit(m.bottom,m.paintOnly,m.top);break;
  case 'reached':if(goal)goal.getElement().classList.add('reached');break;
  case 'activity':if(glow)glow.setActivity(m.value);break;
  case 'layout':pad={top:Math.max(0,m.top||0),bottom:Math.max(0,m.bottom||0),left:0,right:0};break;
  case 'huntProgress':break; // the map measures its own lane (cut at the wall) on every fix
  case 'weather':if(window.MedirunWeather)window.MedirunWeather.set(m.fx||null);break;
  case 'hunt':
   if(zoneLabel){zoneLabel.remove();zoneLabel=null;}
   if(!m.center){stopTour();hunt=null;routeM=0;ignite=null;zoneR=0;applyZone();setData('huntRoute',empty());setData('huntWall',empty());setData('huntWallFoot',empty());laneCoords=null;setData('huntArrows',empty());if(map.getLayer('hunt-arrows'))map.setPaintProperty('hunt-arrows','icon-opacity',0);break;}
   var sameWay=hunt&&m.route&&hunt.route&&hunt.route.length===m.route.length;
   hunt={center:m.center,radius:m.radius||600,route:m.route||null};var lane=cutAtWall(m.route,m.center,hunt.radius);laneCoords=lane;routeM=lengthM(lane);if(!sameWay){huntDone=0;laneProgress();}
   setData('huntRoute',line(lane));setData('huntArrows',arrowsAlong(lane));setData('huntWall',wall(m.center,hunt.radius));setData('huntWallFoot',wallOutline(m.center,hunt.radius));
   if(!m.tour&&!ignite)wallHeight(WALL_H);else if(m.tour)wallHeight(0);
   if(!m.tour&&!ignite){zoneR=hunt.radius;applyZone();}else if(m.tour){zoneR=0;applyZone();}
   if(m.label){var zl=document.createElement('div');zl.className='zone';var dot=document.createElement('i'),txt=document.createElement('span'),nm=document.createElement('b'),sub=document.createElement('small');nm.textContent=m.label;sub.textContent=ZONE_SUB;txt.appendChild(nm);txt.appendChild(sub);zl.appendChild(dot);zl.appendChild(txt);zoneLabel=new mapboxgl.Marker({element:zl}).setLngLat(m.center).addTo(map);}
   if(m.tour)tour();break;
  case 'theme':break; // the Glow city is a night city in every theme
 }}
 window.__run=function(m){if(!ready)queue.push(m);else handle(m);};
 window.addEventListener('message',function(event){if(event.source===window.parent&&event.data&&event.data.channel===channel)window.__run(event.data.message);});
 map.on('style.load',function(){layers();startGlow();if(!ready){ready=true;post({type:'ready'});queue.forEach(handle);queue=[];raf=requestAnimationFrame(frame);setTimeout(maybeHint,4000);}});
 // Tap the runner for a close-up; tap again (or anywhere else) to go back.
 map.on('zoom',sizeMarkers);
 map.on('click',function(e){if(!glow)return;if(glow.runnerHit(e.point.x,e.point.y))setCloseUp(!closeUp);else if(closeUp)setCloseUp(false);});
 function release(){stopTour();if(closeUp)setCloseUp(false);if(following){following=false;post({type:'follow',value:false});}}
 ['dragstart','rotatestart','zoomstart','pitchstart'].forEach(function(event){map.on(event,function(e){if(e.originalEvent)release();});});
 var touching=0,box=map.getCanvasContainer();
 box.addEventListener('touchstart',function(e){touching=e.touches.length;if(touching>1)release();},{passive:true});
 box.addEventListener('touchend',function(e){touching=e.touches.length;},{passive:true});
 box.addEventListener('touchcancel',function(e){touching=e.touches.length;},{passive:true});
 box.addEventListener('mousedown',function(){touching=1;});
 window.addEventListener('mouseup',function(){touching=0;});
 box.addEventListener('wheel',release,{passive:true});
 map.on('error',function(e){var text=String(e.error&&e.error.message||'');if(/token|401|403|Unauthorized/.test(text))post({type:'error',message:${json(tx('რუკის წვდომა ვერ დადასტურდა.','Map access couldn’t be verified.'))}});});
 window.addEventListener('pagehide',function(){if(raf)cancelAnimationFrame(raf);if(glow)glow.dispose();map.remove();});
 })();</script></body></html>`;
}
