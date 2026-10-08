import test from 'node:test';
import assert from 'node:assert/strict';
import {planDay,dayKind,rotationOrder,CAMPAIGN,dateAdd} from './autopilot.js';
import {isUnlocked,normalizeRule,localizeGift,shareOfArea,ladderOf,maxPayout,payoutFor,normalizeDecay} from './giftRules.js';
import {budgetState,weekStart,periodBounds,rankAmong,walletRows} from './economy.js';
import {grandView} from './grand.js';

const DISTRICTS=['გლდანი','ნაძალადევი','დიდუბე','ჩუღურეთი','საბურთალო','ვაკე','მთაწმინდა','კრწანისი','ისანი','სამგორი'];
// 10 districts × 14 spots on a small grid; every third one lit, depths 10–130 m.
const spots=DISTRICTS.flatMap((district,d)=>Array.from({length:14},(_,i)=>({id:`s${d}-${i}`,place:`პარკი ${d}`,district,kind:i%5?'park':'square',lng:44.75+d*0.006+(i%4)*0.0015,lat:41.70+Math.floor(i/4)*0.0015,lit:i%3===0,depthM:10+(i*9)%120,areaM2:80_000})));
// `vake` sits inside the test grid so the rain and the lantern boxes have paths around them.
const golden={rike:{place:'რიყის პარკი',lng:44.8099,lat:41.6937},vake:{place:'ვაკის პარკი',lng:44.78,lat:41.7},lisi:{place:'ლისის ტბა',lng:44.7345,lat:41.7438},april9:{place:'9 აპრილის ბაღი',lng:44.7994,lat:41.6983}};
const plan=date=>planDay(date,{spots,golden});

test('the same date always gives the same boxes',()=>{
 assert.deepEqual(plan('2026-10-06').map(p=>[p.gift.id,p.gift.latitude,p.rule.coins,p.gift.stock]),plan('2026-10-06').map(p=>[p.gift.id,p.gift.latitude,p.rule.coins,p.gift.stock]));
});
test('nothing outside the campaign',()=>{
 assert.equal(plan('2026-10-02').length,0);
 assert.equal(plan('2027-01-01').length,0);
});
test('economy 2: weekdays three waves of many small boxes; weekends more and a little better',()=>{
 assert.equal(dayKind('2026-10-05'),'weekday');assert.equal(dayKind('2026-10-11'),'weekend');
 const mon=plan('2026-10-05'),sun=plan('2026-10-11');
 assert.ok(mon.length>=15&&mon.length<=18,`weekday boxes ${mon.length}`); // 3 × 5 city boxes (+ theme boxes when the week's zone has spots)
 assert.deepEqual([...new Set(mon.map(p=>p.rule.meta.kind))],['am','md','ev'],'three waves a day');
 assert.ok(mon.every(p=>p.rule.coins<=80&&p.gift.stock>=4&&p.gift.stock<=6&&p.gift.pulseRadius===250));
 assert.ok(mon.every(p=>spots.find(s=>s.id===p.rule.meta.spot).depthM>=20),'weekday boxes avoid park edges');
 // Maximum coverage: the two daytime waves together visit every district.
 assert.equal(new Set(mon.filter(p=>p.rule.meta.kind!=='ev').map(p=>p.rule.meta.district)).size,10,'all ten districts every weekday');
 const avg=list=>list.reduce((s,p)=>s+p.rule.coins,0)/list.length;
 assert.ok(sun.length>mon.length&&avg(sun)>avg(mon));
 assert.ok(sun.every(p=>p.rule.coins>=30&&p.rule.coins<=120));
 // Every box carries the first-finder ladder and says so in its copy.
 assert.ok(mon.every(p=>JSON.stringify(p.rule.meta.decay)==='[100,60,40,25]'));
 assert.match(mon[0].gift.description,/პირველ გამხსნელს/);assert.match(mon[0].rule.meta.descriptionEn,/first to open/);
});
test('evening waves only use lit paths, and no spot repeats inside a day',()=>{
 for(const date of ['2026-10-05','2026-10-10','2026-11-14']){
  const day=plan(date),ids=day.map(p=>p.rule.meta.spot);
  for(const p of day.filter(p=>p.rule.meta.kind==='ev')){const s=spots.find(x=>x.id===p.rule.meta.spot);assert.ok(s.lit||s.kind==='square',`${p.gift.id} not lit`);}
  const rain=day.filter(p=>!['saturday','lantern'].includes(p.rule.meta.kind)).map(p=>p.rule.meta.spot);
  assert.equal(new Set(rain).size,rain.length,`duplicate spot on ${date}`);
  assert.ok(ids.length);
 }
});
test('rotation visits every district before repeating one',()=>{
 const order=rotationOrder(spots,'x');
 assert.equal(new Set(order.slice(0,10).map(s=>s.district)).size,10);
 assert.equal(order.length,spots.length);
});
test('a week of daytime boxes never reuses a rotation spot',()=>{
 // Theme-week focus spots may repeat by design (a small area); the city-wide rotation must not.
 const seen=new Set(),campaign={...CAMPAIGN,weeks:[]};
 for(let d='2026-10-05';d<='2026-10-09';d=dateAdd(d,1))for(const p of planDay(d,{spots,golden,campaign}).filter(p=>['am','md'].includes(p.rule.meta.kind))){assert.ok(!seen.has(p.rule.meta.spot),`${p.rule.meta.spot} reused`);seen.add(p.rule.meta.spot);}
});
test('Saturday 16:00 rain around the announced park; lanterns from November need 0.25%',()=>{
 const oct=plan('2026-10-10'),rain=oct.filter(p=>p.rule.meta.kind==='saturday');
 assert.ok(rain.length>=1);
 assert.equal(rain[0].gift.startsAt.toISOString(),'2026-10-10T12:00:00.000Z');
 assert.equal(oct.filter(p=>p.rule.meta.kind==='lantern').length,0);
 assert.equal(plan('2026-10-11').filter(p=>p.rule.meta.kind==='saturday').length,0,'Sunday has no rain');
 const nov=plan('2026-11-07').filter(p=>p.rule.meta.kind==='lantern');
 assert.equal(nov.length,2);
 for(const p of nov){assert.equal(p.rule.minPercent,0.25);assert.equal(p.rule.areaId,CAMPAIGN.area.id);assert.equal(p.rule.coins,500);assert.equal(p.gift.stock,3);}
});
test('the grand prize exists only on 31 December, for 1% of Tbilisi, as a physical single box',()=>{
 assert.equal(plan('2026-12-30').filter(p=>p.rule.meta.kind==='grand').length,0);
 const g=plan('2026-12-31').find(p=>p.rule.meta.kind==='grand');
 assert.ok(g);assert.equal(g.gift.rewardKind,'PHYSICAL');assert.equal(g.gift.stock,1);assert.equal(g.rule.minPercent,1);
 assert.equal(g.gift.startsAt.toISOString(),'2026-12-31T08:00:00.000Z');
 assert.match(g.gift.title,/iPhone 18 Pro Max/);
});
test('every gift id fits the admin id format',()=>{
 for(const d of ['2026-10-05','2026-11-07','2026-12-31'])for(const p of plan(d))assert.match(p.gift.id,/^[a-zA-Z0-9_-]{1,80}$/);
});

test('economy 2: the first finder gets the full coins, the next ones a falling share, never below 5',()=>{
 const rule=normalizeRule({giftId:'g',coins:40,meta:{decay:[100,60,40,25]}});
 assert.deepEqual(rule.decay,[100,60,40,25]);
 assert.deepEqual(ladderOf(rule,6),[40,25,15,10,10,10]);
 assert.equal(maxPayout(rule,6),110);
 assert.deepEqual(ladderOf(normalizeRule({giftId:'g',coins:20,meta:{decay:[100,60,40,25]}}),4),[20,10,10,5]);
 // No ladder (boxes from before economy 2, plain admin gifts): every opening pays the same.
 assert.deepEqual(ladderOf(normalizeRule({giftId:'g',coins:100}),3),[100,100,100]);
 assert.equal(payoutFor(normalizeRule({giftId:'g',coins:0,meta:{decay:[100,50]}}),0),0,'a prize box pays no coins');
 // A broken ladder never pays more than the box says.
 assert.equal(normalizeDecay([100,120]),null);assert.equal(normalizeDecay([]),null);assert.equal(normalizeDecay([50,80]),null);assert.deepEqual(normalizeDecay(['100','60']),[100,60]);
});
test('gating: a rule without threshold is open, a gated rule needs the share',()=>{
 assert.equal(isUnlocked(null,()=>0),true);
 const rule=normalizeRule({giftId:'g',coins:'300',minPercent:1,areaId:'r1996871'});
 assert.equal(rule.coins,300);
 assert.equal(isUnlocked(rule,()=>0.99),false);
 assert.equal(isUnlocked(rule,()=>1),true);
 assert.equal(isUnlocked({...rule,areaId:null},()=>5),false,'gated rule without area never opens');
 assert.equal(isUnlocked(rule,()=>undefined),false);
 assert.equal(normalizeRule({giftId:'g',coins:-5,minPercent:'x'}).minPercent,null);
});
test('English requests get the English box text',()=>{
 const g={id:'a',title:'50 Medi Coins',description:'გახსენი ყუთი'};
 assert.equal(localizeGift(g,{meta:{descriptionEn:'Open the box'}},'en').description,'Open the box');
 assert.equal(localizeGift(g,{meta:{descriptionEn:'Open the box'}},'ka').description,'გახსენი ყუთი');
});
test('lit share counts only cells inside the city',()=>{
 const box=[[44.70,41.68],[44.80,41.68],[44.80,41.74],[44.70,41.74],[44.70,41.68]];
 const area={areaKm2:10,geometry:{type:'Polygon',coordinates:[box]}};
 const inside=Array.from({length:21},(_,i)=>[44.72+i*0.0006,41.71]);
 const outside=inside.map(([x,y])=>[x+1,y]);
 const a=shareOfArea({trail:[inside]},area),b=shareOfArea({trail:[inside,outside]},area);
 assert.ok(a.paintedKm2>0.08&&a.paintedKm2<0.14,String(a.paintedKm2));
 assert.equal(a.paintedKm2,b.paintedKm2);
 assert.equal(shareOfArea({trail:[inside]},null).percent,0);
});
test('eligibility page: levels, streets left, status by date',()=>{
 const v=grandView({share:{percent:0.3,paintedKm2:1.5},now:Date.parse('2026-10-03T10:00:00Z')});
 assert.equal(v.campaign.status,'upcoming');
 assert.equal(v.me.eligible,false);
 assert.deepEqual(v.levels.map(l=>l.reached),[true,true,false,false]);
 assert.equal(v.next.id,'torch');
 assert.equal(v.me.remainingStreetKm,Math.ceil(0.7/100*CAMPAIGN.area.km2/0.1));
 const done=grandView({share:{percent:1.02},lang:'en',now:Date.parse('2026-12-31T09:00:00Z')});
 assert.equal(done.me.eligible,true);assert.equal(done.next,null);assert.equal(done.campaign.status,'live');assert.equal(done.campaign.name,'Light up Tbilisi');
 assert.equal(grandView({share:{percent:0},now:Date.parse('2027-01-01T00:00:00Z')}).campaign.status,'ended');
});

/* ───────── „ყუთები ახლა“ (drops.js) ───────── */
import {dropsView,scheduleOf,lastWalkAt,parseAt,pickCityAt} from './drops.js';
const T=iso=>Date.parse(iso);
function rowsOf(date){
 const p=plan(date);
 return {gifts:p.map(x=>({id:x.gift.id,stock:x.gift.stock,allocated:0,startsAt:x.gift.startsAt,endsAt:x.gift.endsAt,rewardKind:x.gift.rewardKind})),rules:new Map(p.map(x=>[x.rule.giftId,{...x.rule}]))};
}
test('drops: live boxes are counted per district, never with coordinates',()=>{
 const {gifts,rules}=rowsOf('2026-10-06');
 const v=dropsView({gifts,rules,now:T('2026-10-06T09:00:00+04:00')});
 const morning=gifts.filter(g=>g.id.includes('-am-'));
 assert.equal(v.now.boxes,morning.length);
 assert.equal(v.now.openingsLeft,morning.reduce((s,g)=>s+g.stock,0));
 assert.equal(v.now.districts.reduce((s,d)=>s+d.boxes,0),morning.length);
 assert.ok(!JSON.stringify(v).match(/latitude|longitude|lng|lat"|place/));
 assert.equal(v.next.kind,'regular');
 assert.equal(v.next.startsAt,new Date('2026-10-06T13:00:00+04:00').toISOString());
 const later=dropsView({gifts,rules,now:T('2026-10-06T17:30:00+04:00')});
 assert.equal(later.next.kind,'evening');
 assert.equal(later.next.startsAt,new Date('2026-10-06T18:00:00+04:00').toISOString());
});
test('drops: a district carries only a ~1 km grid point of its boxes, never the boxes themselves',()=>{
 const {gifts,rules}=rowsOf('2026-10-06');
 const placed=gifts.map((g,i)=>({...g,latitude:41.71234+i*0.0001,longitude:44.78567}));
 const v=dropsView({gifts:placed,rules,now:T('2026-10-06T09:00:00+04:00')});
 assert.ok(v.now.districts.length>0);
 for(const d of v.now.districts){
  assert.equal(d.near.length,2);
  for(const n of d.near)assert.equal(Math.round(n*100)/100,n);
  assert.ok(Date.parse(d.endsAt)>T('2026-10-06T09:00:00+04:00')&&Date.parse(d.startsAt)<=T('2026-10-06T09:00:00+04:00'));
 }
 assert.ok(!JSON.stringify(v).match(/latitude|longitude|41\.712|44\.785/));
 assert.equal(dropsView({gifts,rules,now:T('2026-10-06T09:00:00+04:00')}).now.districts[0].near,null);
});
test('drops: a box that ran out or ended is not "out there"',()=>{
 const {gifts,rules}=rowsOf('2026-10-06');
 const spent=gifts.map(g=>g.id.includes('-am-')?{...g,allocated:g.stock}:g);
 const v=dropsView({gifts:spent,rules,now:T('2026-10-06T09:00:00+04:00')});
 assert.equal(v.now.boxes,0);
 assert.equal(v.now.endsAt,null);
});
test('drops: before the start the next wave is the first morning; the campaign is upcoming',()=>{
 const {gifts,rules}=rowsOf('2026-10-05');
 const v=dropsView({gifts,rules,now:T('2026-10-04T20:00:00+04:00')});
 assert.equal(v.campaign.status,'upcoming');
 assert.equal(v.now.boxes,0);
 assert.equal(v.next.startsAt,new Date('2026-10-05T08:00:00+04:00').toISOString());
 assert.ok(v.next.coins.min>=20&&v.next.coins.max<=80);
 assert.deepEqual(v.economy.decay,[100,60,40,25]);
});
test('drops: Saturday rain is announced as a kind, its park is not named before it starts',()=>{
 const {gifts,rules}=rowsOf('2026-10-10');
 const v=dropsView({gifts,rules,now:T('2026-10-10T15:00:00+04:00')});
 assert.equal(v.next.kind,'saturday');
 assert.ok(!('districts' in v.next));
});
test('drops: the grand prize never shows up in the box counts',()=>{
 const {gifts,rules}=rowsOf('2026-12-31');
 const v=dropsView({gifts,rules,now:T('2026-12-31T13:00:00+04:00')});
 const grand=gifts.find(g=>g.id===CAMPAIGN.grand.id);
 assert.ok(grand);
 const counted=gifts.filter(g=>g.id!==CAMPAIGN.grand.id&&+new Date(g.startsAt)<=T('2026-12-31T13:00:00+04:00')&&+new Date(g.endsAt)>T('2026-12-31T13:00:00+04:00')).length;
 assert.equal(v.now.boxes,counted);
});
test('drops: with nothing in the database the plan names the next wave',()=>{
 const p=plan('2026-10-07');
 const v=dropsView({gifts:[],rules:new Map(),planned:p,now:T('2026-10-07T07:00:00+04:00')});
 assert.equal(v.next.startsAt,new Date('2026-10-07T08:00:00+04:00').toISOString());
 assert.ok(v.next.boxes>0);
});
test('drops: the weekly rhythm comes from the config',()=>{
 const s=scheduleOf(CAMPAIGN,'ka');
 assert.equal(s[0].times,'08:00 და 13:00 და 18:00');
 assert.equal(s[2].times,'16:00');
 assert.deepEqual(s[1].coins,{min:30,max:120});
});

/* ───────── economy 2: budget, weeks, ranks (economy.js) ───────── */
test('economy: the season budget stops the autopilot at 100 % and projects the pace',()=>{
 const now=T('2026-10-20T12:00:00+04:00');
 const s=budgetState(CAMPAIGN,15000,now);
 assert.equal(s.seasonCoins,60000);assert.equal(s.daysTotal,88);assert.equal(s.daysGone,16);assert.equal(s.daysLeft,72);
 assert.equal(s.percent,25);assert.equal(s.stopped,false);assert.equal(s.projected,Math.round(15000/16*88));assert.equal(s.perDayLeft,Math.round(45000/72));
 assert.equal(budgetState(CAMPAIGN,60000,now).stopped,true);
 assert.equal(budgetState({...CAMPAIGN,economy:{...CAMPAIGN.economy,budget:{seasonCoins:0}}},999999,now).stopped,false,'no budget = no stop');
});
test('economy: leaderboard weeks are Tbilisi Monday → Sunday, the season is the campaign',()=>{
 assert.equal(weekStart(T('2026-10-04T23:30:00+04:00')),'2026-09-28','Sunday night still belongs to its week');
 assert.equal(weekStart(T('2026-10-05T00:10:00+04:00')),'2026-10-05');
 assert.equal(weekStart(T('2026-10-11T12:00:00+04:00')),'2026-10-05');
 assert.equal(periodBounds('week',CAMPAIGN,T('2026-10-08T10:00:00+04:00')).since.toISOString(),'2026-10-04T20:00:00.000Z');
 assert.equal(periodBounds('season',CAMPAIGN,T('2026-10-08T10:00:00+04:00')).since.toISOString(),'2026-10-04T20:00:00.000Z');
 assert.ok(periodBounds('season',CAMPAIGN,T('2027-03-01T10:00:00+04:00')).since>new Date('2026-11-01'),'outside the campaign: the last 90 days');
});
test('wallet: a movement names the box park and the opener place, a prize its board — never a coordinate',()=>{
 const rows=walletRows([
  {id:'a',amount:25,createdAt:'2026-10-06T06:30:00Z',sourceId:'claim:c1',metadata:{giftId:'g',rank:2,base:40},ruleMeta:{kind:'am',place:'ვაკის პარკი',placeEn:'Vake Park',district:'ვაკე',spot:'s1',decay:[100,60]}},
  {id:'b',amount:300,createdAt:'2026-10-12T20:10:00Z',sourceId:'week:2026-10-05:boxes:1',metadata:{week:'2026-10-05',board:'boxes',rank:1},ruleMeta:null},
 ]);
 assert.deepEqual(rows.map(r=>[r.kind,r.amount,r.rank,r.base,r.place,r.district,r.board,r.week]),[['box',25,2,40,'ვაკის პარკი','ვაკე',null,null],['prize',300,1,null,null,null,'boxes','2026-10-05']]);
 assert.equal(walletRows([{id:'a',amount:25,createdAt:'x',sourceId:'claim:c1',metadata:{},ruleMeta:{place:'ვაკის პარკი',placeEn:'Vake Park'}}],'en')[0].place,'Vake Park');
 assert.ok(!JSON.stringify(rows).match(/lat|lng|spot|decay/));
});
test('economy: a player outside the list still gets a place',()=>{
 const rows=[{coins:300,boxes:5},{coins:120,boxes:4},{coins:120,boxes:2},{coins:40,boxes:1}];
 assert.equal(rankAmong(rows,{coins:120,boxes:3},'boxes'),3);
 assert.equal(rankAmong(rows,{coins:500,boxes:1},'boxes'),1);
 assert.equal(rankAmong(rows,{coins:0,boxes:0},'boxes'),null);
 assert.equal(rankAmong([{meters:5000},{meters:900}],{meters:1000},'meters'),2);
});

/* ───────── admin-editable rules (campaignStore.js) ───────── */
import {parseCampaign,FILE_CAMPAIGN,upgradeCampaign} from './campaignStore.js';
const withRules=patch=>({...structuredClone(FILE_CAMPAIGN),...patch});
test('rules: the repo file is a valid campaign',()=>{assert.equal(parseCampaign(FILE_CAMPAIGN).id,FILE_CAMPAIGN.id);});
test('rules: a broken draft is refused with a Georgian reason',()=>{
 const bad=withRules({});bad.days.weekday.stock=[5,2];
 assert.throws(()=>parseCampaign(bad),e=>e.status===400&&/მარაგის/.test(e.message));
 const reserved=withRules({});reserved.days.weekday.waves[0].id='sat';
 assert.throws(()=>parseCampaign(reserved),e=>/დაკავებულია/.test(e.message));
});
test('rules: a day switched off has no boxes, the grand prize still comes',()=>{
 const c=withRules({dayOverrides:{'2026-10-06':{off:true},'2026-12-31':{off:true}}});
 assert.equal(planDay('2026-10-06',{campaign:c,spots,golden}).length,0);
 const grandDay=planDay('2026-12-31',{campaign:c,spots,golden});
 assert.deepEqual(grandDay.map(p=>p.gift.id),[c.grand.id]);
});
test('rules: a weekday run as a weekend gets weekend coins and waves',()=>{
 const c=withRules({dayOverrides:{'2026-10-07':{as:'weekend'}}});
 const p=planDay('2026-10-07',{campaign:c,spots,golden});
 assert.ok(p.every(x=>x.rule.coins>=30));
 assert.ok(p.some(x=>x.gift.id.includes('-am-'))&&+p[0].gift.startsAt===+new Date('2026-10-07T09:30:00+04:00'));
});
test('rules: a custom day replaces only what it names',()=>{
 const c=withRules({dayOverrides:{'2026-10-08':{day:{coins:[{amount:777,weight:1}],stock:[9,9]}}}});
 const p=planDay('2026-10-08',{campaign:c,spots,golden});
 assert.ok(p.length>0&&p.every(x=>x.rule.coins===777&&x.gift.stock===9));
});
test('rules: a campaign saved before economy 2 adopts the new economy but keeps the admin\'s own choices',()=>{
 const old=structuredClone(FILE_CAMPAIGN);delete old.economy;
 old.name.ka='ჩემი კამპანია';old.days.weekday.coins=[{amount:999,weight:1}];old.saturday.dates={'2026-10-17':'lisi'};old.cities.overrides={r1:{off:true}};old.dayOverrides={'2026-10-06':{off:true}};old.excludedSpots=['x'];
 const up=parseCampaign(upgradeCampaign(old));
 assert.equal(up.economy.version,FILE_CAMPAIGN.economy.version);
 assert.equal(up.name.ka,'ჩემი კამპანია');
 assert.deepEqual(up.days.weekday.coins,FILE_CAMPAIGN.days.weekday.coins);
 assert.deepEqual(up.saturday.dates,{'2026-10-17':'lisi'});assert.deepEqual(up.cities.overrides,{r1:{off:true}});
 assert.deepEqual(up.dayOverrides,{'2026-10-06':{off:true}});assert.deepEqual(up.excludedSpots,['x']);
 assert.equal(upgradeCampaign(up),null,'already current');
 const bad=structuredClone(FILE_CAMPAIGN);bad.economy.decay=[50,80];
 assert.throws(()=>parseCampaign(bad),e=>/კიბე/.test(e.message));
});
test('rules: an excluded spot never gets a box',()=>{
 const used=new Set(plan('2026-10-06').map(p=>p.rule.meta.spot));
 const out=[...used][0];
 const c=withRules({excludedSpots:[out]});
 for(let d='2026-10-05';d<='2026-10-12';d=dateAdd(d,1))assert.ok(!planDay(d,{campaign:c,spots,golden}).some(p=>p.rule.meta.spot===out));
});

/* ───────── every other city (cities.js + citySpotsMath.js) ───────── */
import {planCityDay,boxesPerWave,cityRulesOf} from './cities.js';
import {CITY_HELPERS} from './autopilot.js';
import {harvestSpots,zonedTime,timezoneFor} from './citySpotsMath.js';
const liege={cityId:'r19956604',nameKa:'ლიეჟი',nameEn:'Liège',timezone:'Europe/Brussels',players:1,enabled:true,source:'auto'};
const liegeSpots=Array.from({length:12},(_,i)=>({id:`r19956604-parc-${i}`,place:`Parc ${i%4}`,district:`Parc ${i%4}`,kind:'park',lng:5.57+i*0.002,lat:50.63+(i%3)*0.002,depthM:60}));
const cityPlan=(date,patch={},city=liege)=>planCityDay(city,date,{campaign:{...structuredClone(FILE_CAMPAIGN),...patch},spots:liegeSpots,helpers:CITY_HELPERS});
test('cities: one player gets boxes at local time, with the city on every box',()=>{
 const p=cityPlan('2026-10-06');
 assert.equal(p.length,6,'two boxes in each of three waves');
 assert.equal(+p[0].gift.startsAt,+new Date('2026-10-06T07:00:00Z'));
 assert.ok(p.every(x=>x.gift.id.startsWith('glow-2026-10-06-r19956604-')&&x.rule.meta.cityId==='r19956604'&&x.rule.meta.city==='ლიეჟი'));
 assert.equal(new Set(p.map(x=>x.rule.meta.spot)).size,p.length);
});
test('cities: more players, more boxes; weekends add one and pay more; the cap holds',()=>{
 const rules=cityRulesOf(FILE_CAMPAIGN);
 assert.equal(boxesPerWave(rules,{...liege,players:1},false),2);
 assert.equal(boxesPerWave(rules,{...liege,players:12},false),4);
 assert.equal(boxesPerWave(rules,{...liege,players:1},true),3);
 assert.equal(boxesPerWave(rules,{...liege,players:5000},true),6);
 assert.ok(cityPlan('2026-10-10').every(x=>x.rule.coins>=30&&x.rule.coins<=120));
 assert.ok(cityPlan('2026-10-06').every(x=>JSON.stringify(x.rule.meta.decay)==='[100,60,40,25]'),'the ladder travels to every city');
});
test('cities: off, disabled, no players, outside the campaign → nothing',()=>{
 const rules=cityRulesOf(FILE_CAMPAIGN);
 assert.equal(cityPlan('2026-10-06',{cities:{...rules,overrides:{r19956604:{off:true}}}}).length,0);
 assert.equal(cityPlan('2026-10-06',{cities:{...rules,enabled:false}}).length,0);
 assert.equal(cityPlan('2026-10-06',{},{...liege,players:0}).length,0);
 assert.equal(cityPlan('2026-10-06',{},{...liege,players:0,source:'manual'}).length,6);
 assert.equal(cityPlan('2027-01-02').length,0);
});
test('cities: local time follows summer / winter time',()=>{
 assert.equal(zonedTime('2026-10-05','09:00','Europe/Brussels').toISOString(),'2026-10-05T07:00:00.000Z');
 assert.equal(zonedTime('2026-11-02','09:00','Europe/Brussels').toISOString(),'2026-11-02T08:00:00.000Z');
 assert.equal(timezoneFor('BE',5.5),'Europe/Brussels');
 assert.equal(timezoneFor('US',-74),'Etc/GMT+5');
});
test('cities: spots only on park paths, away from roads and schools, deep enough and 150 m apart',()=>{
 // A 400 × 400 m park at the origin, a road along its south edge, a school node in the north-east, paths across.
 const deg=m=>m/111320,lat0=50.63,lng0=5.57,k=Math.cos(lat0*Math.PI/180);
 const pt=(x,y)=>({lon:lng0+deg(x)/k,lat:lat0+deg(y)});
 const ring=[pt(0,0),pt(400,0),pt(400,400),pt(0,400),pt(0,0)];
 const elements=[
  {type:'way',id:1,tags:{leisure:'park',name:'Parc Test'},geometry:ring},
  {type:'way',id:2,tags:{highway:'footway'},geometry:[pt(20,5),pt(380,5)]},           // 5 m from the edge and the road
  {type:'way',id:3,tags:{highway:'footway'},geometry:[pt(200,20),pt(200,380)]},
  {type:'way',id:4,tags:{highway:'footway'},geometry:[pt(20,200),pt(380,200)]},
  {type:'way',id:5,tags:{highway:'footway',bridge:'yes'},geometry:[pt(100,100),pt(120,120)]},
  {type:'way',id:6,tags:{highway:'residential'},geometry:[pt(-50,-3),pt(450,-3)]},
  {type:'node',id:7,tags:{amenity:'school'},...pt(360,360)},
 ];
 const spots=harvestSpots(elements,{cityId:'r1',geometry:null,center:[lng0,lat0]});
 assert.ok(spots.length>=2&&spots.length<=5);
 const m=s=>[(s.lng-lng0)*111320*k,(s.lat-lat0)*111320];
 for(const s of spots){const [x,y]=m(s);assert.ok(y>15,'not on the edge path / near the road');assert.ok(Math.hypot(x-360,y-360)>30,'away from the school');assert.ok(s.depthM>=12);}
 for(let i=0;i<spots.length;i++)for(let j=i+1;j<spots.length;j++){const [a,b]=[m(spots[i]),m(spots[j])];assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])>=149);}
 assert.ok(spots.every(s=>s.place==='Parc Test'&&s.id.startsWith('r1-parc-test-')));
});
test('drops: a Liège reader sees only Liège boxes, with the park as the place',()=>{
 const tb=rowsOf('2026-10-06');
 const lp=cityPlan('2026-10-06');
 const gifts=[...tb.gifts,...lp.map(x=>({id:x.gift.id,stock:x.gift.stock,allocated:0,startsAt:x.gift.startsAt,endsAt:x.gift.endsAt,rewardKind:'DIGITAL'}))];
 const rules=new Map([...tb.rules,...lp.map(x=>[x.rule.giftId,x.rule])]);
 const at=T('2026-10-06T10:00:00+02:00');
 const v=dropsView({gifts,rules,now:at,city:{id:'r19956604',name:'ლიეჟი'}});
 assert.equal(v.city.campaignCity,false);
 assert.equal(v.now.boxes,lp.filter(x=>+x.gift.startsAt<=at&&+x.gift.endsAt>at).length);
 assert.ok(v.now.districts.every(d=>d.name.startsWith('Parc')));
 const t=dropsView({gifts,rules,now:at});
 assert.ok(t.city.campaignCity&&t.now.districts.every(d=>!d.name.startsWith('Parc')));
});

/* ───────── admin „ლოკაცია“: Google Maps link → exact point ───────── */
import {parseMapLocation} from './mapLink.js';
test('map links: the place pin wins over the map centre; plain coordinates work',()=>{
 const owner='https://www.google.com/maps/place/Chau.+de+Tongres+170,+4000+Li%C3%A8ge/@50.6679071,5.5529779,17z/data=!3m1!4b1!4m6!3m5!1s0x47c0fa59475aea11:0xd415658bdb7a2394!8m2!3d50.6679037!4d5.5555528!16s%2Fg%2F11hbprz51s?entry=ttu&g_ep=EgoyMDI2MDkzMC4wIKXMDSoASAFQAw%3D%3D';
 assert.deepEqual(parseMapLocation(owner),{latitude:50.6679037,longitude:5.5555528,source:'pin'});
 assert.deepEqual(parseMapLocation('https://www.google.com/maps/@41.7098,44.7509,16z'),{latitude:41.7098,longitude:44.7509,source:'center'});
 assert.deepEqual(parseMapLocation('https://maps.google.com/?q=41.7151,44.8271'),{latitude:41.7151,longitude:44.8271,source:'query'});
 assert.deepEqual(parseMapLocation(' 41.69442, 44.78384 '),{latitude:41.69442,longitude:44.78384,source:'coordinates'});
 assert.equal(parseMapLocation('https://maps.app.goo.gl/abc123'),null);
 assert.equal(parseMapLocation('ვაკის პარკი'),null);
});

test('drops: only a live fix tells the walked city (a paused journey may hold a stale position)',()=>{
 const t=Date.parse('2026-10-08T18:00:00Z');
 assert.equal(lastWalkAt({state:{journey:{position:[5.57,50.63],lastFix:t}}}),t);
 assert.equal(lastWalkAt({state:{journey:{position:[44.8,41.7],lastFix:null,pausedAt:'2026-10-08T18:00:00.000Z'}},updatedAt:new Date(t)}),0);
 assert.equal(lastWalkAt({state:{journey:{lastFix:t}}}),0);
 assert.equal(lastWalkAt(null),0);
});
test('drops: the phone position picks the city it is in (smallest box), junk headers are ignored',()=>{
 assert.deepEqual(parseAt('5.58,50.63'),[5.58,50.63]);
 assert.deepEqual(parseAt(' 44.79,41.72 '),[44.79,41.72]);
 for(const bad of ['', 'x', '5.58', '500,50', '5.58,95', '5.58;50.63', null])assert.equal(parseAt(bad),null);
 const boxes=[{tbilisi:true,box:[44.6,41.6,45.0,41.85]},{row:{cityId:'r19956604'},box:[5.45,50.55,5.7,50.7]},{row:{cityId:'big'},box:[3,49,7,52]}];
 assert.equal(pickCityAt([5.58,50.63],boxes).row.cityId,'r19956604');
 assert.equal(pickCityAt([44.79,41.72],boxes).tbilisi,true);
 assert.equal(pickCityAt([0,0],boxes),null);
});
