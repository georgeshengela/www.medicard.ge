import type {LatLng} from './geo';
import {tx} from '../../i18n/locale.js';
import {MAP_FLAG,MAP_GIFT,MAP_PUCK} from './mapArt.js';
export const RUN_MAP_HTML_REV=13;
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
 .gift{width:64px;height:64px;filter:drop-shadow(0 8px 10px #03071266);animation:giftFloat 2.6s ease-in-out infinite}
 @keyframes giftFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
 @media (prefers-reduced-motion:reduce){.gift{animation:none}}
 </style></head><body><div id="map"></div><script>
 (function(){
 var PUCK_ART=${json(MAP_PUCK)},FLAG_ART=${json(MAP_FLAG)},GIFT_ART=${json(MAP_GIFT)},GLOW_BASE=${json(base)};
 var channel=${json(opts.channel||'native-map')},center=${json([opts.center.lng,opts.center.lat])},TOKEN=${json(opts.token)};
 function post(data){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(data));else if(window.parent!==window)window.parent.postMessage({channel:channel,data:data},'*');}catch(e){}}
 if(typeof mapboxgl==='undefined'){post({type:'error',message:${json(tx('რუკის ჩატვირთვა ვერ მოხერხდა. შეამოწმე ინტერნეტი.','The map couldn’t load. Check your internet connection.'))}});return;}
 mapboxgl.accessToken=TOKEN;
 var G=window.MedirunGlow||null;
 var map=new mapboxgl.Map({container:'map',style:G?G.glowStyle():'mapbox://styles/mapbox/dark-v11',center:center,zoom:17.5,pitch:55,bearing:0,attributionControl:false,projection:'mercator',antialias:true,maxPitch:75,fadeDuration:0});
 map.addControl(new mapboxgl.AttributionControl({compact:true}));
 var following=true,rotate=true,threeD=true,ready=false,queue=[],glow=null,goal=null,gift=null,puck=null,position=center,heading=null,showRunner=true,hero='m',raf=0,lastT=0;
 var pad={top:130,bottom:240,left:0,right:0};
 var retained={route:null,trail:null,paint:null,mission:null};
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
  if(!glow)trailLayers();
 }
 function placePuck(){if(glow||!showRunner)return;if(!puck){var el=document.createElement('div');el.className='puck';el.innerHTML='<img alt="" src="'+PUCK_ART+'">';puck=new mapboxgl.Marker({element:el,rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(position).addTo(map);}puck.setLngLat(position);if(heading!=null)puck.setRotation(heading);}
 function lerpAngle(a,b,t){return a+((((b-a)%360)+540)%360-180)*t;}
 // Follow the runner every frame (smooth) while following; any drag hands the camera to the person.
 function frame(t){
  var dt=lastT?Math.min(.1,(t-lastT)/1000):0;lastT=t;
  if(following&&ready){
   var r=glow?glow.runner():null,target=r?[r.lng,r.lat]:position,hd=r&&r.heading!=null?r.heading:heading;
   var zoom=threeD?18.2:17.4,pitch=threeD?60:0,bearing=rotate&&hd!=null?hd-(threeD?20:0):(rotate?map.getBearing():0);
   var k=reduced?1:1-Math.exp(-dt*2.4),kb=reduced?1:1-Math.exp(-dt*1.3),c=map.getCenter();
   map.jumpTo({center:[c.lng+(target[0]-c.lng)*k,c.lat+(target[1]-c.lat)*k],zoom:map.getZoom()+(zoom-map.getZoom())*k,pitch:map.getPitch()+(pitch-map.getPitch())*k,bearing:lerpAngle(map.getBearing(),bearing,kb),padding:pad});
  }
  raf=requestAnimationFrame(frame);
 }
 function circle(c,r){var points=[];for(var i=0;i<=64;i++){var angle=i/64*Math.PI*2;points.push([c[0]+Math.cos(angle)*r/(111195*Math.cos(c[1]*Math.PI/180)),c[1]+Math.sin(angle)*r/111195]);}return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[points]}};}
 function fit(bottom,paintOnly,top){var coords=paintOnly?[]:(retained.route&&retained.route.geometry&&retained.route.geometry.coordinates)||[];if(!paintOnly&&!coords.length&&retained.trail&&retained.trail.geometry)coords=retained.trail.geometry.coordinates;if(!coords.length&&retained.paint)coords=retained.paint.features.reduce(function(all,f){return all.concat(f.geometry.coordinates);},[]);if(!coords.length){following=true;return;}var bounds=new mapboxgl.LngLatBounds(coords[0],coords[0]);coords.forEach(function(p){bounds.extend(p);});following=false;post({type:'follow',value:false});map.fitBounds(bounds,{padding:{top:typeof top==='number'?top:120,bottom:bottom||230,left:45,right:45},maxZoom:17,pitch:threeD?45:0,duration:reduced?0:900});}
 function handle(m){switch(m.type){
  case 'init':position=[m.origin.lng,m.origin.lat];hero=m.hero==='f'?'f':'m';showRunner=m.runner!==false;
   if(glow){glow.setHero(hero);glow.setRunnerVisible(showRunner);glow.setRunner(position[0],position[1],null);}else placePuck();
   setData('route',line(m.route));if(goal)goal.remove();goal=null;
   if(m.pin){var el=document.createElement('div');el.className='goal';el.innerHTML='<img alt="" src="'+FLAG_ART+'">';goal=new mapboxgl.Marker({element:el}).setLngLat([m.pin.lng,m.pin.lat]).addTo(map);}
   if(m.fit)fit();else following=true;break;
  case 'fix':position=[m.lng,m.lat];if(typeof m.heading==='number')heading=m.heading;if(glow)glow.setRunner(m.lng,m.lat,typeof m.heading==='number'?m.heading:null);else placePuck();break;
  case 'trail':if(glow){retained.trail=line(m.coords);glow.setTrail(m.coords||[]);}else setData('trail',line(m.coords));break;
  case 'paint':var lines=(m.lines||[]).filter(function(l){return l.length>1;});setData('paint',{type:'FeatureCollection',features:lines.map(function(l){return line(l);})});if(glow)glow.setPaint(lines);break;
  case 'mission':setData('mission',m.center?circle(m.center,m.radius||100):empty());break;
  case 'gift':if(gift)gift.remove();gift=null;if(m.position){var box=document.createElement('div');box.className='gift';box.innerHTML='<img alt="" src="'+GIFT_ART+'">';gift=new mapboxgl.Marker({element:box,anchor:'bottom'}).setLngLat(m.position).addTo(map);}break;
  case 'options':rotate=m.rotate;threeD=m.threeD;break;
  case 'follow':following=true;post({type:'follow',value:true});break;
  case 'fit':fit(m.bottom,m.paintOnly,m.top);break;
  case 'reached':if(goal)goal.getElement().classList.add('reached');break;
  case 'activity':if(glow)glow.setActivity(m.value);break;
  case 'layout':pad={top:Math.max(0,m.top||0),bottom:Math.max(0,m.bottom||0),left:0,right:0};break;
  case 'theme':break; // the Glow city is a night city in every theme
 }}
 window.__run=function(m){if(!ready)queue.push(m);else handle(m);};
 window.addEventListener('message',function(event){if(event.source===window.parent&&event.data&&event.data.channel===channel)window.__run(event.data.message);});
 map.on('style.load',function(){layers();startGlow();if(!ready){ready=true;post({type:'ready'});queue.forEach(handle);queue=[];raf=requestAnimationFrame(frame);}});
 ['dragstart','rotatestart','zoomstart','pitchstart'].forEach(function(event){map.on(event,function(e){if(e.originalEvent&&following){following=false;post({type:'follow',value:false});}});});
 map.on('error',function(e){var text=String(e.error&&e.error.message||'');if(/token|401|403|Unauthorized/.test(text))post({type:'error',message:${json(tx('რუკის წვდომა ვერ დადასტურდა.','Map access couldn’t be verified.'))}});});
 window.addEventListener('pagehide',function(){if(raf)cancelAnimationFrame(raf);if(glow)glow.dispose();map.remove();});
 })();</script></body></html>`;
}
