import test from 'node:test';
import assert from 'node:assert/strict';
import {planDay,dayKind,rotationOrder,CAMPAIGN,dateAdd} from './autopilot.js';
import {isUnlocked,normalizeRule,localizeGift,shareOfArea} from './giftRules.js';
import {grandView} from './grand.js';

const DISTRICTS=['გლდანი','ნაძალადევი','დიდუბე','ჩუღურეთი','საბურთალო','ვაკე','მთაწმინდა','კრწანისი','ისანი','სამგორი'];
// 10 districts × 14 spots on a small grid; every third one lit, depths 10–130 m.
const spots=DISTRICTS.flatMap((district,d)=>Array.from({length:14},(_,i)=>({id:`s${d}-${i}`,place:`პარკი ${d}`,district,kind:i%5?'park':'square',lng:44.75+d*0.006+(i%4)*0.0015,lat:41.70+Math.floor(i/4)*0.0015,lit:i%3===0,depthM:10+(i*9)%120,areaM2:80_000})));
const golden={rike:{place:'რიყის პარკი',lng:44.8099,lat:41.6937},vake:{place:'ვაკის პარკი',lng:44.7509,lat:41.7098},lisi:{place:'ლისის ტბა',lng:44.7345,lat:41.7438},april9:{place:'9 აპრილის ბაღი',lng:44.7994,lat:41.6983}};
const plan=date=>planDay(date,{spots,golden});

test('the same date always gives the same boxes',()=>{
 assert.deepEqual(plan('2026-10-06').map(p=>[p.gift.id,p.gift.latitude,p.rule.coins,p.gift.stock]),plan('2026-10-06').map(p=>[p.gift.id,p.gift.latitude,p.rule.coins,p.gift.stock]));
});
test('nothing outside the campaign',()=>{
 assert.equal(plan('2026-10-02').length,0);
 assert.equal(plan('2027-01-01').length,0);
});
test('weekdays: few small boxes deep inside parks; weekends: more and better',()=>{
 assert.equal(dayKind('2026-10-05'),'weekday');assert.equal(dayKind('2026-10-11'),'weekend');
 const mon=plan('2026-10-05'),sun=plan('2026-10-11');
 assert.ok(mon.length>=5&&mon.length<=7,`weekday boxes ${mon.length}`);
 assert.ok(mon.every(p=>p.rule.coins<=250&&p.gift.stock<=3&&p.gift.pulseRadius===250)); // coins ×5 since 2 Oct (store economy)
 assert.ok(mon.every(p=>spots.find(s=>s.id===p.rule.meta.spot).depthM>=40),'weekday boxes avoid park edges');
 const avg=list=>list.reduce((s,p)=>s+p.rule.coins,0)/list.length;
 assert.ok(sun.length>mon.length&&avg(sun)>avg(mon));
 assert.ok(sun.every(p=>p.rule.coins>=150));
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
test('a week of weekday boxes never reuses a rotation spot',()=>{
 // Theme-week focus spots may repeat by design (a small area); the city-wide rotation must not.
 const seen=new Set(),campaign={...CAMPAIGN,weeks:[]};
 for(let d='2026-10-05';d<='2026-10-09';d=dateAdd(d,1))for(const p of planDay(d,{spots,golden,campaign}).filter(p=>p.rule.meta.kind==='am')){assert.ok(!seen.has(p.rule.meta.spot),`${p.rule.meta.spot} reused`);seen.add(p.rule.meta.spot);}
});
test('Saturday 16:00 rain around the announced park; lanterns from November need 0.25%',()=>{
 const oct=plan('2026-10-10'),rain=oct.filter(p=>p.rule.meta.kind==='saturday');
 assert.ok(rain.length>=1);
 assert.equal(rain[0].gift.startsAt.toISOString(),'2026-10-10T12:00:00.000Z');
 assert.equal(oct.filter(p=>p.rule.meta.kind==='lantern').length,0);
 assert.equal(plan('2026-10-11').filter(p=>p.rule.meta.kind==='saturday').length,0,'Sunday has no rain');
 const nov=plan('2026-11-07').filter(p=>p.rule.meta.kind==='lantern');
 for(const p of nov){assert.equal(p.rule.minPercent,0.25);assert.equal(p.rule.areaId,CAMPAIGN.area.id);assert.equal(p.rule.coins,1500);}
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
import {dropsView,scheduleOf} from './drops.js';
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
 assert.equal(v.next.kind,'evening');
 assert.equal(v.next.startsAt,new Date('2026-10-06T18:00:00+04:00').toISOString());
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
 assert.equal(v.next.startsAt,new Date('2026-10-05T08:30:00+04:00').toISOString());
 assert.ok(v.next.coins.min>=50&&v.next.coins.max<=250);
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
 assert.equal(v.next.startsAt,new Date('2026-10-07T08:30:00+04:00').toISOString());
 assert.ok(v.next.boxes>0);
});
test('drops: the weekly rhythm comes from the config',()=>{
 const s=scheduleOf(CAMPAIGN,'ka');
 assert.equal(s[0].times,'08:30 და 18:00');
 assert.equal(s[2].times,'16:00');
 assert.deepEqual(s[1].coins,{min:150,max:500});
});
