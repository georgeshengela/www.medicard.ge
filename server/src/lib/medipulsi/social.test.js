// MEDIRUN social + onboarding (owner 2026-10-05): crews, together, live counts, starter box, city meter, wrapped.
import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanCrewName,normalizeCode,validCode,newCode,companionsNear,togetherDelta,kmToPay,freshSpot,togetherOf,TOGETHER_M} from './social.js';
import {starterGiftId,isStarterId,visibleTo,starterOf,starterDue,starterProgress} from './starter.js';
import {milestoneView,unionShare,MILESTONES} from './cityMeter.js';
import {wrappedWindow} from './wrapped.js';
import {walletRows} from './economy.js';
import {FILE_CAMPAIGN,parseCampaign,economyOf} from './campaignStore.js';

const NOW=Date.parse('2026-10-07T10:00:00+04:00');
const TBILISI=[44.7930,41.6970];
const east=(p,m)=>[p[0]+m/(111320*Math.cos(p[1]*Math.PI/180)),p[1]];

test('crew names: trimmed, 2–24 characters, no links or handles', () => {
 assert.equal(cleanCrewName('  ვაკის   მორბენლები '),'ვაკის მორბენლები');
 assert.equal(cleanCrewName('a'),null);
 assert.equal(cleanCrewName('x'.repeat(25)),null);
 assert.equal(cleanCrewName('join www.spam.ge'),null);
 assert.equal(cleanCrewName('https://x'),null);
 assert.equal(cleanCrewName('me@mail'),null);
 assert.equal(cleanCrewName('t.me/group'),null);
 assert.equal(cleanCrewName('Office​ Team'),'Office Team');
});

test('crew codes: six unambiguous characters, typed in any case', () => {
 for(let i=0;i<200;i++){const c=newCode();assert.ok(validCode(c),c);}
 assert.equal(normalizeCode(' ab-c2 3d '),'ABC23D');
 assert.equal(validCode('ABCDE0'),false);   // 0 is not in the alphabet
 assert.equal(validCode('ABCDE'),false);
});

test('together: only fresh, precise crew members within the radius, never those who switched it off', () => {
 const fix=(p,age=2000,acc=8)=>({position:p,lastFix:NOW-age,accuracy:acc});
 const others=[
  {handle:'near',journey:fix(east(TBILISI,TOGETHER_M-5))},
  {handle:'far',journey:fix(east(TBILISI,TOGETHER_M+15))},
  {handle:'stale',journey:fix(east(TBILISI,5),60_000)},
  {handle:'blurry',journey:fix(east(TBILISI,5),1000,80)},
  {handle:'off',journey:fix(east(TBILISI,5)),settings:{together:false}},
 ];
 assert.deepEqual(companionsNear(TBILISI,others,NOW),['near']);
 assert.equal(freshSpot({position:TBILISI,lastFix:NOW+10_000,accuracy:5},NOW),null);
});

test('together metres: the walk since the last tick, nothing after a gap, a jump or midnight', () => {
 const prev={lastAt:NOW-10_000,lng:TBILISI[0],lat:TBILISI[1]};
 assert.ok(Math.abs(togetherDelta(prev,east(TBILISI,30),NOW)-30)<0.5);
 assert.equal(togetherDelta(prev,east(TBILISI,200),NOW),0);                 // 20 m/s is not walking
 assert.equal(togetherDelta({...prev,lastAt:NOW-60_000},east(TBILISI,30),NOW),0);
 assert.equal(togetherDelta({lastAt:null},east(TBILISI,30),NOW),0);
 const lateNight=Date.parse('2026-10-08T00:00:05+04:00');
 assert.equal(togetherDelta({...prev,lastAt:lateNight-10_000},east(TBILISI,20),lateNight),0);
});

test('together coins: each full km once, up to the daily cap', () => {
 const rules={enabled:true,coinsPerKm:10,dailyCap:30};
 assert.deepEqual(kmToPay(999,0,rules),[]);
 assert.deepEqual(kmToPay(2100,0,rules),[1,2]);
 assert.deepEqual(kmToPay(2100,2,rules),[]);
 assert.deepEqual(kmToPay(9000,2,rules),[3]);
 assert.deepEqual(kmToPay(5000,0,{...rules,coinsPerKm:0}),[]);
 assert.deepEqual(kmToPay(5000,0,{...rules,enabled:false}),[]);
 assert.deepEqual(togetherOf(FILE_CAMPAIGN),{enabled:true,coinsPerKm:10,dailyCap:30});
});

test('starter box: personal by id, due after metres or seconds', () => {
 const a=starterGiftId('user-a'),b=starterGiftId('user-b');
 assert.ok(isStarterId(a)&&a!==b&&!a.includes('user-a'));
 assert.equal(visibleTo(a,'user-a'),true);
 assert.equal(visibleTo(a,'user-b'),false);
 assert.equal(visibleTo('glow-2026-10-07-am-01','user-b'),true);
 const s=starterOf(FILE_CAMPAIGN);
 assert.equal(s.enabled,true);assert.equal(s.coins,50);
 assert.equal(starterDue(s,{meters:10,seconds:5}),false);
 assert.equal(starterDue(s,{meters:60,seconds:5}),true);
 assert.equal(starterDue(s,{meters:0,seconds:45}),true);
 assert.deepEqual(starterProgress(s,{meters:21,seconds:3}),{meters:39});
 assert.equal(starterProgress(s,{meters:80,seconds:3}),null);
});

test('saved campaigns from before the starter / together rules get the defaults and still validate', () => {
 const old=structuredClone(FILE_CAMPAIGN);delete old.economy.starter;delete old.economy.together;
 const parsed=parseCampaign(old);
 assert.equal(economyOf(parsed).starter.coins,50);
 assert.equal(economyOf(parsed).together.coinsPerKm,10);
 const edited=structuredClone(FILE_CAMPAIGN);edited.economy.starter={...edited.economy.starter,enabled:false};
 assert.equal(starterOf(parseCampaign(edited)).enabled,false);
});

test('city meter: shared streets count once; milestones and the next one', () => {
 const ring=[[44.70,41.65],[44.90,41.65],[44.90,41.80],[44.70,41.80],[44.70,41.65]];
 const area={areaKm2:500,geometry:{type:'Polygon',coordinates:[ring]}};
 const walk=[TBILISI,east(TBILISI,500)];
 const one=unionShare([{trail:[walk]}],area),two=unionShare([{trail:[walk]},{trail:[walk]}],area);
 assert.ok(one.cells>0);
 assert.equal(two.cells,one.cells);
 assert.equal(two.people,2);
 assert.equal(unionShare([{trail:[[[10,10],[10.001,10]]]}],area).people,0);   // outside the city
 const v=milestoneView(1.2,{'1':'2026-10-06T10:00:00.000Z'});
 assert.equal(v.next.percent,2);
 assert.equal(v.last.percent,1);
 assert.equal(v.list.filter(m=>m.reached).length,MILESTONES.filter(m=>m<=1.2).length);
});

test('wrapped: last Tbilisi week, shown until Wednesday night', () => {
 const w=wrappedWindow(NOW);   // Wednesday 7 Oct
 assert.equal(w.start,'2026-09-28');
 assert.equal(w.end,'2026-10-04');
 assert.equal(w.showUntil,new Date(Date.parse('2026-10-08T00:00:00+04:00')).toISOString());
});

test('wallet rows name together coins', () => {
 const [row]=walletRows([{id:'1',amount:10,createdAt:new Date(NOW),sourceId:'together:2026-10-07:1',metadata:{kind:'together'},ruleMeta:null}]);
 assert.equal(row.kind,'together');
});
