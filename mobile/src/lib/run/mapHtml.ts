import type {LatLng} from './geo';
import {tx} from '../../i18n/locale.js';
import {MAP_FLAG,MAP_GIFT,MAP_PUCK} from './mapArt.js';
export const RUN_MAP_HTML_REV=12;

/** Only Mapbox rendering lives here. Auth, GPS, game logic and every control are native. */
export function buildRunMapHtml(opts:{token:string;center:LatLng;dark:boolean;channel?:string}):string{
 const json=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c');
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
 <link href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css" rel="stylesheet">
 <script src="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js"></script>
 <style>html,body,#map{margin:0;width:100%;height:100%;overflow:hidden;background:${opts.dark?'#030712':'#F5F7F7'}}
 .mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right{bottom:156px}
 .puck{width:46px;height:46px;filter:drop-shadow(0 4px 6px #03071277)}
 .puck img,.goal img,.gift img{width:100%;height:100%;display:block}
 .goal{width:44px;height:44px;filter:drop-shadow(0 4px 6px #03071266);transition:filter .3s}.goal.reached{filter:drop-shadow(0 0 12px #5EEAD4)}
 .gift{width:64px;height:64px;filter:drop-shadow(0 8px 10px #03071266);animation:giftFloat 2.6s ease-in-out infinite}
 @keyframes giftFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
 @media (prefers-reduced-motion:reduce){.gift{animation:none}}
 </style></head><body><div id="map"></div><script>
 (function(){
 var PUCK_ART=${json(MAP_PUCK)},FLAG_ART=${json(MAP_FLAG)},GIFT_ART=${json(MAP_GIFT)};
 var channel=${json(opts.channel||'native-map')},center=${json([opts.center.lng,opts.center.lat])},dark=${json(opts.dark)};
 function post(data){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(data));else if(window.parent!==window)window.parent.postMessage({channel:channel,data:data},'*');}catch(e){}}
 if(typeof mapboxgl==='undefined'){post({type:'error',message:${json(tx('რუკის ჩატვირთვა ვერ მოხერხდა. შეამოწმე ინტერნეტი.','The map couldn’t load. Check your internet connection.'))}});return;}
 mapboxgl.accessToken=${json(opts.token)};
 var map=new mapboxgl.Map({container:'map',style:'mapbox://styles/mapbox/standard',center:center,zoom:17.5,pitch:52,bearing:0,attributionControl:false,config:{basemap:{lightPreset:dark?'night':'day',showPointOfInterestLabels:false,show3dObjects:false}}});
 map.addControl(new mapboxgl.AttributionControl({compact:true}));
 var following=true,rotate=true,threeD=true,ready=false,queue=[],heading=0,user=null,goal=null,gift=null,position=center,raf=0;
 var retained={route:null,trail:null,paint:null,mission:null};
 var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function empty(){return {type:'FeatureCollection',features:[]};}
 function line(coords){return coords&&coords.length>1?{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}}:empty();}
 function setData(id,data){retained[id]=data;var source=map.getSource(id);if(source)source.setData(data);if(id==='paint'||id==='trail')scheduleScan();}
 function layers(){
  cityLayer();
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
 // Walked city: buildings near anything the player has walked rise to full height and take a colour; the rest stay low and grey.
 var CITY='walked-city',LIT=['boolean',['feature-state','lit'],false],REST=.28,RADIUS=55,PAL=['#FB7185','#F59E0B','#FCD34D','#34D399','#22D3EE','#818CF8','#E879F9','#2DD4BF','#F97316'];
 var lit={},rising=[],grid={},cosLat=Math.cos(center[1]*Math.PI/180),walkedPoints=-1,cityDirty=true,cityFirst=true,scanTimer=0,cityRaf=0;
 function cityLayer(){
  try{map.setConfigProperty('basemap','show3dObjects',false);}catch(e){}
  if(!map.getSource(CITY))map.addSource(CITY,{type:'vector',url:'mapbox://mapbox.mapbox-streets-v8'});
  if(map.getLayer('city-buildings'))return;
  var colour=['match',['%',['to-number',['id'],0],PAL.length]];PAL.forEach(function(c,i){colour.push(i,c);});colour.push(PAL[0]);
  var share=['case',LIT,['+',REST,['*',1-REST,['coalesce',['feature-state','rise'],1]]],REST];
  var layer={id:'city-buildings',type:'fill-extrusion',source:CITY,'source-layer':'building',minzoom:13,filter:['==',['get','extrude'],'true'],
   paint:{'fill-extrusion-color':['case',LIT,colour,dark?'#1E2735':'#C7D0CE'],'fill-extrusion-height':['*',['coalesce',['get','height'],9],share],'fill-extrusion-base':['*',['coalesce',['get','min_height'],0],share],'fill-extrusion-opacity':.92,'fill-extrusion-emissive-strength':['case',LIT,.7,.05]}};
  if(map.getStyle().imports)layer.slot='middle';
  try{map.addLayer(layer);}catch(e){delete layer.paint['fill-extrusion-emissive-strength'];try{map.addLayer(layer);}catch(e2){}}
 }
 function walkedLines(){var out=[];if(retained.paint&&retained.paint.features)retained.paint.features.forEach(function(f){out.push(f.geometry.coordinates);});if(retained.trail&&retained.trail.geometry)out.push(retained.trail.geometry.coordinates);return out;}
 function xy(p){return [p[0]*111320*cosLat,p[1]*110540];}
 function indexWalk(){
  var lines=walkedLines(),count=0;lines.forEach(function(l){count+=l.length;});if(count===walkedPoints)return;walkedPoints=count;grid={};
  lines.forEach(function(l){for(var i=0;i<l.length;i++){var a=xy(l[i]),b=xy(l[i+1]||l[i]),steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/10));
   for(var k=0;k<steps;k++){var x=a[0]+(b[0]-a[0])*k/steps,y=a[1]+(b[1]-a[1])*k/steps,key=Math.floor(x/RADIUS)+','+Math.floor(y/RADIUS);(grid[key]||(grid[key]=[])).push([x,y]);}}});
  cityDirty=true;
 }
 function near(p){var q=xy(p),cx=Math.floor(q[0]/RADIUS),cy=Math.floor(q[1]/RADIUS);for(var i=-1;i<=1;i++)for(var j=-1;j<=1;j++){var cell=grid[(cx+i)+','+(cy+j)];if(cell)for(var n=0;n<cell.length;n++){var dx=cell[n][0]-q[0],dy=cell[n][1]-q[1];if(dx*dx+dy*dy<RADIUS*RADIUS)return true;}}return false;}
 function scheduleScan(){if(!scanTimer)scanTimer=setTimeout(scan,500);}
 function scan(){
  scanTimer=0;indexWalk();if(!cityDirty||!map.getLayer('city-buildings'))return;cityDirty=false;
  var animate=!cityFirst&&!reduced,now=performance.now(),any=false;
  map.querySourceFeatures(CITY,{sourceLayer:'building'}).forEach(function(f){
   var id=f.id;if(id===undefined||lit[id])return;var g=f.geometry,ring=g.type==='Polygon'?g.coordinates[0]:g.type==='MultiPolygon'?g.coordinates[0][0]:null;if(!ring||!ring.length)return;
   var sx=0,sy=0;ring.forEach(function(c){sx+=c[0];sy+=c[1];});if(!near([sx/ring.length,sy/ring.length]))return;
   lit[id]=1;map.setFeatureState({source:CITY,sourceLayer:'building',id:id},{lit:true,rise:animate?0:1});if(animate){rising.push({id:id,t:now+Math.random()*250});any=true;}
  });
  if(Object.keys(grid).length)cityFirst=false;
  if(any&&!cityRaf)cityRaf=requestAnimationFrame(riseFrame);
 }
 function riseFrame(now){
  cityRaf=0;
  rising=rising.filter(function(r){var p=Math.min(1,Math.max(0,(now-r.t)/900)),c=1.9,e=p<=0?0:1+(c+1)*Math.pow(p-1,3)+c*Math.pow(p-1,2);
   map.setFeatureState({source:CITY,sourceLayer:'building',id:r.id},{rise:e});return p<1;});
  if(rising.length)cityRaf=requestAnimationFrame(riseFrame);
 }
 function puck(){var el=document.createElement('div');el.className='puck';el.innerHTML='<img alt="" src="'+PUCK_ART+'">';return new mapboxgl.Marker({element:el,rotationAlignment:'map',pitchAlignment:'map'}).setLngLat(position).addTo(map);}
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
  case 'init':position=[m.origin.lng,m.origin.lat];if(!user)user=puck();else user.setLngLat(position);setData('route',line(m.route));if(goal)goal.remove();goal=null;if(m.pin){var el=document.createElement('div');el.className='goal';el.innerHTML='<img alt="" src="'+FLAG_ART+'">';goal=new mapboxgl.Marker({element:el}).setLngLat([m.pin.lng,m.pin.lat]).addTo(map);}if(m.fit)fit();else follow();break;
  case 'fix':move([m.lng,m.lat],typeof m.heading==='number'?m.heading:heading);break;
  case 'trail':setData('trail',line(m.coords));break;
  case 'paint':setData('paint',{type:'FeatureCollection',features:(m.lines||[]).filter(function(l){return l.length>1;}).map(function(l){return line(l);})});break;
  case 'mission':setData('mission',m.center?circle(m.center,m.radius||100):empty());break;
  case 'gift':if(gift)gift.remove();gift=null;if(m.position){var box=document.createElement('div');box.className='gift';box.innerHTML='<img alt="" src="'+GIFT_ART+'">';gift=new mapboxgl.Marker({element:box,anchor:'bottom'}).setLngLat(m.position).addTo(map);}break;
  case 'options':rotate=m.rotate;threeD=m.threeD;follow();break;
  case 'follow':following=true;post({type:'follow',value:true});follow();break;
  case 'fit':fit(m.bottom,m.paintOnly,m.top);break;
  case 'reached':if(goal)goal.getElement().classList.add('reached');break;
  case 'theme':dark=m.dark;try{map.setConfigProperty('basemap','lightPreset',dark?'night':'day');}catch(e){}if(map.getLayer('city-buildings'))map.setPaintProperty('city-buildings','fill-extrusion-color',['case',LIT,map.getPaintProperty('city-buildings','fill-extrusion-color')[2],dark?'#1E2735':'#C7D0CE']);break;
 }}
 window.__run=function(m){if(!ready)queue.push(m);else handle(m);};
 window.addEventListener('message',function(event){if(event.source===window.parent&&event.data&&event.data.channel===channel)window.__run(event.data.message);});
 map.on('sourcedata',function(e){if(e.sourceId===CITY&&e.isSourceLoaded){cityDirty=true;scheduleScan();}});
 map.on('style.load',function(){layers();if(!ready){ready=true;post({type:'ready'});queue.forEach(handle);queue=[];}});
 ['dragstart','rotatestart','zoomstart'].forEach(function(event){map.on(event,function(e){if(e.originalEvent){following=false;post({type:'follow',value:false});}});});
 map.on('error',function(e){var text=String(e.error&&e.error.message||'');if(/token|401|403|Unauthorized/.test(text))post({type:'error',message:${json(tx('რუკის წვდომა ვერ დადასტურდა.','Map access couldn’t be verified.'))}});});
 window.addEventListener('pagehide',function(){if(raf)cancelAnimationFrame(raf);if(cityRaf)cancelAnimationFrame(cityRaf);if(scanTimer)clearTimeout(scanTimer);map.remove();});
 })();</script></body></html>`;
}
