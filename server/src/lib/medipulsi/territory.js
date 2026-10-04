// How much of a city / country a person has painted in MEDIRUN, for the progress section and share card.
// Places come from OpenStreetMap (Nominatim reverse with the boundary polygon) and are cached forever per
// ~2 km tile, so each tile costs one lookup for the whole user base. Only aggregates leave the server —
// never the route itself.
import {prisma} from '../prisma.js';
import {nominatimTurn} from '../userLocation.js';
import {countryCodeOf,countryNameKa,countryNameEn,cityNameKa,cityNameEn} from '../geoPlace.js';
import {paintedCells,groupByTile,tileCenter,cellCenter,insideGeometry,geometryBbox,geometryAreaKm2,cityMap,CELL_KM2,WORLD_LAND_KM2} from './territoryMath.js';

const UA='Medicard.GE/1.0 (MEDIRUN painted city; contact@medicard.ge)';
/** New tiles are looked up within this budget; the rest arrive on the next visit (`pending`). */
const LOOKUP_BUDGET_MS=8000;
const isPolygon=g=>g?.type==='Polygon'||g?.type==='MultiPolygon';
/** Official total areas (km²). OSM country boundaries include territorial waters (Georgia: 75 637 vs 69 700),
 * so known countries use the official figure; others fall back to the OSM polygon. */
export const COUNTRY_AREA_KM2={GE:69700,AM:29743,AZ:86600,TR:783562,UA:603550,RU:17098246,BE:30689,NL:41850,LU:2586,DE:357592,FR:551695,IT:301340,ES:505990,PT:92212,GB:243610,IE:70273,AT:83879,CH:41285,PL:312696,CZ:78866,HU:93030,RO:238397,BG:110994,GR:131957,CY:9251,DK:42933,SE:450295,NO:385207,FI:338455,US:9833520,CA:9984670,IL:22145,AE:83600,JP:377975};

let ready=false;
async function ensureTables(){
 if(ready)return;
 await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MedipulsiPlaceTile" ("tile" TEXT PRIMARY KEY, "cityId" TEXT, "countryCode" TEXT, "resolvedAt" TIMESTAMPTZ NOT NULL DEFAULT now())`);
 await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MedipulsiArea" ("id" TEXT PRIMARY KEY, "kind" TEXT NOT NULL, "countryCode" TEXT, "nameKa" TEXT, "nameEn" TEXT, "areaKm2" DOUBLE PRECISION NOT NULL, "geometry" JSONB, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now())`);
 ready=true;
}

async function reverse(lng,lat,params){
 await nominatimTurn();
 const url=new URL('https://nominatim.openstreetmap.org/reverse');
 for(const [k,v] of Object.entries({format:'jsonv2',lat,lon:lng,polygon_geojson:1,namedetails:1,addressdetails:1,...params}))url.searchParams.set(k,String(v));
 const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{Accept:'application/json','User-Agent':UA}});
 if(!response.ok)throw new Error(`nominatim ${response.status}`);
 return response.json();
}

async function ensureCountry(code,lng,lat){
 const found=await prisma.$queryRaw`SELECT "id" FROM "MedipulsiArea" WHERE "id"=${'country:'+code}`;
 if(found.length)return;
 const body=await reverse(lng,lat,{zoom:3,polygon_threshold:0.01});
 if(!isPolygon(body?.geojson)||countryCodeOf(body?.address?.country_code)!==code)return;
 const n=body.namedetails||{};
 await prisma.$executeRaw`INSERT INTO "MedipulsiArea" ("id","kind","countryCode","nameKa","nameEn","areaKm2","geometry") VALUES (${'country:'+code},'country',${code},${n['name:ka']||countryNameKa(code,body.name)},${n['name:en']||countryNameEn(code,body.name)},${COUNTRY_AREA_KM2[code]??geometryAreaKm2(body.geojson)},NULL) ON CONFLICT ("id") DO NOTHING`;
}

/** City (or the municipality around a village) and country of one tile; cached even when empty (sea). */
async function resolveTile(tile){
 const [lng,lat]=tileCenter(tile);
 const body=await reverse(lng,lat,{zoom:10,polygon_threshold:0.0005});
 const countryCode=countryCodeOf(body?.address?.country_code)||null;
 let cityId=null;
 if(isPolygon(body?.geojson)&&body.osm_type&&body.osm_id){
  cityId=`${body.osm_type[0]}${body.osm_id}`;
  const n=body.namedetails||{};
  await prisma.$executeRaw`INSERT INTO "MedipulsiArea" ("id","kind","countryCode","nameKa","nameEn","areaKm2","geometry") VALUES (${cityId},'city',${countryCode},${n['name:ka']||cityNameKa(body.name)||body.name},${n['name:en']||cityNameEn(body.name)||body.name},${geometryAreaKm2(body.geojson)},${JSON.stringify(body.geojson)}::jsonb) ON CONFLICT ("id") DO NOTHING`;
 }
 if(countryCode)await ensureCountry(countryCode,lng,lat);
 await prisma.$executeRaw`INSERT INTO "MedipulsiPlaceTile" ("tile","cityId","countryCode") VALUES (${tile},${cityId},${countryCode}) ON CONFLICT ("tile") DO NOTHING`;
 return {tile,cityId,countryCode};
}

/** The OSM city / country of one ~2 km tile, cached for everyone (MEDIRUN cities use it for home places). */
export async function resolveTilePlace(tile){
 await ensureTables();
 const [row]=await prisma.$queryRaw`SELECT "tile","cityId","countryCode" FROM "MedipulsiPlaceTile" WHERE "tile"=${tile}`;
 return row||resolveTile(tile);
}

const memo=new Map();
export async function territory(userId,lang='ka'){
 const player=await prisma.medipulsiPlayer.findUnique({where:{userId},select:{state:true}});
 const cells=paintedCells(player?.state?.journey);
 const signature=`${lang}:${cells.size}`,cached=memo.get(userId);
 if(cached&&cached.signature===signature&&Date.now()-cached.at<10*60_000)return cached.result;
 await ensureTables();
 const tiles=groupByTile(cells),keys=[...tiles.keys()];
 const places=new Map((keys.length?await prisma.$queryRaw`SELECT "tile","cityId","countryCode" FROM "MedipulsiPlaceTile" WHERE "tile" = ANY(${keys})`:[]).map(r=>[r.tile,r]));
 const started=Date.now();let pending=false;
 for(const tile of keys.filter(k=>!places.has(k)).sort((a,b)=>tiles.get(b).length-tiles.get(a).length)){
  if(Date.now()-started>LOOKUP_BUDGET_MS){pending=true;break;}
  try{places.set(tile,await resolveTile(tile));}catch{pending=true;}
 }
 const ids=[...new Set([...places.values()].flatMap(p=>[p.cityId,p.countryCode&&'country:'+p.countryCode]).filter(Boolean))];
 const areas=new Map((ids.length?await prisma.$queryRaw`SELECT "id","kind","countryCode","nameKa","nameEn","areaKm2","geometry" FROM "MedipulsiArea" WHERE "id" = ANY(${ids})`:[]).map(a=>[a.id,a]));
 const cityCells=new Map(),countryCells=new Map(),boxes=new Map();
 for(const [tile,list] of tiles){
  const place=places.get(tile);if(!place)continue;
  if(place.countryCode)countryCells.set(place.countryCode,(countryCells.get(place.countryCode)||0)+list.length);
  const city=place.cityId&&areas.get(place.cityId);if(!city?.geometry)continue;
  let box=boxes.get(city.id);if(!box)boxes.set(city.id,box=geometryBbox(city.geometry));
  let mine=cityCells.get(city.id);if(!mine)cityCells.set(city.id,mine=[]);
  for(const key of list){const p=cellCenter(key);if(p[0]>=box[0]&&p[0]<=box[2]&&p[1]>=box[1]&&p[1]<=box[3]&&insideGeometry(p,city.geometry))mine.push(key);}
 }
 const name=a=>(lang==='en'?a.nameEn||a.nameKa:a.nameKa||a.nameEn)||'';
 const row=(a,count)=>({id:a.id,name:name(a),countryCode:a.countryCode,areaKm2:a.areaKm2,paintedKm2:count*CELL_KM2,percent:a.areaKm2>0?Math.min(100,count*CELL_KM2/a.areaKm2*100):0});
 // The six cities the app can pick from also get the minimal map for the share card.
 const cities=[...cityCells].filter(([,keys])=>keys.length).sort((a,b)=>b[1].length-a[1].length).map(([id,keys],i)=>({...row(areas.get(id),keys.length),map:i<6?cityMap(areas.get(id).geometry,keys):null}));
 const countries=[...countryCells].filter(([code])=>areas.has('country:'+code)).map(([code,n])=>row(areas.get('country:'+code),n)).sort((a,b)=>b.paintedKm2-a.paintedKm2);
 const paintedKm2=cells.size*CELL_KM2;
 const result={paintedKm2,world:{percent:paintedKm2/WORLD_LAND_KM2*100},cities,countries,pending};
 if(!pending)memo.set(userId,{signature,at:Date.now(),result});
 return result;
}
