// MEDIRUN share clips (owner 2026-10-05: „ყველაზე ლამაზი რამ აპიდან გამოვიდეს“). A WebView renders the Glow night
// city (or the box opening) frame by frame into one 720×1280 canvas with the wordmark, the numbers and the invite
// link on top, encodes an mp4 (WebCodecs + mp4-muxer, served from medicard.ge) and hands it to the share sheet.
// No WebCodecs → the last frame as a picture, so sharing always works. Ships by OTA / server deploy only.
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

/** Frames per second of every clip (the encoder gets exactly this many frames per second of video). */
export const CLIP_FPS=30;
/** Clip lengths in seconds. */
export const CLIP_SECONDS={walk:12,city:11,box:7} as const;
const SEPARATORS=new RegExp('['+String.fromCharCode(0x2028,0x2029)+']','g');

/**
 * The page. `scene` is data only; the page talks to Mapbox and medicard.ge and nothing else.
 *
 * Rendering is offline, frame by frame (owner 2026-10-05: the first real-time recording stuttered and showed black
 * holes): a virtual clock replaces performance.now / requestAnimationFrame before Mapbox and the Glow engine load,
 * so every frame advances the city by exactly 1/30 s. Before a frame is taken the page waits until the map's tiles
 * and the engine's own downloads have arrived, then hands the frame to WebCodecs (H.264) and mp4-muxer. However
 * slow the phone, the video plays smooth and complete. Without WebCodecs the same frames are drawn and the last one
 * comes back as a picture.
 */
export function buildShareStudioHtml(opts:{token:string;scene:ShareScene;glowBase?:string;reducedMotion?:boolean}):string{
 const json=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\x3c').replace(SEPARATORS,' ');
 const base=(opts.glowBase||GLOW_BASE).replace(/"/g,'');
 const map=opts.scene.kind!=='box';
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
 <script>
 // Virtual clock: must run before Mapbox and the engine read performance.now / requestAnimationFrame.
 (function(){
  var realNow=performance.now.bind(performance),realRaf=window.requestAnimationFrame.bind(window),realCancel=window.cancelAnimationFrame.bind(window),realDate=Date.now;
  var V={on:false,t:0,base:0,q:new Map(),id:1e9};
  performance.now=function(){return V.on?V.t:realNow();};
  Date.now=function(){return V.on?V.base+V.t:realDate();};
  window.requestAnimationFrame=function(cb){if(!V.on)return realRaf(cb);var id=++V.id;V.q.set(id,cb);return id;};
  window.cancelAnimationFrame=function(id){if(V.q.has(id))V.q.delete(id);else realCancel(id);};
  V.realNow=realNow;
  V.enable=function(){V.t=realNow();V.base=realDate()-V.t;V.on=true;};
  V.step=function(ms){V.t+=ms;var q=V.q;V.q=new Map();q.forEach(function(cb){try{cb(V.t);}catch(e){}});};
  window.__clock=V;
 })();
 </script>
 <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
 <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@800&family=Noto+Sans+Georgian:wght@500;700;800&display=block" rel="stylesheet">
 ${map?`<link href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css" rel="stylesheet"><script src="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.js"></script><script src="${base}engine.js?v=share2"></script>`:''}
 <script src="${base}share/mp4-muxer.js?v=1"></script>
 <style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#030712}
 #map{position:fixed;left:0;top:0;width:720px;height:1280px;z-index:0}
 #out,#play{position:fixed;left:0;top:0;width:100%;height:100%;object-fit:contain;z-index:1;background:#030712}
 #play{z-index:2;display:none}</style>
 </head><body>${map?'<div id="map"></div>':''}<canvas id="out" width="720" height="1280"></canvas><video id="play" muted loop playsinline autoplay></video><script>
 (function(){
 var S=${json(opts.scene)},TOKEN=${json(opts.token)},BASE=${json(base)},REDUCED=${opts.reducedMotion?'true':'false'};
 var V=window.__clock,W=720,H=1280,FPS=${CLIP_FPS},TEAL='#2DD4BF',MINT='#99F6E4',AMBER='#FCD34D',KA='"Noto Sans Georgian",system-ui,sans-serif',EXO='"Exo 2","Noto Sans Georgian",system-ui,sans-serif';
 var DUR=S.kind==='box'?${CLIP_SECONDS.box}:S.kind==='walk'?${CLIP_SECONDS.walk}:${CLIP_SECONDS.city},REVEAL=S.kind==='box'?2.4:S.kind==='walk'?8.2:7.2,N=Math.round(DUR*FPS);
 function post(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o));}catch(e){}}
 var failed=false;function fail(m){if(failed)return;failed=true;post({type:'error',message:String(m||'error')});}
 window.onerror=function(m){fail(m);};
 var out=document.getElementById('out'),ctx=out.getContext('2d');
 function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
 function ease(x){x=clamp(x,0,1);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;}
 function easeOut(x){x=clamp(x,0,1);return 1-Math.pow(1-x,3);}
 function lerp(a,b,t){return a+(b-a)*t;}
 function lerpAngle(a,b,t){return a+((((b-a)%360)+540)%360-180)*t;}
 function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
 function fit(text,font,size,max){ctx.font=font.replace('{s}',size);while(size>12&&ctx.measureText(text).width>max){size-=2;ctx.font=font.replace('{s}',size);}return size;}

 // ---------- overlay ----------
 function wordmark(x,y,size){
  ctx.save();ctx.textBaseline='alphabetic';ctx.font='800 '+size+'px '+EXO;ctx.shadowColor='rgba(3,7,18,.75)';ctx.shadowBlur=18;
  ctx.fillStyle='#FFFFFF';ctx.fillText('MEDI',x,y);
  var w=ctx.measureText('MEDI').width;ctx.translate(x+w-size*.02,y);ctx.transform(1,0,-Math.tan(16*Math.PI/180),1,0,0);ctx.fillStyle=TEAL;ctx.fillText('RUN',0,0);ctx.restore();
 }
 function pill(text,cx,y){
  ctx.save();ctx.font='700 28px '+KA;var w=ctx.measureText(text).width+76,h=58,x=cx-w/2;
  ctx.fillStyle='rgba(3,7,18,.55)';ctx.strokeStyle='rgba(153,246,228,.55)';ctx.lineWidth=2;
  ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,29);else ctx.rect(x,y,w,h);ctx.fill();ctx.stroke();
  ctx.fillStyle=TEAL;ctx.beginPath();ctx.arc(x+30,y+h/2,7,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#FFFFFF';ctx.textBaseline='middle';ctx.fillText(text,x+48,y+h/2+1);ctx.restore();
 }
 function overlay(t){
  var g=ctx.createLinearGradient(0,0,0,240);g.addColorStop(0,'rgba(3,7,18,.6)');g.addColorStop(1,'rgba(3,7,18,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,240);
  wordmark(56,124,62);
  if(S.kicker){ctx.save();ctx.font='500 26px '+KA;ctx.fillStyle='rgba(255,255,255,.85)';ctx.shadowColor='rgba(3,7,18,.8)';ctx.shadowBlur=10;ctx.fillText(S.kicker,58,170);ctx.restore();}
  var r=REDUCED?1:easeOut((t-REVEAL)/.8);
  if(S.kind!=='box'){
   if(r>0){var b=ctx.createLinearGradient(0,H-600,0,H);b.addColorStop(0,'rgba(3,7,18,0)');b.addColorStop(.38,'rgba(3,7,18,'+(.8*r)+')');b.addColorStop(1,'rgba(3,7,18,'+(.94*r)+')');ctx.fillStyle=b;ctx.fillRect(0,H-600,W,600);}
   if(r>0){
    ctx.save();ctx.globalAlpha=r;ctx.translate(0,(1-r)*36);ctx.textBaseline='alphabetic';
    fit(S.title,'700 {s}px '+KA,36,W-112);ctx.fillStyle=MINT;ctx.fillText(S.title,56,H-470);
    fit(S.big,'800 {s}px '+EXO,168,W-260);ctx.fillStyle='#FFFFFF';ctx.fillText(S.big,52,H-320);
    var bw=ctx.measureText(S.big).width;ctx.font='800 54px '+KA;ctx.fillStyle=TEAL;ctx.fillText(S.unit,52+bw+16,H-322);
    var cols=S.stats.slice(0,3),cw=(W-112)/Math.max(1,cols.length);
    cols.forEach(function(s,i){var x=56+i*cw;ctx.fillStyle='#FFFFFF';fit(s.value,'700 {s}px '+EXO,40,cw-16);ctx.fillText(s.value,x,H-236);ctx.fillStyle='rgba(255,255,255,.66)';fit(s.label,'500 {s}px '+KA,22,cw-16);ctx.fillText(s.label,x,H-204);});
    ctx.restore();
   }
  }else{var bb=ctx.createLinearGradient(0,H-240,0,H);bb.addColorStop(0,'rgba(3,7,18,0)');bb.addColorStop(1,'rgba(3,7,18,.9)');ctx.fillStyle=bb;ctx.fillRect(0,H-240,W,240);}
  var f=REDUCED?1:easeOut((t-REVEAL-.5)/.7);
  if(f>0){ctx.save();ctx.globalAlpha=f;pill(S.link,W/2,H-150);ctx.font='500 22px '+KA;ctx.fillStyle='rgba(255,255,255,.75)';ctx.textAlign='center';ctx.textBaseline='alphabetic';fit(S.cta,'500 {s}px '+KA,22,W-80);ctx.fillText(S.cta,W/2,H-60);ctx.restore();}
  if(S.kind!=='box'){ctx.save();ctx.font='500 15px system-ui,sans-serif';ctx.fillStyle='rgba(255,255,255,.5)';ctx.textAlign='right';ctx.fillText(S.attribution,W-18,H-18);ctx.restore();}
  if(t<.5){ctx.fillStyle='rgba(3,7,18,'+(1-t/.5)+')';ctx.fillRect(0,0,W,H);}
 }

 // ---------- encoder (WebCodecs H.264 → mp4); no encoder = the last frame as a picture ----------
 var enc=null,muxer=null,encErr=null;
 async function openEncoder(){
  if(!window.VideoEncoder||!window.VideoFrame||!window.Mp4Muxer)return false;
  var codecs=['avc1.640028','avc1.4d0028','avc1.42e01f','avc1.42001f'],config=null;
  for(var i=0;i<codecs.length&&!config;i++){
   var c={codec:codecs[i],width:W,height:H,bitrate:7000000,framerate:FPS,avc:{format:'avc'}};
   try{var s=await VideoEncoder.isConfigSupported(c);if(s&&s.supported)config=c;}catch(e){}
  }
  if(!config)return false;
  try{
   muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:'avc',width:W,height:H,frameRate:FPS},fastStart:'in-memory'});
   enc=new VideoEncoder({output:function(chunk,meta){try{muxer.addVideoChunk(chunk,meta);}catch(e){encErr=e;}},error:function(e){encErr=e;}});
   enc.configure(config);
   return true;
  }catch(e){enc=null;muxer=null;return false;}
 }
 function encode(i){
  if(!enc||encErr)return;
  try{var fr=new VideoFrame(out,{timestamp:Math.round(i*1e6/FPS),duration:Math.round(1e6/FPS)});enc.encode(fr,{keyFrame:i%(FPS*2)===0});fr.close();}catch(e){encErr=e;}
 }
 function b64(bytes){var s='',step=0x8000;for(var i=0;i<bytes.length;i+=step)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+step));return btoa(s);}
 var still='';
 async function finish(){
  if(!still){try{still=out.toDataURL('image/jpeg',.9);}catch(e){}}
  if(still)post({type:'image',data:still.slice(still.indexOf(',')+1)});
  if(!enc||encErr){post({type:'video-end',none:true});return;}
  try{
   await enc.flush();enc.close();muxer.finalize();
   var buf=new Uint8Array(muxer.target.buffer);
   if(buf.length<20000){post({type:'video-end',none:true});return;}
   var data=b64(buf),size=400000,n=Math.ceil(data.length/size);
   post({type:'video-start',mime:'video/mp4',chunks:n});
   for(var k=0;k<n;k++)post({type:'video-chunk',i:k,data:data.slice(k*size,(k+1)*size)});
   post({type:'video-end'});
   // the finished clip plays in the preview, smooth, exactly as it will be shared
   try{var v=document.getElementById('play');v.src=URL.createObjectURL(new Blob([buf],{type:'video/mp4'}));v.style.display='block';v.play().catch(function(){});}catch(e){}
  }catch(e){post({type:'video-end',none:true});}
 }

 // ---------- the offline frame loop ----------
 var pending=0;
 (function(){var f=window.fetch;if(f)window.fetch=function(){pending++;return f.apply(this,arguments).finally(function(){pending--;});};})();
 async function settle(map,maxMs){
  if(!map)return sleep(0);
  var start=V.realNow(),quiet=0;
  for(;;){
   var ready=pending===0&&(!map.areTilesLoaded||map.areTilesLoaded());
   if(ready){if(++quiet>=2)return;}else quiet=0;
   if(V.realNow()-start>maxMs)return;
   await sleep(ready?0:24);
   V.step(0);
  }
 }
 async function run(update,map){
  var video=await openEncoder();
  post({type:'started',mode:video?'video':'image'});
  if(map)V.enable();
  var lastP=-1;
  for(var i=0;i<N&&!failed;i++){
   var t=i/FPS;
   update(t);
   if(map){map.triggerRepaint();V.step(1000/FPS);await settle(map,1800);map.triggerRepaint();V.step(0);}
   compose(t,map);
   encode(i);
   if(i===N-6){try{still=out.toDataURL('image/jpeg',.9);}catch(e){}}
   var p=Math.floor(i/N*40);if(p!==lastP){lastP=p;post({type:'progress',p:p/40});}
   if(enc&&enc.encodeQueueSize>6){while(enc.encodeQueueSize>2)await sleep(4);}
   if(!map&&i%3===0)await sleep(0);
  }
  if(!failed)await finish();
 }
 function compose(t,map){
  if(map){
   ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
   ctx.fillStyle='#030712';ctx.fillRect(0,0,W,H);
   try{
    var cv=map.getCanvas();ctx.drawImage(cv,0,0,W,H);
    // the night city reads too dark on a phone in daylight: lift it with a soft screen pass (no CSS filter — older Safari)
    ctx.globalCompositeOperation='screen';ctx.globalAlpha=.42;ctx.drawImage(cv,0,0,W,H);
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
   }catch(e){}
  }else drawBox(t);
  ctx.save();overlay(t);ctx.restore();
 }
 var fontsReady=(document.fonts&&document.fonts.load?Promise.all([document.fonts.load('800 64px "Exo 2"'),document.fonts.load('700 36px "Noto Sans Georgian"'),document.fonts.load('500 26px "Noto Sans Georgian"')]):Promise.resolve()).catch(function(){});

 // ---------- the box opening (2D) ----------
 var shut=new Image(),open=new Image(),coins=[],stars=[],seed=7;
 function rnd(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;}
 function drawBox(t){
  var bg=ctx.createLinearGradient(0,0,W*.4,H);bg.addColorStop(0,'#030712');bg.addColorStop(.55,'#042F2E');bg.addColorStop(1,'#0F766E');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  stars.forEach(function(s){ctx.globalAlpha=.25+.35*Math.abs(Math.sin(t*1.4+s.p));ctx.fillStyle='#CCFBF1';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
  var opened=t>=2.2,cx=W/2,cy=520,size=opened?420:470;
  var glow=ctx.createRadialGradient(cx,cy,10,cx,cy,380);glow.addColorStop(0,opened?'rgba(252,211,77,.55)':'rgba(94,234,212,.34)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
  var fl=REDUCED?0:Math.sin(t*2.2)*12,shake=!REDUCED&&t>1.2&&t<2.2?Math.sin(t*70)*.11:0;
  ctx.save();ctx.translate(cx,cy+fl);ctx.rotate(shake);var img=opened?open:shut;if(img.complete&&img.naturalWidth)ctx.drawImage(img,-size/2,-size/2,size,size);ctx.restore();
  if(opened&&!REDUCED){var dt=t-2.2;if(dt<.25){ctx.fillStyle='rgba(255,255,255,'+(.8*(1-dt/.25))+')';ctx.fillRect(0,0,W,H);}
   coins.forEach(function(o){var x=cx+o.vx*dt*.6,y=cy+o.vy*dt*.6+700*dt*dt,a=clamp(1.6-dt*.55,0,1);if(a<=0)return;ctx.globalAlpha=a;ctx.fillStyle=o.c;ctx.beginPath();ctx.ellipse(x,y,o.r,o.r*Math.max(.15,Math.abs(Math.cos(t*6+o.s))),0,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;}
  var r=REDUCED?1:easeOut((t-2.4)/.8);
  if(r>0){ctx.save();ctx.globalAlpha=r;ctx.textAlign='center';ctx.textBaseline='alphabetic';var shown=REDUCED?S.coins:Math.round(S.coins*easeOut((t-2.4)/1.1));var txt='+'+shown;fit(txt,'800 {s}px '+EXO,150,W-80);ctx.fillStyle='#FFFFFF';ctx.fillText(txt,W/2,900);ctx.font='800 40px '+EXO;ctx.fillStyle=MINT;ctx.fillText('Medi Coins',W/2,952);ctx.restore();}
  var q=REDUCED?1:easeOut((t-3.3)/.7);
  if(q>0){ctx.save();ctx.globalAlpha=q;ctx.textAlign='center';
   if(S.badge){fit(S.badge,'700 {s}px '+KA,30,W-120);var bw=ctx.measureText(S.badge).width+56;ctx.fillStyle='rgba(252,211,77,.18)';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(W/2-bw/2,984,bw,58,29);else ctx.rect(W/2-bw/2,984,bw,58);ctx.fill();ctx.fillStyle=AMBER;ctx.textBaseline='middle';ctx.fillText(S.badge,W/2,1014);}
   if(S.place){ctx.textBaseline='alphabetic';fit(S.place,'500 {s}px '+KA,28,W-120);ctx.fillStyle='rgba(204,251,241,.9)';ctx.fillText(S.place,W/2,1088);}
   ctx.restore();}
 }
 function boxScene(){
  shut.crossOrigin=open.crossOrigin='anonymous';shut.src=BASE+'share/gift.png';open.src=BASE+'share/gift-open.png';
  for(var i=0;i<34;i++){var a=rnd()*Math.PI*2,v=380+rnd()*520;coins.push({vx:Math.cos(a)*v,vy:Math.sin(a)*v-520,r:9+rnd()*12,c:i%3?AMBER:'#F59E0B',s:rnd()*6});}
  for(var k=0;k<70;k++)stars.push({x:rnd()*W,y:rnd()*H*.75,r:.6+rnd()*1.8,p:rnd()*6});
  var loaded=new Promise(function(r){var n=0;function one(){if(++n===2)r();}shut.onload=open.onload=one;shut.onerror=open.onerror=one;});
  Promise.all([fontsReady,Promise.race([loaded,sleep(6000)])]).then(function(){return run(function(){},null);}).catch(fail);
 }

 // ---------- the night city: walk (chase, then a crane up to the whole route) / my city ----------
 function cityScene(){
  if(typeof mapboxgl==='undefined'){fail('map');return;}
  mapboxgl.accessToken=TOKEN;
  var G=window.MedirunGlow||null,lines=S.kind==='walk'?[S.line]:S.lines;
  var b=[Infinity,Infinity,-Infinity,-Infinity];lines.forEach(function(l){l.forEach(function(p){b=[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])];});});
  var centre=[(b[0]+b[2])/2,(b[1]+b[3])/2];
  var map=new mapboxgl.Map({container:'map',style:G?G.glowStyle():'mapbox://styles/mapbox/dark-v11',center:centre,zoom:16,pitch:55,bearing:0,interactive:false,attributionControl:false,preserveDrawingBuffer:true,pixelRatio:1,antialias:true,fadeDuration:0,projection:'mercator',maxPitch:75});
  var glow=null,fitCam=null;
  function mPerDeg(lat){return [111320*Math.cos(lat*Math.PI/180),110540];}
  function densify(line,step){var o=[line[0]];for(var i=1;i<line.length;i++){var a=line[i-1],c=line[i],k=mPerDeg(a[1]),d=Math.hypot((c[0]-a[0])*k[0],(c[1]-a[1])*k[1]),n=Math.max(1,Math.ceil(d/step));for(var j=1;j<=n;j++)o.push([a[0]+(c[0]-a[0])*j/n,a[1]+(c[1]-a[1])*j/n]);}return o;}
  function heading(a,c){var k=mPerDeg(a[1]);return (Math.atan2((c[0]-a[0])*k[0],(c[1]-a[1])*k[1])*180/Math.PI+360)%360;}
  // walk: 4 m steps; the chase covers the first stretch at a hyperlapse pace, the crane finishes the route
  var path=S.kind==='walk'?densify(S.line,4):null,STEP=4,total=path?(path.length-1)*STEP:0,chase=path?Math.min(total*.4,420):0;
  var fed=0,camBear=null,camC=null;
  function headIndex(t){
   var d=t<5?lerp(0,chase,ease(t/5)):lerp(chase,total,ease((t-5)/3.2));
   return clamp(Math.round(d/STEP),1,path.length-1);
  }
  var steps=0,lastStep=-1;
  function update(t){
   if(S.kind==='walk'){
    var idx=headIndex(t);
    if(idx>fed){fed=idx;if(glow)glow.setTrail(path.slice(0,fed+1));}
    var h=path[fed],ahead=path[Math.min(path.length-1,fed+8)],behind=path[Math.max(0,fed-8)],hd=heading(behind,ahead);
    if(glow)glow.setRunner(h[0],h[1],hd,t<8.2?3.4:0);
    var r=glow&&glow.runner?glow.runner():null,focus=r?[r.lng,r.lat]:h;
    camBear=camBear==null?hd:lerpAngle(camBear,hd,.06);
    camC=camC?[lerp(camC[0],focus[0],.35),lerp(camC[1],focus[1],.35)]:focus;
    // crane: from behind the runner up to the whole route, turned so the route runs up the screen
    var up=REDUCED?1:ease((t-4.6)/3.4),orbit=REDUCED?0:Math.max(0,t-8.2)*1.6;
    map.jumpTo({center:[lerp(camC[0],fitCam.center[0],up),lerp(camC[1],fitCam.center[1],up)],zoom:lerp(17.9,fitCam.zoom,up),pitch:lerp(64,fitCam.pitch,up),bearing:lerpAngle(camBear,fitCam.bearing,up)+orbit});
   }else{
    var k=REDUCED?1:ease(t/6.6);
    map.jumpTo({center:[lerp(fitCam.first[0],fitCam.center[0],k),lerp(fitCam.first[1],fitCam.center[1],k)],zoom:lerp(fitCam.close,fitCam.zoom,k),pitch:lerp(62,fitCam.pitch,k),bearing:fitCam.bearing-50+50*(REDUCED?1:ease(t/7))+(REDUCED?0:Math.max(0,t-7)*1.6)});
    var q=REDUCED?1:clamp((t-.3)/6,0,1),s=Math.max(1,Math.ceil(q*steps));
    if(s!==lastStep){lastStep=s;var shown=lines.slice(0,Math.ceil(lines.length*s/steps));if(glow)glow.setPaint(shown);var src=map.getSource('paint');if(src)src.setData({type:'FeatureCollection',features:shown.map(function(l){return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:l}};})});}
   }
  }
  map.on('error',function(e){var m=String(e&&e.error&&e.error.message||'');if(/token|401|403/i.test(m))fail('token');});
  map.on('style.load',function(){
   if(S.kind==='city'){try{map.addSource('paint',{type:'geojson',data:{type:'FeatureCollection',features:[]}});var zw=function(a,c){return ['interpolate',['linear'],['zoom'],12,a,18,c];};map.addLayer({id:'paint-aura',type:'line',source:'paint',paint:{'line-color':'#14B8A6','line-width':zw(6,26),'line-opacity':.32,'line-blur':6},layout:{'line-cap':'round','line-join':'round'}});map.addLayer({id:'paint-line',type:'line',source:'paint',paint:{'line-color':'#5EEAD4','line-width':zw(1.8,5),'line-opacity':.95},layout:{'line-cap':'round','line-join':'round'}});}catch(e){}}
   if(G){try{glow=G.createGlow({mapboxgl:mapboxgl,map:map,token:TOKEN,assetBase:BASE,hero:S.hero,adaptive:false});}catch(e){glow=null;}}
   if(glow){
    glow.setRunnerVisible(S.kind==='walk');
    if(S.kind==='walk'){glow.setRunner(path[0][0],path[0][1],heading(path[0],path[Math.min(8,path.length-1)]),0);glow.setActivity('auto');}
    try{if(glow.debug&&glow.debug.THREE){window.__MEDIRUN_THREE__=glow.debug.THREE;var sc=document.createElement('script');sc.src=BASE+'decor/decor.js?v=share2';sc.onload=function(){try{window.MedirunDecor.start(glow,{map:map,mapboxgl:mapboxgl,base:BASE+'decor/'});}catch(e){}};document.head.appendChild(sc);}}catch(e){}
   }
   // the final view is turned so the walk (or the lit streets end to end) runs up the screen and fills it
   var firstPt=lines[0][0],lastLine=lines[lines.length-1],endBear=S.kind==='walk'?heading(path[0],path[path.length-1]):heading(firstPt,lastLine[lastLine.length-1]),endPitch=S.kind==='walk'?46:50;
   var c=map.cameraForBounds([[b[0],b[1]],[b[2],b[3]]],{padding:S.kind==='walk'?{top:250,bottom:560,left:50,right:50}:{top:300,bottom:620,left:80,right:80},bearing:endBear,pitch:endPitch})||{center:centre,zoom:15};
   var ctr=c.center&&c.center.lng!=null?[c.center.lng,c.center.lat]:centre,z=clamp(c.zoom||15,S.kind==='city'?14:14.6,17.2);
   var last=lines[lines.length-1],mid=last[Math.floor(last.length/2)];
   fitCam={center:ctr,zoom:z,close:clamp(z+1.9,16.4,17.8),first:mid,bearing:endBear,pitch:endPitch};
   steps=Math.min(16,lines.length);
   if(S.kind==='walk')map.jumpTo({center:path[0],zoom:17.9,pitch:64,bearing:heading(path[0],path[Math.min(8,path.length-1)])});
   else map.jumpTo({center:mid,zoom:fitCam.close,pitch:62,bearing:endBear-50});
   var idle=new Promise(function(r){map.once('idle',r);});
   Promise.all([fontsReady,Promise.race([idle,sleep(9000)])]).then(function(){return sleep(900);}).then(function(){return run(update,map);}).catch(fail);
  });
 }
 if(S.kind==='box')boxScene();else cityScene();
 })();</script></body></html>`;
}
