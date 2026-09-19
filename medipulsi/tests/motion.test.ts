import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceJourney,easeAngle,trimFraction} from '../src/motion.ts';
import {EMPTY,TOTAL,GIFT_AT} from '../src/engine.ts';
test('30/60/120 Hz displays cover the same distance with sub-metre steps',()=>{
 for(const hz of [30,60,120]){let p={...EMPTY};for(let i=0;i<hz*10;i++){const n=advanceJourney(p,1/hz,GIFT_AT,true);assert.ok(n.meters-p.meters<=16/30+.00001);p=n;}assert.ok(Math.abs(p.meters-160)<.00001);assert.ok(Math.abs(p.seconds-10)<.00001);}
});
test('background suspension cannot teleport the player or award a gift',()=>{const p=advanceJourney({...EMPTY},120,GIFT_AT,true);assert.ok(p.meters<=1.6);assert.equal(p.claimed,false);});
test('large frame does not overshoot the gift arrival gate',()=>{const p=advanceJourney({...EMPTY,meters:GIFT_AT-10},.1,GIFT_AT,true);assert.equal(p.meters,GIFT_AT-9);});
test('heading interpolation crosses north through the short arc, including accumulated turns',()=>{assert.equal(easeAngle(359,1,.5),360);assert.equal(easeAngle(1,359,.5),0);assert.equal(easeAngle(1080,10,.5),1085);assert.equal(easeAngle(-720,350,.5),-725);});
test('route shader fraction is monotonic and preserves endpoints',()=>{assert.equal(trimFraction(0),0);assert.equal(trimFraction(TOTAL),1);let previous=0;for(let m=0;m<TOTAL;m+=10){const v=trimFraction(m);assert.ok(v>=previous&&v<=1);previous=v;}});
