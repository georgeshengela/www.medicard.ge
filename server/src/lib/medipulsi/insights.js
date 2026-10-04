// Admin MEDIRUN overview (#/medipulsi, owner 2026-10-04): what an admin needs to know about the game in one read —
// players and how many come back, walks and kilometres over time, where people play (countries and cities: who
// lives there, who painted there, how much, boxes opened), the Tbilisi levels (who can see the lanterns / the grand
// prize), the most active players, coins paid and prizes waiting. Box management lives in #/medirun-boxes.
// Aggregates only, cached 10 minutes per instance; painted areas come from each player's own journey cells.
import {prisma} from '../prisma.js';
import {paintedCells,groupByTile,CELL_KM2} from './territoryMath.js';
import {shareOfArea} from './giftRules.js';
import {getCampaign} from './campaignStore.js';
import {ensureCityTable,homeCityId} from './cities.js';

const DAY=86400_000;
let cache={at:0,value:null};
export function clearInsightsCache(){cache={at:0,value:null};}

const tbDay=d=>new Date(+new Date(d)+4*3600_000).toISOString().slice(0,10);

export async function medirunInsights({db=prisma,now=Date.now(),force=false}={}){
 if(!force&&cache.value&&now-cache.at<10*60_000)return cache.value;
 const campaign=await getCampaign(db,now),since30=new Date(now-30*DAY),since7=new Date(now-7*DAY);
 const [players,sessions30,totals,totals7,newPlayers7,activeNow,claims,coins,coins7,pendingPrizes,approvedPrizes]=await Promise.all([
  db.medipulsiPlayer.findMany({select:{userId:true,state:true,handle:true,leaderboardOptIn:true,createdAt:true,user:{select:{fullName:true}}}}),
  db.medipulsiSession.findMany({where:{phase:'FINISHED',excluded:false,startedAt:{gte:since30}},select:{userId:true,startedAt:true,meters:true,seconds:true,newMeters:true}}),
  db.medipulsiSession.aggregate({where:{phase:'FINISHED',excluded:false},_count:{_all:true},_sum:{meters:true,newMeters:true,seconds:true}}),
  db.medipulsiSession.aggregate({where:{phase:'FINISHED',excluded:false,startedAt:{gte:since7}},_count:{_all:true},_sum:{meters:true,newMeters:true}}),
  db.medipulsiPlayer.count({where:{createdAt:{gte:since7}}}),
  db.medipulsiSession.count({where:{phase:'ACTIVE',updatedAt:{gte:new Date(now-120_000)}}}),
  db.medipulsiClaim.findMany({where:{createdAt:{gte:since30}},select:{userId:true,giftId:true,createdAt:true,reward:true}}),
  db.rewardLedger.aggregate({where:{sourceType:'MEDIRUN',currency:'COIN'},_sum:{amount:true},_count:{_all:true}}).catch(()=>({_sum:{amount:0},_count:{_all:0}})),
  db.rewardLedger.aggregate({where:{sourceType:'MEDIRUN',currency:'COIN',createdAt:{gte:since7}},_sum:{amount:true}}).catch(()=>({_sum:{amount:0}})),
  db.medipulsiClaim.count({where:{status:'PENDING'}}),
  db.medipulsiClaim.count({where:{status:'APPROVED',reward:{path:['kind'],equals:'PHYSICAL'}}}).catch(()=>0),
 ]);

 /* trends: walks, players, km per Tbilisi day for 30 days */
 const days=new Map();
 for(let i=29;i>=0;i--)days.set(tbDay(now-i*DAY),{walks:0,players:new Set(),km:0,opened:0});
 for(const s of sessions30){const d=days.get(tbDay(s.startedAt));if(d){d.walks++;d.players.add(s.userId);d.km+=s.meters/1000;}}
 for(const c of claims){const d=days.get(tbDay(c.createdAt));if(d)d.opened++;}
 const trend=[...days].map(([date,d])=>({date,walks:d.walks,players:d.players.size,km:Math.round(d.km*10)/10,opened:d.opened}));

 /* who comes back: players with walks on 2+ different days in 30 days */
 const daysByPlayer=new Map();
 for(const s of sessions30){let set=daysByPlayer.get(s.userId);if(!set)daysByPlayer.set(s.userId,set=new Set());set.add(tbDay(s.startedAt));}
 const active30=daysByPlayer.size,returning=[...daysByPlayer.values()].filter(s=>s.size>=2).length;
 const active7=new Set(sessions30.filter(s=>+s.startedAt>=+since7).map(s=>s.userId)).size;

 /* where: painted cells per city / country (tile → city cache), homes, openings */
 const tilesByPlayer=new Map(),allTiles=new Set();
 for(const p of players){const t=groupByTile(paintedCells(p.state?.journey));tilesByPlayer.set(p.userId,t);for(const k of t.keys())allTiles.add(k);}
 const tileKeys=[...allTiles];
 const placeOf=new Map(tileKeys.length?(await db.$queryRaw`SELECT "tile","cityId","countryCode" FROM "MedipulsiPlaceTile" WHERE "tile" = ANY(${tileKeys})`).map(r=>[r.tile,r]):[]);
 const city=new Map(),country=new Map();
 const bump=(map,id,userId,cells)=>{let r=map.get(id);if(!r)map.set(id,r={id,players:new Set(),cells:0,homes:0,opened:0,openers:new Set()});r.players.add(userId);r.cells+=cells;};
 let unresolved=0;
 for(const [userId,tiles] of tilesByPlayer)for(const [tile,list] of tiles){
  const pl=placeOf.get(tile);
  if(!pl){unresolved+=list.length;continue;}
  if(pl.cityId)bump(city,pl.cityId,userId,list.length);
  if(pl.countryCode)bump(country,pl.countryCode,userId,list.length);
 }
 const homes=await db.$queryRaw`SELECT "userId","lat","lng","cityKa","countryCode" FROM "UserLocation" WHERE "enabled"=true AND "lat" IS NOT NULL`.catch(()=>[]);
 for(const h of homes){
  const id=await homeCityId(h,{db}).catch(()=>null);
  if(id){let r=city.get(id);if(!r)city.set(id,r={id,players:new Set(),cells:0,homes:0,opened:0,openers:new Set()});r.homes++;}
  if(h.countryCode){let r=country.get(h.countryCode);if(!r)country.set(h.countryCode,r={id:h.countryCode,players:new Set(),cells:0,homes:0,opened:0,openers:new Set()});r.homes++;}
 }
 const ruleRows=claims.length?await db.$queryRaw`SELECT "giftId","meta"->>'cityId' AS city FROM "MedipulsiGiftRule" WHERE "giftId" = ANY(${[...new Set(claims.map(c=>c.giftId))]})`.catch(()=>[]):[];
 const cityOfGift=new Map(ruleRows.map(r=>[r.giftId,r.city||campaign.area.id]));
 for(const c of claims){const id=cityOfGift.get(c.giftId)||campaign.area.id;let r=city.get(id);if(!r)city.set(id,r={id,players:new Set(),cells:0,homes:0,opened:0,openers:new Set()});r.opened++;r.openers.add(c.userId);}
 const ids=[...city.keys()];
 const areas=new Map(ids.length?(await db.$queryRaw`SELECT "id","countryCode","nameKa","nameEn","areaKm2" FROM "MedipulsiArea" WHERE "id" = ANY(${ids})`).map(a=>[a.id,a]):[]);
 const countryAreas=new Map((await db.$queryRaw`SELECT "countryCode","nameKa","nameEn","areaKm2" FROM "MedipulsiArea" WHERE "kind"='country'`.catch(()=>[])).map(a=>[a.countryCode,a]));
 await ensureCityTable(db);
 const boxCities=new Map((await db.$queryRaw`SELECT "cityId","status","spotCount","enabled" FROM "MedirunCity"`).map(r=>[r.cityId,r]));
 const cities=[...city.values()].map(r=>{const a=areas.get(r.id)||{},km2=r.cells*CELL_KM2,b=boxCities.get(r.id);return {id:r.id,nameKa:a.nameKa||null,nameEn:a.nameEn||null,countryCode:a.countryCode||null,players:r.players.size,homes:r.homes,paintedKm2:km2,percent:a.areaKm2>0?Math.min(100,km2/a.areaKm2*100):0,opened:r.opened,openers:r.openers.size,boxes:r.id===campaign.area.id?'campaign':b?(b.enabled?b.status:'off'):'none'};})
  .filter(r=>r.nameKa||r.nameEn).sort((a,b)=>(b.players+b.homes)-(a.players+a.homes)||b.paintedKm2-a.paintedKm2);
 const countries=[...country.values()].map(r=>{const a=countryAreas.get(r.id)||{},km2=r.cells*CELL_KM2;return {code:r.id,nameKa:a.nameKa||r.id,nameEn:a.nameEn||r.id,players:r.players.size,homes:r.homes,paintedKm2:km2};}).sort((a,b)=>(b.players+b.homes)-(a.players+a.homes));

 /* Tbilisi levels: the same precise share the gift gate uses */
 const [tbArea]=await db.$queryRaw`SELECT "id","areaKm2","geometry" FROM "MedipulsiArea" WHERE "id"=${campaign.area.id}`.catch(()=>[]);
 const levels=campaign.levels.map(l=>({id:l.id,name:l.name.ka,percent:l.percent,players:0}));
 const shares=[];
 if(tbArea)for(const p of players){
  if(!tilesByPlayer.get(p.userId)?.size)continue;
  const s=shareOfArea(p.state?.journey,tbArea,campaign.area.km2);
  if(s.percent>0)shares.push({userId:p.userId,percent:s.percent});
  for(const l of levels)if(s.percent+1e-9>=l.percent)l.players++;
 }
 shares.sort((a,b)=>b.percent-a.percent);

 /* most active (30 days): km, walks, new streets, coins from boxes */
 const per=new Map();
 for(const s of sessions30){let r=per.get(s.userId);if(!r)per.set(s.userId,r={km:0,walks:0,newKm:0,seconds:0,coins:0,opened:0});r.km+=s.meters/1000;r.walks++;r.newKm+=s.newMeters/1000;r.seconds+=s.seconds;}
 for(const c of claims){const r=per.get(c.userId);if(r){r.opened++;r.coins+=Number(c.reward?.coins)||0;}}
 const byId=new Map(players.map(p=>[p.userId,p]));
 const shareById=new Map(shares.map(s=>[s.userId,s.percent]));
 const top=[...per].sort((a,b)=>b[1].km-a[1].km).slice(0,15).map(([userId,r])=>({userId,name:byId.get(userId)?.user?.fullName||null,handle:byId.get(userId)?.handle||null,optIn:Boolean(byId.get(userId)?.leaderboardOptIn),km:Math.round(r.km*10)/10,walks:r.walks,newKm:Math.round(r.newKm*10)/10,hours:Math.round(r.seconds/360)/10,opened:r.opened,coins:r.coins,tbilisiPercent:shareById.get(userId)||0}));

 const value={
  generatedAt:new Date(now).toISOString(),
  players:{total:players.length,new7:newPlayers7,activeNow,active7,active30,returning,optIn:players.filter(p=>p.leaderboardOptIn).length},
  walks:{total:totals._count._all,km:Math.round((totals._sum.meters||0)/100)/10,newKm:Math.round((totals._sum.newMeters||0)/100)/10,hours:Math.round((totals._sum.seconds||0)/360)/10,last7:totals7._count._all,km7:Math.round((totals7._sum.meters||0)/100)/10,newKm7:Math.round((totals7._sum.newMeters||0)/100)/10},
  coins:{total:coins._sum.amount||0,openings:coins._count._all,last7:coins7._sum.amount||0},
  prizes:{pending:pendingPrizes,toHandOver:approvedPrizes},
  trend,cities,countries,unresolvedKm2:unresolved*CELL_KM2,
  levels,tbilisiTop:shares.slice(0,5).map(s=>({name:byId.get(s.userId)?.user?.fullName||byId.get(s.userId)?.handle||null,userId:s.userId,percent:s.percent})),
  top,
 };
 cache={at:now,value};
 return value;
}
