/**
 * Live weather over the MEDIRUN map: when it rains where the runner is, it rains on the map.
 *
 * A plain 2D canvas above the Glow city (pointer-events none), injected into the map WebView by
 * `buildRunMapHtml`. Native sends `{type:'weather', fx}` (see `runWeatherFx`); the map calls
 * `MedirunWeather.camera(bearing, pitch)` every frame so the rain swings with the camera.
 *
 * Rain = streaks in three depth layers + splashes on the ground half of the screen; storm adds
 * rare lightning (a soft flash and a bolt in the sky, ≥ 6 s apart, never under reduced motion);
 * snow = soft flakes that sway; fog = drifting haze bands. Reduced motion draws only the still
 * veil/haze. Density eases in and out over a few seconds and drops by itself on a slow phone.
 *
 * Kept as a string because Hermes ships bytecode (Function#toString has no source) — no backticks
 * or `${` inside.
 */
export const WEATHER_FX_JS = String.raw`(function(){
 var cv=document.createElement('canvas');cv.setAttribute('aria-hidden','true');
 cv.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2';
 document.body.appendChild(cv);
 var ctx=cv.getContext('2d');if(!ctx)return;
 var W=1,H=1,DPR=Math.min(1.5,window.devicePixelRatio||1);
 var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 var P={
  drizzle:{rain:110,len:[5,11],speed:[480,700],width:[.6,1],alpha:[.16,.3],splash:3,veil:.05},
  rain:{rain:230,len:[11,22],speed:[900,1250],width:[.75,1.3],alpha:[.2,.4],splash:12,veil:.1,mist:.06},
  heavy_rain:{rain:400,len:[17,32],speed:[1150,1650],width:[.9,1.6],alpha:[.24,.48],splash:28,veil:.17,mist:.12},
  storm:{rain:400,len:[18,34],speed:[1200,1700],width:[.9,1.6],alpha:[.24,.5],splash:30,veil:.22,mist:.14,flash:1},
  snow:{snow:130,size:[1,2.7],speed:[32,80],veil:.04,mist:.07,white:1},
  heavy_snow:{snow:290,size:[1.2,3.3],speed:[55,125],veil:.07,mist:.15,white:1},
  fog:{fog:1,veil:.06,mist:.22,white:1},
  clouds:{veil:.07}
 };
 var cfg=null,kind='none',wind=0,level=0,target=0,quality=1,slowFor=0,ema=0;
 var drops=[],flakes=[],splashes=[],bands=[];
 var flash=0,flashes=[],nextFlash=0,bolt=null;
 var raf=0,last=0,bearing=null,pitch=60,clock=0;
 function rnd(a,b){return a+Math.random()*(b-a);}
 function lerp(r,z){return r[0]+(r[1]-r[0])*z;}
 var flake=document.createElement('canvas');flake.width=flake.height=32;
 (function(){var g=flake.getContext('2d'),r=g.createRadialGradient(16,16,0,16,16,16);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(240,246,255,.85)');r.addColorStop(1,'rgba(230,240,255,0)');g.fillStyle=r;g.fillRect(0,0,32,32);})();
 var haze=document.createElement('canvas');haze.width=256;haze.height=64;
 (function(){var g=haze.getContext('2d');g.translate(128,32);g.scale(4,1);var r=g.createRadialGradient(0,0,0,0,0,32);r.addColorStop(0,'rgba(185,198,218,.9)');r.addColorStop(1,'rgba(185,198,218,0)');g.fillStyle=r;g.fillRect(-32,-32,64,64);})();
 function resize(){W=Math.max(1,window.innerWidth);H=Math.max(1,window.innerHeight);cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);if(reduced||!raf)still();}
 function drop(top){var z=Math.random();return {x:Math.random()*W,y:top?rnd(-H*.25,0):rnd(-H,H),z:z};}
 function fl(top){var z=Math.random();return {x:Math.random()*W,y:top?rnd(-40,-5):rnd(-40,H),z:z,ph:Math.random()*6.28,f:rnd(.6,1.4)};}
 function fill(){
  drops.length=0;flakes.length=0;bands.length=0;splashes.length=0;
  if(!cfg)return;
  var area=Math.min(1.6,Math.max(.6,W*H/(390*844)));
  if(cfg.rain)for(var i=0;i<Math.round(cfg.rain*area);i++)drops.push(drop(false));
  if(cfg.snow)for(var j=0;j<Math.round(cfg.snow*area);j++)flakes.push(fl(false));
  if(cfg.fog)for(var k=0;k<4;k++)bands.push({y:rnd(.12,.75),x:Math.random(),w:rnd(1.2,2),h:rnd(60,130),v:rnd(.004,.012)*(k%2?1:-1),a:rnd(.14,.24)});
 }
 // Wind leans the rain: up to ~20 degrees at 60 km/h.
 function slant(){return Math.min(.36,wind/170);}
 function veil(a){if(a<=0)return;ctx.fillStyle='rgba(6,10,20,'+a+')';ctx.fillRect(0,0,W,H);}
 function mist(a){if(a<=0)return;var top=pitch>30?H*.08:0,g=ctx.createLinearGradient(0,top,0,H*.55),c=cfg&&cfg.white?'205,214,228':'150,165,190';
  g.addColorStop(0,'rgba('+c+','+a+')');g.addColorStop(1,'rgba('+c+',0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
 function drawBands(dt,alpha){
  for(var i=0;i<bands.length;i++){var b=bands[i];b.x+=b.v*dt;if(b.x>1.3)b.x=-.3;if(b.x<-.3)b.x=1.3;
   ctx.globalAlpha=b.a*alpha;var w=W*b.w;ctx.drawImage(haze,b.x*W-w/2,b.y*H-b.h/2,w,b.h);}
  ctx.globalAlpha=1;
 }
 function still(){
  ctx.clearRect(0,0,W,H);if(!cfg)return;
  var a=reduced?1:level;veil((cfg.veil||0)*a);mist((cfg.mist||0)*a);if(cfg.fog)drawBands(0,a);
 }
 function strike(t){
  flashes=[t,t+90,t+210];
  var x=rnd(W*.15,W*.85),y=0,pts=[[x,y]],end=H*rnd(.18,.32);
  while(y<end){y+=rnd(14,30);x+=rnd(-18,18);pts.push([x,y]);}
  bolt={pts:pts,t:t};
  nextFlash=t+rnd(6500,15000);
 }
 function frame(t){
  raf=0;if(document.hidden)return;
  var dt=last?Math.min(.05,(t-last)/1000):0;last=t;clock+=dt;
  if(dt>0){ema=ema?ema*.92+dt*.08:dt;if(ema>.034){slowFor+=dt;if(slowFor>2.5&&quality>.35){quality*=.6;slowFor=0;}}else slowFor=0;}
  level+=(target-level)*Math.min(1,dt*.7);
  if(target===0&&level<.01){level=0;ctx.clearRect(0,0,W,H);cfg=null;kind='none';fill();return;}
  ctx.clearRect(0,0,W,H);
  veil((cfg.veil||0)*level);mist((cfg.mist||0)*level);
  var topDown=pitch<30,sl=slant(),i,d,n;
  if(cfg.rain){
   n=Math.round(drops.length*level*quality);
   var groups=[[],[],[]];
   for(i=0;i<n;i++){d=drops[i];var sp=lerp(cfg.speed,d.z);d.y+=sp*dt;d.x+=sp*sl*dt;
    var len=lerp(cfg.len,d.z)*(topDown?.35:1);
    if(d.y-len>H){var nd=drop(true);d.x=nd.x;d.y=nd.y;d.z=nd.z;}
    if(d.x>W+20)d.x-=W+40;else if(d.x<-20)d.x+=W+40;
    groups[d.z<.34?0:d.z<.67?1:2].push(d);}
   for(var g=0;g<3;g++){var list=groups[g];if(!list.length)continue;var zz=(g+.5)/3;
    ctx.strokeStyle='rgba(196,216,242,'+lerp(cfg.alpha,zz)+')';ctx.lineWidth=lerp(cfg.width,zz);ctx.lineCap='round';ctx.beginPath();
    for(var q=0;q<list.length;q++){d=list[q];var l=lerp(cfg.len,d.z)*(topDown?.35:1);ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-sl*l,d.y-l);}
    ctx.stroke();}
   // Splashes on the ground half (the whole screen when looking straight down).
   var spawn=cfg.splash*3*level*quality*(W/390)*dt;
   while(spawn>0&&splashes.length<70){if(spawn>=1||Math.random()<spawn){var gy=topDown?Math.random()*H:rnd(H*.42,H);var near=topDown?.6:(gy-H*.42)/(H*.58);splashes.push({x:Math.random()*W,y:gy,r:2+near*5,age:0,life:rnd(.28,.42)});}spawn-=1;}
   ctx.lineWidth=1;
   for(i=splashes.length-1;i>=0;i--){var s=splashes[i];s.age+=dt;var p=s.age/s.life;if(p>=1){splashes.splice(i,1);continue;}
    ctx.strokeStyle='rgba(200,222,248,'+(.5*(1-p))+')';ctx.beginPath();ctx.ellipse(s.x,s.y,s.r*(.4+p*1.6),s.r*(.4+p*1.6)*(topDown?1:.38),0,0,6.283);ctx.stroke();}
  }
  if(cfg.snow){
   n=Math.round(flakes.length*level*quality);
   for(i=0;i<n;i++){var f=flakes[i];var fs=lerp(cfg.speed,f.z)*(topDown?.5:1);f.y+=fs*dt;f.x+=(Math.sin(clock*f.f+f.ph)*(14+f.z*22)+wind*.5*(.4+f.z))*dt;
    if(f.y>H+10){var nf=fl(true);f.x=nf.x;f.y=nf.y;f.z=nf.z;}
    if(f.x>W+10)f.x-=W+20;else if(f.x<-10)f.x+=W+20;
    var r=lerp(cfg.size,f.z)*2.2;ctx.globalAlpha=.35+f.z*.55;ctx.drawImage(flake,f.x-r,f.y-r,r*2,r*2);}
   ctx.globalAlpha=1;
  }
  if(cfg.fog)drawBands(dt,level);
  if(cfg.flash&&!reduced){
   if(!nextFlash)nextFlash=t+rnd(2500,6000);
   if(t>=nextFlash&&level>.6)strike(t);
   flash=0;for(i=0;i<flashes.length;i++){var age=t-flashes[i];if(age>=0)flash=Math.max(flash,(i===1?1:.65)*Math.exp(-age/(i===2?260:70)));}
   if(flash>.01){ctx.fillStyle='rgba(205,220,255,'+(flash*.34)+')';ctx.fillRect(0,0,W,H);}
   if(bolt){var ba=1-(t-bolt.t)/260;if(ba<=0)bolt=null;else{ctx.save();ctx.strokeStyle='rgba(235,242,255,'+ba+')';ctx.lineWidth=2.2;ctx.shadowColor='rgba(170,195,255,.9)';ctx.shadowBlur=14;ctx.beginPath();ctx.moveTo(bolt.pts[0][0],bolt.pts[0][1]);for(i=1;i<bolt.pts.length;i++)ctx.lineTo(bolt.pts[i][0],bolt.pts[i][1]);ctx.stroke();ctx.restore();}}
  }
  raf=requestAnimationFrame(frame);
 }
 function loop(){if(!raf&&!reduced&&cfg&&!document.hidden){last=0;raf=requestAnimationFrame(frame);}}
 function set(fx){
  var k=fx&&P[fx.kind]?fx.kind:'none';
  wind=fx&&typeof fx.wind==='number'?Math.max(0,fx.wind):0;
  if(k==='none'){target=0;if(reduced){cfg=null;kind='none';still();}return;}
  if(k!==kind){cfg=P[k];kind=k;level=Math.min(level,.15);fill();}
  target=1;
  if(reduced){level=1;still();}else loop();
 }
 function camera(b,p){
  if(typeof p==='number')pitch=p;
  if(typeof b!=='number')return;
  if(bearing!=null&&cfg&&!reduced){var db=((b-bearing+540)%360)-180;if(Math.abs(db)>.01){var px=-db*(W/75),i;
   for(i=0;i<drops.length;i++){drops[i].x+=px*(.35+.65*drops[i].z);}
   for(i=0;i<flakes.length;i++){flakes[i].x+=px*(.35+.65*flakes[i].z);}}}
  bearing=b;
 }
 window.addEventListener('resize',function(){resize();fill();});
 document.addEventListener('visibilitychange',function(){if(!document.hidden)loop();});
 resize();
 window.MedirunWeather={set:set,camera:camera};
})();`;
