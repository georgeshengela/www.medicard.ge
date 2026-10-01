import test from 'node:test';
import assert from 'node:assert/strict';
import {formatArea,formatPercent} from './territory.ts';
test('percent keeps small shares visible instead of rounding them to 0',()=>{
 assert.equal(formatPercent(0),'0');assert.equal(formatPercent(0.000723),'0.00072');assert.equal(formatPercent(0.0123),'0.012');
 assert.equal(formatPercent(4.0e-8),'0.000000040');assert.equal(formatPercent(3.456),'3.46');assert.equal(formatPercent(42.31),'42.3');
 assert.notEqual(formatPercent(1e-11),'0');
});
test('area reads as m² while small and km² later',()=>{
 assert.equal(formatArea(0.0623),'62 300 მ²');assert.equal(formatArea(0.0623,'en'),'62 300 m²');assert.equal(formatArea(2.5),'2.50 კმ²');assert.equal(formatArea(0),'0 მ²');
});
