import test from 'node:test';
import assert from 'node:assert/strict';
import {cityOf,dropDay,goalStreetKm,dropLabel,grandArea,grandCountdown,grandPercent,grandProgress,levelPercent,safeRulesUrl,streetsLeftLabel} from './grand.ts';

const DROP='2026-12-31T08:00:00.000Z';
test('drop time reads in Tbilisi time in both languages',()=>{
 assert.equal(dropLabel(DROP,'ka','ka-GE'),'31 დეკემბერი, 12:00');
 assert.equal(dropLabel(DROP,'en','en-GB'),'31 December, 12:00');
 assert.equal(dropDay(DROP,'ka','ka-GE'),'31 დეკემბერი');
 assert.equal(dropLabel('nope','ka','ka-GE'),'');
});
test('countdown counts Tbilisi calendar days, then today, live and ended',()=>{
 assert.deepEqual(grandCountdown(DROP,'upcoming',Date.parse('2026-10-01T09:00:00Z'),'ka'),{kind:'days',days:91,label:'დარჩა 91 დღე'});
 assert.equal(grandCountdown(DROP,'upcoming',Date.parse('2026-10-01T09:00:00Z'),'en').label,'91 days left');
 // 23:30 in Tbilisi on 30 Dec is still one calendar day before.
 assert.equal(grandCountdown(DROP,'upcoming',Date.parse('2026-12-30T19:30:00Z'),'en').label,'1 day left');
 // 00:30 in Tbilisi on 31 Dec is already the day.
 assert.equal(grandCountdown(DROP,'upcoming',Date.parse('2026-12-30T20:30:00Z'),'ka').label,'დღესაა');
 assert.equal(grandCountdown(DROP,'live',Date.parse('2026-12-31T09:00:00Z'),'ka').kind,'live');
 assert.equal(grandCountdown(DROP,'ended',Date.parse('2027-01-02T09:00:00Z'),'ka').label,'დასრულდა');
});
test('numbers use the Georgian decimal comma and never fake a zero',()=>{
 assert.equal(grandPercent(0.234,'ka'),'0,23%');assert.equal(grandPercent(0.234,'en'),'0.23%');
 assert.equal(grandPercent(0.0004,'ka'),'<0,01%');assert.equal(grandPercent(0,'ka'),'0%');
 assert.equal(levelPercent(0.1,'ka'),'0,1%');assert.equal(levelPercent(0.25,'en'),'0.25%');assert.equal(levelPercent(1,'ka'),'1%');
 assert.equal(grandArea(1.18,'ka'),'1,18 კმ²');assert.equal(grandArea(0.0623,'en'),'62 300 m²');assert.equal(grandArea(0,'ka'),'0 კმ²');
});
test('copy helpers: genitive city, streets left, progress and rules link',()=>{
 assert.equal(cityOf('თბილისი','ka'),'თბილისის');assert.equal(cityOf('Tbilisi','en'),'Tbilisi');
 assert.equal(streetsLeftLabel(39,'ka'),'დაგრჩა ≈ 39 კმ ახალი ქუჩა');assert.equal(streetsLeftLabel(38.2,'en'),'≈ 39 km of new streets to go');
 const req={areaId:'r1996871',city:'თბილისი',percent:1,areaKm2:503.93};
 assert.equal(grandProgress({requirement:req,me:{percent:0.25,paintedKm2:1.26,eligible:false,remainingPercent:0.75,remainingKm2:3.78,remainingStreetKm:38}}),0.25);
 assert.equal(grandProgress({requirement:req,me:{percent:1.4,paintedKm2:7,eligible:true,remainingPercent:0,remainingKm2:0,remainingStreetKm:0}}),1);
 assert.equal(grandProgress({requirement:req,me:null}),0);
 assert.equal(goalStreetKm(req),50);assert.equal(goalStreetKm(null),0);
 assert.equal(safeRulesUrl('https://medicard.ge/medirun/rules.html'),'https://medicard.ge/medirun/rules.html');
 assert.equal(safeRulesUrl('javascript:alert(1)'),null);assert.equal(safeRulesUrl(null),null);
});
