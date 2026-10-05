// MEDIRUN share clips (owner 2026-10-05: „ყველაზე ლამაზი რამ აპიდან გამოვიდეს“). A hidden-chrome WebView renders
// the Glow night city (or the box opening) into one 720×1280 canvas with the wordmark, the numbers and the invite
// link drawn on top, records ~10 s with MediaRecorder and hands the file to the native share sheet. Where the
// WebView cannot record an mp4 (older iOS, Android WebView = webm only) the same final frame comes back as a
// picture, so sharing always works. Everything here ships in the JS bundle and the page loads the same engine
// as the run map, so changes go out by OTA / server deploy only.
import {tx} from '../../i18n/locale.js';
import {GLOW_BASE} from './mapHtml.ts';

export type LngLat=[number,number];
export type ShareStat={value:string;label:string};
type Overlay={kicker:string;title:string;big:string;unit:string;stats:ShareStat[];link:string;cta:string;attribution:string};
export type ShareScene=
 | (Overlay&{kind:'walk';line:LngLat[];hero:'m'|'f'})
 | (Overlay&{kind:'city';lines:LngLat[][];hero:'m'|'f'})
 | (Overlay&{kind:'box';coins:number;badge:string;place:string});
export type StudioMessage=
 | {type:'started';mode:'video'|'image'}
 | {type:'progress';p:number}
 | {type:'image';data:string}
 | {type:'video-start';mime:string;chunks:number}
 | {type:'video-chunk';i:number;data:string}
 | {type:'video-end'}
 | {type:'error';message:string};

const R=Math.PI/180;
export function metersBetween(a:LngLat,b:LngLat){
 const dLat=(b[1]-a[1])*R,dLon=(b[0]-a[0])*R,h=Math.sin(dLat/2)**2+Math.cos(a[1]*R)*Math.cos(b[1]*R)*Math.sin(dLon/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
export function lineLength(line:LngLat[]){let d=0;for(let i=1;i<line.length;i++)d+=metersBetween(line[i-1],line[i]);return d;}
const valid=(p:unknown):p is LngLat=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0] as number)<=180&&Math.abs(p[1] as number)<=90;

/** Cuts `meters` off one end of a line (start = true: from the beginning), interpolating the new end point. */
function cut(line:LngLat[],meters:number,start:boolean):LngLat[]{
 const pts=start?line:[...line].reverse();
 let left=meters;
 for(let i=1;i<pts.length;i++){
  const d=metersBetween(pts[i-1],pts[i]);
  if(d>=left){const t=d>0?left/d:0,p:LngLat=[pts[i-1][0]+(pts[i][0]-pts[i-1][0])*t,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*t];const out=[p,...pts.slice(i)];return start?out:out.reverse();}
  left-=d;
 }
 return [];
}
/**
 * Privacy zone (Strava-style): a walk usually starts and ends at home, so every line loses `meters` at both ends
 * before it is drawn on a picture people will post. Lines shorter than twice that disappear.
 */
export function trimEnds(lines:LngLat[][],meters=200):LngLat[][]{
 return lines.map(l=>l.filter(valid)).filter(l=>l.length>1).map(l=>cut(cut(l,meters,true),meters,false)).filter(l=>l.length>1&&lineLength(l)>20);
}
/** One walk drawn as one line: segments joined in order (pauses become a short straight step). */
export function joinSegments(segments:LngLat[][]):LngLat[]{return segments.flat().filter(valid);}
/**
 * The city clip shows one city: lines with a point within `radiusM` of the median point of all lines (a walk in
 * another city would zoom the camera out to a whole country, where the city engine draws nothing).
 */
export function cityLines(lines:LngLat[][],radiusM=12000):LngLat[][]{
 const pts=lines.flat().filter(valid);
 if(!pts.length)return [];
 const med=(k:0|1)=>{const v=pts.map(p=>p[k]).sort((a,b)=>a-b);return v[Math.floor(v.length/2)];};
 const centre:LngLat=[med(0),med(1)];
 return lines.filter(l=>l.some(p=>valid(p)&&metersBetween(p,centre)<=radiusM));
}
export function boundsOf(lines:LngLat[][]):[number,number,number,number]|null{
 let b:[number,number,number,number]=[Infinity,Infinity,-Infinity,-Infinity];
 for(const l of lines)for(const p of l)if(valid(p))b=[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])];
 return Number.isFinite(b[0])?b:null;
}
/** Thins a long line so the page never gets more than `max` points (keeps the shape, never the ends). */
export function thin(line:LngLat[],max=1500):LngLat[]{
 if(line.length<=max)return line;
 const step=(line.length-1)/(max-1);
 return Array.from({length:max},(_,i)=>line[Math.round(i*step)]);
}

const ATTRIBUTION='© Mapbox © OpenStreetMap';
export const attribution=()=>ATTRIBUTION;
export const sceneDefaults={cta:()=>tx('ჩამოტვირთე MEDICARD და გაანათე შენი ქალაქი','Get MEDICARD and light up your city'),attribution};

/** The page. `scene` is data only; the page never talks to anything but Mapbox and medicard.ge. */
export function buildShareStudioHtml(opts:{token:string;scene:ShareScene;glowBase?:string;reducedMotion?:boolean}):string{
 const json=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\x3c').replace(/[\u2028\u2029]/g,' ');
 const base=(opts.glowBase||GLOW_BASE).replace(/"/g,'');
 const map=opts.scene.kind!=='box';
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
 <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
 <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@800&family=Noto+Sans+Georgian:wght@500;700;800&display=block" rel="stylesheet">
 ${map?`<link href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css" rel="stylesheet"><script src="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js"></script><script src="${base}engine.js?v=share1"></script>`:''}
 <style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#030712}
 #map{position:fixed;left:0;top:0;width:720px;height:1280px;z-index:0}
 #out{position:fixed;left:0;top:0;width:100%;height:100%;object-fit:contain;z-index:1;background:#030712}</style>
 </head><body>${map?'<div id="map"></div>':''}<canvas id="out" width="720" height="1280"></canvas><script>
 (function(){
 var S=${json(opts.scene)},TOKEN=${json(opts.token)},BASE=${json(base)},REDUCED=${opts.reducedMotion?'true':'false'};
 var W=720,H=1280,TEAL='#2DD4BF',MINT='#99F6E4',AMBER='#FCD34D',KA='"Noto Sans Georgian",system-ui,sans-serif',EXO='"Exo 2","Noto Sans Georgian",system-ui,sans-serif';
 function post(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}}
 function fail(m){post({type:'error',message:String(m||'error')});}
 window.onerror=function(m){fail(m);};
 var out=document.getElementById('out'),ctx=out.getContext('2d');
 var DUR=S.kind==='box'?6.8:10.5,REVEAL=S.kind==='box'?2.4:S.kind==='walk'?6.6:6.0;
 function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
 function ease(x){x=clamp(x,0,1);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;}
 function easeOut(x){x=clamp(x,0,1);return 1-Math.pow(1-x,3);}
 function lerp(a,b,t){return a+(b-a)*t;}
 function fit(text,font,size,max){ctx.font=font.replace('{s}',size);while(size>12&&ctx.measureText(text).width>max){size-=2;ctx.font=font.replace('{s}',size);}return size;}

 // ---------- overlay: wordmark, numbers, invite link ----------
 function wordmark(x,y,size){
  ctx.save();ctx.textBaseline='alphabetic';ctx.font='800 '+size+'px '+EXO;ctx.fillStyle='#FFFFFF';ctx.fillText('MEDI',x,y);
  var w=ctx.measureText('MEDI').width;ctx.translate(x+w-size*.02,y);ctx.transform(1,0,-Math.tan(16*Math.PI/180),1,0,0);ctx.fillStyle=TEAL;ctx.fillText('RUN',0,0);ctx.restore();
 }
 function pill(text,cx,y){
  ctx.save();ctx.font='700 28px '+KA;var w=ctx.measureText(text).width+76,h=58,x=cx-w/2;
  ctx.fillStyle='rgba(255,255,255,.10)';ctx.strokeStyle='rgba(153,246,228,.45)';ctx.lineWidth=2;
  ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,29);else ctx.rect(x,y,w,h);ctx.fill();ctx.stroke();
  ctx.fillStyle=TEAL;ctx.beginPath();ctx.arc(x+30,y+h/2,7,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#FFFFFF';ctx.textBaseline='middle';ctx.fillText(text,x+48,y+h/2+1);ctx.restore();
 }
 function overlay(t){
  // top: dark fade, wordmark, kicker
  var g=ctx.createLinearGradient(0,0,0,300);g.addColorStop(0,'rgba(3,7,18,.78)');g.addColorStop(1,'rgba(3,7,18,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,300);
  wordmark(56,128,64);
  if(S.kicker){ctx.font='500 26px '+KA;ctx.fillStyle='rgba(255,255,255,.78)';ctx.textBaseline='alphabetic';ctx.fillText(S.kicker,58,174);}
  // bottom: panel with the numbers, revealed with a lift
  // the box clip paints its own numbers in the middle: only a light fade behind the link there
  var top=S.kind==='box'?H-240:H-640,b=ctx.createLinearGradient(0,top,0,H);b.addColorStop(0,'rgba(3,7,18,0)');b.addColorStop(S.kind==='box'?.5:.42,'rgba(3,7,18,.82)');b.addColorStop(1,'rgba(3,7,18,.96)');ctx.fillStyle=b;ctx.fillRect(0,top,W,H-top);
  var r=REDUCED?1:easeOut((t-REVEAL)/.9);
  if(r>0&&S.kind!=='box'){
   ctx.save();ctx.globalAlpha=r;ctx.translate(0,(1-r)*40);ctx.textBaseline='alphabetic';
   var size=fit(S.title,'700 {s}px '+KA,36,W-112);ctx.fillStyle=MINT;ctx.fillText(S.title,56,H-470);
   var big=fit(S.big,'800 {s}px '+EXO,168,W-260);ctx.fillStyle='#FFFFFF';ctx.fillText(S.big,52,H-320);
   var bw=ctx.measureText(S.big).width;ctx.font='800 54px '+KA;ctx.fillStyle=TEAL;ctx.fillText(S.unit,52+bw+16,H-322);
   var cols=S.stats.slice(0,3),cw=(W-112)/Math.max(1,cols.length);
   cols.forEach(function(s,i){var x=56+i*cw;ctx.fillStyle='#FFFFFF';fit(s.value,'700 {s}px '+EXO,40,cw-16);ctx.fillText(s.value,x,H-236);ctx.fillStyle='rgba(255,255,255,.62)';fit(s.label,'500 {s}px '+KA,22,cw-16);ctx.fillText(s.label,x,H-204);});
   ctx.restore();
  }
  var f=REDUCED?1:easeOut((t-REVEAL-.5)/.8);
  if(f>0){ctx.save();ctx.globalAlpha=f;pill(S.link,W/2,H-150);ctx.font='500 22px '+KA;ctx.fillStyle='rgba(255,255,255,.7)';ctx.textAlign='center';ctx.textBaseline='alphabetic';fit(S.cta,'500 {s}px '+KA,22,W-80);ctx.fillText(S.cta,W/2,H-60);ctx.restore();}
  if(S.kind!=='box'){ctx.save();ctx.font='500 15px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,.45)';ctx.textAlign='right';ctx.fillText(S.attribution,W-18,H-18);ctx.restore();}
  if(t<.6){ctx.fillStyle='rgba(3,7,18,'+(1-t/.6)+')';ctx.fillRect(0,0,W,H);}
 }

 // ---------- recorder (mp4 where the WebView can, else the last frame as a picture) ----------
 function pickMime(){
  if(!window.MediaRecorder||!out.captureStream)return null;
  var list=['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1','video/mp4','video/quicktime'];
  for(var i=0;i<list.length;i++){try{if(MediaRecorder.isTypeSupported(list[i]))return list[i];}catch(e){}}
  return null;
 }
 var rec=null,parts=[],mime=pickMime();
 function startRecording(){
  if(!mime){post({type:'started',mode:'image'});return;}
  try{
   var stream=out.captureStream(30);
   rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000});
   rec.ondataavailable=function(e){if(e.data&&e.data.size)parts.push(e.data);};
   rec.start(1000);
   post({type:'started',mode:'video'});
  }catch(e){rec=null;mime=null;post({type:'started',mode:'image'});}
 }
 function sendBlob(blob){
  var reader=new FileReader();
  reader.onerror=function(){fail('read');};
  reader.onload=function(){
   var s=String(reader.result||''),b64=s.slice(s.indexOf(',')+1),size=400000,n=Math.ceil(b64.length/size);
   post({type:'video-start',mime:(mime||'video/mp4').split(';')[0],chunks:n});
   for(var i=0;i<n;i++)post({type:'video-chunk',i:i,data:b64.slice(i*size,(i+1)*size)});
   post({type:'video-end'});
  };
  reader.readAsDataURL(blob);
 }
 function finish(){
  // the picture first (always), then the clip when there is one
  var still='';try{still=out.toDataURL('image/jpeg',.9);}catch(e){}
  if(still)post({type:'image',data:still.slice(still.indexOf(',')+1)});
  if(!rec){if(!still)fail('capture');else post({type:'video-end',none:true});return;}
  var done=false;
  function deliver(){if(done)return;done=true;var blob=new Blob(parts,{type:(mime||'video/mp4').split(';')[0]});if(blob.size<20000)post({type:'video-end',none:true});else sendBlob(blob);}
  rec.onstop=deliver;setTimeout(deliver,4000);
  try{rec.requestData&&rec.requestData();rec.stop();}catch(e){deliver();}
 }

 // ---------- timeline ----------
 var t0=0,last=0,lastProgress=-1,ended=false,draw=function(){};
 function loop(now){
  if(ended)return;
  if(!t0)t0=now;var t=(now-t0)/1000;
  try{draw(t);}catch(e){}
  ctx.save();overlay(t);ctx.restore();
  var p=Math.floor(clamp(t/DUR,0,1)*20);if(p!==lastProgress){lastProgress=p;post({type:'progress',p:p/20});}
  if(t>=DUR){ended=true;finish();return;}
  requestAnimationFrame(loop);
 }
 function begin(){startRecording();requestAnimationFrame(loop);}
 var fontsReady=(document.fonts&&document.fonts.load?Promise.all([document.fonts.load('800 64px "Exo 2"'),document.fonts.load('700 36px "Noto Sans Georgian"'),document.fonts.load('500 26px "Noto Sans Georgian"')]):Promise.resolve()).catch(function(){});
 function timeout(ms){return new Promise(function(r){setTimeout(r,ms);});}

 // ---------- the box opening (2D only) ----------
 function boxScene(){
  var shut=new Image(),open=new Image(),coins=[];shut.crossOrigin=open.crossOrigin='anonymous';
  shut.src=BASE+'share/gift.png';open.src=BASE+'share/gift-open.png';
  for(var i=0;i<34;i++){var a=Math.random()*Math.PI*2,v=380+Math.random()*520;coins.push({vx:Math.cos(a)*v,vy:Math.sin(a)*v-520,r:9+Math.random()*12,c:i%3?AMBER:'#F59E0B',s:Math.random()*6});}
  var stars=[];for(var k=0;k<70;k++)stars.push({x:Math.random()*W,y:Math.random()*H*.75,r:.6+Math.random()*1.8,p:Math.random()*6});
  draw=function(t){
   var bg=ctx.createLinearGradient(0,0,W*.4,H);bg.addColorStop(0,'#030712');bg.addColorStop(.55,'#042F2E');bg.addColorStop(1,'#0F766E');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
   stars.forEach(function(s){ctx.globalAlpha=.25+.35*Math.abs(Math.sin(t*1.4+s.p));ctx.fillStyle='#CCFBF1';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
   var opened=t>=2.2,cx=W/2,cy=520,size=opened?420:470;
   var glow=ctx.createRadialGradient(cx,cy,10,cx,cy,380);glow.addColorStop(0,opened?'rgba(252,211,77,.55)':'rgba(94,234,212,.34)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
   var float=REDUCED?0:Math.sin(t*2.2)*12,shake=!REDUCED&&t>1.2&&t<2.2?Math.sin(t*70)*.11:0;
   ctx.save();ctx.translate(cx,cy+float);ctx.rotate(shake);var img=opened?open:shut;if(img.complete&&img.naturalWidth)ctx.drawImage(img,-size/2,-size/2,size,size);ctx.restore();
   if(opened&&!REDUCED){var dt=t-2.2;if(dt<.25){ctx.fillStyle='rgba(255,255,255,'+(.8*(1-dt/.25))+')';ctx.fillRect(0,0,W,H);}
    coins.forEach(function(o){var x=cx+o.vx*dt*.6,y=cy+o.vy*dt*.6+700*dt*dt;var a=clamp(1.6-dt*.55,0,1);if(a<=0)return;ctx.globalAlpha=a;ctx.fillStyle=o.c;ctx.beginPath();ctx.ellipse(x,y,o.r,o.r*Math.abs(Math.cos(t*6+o.s)),0,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;}
   var r=REDUCED?1:easeOut((t-2.4)/.8);
   if(r>0){
    ctx.save();ctx.globalAlpha=r;ctx.textAlign='center';ctx.textBaseline='alphabetic';
    var shown=REDUCED?S.coins:Math.round(S.coins*easeOut((t-2.4)/1.1));
    var txt='+'+shown;fit(txt,'800 {s}px '+EXO,150,W-80);ctx.fillStyle='#FFFFFF';ctx.fillText(txt,W/2,900);
    ctx.font='800 40px '+EXO;ctx.fillStyle=MINT;ctx.fillText('Medi Coins',W/2,952);
    ctx.restore();
   }
   var q=REDUCED?1:easeOut((t-3.3)/.7);
   if(q>0){
    ctx.save();ctx.globalAlpha=q;ctx.textAlign='center';
    if(S.badge){fit(S.badge,'700 {s}px '+KA,30,W-120);var bw=ctx.measureText(S.badge).width+56;ctx.fillStyle='rgba(252,211,77,.18)';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(W/2-bw/2,984,bw,58,29);else ctx.rect(W/2-bw/2,984,bw,58);ctx.fill();ctx.fillStyle=AMBER;ctx.textBaseline='middle';ctx.fillText(S.badge,W/2,1014);}
    if(S.place){ctx.textBaseline='alphabetic';fit(S.place,'500 {s}px '+KA,28,W-120);ctx.fillStyle='rgba(204,251,241,.9)';ctx.fillText(S.place,W/2,1088);}
    ctx.restore();
   }
  };
  Promise.all([fontsReady,new Promise(function(r){var n=0;function one(){if(++n===2)r();}shut.onload=open.onload=one;shut.onerror=open.onerror=one;}),timeout(200)]).then(begin);
 }

 // ---------- the night city (walk / my city) ----------
 function cityScene(){
  if(typeof mapboxgl==='undefined'){fail('map');return;}
  mapboxgl.accessToken=TOKEN;
  var G=window.MedirunGlow||null,lines=S.kind==='walk'?[S.line]:S.lines;
  var b=[Infinity,Infinity,-Infinity,-Infinity];lines.forEach(function(l){l.forEach(function(p){b=[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])];});});
  var centre=[(b[0]+b[2])/2,(b[1]+b[3])/2];
  var map=new mapboxgl.Map({container:'map',style:G?G.glowStyle():'mapbox://styles/mapbox/dark-v11',center:centre,zoom:15,pitch:55,bearing:-20,interactive:false,attributionControl:false,preserveDrawingBuffer:true,pixelRatio:1,antialias:true,fadeDuration:0,projection:'mercator',maxPitch:75});
  var glow=null,cam=null;
  function densify(line,step){var outp=[line[0]];for(var i=1;i<line.length;i++){var a=line[i-1],c=line[i],dx=(c[0]-a[0])*111320*Math.cos(a[1]*Math.PI/180),dy=(c[1]-a[1])*110540,d=Math.hypot(dx,dy),n=Math.max(1,Math.ceil(d/step));for(var k=1;k<=n;k++)outp.push([a[0]+(c[0]-a[0])*k/n,a[1]+(c[1]-a[1])*k/n]);}return outp;}
  var path=S.kind==='walk'?densify(S.line,6):null,fed=0,lastFeed=0,lastStep=-1,follow=null;
  function heading(a,c){var y=Math.sin((c[0]-a[0])*Math.PI/180)*Math.cos(c[1]*Math.PI/180),x=Math.cos(a[1]*Math.PI/180)*Math.sin(c[1]*Math.PI/180)-Math.sin(a[1]*Math.PI/180)*Math.cos(c[1]*Math.PI/180)*Math.cos((c[0]-a[0])*Math.PI/180);return (Math.atan2(y,x)*180/Math.PI+360)%360;}
  draw=function(t){
   if(cam&&S.kind==='walk'&&path){
    // follow the light close behind the runner while the walk draws itself, then pull back to the whole route
    var head=path[Math.max(0,fed-1)]||path[0],out=REDUCED?1:ease((t-6.3)/1.6),bear=lerp(-30,25,REDUCED?1:ease(t/DUR));
    follow=follow?[lerp(follow[0],head[0],.08),lerp(follow[1],head[1],.08)]:head;
    map.jumpTo({center:[lerp(follow[0],cam.center[0],out),lerp(follow[1],cam.center[1],out)],zoom:lerp(cam.close,cam.zoom,out),pitch:lerp(62,52,out),bearing:bear});
   }else if(cam){
    var k=REDUCED?1:ease(t/6.4);
    map.jumpTo({center:cam.center,zoom:lerp(cam.zoom+1.5,cam.zoom,k),pitch:lerp(48,60,k),bearing:lerp(-28,58,REDUCED?1:ease(t/DUR))});
   }
   if(glow&&path){
    var p=REDUCED?1:ease((t-.4)/6),want=Math.max(2,Math.round(p*path.length));
    if(want>fed&&(t-lastFeed>.1||want===path.length)){fed=want;lastFeed=t;glow.setTrail(path.slice(0,fed));var h=path[fed-1],pr=path[Math.max(0,fed-4)];glow.setRunner(h[0],h[1],heading(pr,h),fed<path.length?3.2:0);}
   }
   if(glow&&S.kind==='city'){
    var steps=Math.min(14,lines.length),q=REDUCED?1:clamp((t-.4)/5,0,1),s=Math.ceil(q*steps);
    if(s!==lastStep){lastStep=s;var shown=lines.slice(0,Math.ceil(lines.length*s/steps));glow.setPaint(shown);var src=map.getSource('paint');if(src)src.setData({type:'FeatureCollection',features:shown.map(function(l){return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:l}};})});}
   }
   map.triggerRepaint();
   try{ctx.drawImage(map.getCanvas(),0,0,W,H);}catch(e){}
  };
  map.on('error',function(e){var m=String(e&&e.error&&e.error.message||'');if(/token|401|403/i.test(m))fail('token');});
  map.on('style.load',function(){
   if(G){try{glow=G.createGlow({mapboxgl:mapboxgl,map:map,token:TOKEN,assetBase:BASE,hero:S.hero,adaptive:false});}catch(e){glow=null;}}
   // my lit streets glow on the ground too (the city clip lights them one walk after another)
   if(S.kind==='city'){try{map.addSource('paint',{type:'geojson',data:{type:'FeatureCollection',features:[]}});var zw=function(a,b){return ['interpolate',['linear'],['zoom'],12,a,18,b];};map.addLayer({id:'paint-aura',type:'line',source:'paint',paint:{'line-color':'#14B8A6','line-width':zw(5,22),'line-opacity':.28,'line-blur':6},layout:{'line-cap':'round','line-join':'round'}});map.addLayer({id:'paint-line',type:'line',source:'paint',paint:{'line-color':'#5EEAD4','line-width':zw(1.6,4.5),'line-opacity':.9},layout:{'line-cap':'round','line-join':'round'}});}catch(e){}}
   if(glow){glow.setRunnerVisible(S.kind==='walk');if(S.kind==='walk'){var s0=path[0];glow.setRunner(s0[0],s0[1],null,0);glow.setActivity('auto');}
    // the holiday trucks and the Mtatsminda wheel come along, like on the run map
    try{if(glow.debug&&glow.debug.THREE){window.__MEDIRUN_THREE__=glow.debug.THREE;var sc=document.createElement('script');sc.src=BASE+'decor/decor.js?v=share1';sc.onload=function(){try{window.MedirunDecor.start(glow,{map:map,mapboxgl:mapboxgl,base:BASE+'decor/'});}catch(e){}};document.head.appendChild(sc);}}catch(e){}}
   var c=map.cameraForBounds([[b[0],b[1]],[b[2],b[3]]],{padding:{top:300,bottom:600,left:80,right:80}})||{center:centre,zoom:15};
   var ctr=c.center&&c.center.lng!=null?[c.center.lng,c.center.lat]:centre;
   cam={center:ctr,zoom:clamp(c.zoom||15,13.6,17.4)};cam.zoom=Math.max(cam.zoom,S.kind==='city'?13.9:13.6);cam.close=clamp(cam.zoom+1.8,16,17.8);
   if(S.kind==='walk')map.jumpTo({center:path[0],zoom:cam.close,pitch:62,bearing:-30});
   else map.jumpTo({center:cam.center,zoom:cam.zoom+1.5,pitch:48,bearing:-28});
   var idle=new Promise(function(r){map.once('idle',r);});
   Promise.all([fontsReady,Promise.race([idle,timeout(7000)])]).then(function(){return timeout(1400);}).then(begin);
  });
 }
 if(S.kind==='box')boxScene();else cityScene();
 })();</script></body></html>`;
}
