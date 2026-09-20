import type {LatLng} from './geo';
export const RUN_MAP_HTML_REV=11;

/** Only Mapbox rendering lives here. Auth, GPS, game logic and every control are native. */
export function buildRunMapHtml(opts:{token:string;center:LatLng;dark:boolean;channel?:string}):string{
 const json=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c');
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
 <link href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css" rel="stylesheet">
 <script src="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js"></script>
 <style>html,body,#map{margin:0;width:100%;height:100%;overflow:hidden;background:${opts.dark?'#030712':'#F5F7F7'}}
 .mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right{bottom:156px}
 .puck{width:38px;height:38px;filter:drop-shadow(0 3px 5px #03071266)}
 .puck svg{width:100%;height:100%}.goal{width:32px;height:32px;border-radius:50%;background:#fff;border:3px solid #14B8A6;display:grid;place-items:center;font-size:20px;color:#0F766E}
 .gift{width:48px;height:54px;filter:drop-shadow(0 6px 8px #03071255)}
 </style></head><body><div id="map"></div><script>
 (function(){
 var channel=${json(opts.channel||'native-map')},center=${json([opts.center.lng,opts.center.lat])},dark=${json(opts.dark)};
 function post(data){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(data));else if(window.parent!==window)window.parent.postMessage({channel:channel,data:data},'*');}catch(e){}}
 if(typeof mapboxgl==='undefined'){post({type:'error',message:'რუკის ჩატვირთვა ვერ მოხერხდა. შეამოწმე ინტერნეტი.'});return;}
 mapboxgl.accessToken=${json(opts.token)};
 var map=new mapboxgl.Map({container:'map',style:'mapbox://styles/mapbox/standard',center:center,zoom:17.5,pitch:52,bearing:0,attributionControl:false,config:{basemap:{lightPreset:dark?'night':'day',showPointOfInterestLabels:false}}});
 map.addControl(new mapboxgl.AttributionControl({compact:true}));
 var following=true,rotate=true,threeD=true,ready=false,queue=[],heading=0,user=null,goal=null,gift=null,position=center,raf=0;
 var retained={route:null,trail:null,paint:null,mission:null};
 var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function empty(){return {type:'FeatureCollection',features:[]};}
 function line(coords){return coords&&coords.length>1?{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}}:empty();}
 function setData(id,data){retained[id]=data;var source=map.getSource(id);if(source)source.setData(data);}
 function layers(){
  var slot=map.getStyle().imports?{slot:'middle'}:{};
  ['route','trail','paint','mission'].forEach(function(id){if(!map.getSource(id))map.addSource(id,{type:'geojson',data:retained[id]||empty()});});
  function add(id,type,source,paint,layout){var navigation=source!=='mission';if(navigation&&type==='line')paint=Object.assign({'line-occlusion-opacity':.85,'line-emissive-strength':1},paint);if(!map.getLayer(id))map.addLayer(Object.assign({id:id,type:type,source:source,paint:paint,layout:layout||{}},navigation?{slot:'top'}:slot));}
  add('mission-fill','fill','mission',{'fill-color':'#14B8A6','fill-opacity':.08});
  add('mission-ring','line','mission',{'line-color':'#14B8A6','line-width':2,'line-dasharray':[2,3]});
  var rounded={'line-cap':'round','line-join':'round'};
  add('route-border','line','route',{'line-color':'#fff','line-width':9,'line-opacity':.8},rounded);
  add('route-line','line','route',{'line-color':'#6D5CE7','line-width':5,'line-opacity':.8},rounded);
  ['paint','trail'].forEach(function(id){
   add(id+'-aura','line',id,{'line-color':'#14B8A6','line-width':['interpolate',['linear'],['zoom'],12,5,18,24],'line-opacity':.2,'line-blur':7},rounded);
   add(id+'-edge','line',id,{'line-color':'#0F766E','line-width':['interpolate',['linear'],['zoom'],12,3,18,10]},rounded);
   add(id+'-line','line',id,{'line-color':'#2DD4BF','line-width':['interpolate',['linear'],['zoom'],12,2,18,6]},rounded);
   add(id+'-shine','line',id,{'line-color':'#CCFBF1','line-width':1.2,'line-opacity':.85},rounded);
  });
 }
 function puck(){var el=document.createElement('div');el.className='puck';el.innerHTML='<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="#14B8A6" fill-opacity=".16"/><circle cx="20" cy="20" r="11" fill="#0D9488" stroke="white" stroke-width="2.5"/><path d="M20 4 L27 23 L20 19 L13 23Z" fill="#5EEAD4" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';return new mapboxgl.Marker({element:el,rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(position).addTo(map);}
 function follow(){if(!following)return;map.easeTo({center:position,bearing:rotate?heading:0,pitch:threeD?52:0,zoom:17.8,padding:{top:70,bottom:170,left:0,right:0},duration:reduced?0:750,essential:true});}
 function move(point,nextHeading){
  var from=user?user.getLngLat().toArray():position.slice(),fromAngle=user?user.getRotation():heading,difference=((nextHeading-fromAngle+540)%360)-180;
  position=point;heading=nextHeading;if(!user)user=puck();
  if(raf)cancelAnimationFrame(raf);var start=performance.now();
  function frame(now){var t=reduced?1:Math.min(1,(now-start)/850),e=1-Math.pow(1-t,2);user.setLngLat([from[0]+(point[0]-from[0])*e,from[1]+(point[1]-from[1])*e]).setRotation(fromAngle+difference*e);if(t<1)raf=requestAnimationFrame(frame);else raf=0;}
  raf=requestAnimationFrame(frame);follow();
 }
 function circle(c,r){var points=[];for(var i=0;i<=64;i++){var angle=i/64*Math.PI*2;points.push([c[0]+Math.cos(angle)*r/(111195*Math.cos(c[1]*Math.PI/180)),c[1]+Math.sin(angle)*r/111195]);}return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[points]}};}
 function fit(bottom,paintOnly,top){var coords=paintOnly?[]:(retained.route&&retained.route.geometry&&retained.route.geometry.coordinates)||[];if(!paintOnly&&!coords.length&&retained.trail&&retained.trail.geometry)coords=retained.trail.geometry.coordinates;if(!coords.length&&retained.paint)coords=retained.paint.features.reduce(function(all,f){return all.concat(f.geometry.coordinates);},[]);if(!coords.length){follow();return;}var bounds=new mapboxgl.LngLatBounds(coords[0],coords[0]);coords.forEach(function(p){bounds.extend(p);});following=false;post({type:'follow',value:false});map.fitBounds(bounds,{padding:{top:typeof top==='number'?top:120,bottom:bottom||230,left:45,right:45},maxZoom:17,pitch:threeD?40:0,duration:reduced?0:900});}
 function handle(m){switch(m.type){
  case 'init':position=[m.origin.lng,m.origin.lat];if(!user)user=puck();else user.setLngLat(position);setData('route',line(m.route));if(goal)goal.remove();goal=null;if(m.pin){var el=document.createElement('div');el.className='goal';el.textContent='⚑';goal=new mapboxgl.Marker({element:el}).setLngLat([m.pin.lng,m.pin.lat]).addTo(map);}if(m.fit)fit();else follow();break;
  case 'fix':move([m.lng,m.lat],typeof m.heading==='number'?m.heading:heading);break;
  case 'trail':setData('trail',line(m.coords));break;
  case 'paint':setData('paint',{type:'FeatureCollection',features:(m.lines||[]).filter(function(l){return l.length>1;}).map(function(l){return line(l);})});break;
  case 'mission':setData('mission',m.center?circle(m.center,m.radius||100):empty());break;
  case 'gift':if(gift)gift.remove();gift=null;if(m.position){var box=document.createElement('div');box.className='gift';box.innerHTML='<svg viewBox="0 0 64 72" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="64" rx="20" ry="5" fill="#030712" opacity=".2"/><path d="M9 29 L32 18 L55 29 L55 53 L32 66 L9 53Z" fill="#0D9488"/><path d="M32 42 L55 29 L55 53 L32 66Z" fill="#0F766E"/><path d="M6 26 L32 13 L58 26 L32 40Z" fill="#5EEAD4"/><path d="M6 26 L6 33 L32 47 L58 33 L58 26 L32 40Z" fill="#14B8A6"/><path d="M26 37 L34 41 L34 64 L26 60Z M16 21 L40 34 L47 30 L23 17Z" fill="#CCFBF1"/><path d="M31 17 C8 17 18 0 27 9 L32 17 C53 17 44 0 36 9Z" fill="none" stroke="#CCFBF1" stroke-width="4"/></svg>';gift=new mapboxgl.Marker({element:box,anchor:'bottom'}).setLngLat(m.position).addTo(map);}break;
  case 'options':rotate=m.rotate;threeD=m.threeD;follow();break;
  case 'follow':following=true;post({type:'follow',value:true});follow();break;
  case 'fit':fit(m.bottom,m.paintOnly,m.top);break;
  case 'reached':if(goal)goal.getElement().style.background='#5EEAD4';break;
  case 'theme':dark=m.dark;try{map.setConfigProperty('basemap','lightPreset',dark?'night':'day');}catch(e){}break;
 }}
 window.__run=function(m){if(!ready)queue.push(m);else handle(m);};
 window.addEventListener('message',function(event){if(event.source===window.parent&&event.data&&event.data.channel===channel)window.__run(event.data.message);});
 map.on('style.load',function(){layers();if(!ready){ready=true;post({type:'ready'});queue.forEach(handle);queue=[];}});
 ['dragstart','rotatestart','zoomstart'].forEach(function(event){map.on(event,function(e){if(e.originalEvent){following=false;post({type:'follow',value:false});}});});
 map.on('error',function(e){var text=String(e.error&&e.error.message||'');if(/token|401|403|Unauthorized/.test(text))post({type:'error',message:'რუკის წვდომა ვერ დადასტურდა.'});});
 window.addEventListener('pagehide',function(){if(raf)cancelAnimationFrame(raf);map.remove();});
 })();</script></body></html>`;
}
