// Gift-box spots for any city, computed from one Overpass answer (pure; citySpots.js fetches and stores).
// The same owner rules as Tbilisi (brand/medirun/glow-campaign/spots/harvest.py), simplified for runtime:
// nodes of public footways / paths / pedestrian ways inside free, public parks and gardens; >= 15 m from motor
// roads (20 m from rail); away from cemeteries, places of worship, schools, kindergartens, hospitals, clinics,
// military, prisons, construction (20 m), water / rivers / cliffs (25 m), playgrounds, pitches, zoos (10 m);
// never on bridges, tunnels, indoor, private or informal ways; >= 150 m apart; about 1 spot per 3 ha (max 8)
// per park; deeper inside the park preferred (rewarded up to 150 m, never on the outer 12 m).

const R=6371008.8;
/** Local metric projection around a reference point (good to a few cm inside one city). */
export function projector(lng0,lat0){
 const kx=Math.cos(lat0*Math.PI/180)*Math.PI/180*R,ky=Math.PI/180*R;
 return {fwd:(lng,lat)=>[(lng-lng0)*kx,(lat-lat0)*ky],inv:(x,y)=>[lng0+x/kx,lat0+y/ky]};
}

const MOTOR=/^(motorway|trunk|primary|secondary|tertiary)(_link)?$|^(residential|unclassified|living_street|service|road)$/;
const RAIL=/^(rail|light_rail|tram|narrow_gauge)$/;
const BAD_ACCESS=new Set(['private','no','customers','permit','military']);
const MIN_SPACING=150,ROAD_MIN=15,RAIL_MIN=20,MIN_DEPTH=12,DEPTH_SWEET=150,STEP=20;

function freePublic(t={}){
 if(BAD_ACCESS.has(t.access))return false;
 if(t.fee==='yes'||(t.charge&&t.fee!=='no'))return false;
 if(t.abandoned==='yes'||t.disused==='yes')return false;
 const name=`${t.name||''} ${t['name:en']||''}`.toLowerCase();
 return !/\bzoo\b|zoolog|botanic|cemeter|friedhof|cimeti/.test(name);
}
/** Exclusion buffer (m) for a feature, or 0 when it is not one. */
function exclusion(t={}){
 const {amenity:am,landuse:lu,natural:nat,waterway:ww,leisure:lei,tourism:tour}=t;
 if(lu==='cemetery'||am==='grave_yard')return 20;
 if(am==='place_of_worship'||lu==='religious')return 20;
 if(['school','kindergarten','hospital','clinic','prison'].includes(am)||lu==='education')return 20;
 if(lu==='military'||t.military)return 20;
 if(lu==='construction')return 20;
 if(nat==='water'||t.water||['reservoir','basin'].includes(lu)||['river','riverbank','canal'].includes(ww)||nat==='wetland'||nat==='cliff')return 25;
 if(['playground','pitch','stadium','water_park','dog_park'].includes(lei)||['zoo','theme_park'].includes(tour))return 10;
 return 0;
}

/* ───────── geometry on projected coordinates ───────── */
function inRing([x,y],ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;}
function segDist([px,py],[ax,ay],[bx,by]){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;let t=l?((px-ax)*dx+(py-ay)*dy)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));}
function ringArea(r){let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=(r[j][0]+r[i][0])*(r[j][1]-r[i][1]);return Math.abs(a/2);}
/** Joins open member ways into closed rings (multipolygon relations). */
function stitch(lines){
 const rings=[],open=lines.map(l=>l.slice()).filter(l=>l.length>=2);
 const same=(a,b)=>Math.abs(a[0]-b[0])<.01&&Math.abs(a[1]-b[1])<.01;
 while(open.length){
  let ring=open.shift();
  let grew=true;
  while(!same(ring[0],ring.at(-1))&&grew){
   grew=false;
   for(let i=0;i<open.length;i++){
    const l=open[i];
    if(same(ring.at(-1),l[0])){ring=ring.concat(l.slice(1));}
    else if(same(ring.at(-1),l.at(-1))){ring=ring.concat(l.slice(0,-1).reverse());}
    else if(same(ring[0],l.at(-1))){ring=l.concat(ring.slice(1));}
    else if(same(ring[0],l[0])){ring=l.slice().reverse().concat(ring.slice(1));}
    else continue;
    open.splice(i,1);grew=true;break;
   }
  }
  if(ring.length>=4&&same(ring[0],ring.at(-1)))rings.push(ring);
 }
 return rings;
}
/** Shape of one Overpass element: {polys:[{outer,inners}]} | {lines:[[pt…]]} | {point}. */
function shapeOf(e,P){
 const pts=g=>(g||[]).filter(Boolean).map(p=>P.fwd(p.lon,p.lat));
 if(e.type==='node')return Number.isFinite(e.lon)?{point:P.fwd(e.lon,e.lat)}:null;
 if(e.type==='way'){
  const c=pts(e.geometry);
  if(c.length>=4&&c[0][0]===c.at(-1)[0]&&c[0][1]===c.at(-1)[1])return {polys:[{outer:c,inners:[]}],lines:[c]};
  return c.length>=2?{lines:[c]}:null;
 }
 if(e.type==='relation'){
  const outer=[],inner=[];
  for(const m of e.members||[]){if(m.type!=='way'||!m.geometry)continue;(m.role==='inner'?inner:outer).push(pts(m.geometry));}
  const outs=stitch(outer),ins=stitch(inner);
  if(!outs.length)return null;
  return {polys:outs.map(o=>({outer:o,inners:ins.filter(i=>inRing(i[0],o))})),lines:[...outs,...ins]};
 }
 return null;
}
const insidePolys=(p,polys)=>polys.some(({outer,inners})=>inRing(p,outer)&&!inners.some(h=>inRing(p,h)));
function distToLines(p,lines){let d=Infinity;for(const l of lines)for(let i=1;i<l.length;i++){const s=segDist(p,l[i-1],l[i]);if(s<d)d=s;}return d;}

/** A grid of line segments so „how far is the nearest road“ stays fast for thousands of points. */
function segmentGrid(items,cell=60){
 const grid=new Map(),key=(x,y)=>`${Math.floor(x/cell)}:${Math.floor(y/cell)}`;
 for(const {lines,buffer,poly} of items)for(const l of lines)for(let i=1;i<l.length;i++){
  const a=l[i-1],b=l[i],seg={a,b,buffer,poly};
  const x0=Math.floor(Math.min(a[0],b[0])/cell),x1=Math.floor(Math.max(a[0],b[0])/cell),y0=Math.floor(Math.min(a[1],b[1])/cell),y1=Math.floor(Math.max(a[1],b[1])/cell);
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const k=`${x}:${y}`;let list=grid.get(k);if(!list)grid.set(k,list=[]);list.push(seg);}
 }
 /** True when a segment lies closer to p than its buffer. */
 return {near(p,reach=60){const cx=Math.floor(p[0]/cell),cy=Math.floor(p[1]/cell),r=Math.ceil(reach/cell);for(let x=cx-r;x<=cx+r;x++)for(let y=cy-r;y<=cy+r;y++)for(const s of grid.get(`${x}:${y}`)||[])if(segDist(p,s.a,s.b)<s.buffer)return true;return false;}};
}

const slug=s=>String(s||'park').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,32)||'park';

/**
 * Overpass elements (parks, paths, roads, exclusions — one answer, out geom) + the city outline → spots.
 * `city` = {cityId, geometry (GeoJSON, lng/lat), center:[lng,lat]}.
 */
export function harvestSpots(elements,city,{inside=null}={}){
 const [lng0,lat0]=city.center,P=projector(lng0,lat0);
 const parks=[],paths=[],blockers=[],pointBlockers=[],areaBlockers=[];
 for(const e of elements||[]){
  const t=e.tags||{};
  const s=shapeOf(e,P);if(!s)continue;
  if(['park','garden'].includes(t.leisure)&&s.polys&&freePublic(t)){
   const area=s.polys.reduce((a,p)=>a+ringArea(p.outer)-p.inners.reduce((x,h)=>x+ringArea(h),0),0);
   if(area>=3000)parks.push({id:`${e.type[0]}${e.id}`,name:t.name||t['name:en']||null,nameEn:t['name:en']||t.name||null,polys:s.polys,area});
   continue;
  }
  if(/^(footway|path|pedestrian)$/.test(t.highway||'')&&s.lines){
   if(t.bridge&&t.bridge!=='no'||t.tunnel&&t.tunnel!=='no'||t.indoor==='yes'||t.informal==='yes'||BAD_ACCESS.has(t.access)||t.level&&t.level!=='0')continue;
   paths.push({lines:s.lines,lit:t.lit==='yes'});continue;
  }
  if(MOTOR.test(t.highway||'')&&s.lines){blockers.push({lines:s.lines,buffer:ROAD_MIN});continue;}
  if(RAIL.test(t.railway||'')&&s.lines){blockers.push({lines:s.lines,buffer:RAIL_MIN});continue;}
  const buf=exclusion(t);
  if(!buf)continue;
  if(s.point)pointBlockers.push({p:s.point,buffer:buf+10});
  else if(s.polys){areaBlockers.push({polys:s.polys});blockers.push({lines:s.lines,buffer:buf});}
  else if(s.lines)blockers.push({lines:s.lines,buffer:buf});
 }
 if(!parks.length||!paths.length)return [];
 const grid=segmentGrid(blockers);
 const cityPolys=(()=>{const g=city.geometry,list=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];return list.map(r=>({outer:r[0].map(([x,y])=>P.fwd(x,y)),inners:r.slice(1).map(h=>h.map(([x,y])=>P.fwd(x,y)))}));})();
 // Candidate points: every path vertex plus a point every 20 m along each segment.
 const cands=[];
 for(const {lines,lit} of paths)for(const l of lines)for(let i=1;i<l.length;i++){
  const [a,b]=[l[i-1],l[i]],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.floor(len/STEP));
  for(let k=0;k<n;k++){const f=k/n;cands.push({p:[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f],lit});}
 }
 const byPark=new Map();
 for(const c of cands){
  if(cityPolys.length&&!insidePolys(c.p,cityPolys))continue;
  if(inside&&!inside(P.inv(...c.p)))continue;
  const park=parks.find(k=>insidePolys(c.p,k.polys));if(!park)continue;
  const depth=Math.min(...park.polys.map(({outer,inners})=>Math.min(distToLines(c.p,[outer]),inners.length?distToLines(c.p,inners):Infinity)));
  if(depth<MIN_DEPTH)continue;
  if(grid.near(c.p,60))continue;
  if(pointBlockers.some(b=>Math.hypot(b.p[0]-c.p[0],b.p[1]-c.p[1])<b.buffer))continue;
  if(areaBlockers.some(b=>insidePolys(c.p,b.polys)))continue;
  let list=byPark.get(park.id);if(!list)byPark.set(park.id,list=[]);
  list.push({...c,depth,score:Math.min(depth,DEPTH_SWEET)});
 }
 // Deeper points first; one spot per ~3 ha (max 8) per park; >= 150 m between any two spots.
 const chosen=[];
 const parksSorted=[...byPark.keys()].map(id=>parks.find(p=>p.id===id)).sort((a,b)=>b.area-a.area);
 for(const park of parksSorted){
  const quota=Math.max(1,Math.min(8,Math.round(park.area/30000)));
  let n=0;
  for(const c of byPark.get(park.id).sort((a,b)=>b.score-a.score)){
   if(n>=quota)break;
   if(chosen.some(o=>Math.hypot(o.p[0]-c.p[0],o.p[1]-c.p[1])<MIN_SPACING))continue;
   chosen.push({...c,park});n++;
  }
 }
 const counts=new Map();
 return chosen.map(c=>{
  const [lng,lat]=P.inv(...c.p),base=`${city.cityId}-${slug(c.park.nameEn||c.park.name||c.park.id)}`,i=(counts.get(base)||0)+1;counts.set(base,i);
  const name=c.park.name||c.park.nameEn||null;
  return {id:`${base}-${String(i).padStart(2,'0')}`,place:name,placeEn:c.park.nameEn||name,district:name||c.park.id,kind:'park',lng:+lng.toFixed(6),lat:+lat.toFixed(6),lit:c.lit||null,areaM2:Math.round(c.park.area),depthM:+c.depth.toFixed(1)};
 });
}

/** The Overpass query for a bounding box (s,w,n,e): parks, their paths, and what lies near those paths. */
export function overpassQuery([s,w,n,e]){
 const bb=[s,w,n,e].map(v=>v.toFixed(5)).join(',');
 return `[out:json][timeout:150][maxsize:268435456][bbox:${bb}];
(way["leisure"~"^(park|garden)$"];relation["leisure"~"^(park|garden)$"];)->.p;
.p out body geom;
.p map_to_area->.pa;
way["highway"~"^(footway|path|pedestrian)$"](area.pa)->.w;
.w out body geom;
(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|residential|unclassified|living_street|service|road)$"](around.w:25);
 way["railway"~"^(rail|light_rail|tram|narrow_gauge)$"](around.w:25);)->.r;
.r out tags geom;
(nwr["amenity"~"^(grave_yard|place_of_worship|school|kindergarten|hospital|clinic|prison)$"](around.w:45);
 nwr["landuse"~"^(cemetery|military|construction|reservoir|basin|religious|education)$"](around.w:45);
 nwr["natural"~"^(water|wetland|cliff)$"](around.w:45);
 nwr["waterway"~"^(river|riverbank|canal)$"](around.w:45);
 nwr["leisure"~"^(playground|pitch|stadium|water_park|dog_park)$"](around.w:25);
 nwr["tourism"~"^(zoo|theme_park)$"](around.w:25);)->.x;
.x out tags geom;`;
}

/* ───────── time zones (a city's local wave times) ───────── */
// One zone per country where that is true; bigger countries fall back to the longitude (fixed offset).
const COUNTRY_TZ={GE:'Asia/Tbilisi',AM:'Asia/Yerevan',AZ:'Asia/Baku',TR:'Europe/Istanbul',UA:'Europe/Kyiv',BY:'Europe/Minsk',MD:'Europe/Chisinau',BE:'Europe/Brussels',NL:'Europe/Amsterdam',LU:'Europe/Luxembourg',DE:'Europe/Berlin',FR:'Europe/Paris',IT:'Europe/Rome',ES:'Europe/Madrid',PT:'Europe/Lisbon',GB:'Europe/London',IE:'Europe/Dublin',AT:'Europe/Vienna',CH:'Europe/Zurich',PL:'Europe/Warsaw',CZ:'Europe/Prague',SK:'Europe/Bratislava',HU:'Europe/Budapest',RO:'Europe/Bucharest',BG:'Europe/Sofia',GR:'Europe/Athens',CY:'Asia/Nicosia',DK:'Europe/Copenhagen',SE:'Europe/Stockholm',NO:'Europe/Oslo',FI:'Europe/Helsinki',EE:'Europe/Tallinn',LV:'Europe/Riga',LT:'Europe/Vilnius',SI:'Europe/Ljubljana',HR:'Europe/Zagreb',RS:'Europe/Belgrade',BA:'Europe/Sarajevo',ME:'Europe/Podgorica',MK:'Europe/Skopje',AL:'Europe/Tirane',MT:'Europe/Malta',IS:'Atlantic/Reykjavik',IL:'Asia/Jerusalem',AE:'Asia/Dubai',QA:'Asia/Qatar',SA:'Asia/Riyadh',KW:'Asia/Kuwait',BH:'Asia/Bahrain',OM:'Asia/Muscat',IR:'Asia/Tehran',IQ:'Asia/Baghdad',JO:'Asia/Amman',LB:'Asia/Beirut',EG:'Africa/Cairo',IN:'Asia/Kolkata',PK:'Asia/Karachi',CN:'Asia/Shanghai',JP:'Asia/Tokyo',KR:'Asia/Seoul',TH:'Asia/Bangkok',VN:'Asia/Ho_Chi_Minh',SG:'Asia/Singapore',MY:'Asia/Kuala_Lumpur',PH:'Asia/Manila',UZ:'Asia/Tashkent',TM:'Asia/Ashgabat',KG:'Asia/Bishkek',TJ:'Asia/Dushanbe',NZ:'Pacific/Auckland',ZA:'Africa/Johannesburg',MA:'Africa/Casablanca',TN:'Africa/Tunis',NG:'Africa/Lagos',KE:'Africa/Nairobi',AR:'America/Argentina/Buenos_Aires',CL:'America/Santiago',CO:'America/Bogota',PE:'America/Lima',VE:'America/Caracas',UY:'America/Montevideo'};
export function timezoneFor(countryCode,lng){
 const tz=COUNTRY_TZ[String(countryCode||'').toUpperCase()];
 if(tz)return tz;
 const h=Math.max(-12,Math.min(14,Math.round((Number(lng)||0)/15)));
 return h===0?'Etc/GMT':`Etc/GMT${h>0?'-':'+'}${Math.abs(h)}`;
}
const parts=(ms,tz)=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(ms)).map(p=>[p.type,p.value]));
function offsetMs(ms,tz){const p=parts(ms,tz);return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-Math.floor(ms/1000)*1000;}
/** The local calendar date in a zone. */
export function localDate(ms,tz){const p=parts(ms,tz);return `${p.year}-${p.month}-${p.day}`;}
/** „2026-10-05 09:00 in Europe/Brussels“ → that instant (DST-safe). */
export function zonedTime(ymd,hhmm,tz){
 const [y,m,d]=ymd.split('-').map(Number),[hh,mm]=hhmm.split(':').map(Number),guess=Date.UTC(y,m-1,d,hh,mm);
 let t=guess-offsetMs(guess,tz);t=guess-offsetMs(t,tz);
 return new Date(t);
}
