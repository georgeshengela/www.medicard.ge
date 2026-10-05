import test from 'node:test';
import assert from 'node:assert/strict';
import {cityLevel,meterSegments} from './cityLevels.ts';

test('city level: none yet, on the way to Spark', () => {
 const l=cityLevel(0.08);
 assert.equal(l.current,null);
 assert.equal(l.next?.percent,0.1);
 assert.ok(Math.abs(l.progress-0.8)<1e-9);
});

test('city level: Lantern reached, on the way to Torch; gold from Lantern up', () => {
 const l=cityLevel(0.31);
 assert.equal(l.current?.percent,0.25);
 assert.equal(l.current?.gold,true);
 assert.equal(l.next?.percent,0.5);
 assert.ok(Math.abs(l.progress-0.24)<1e-9);
 assert.equal(cityLevel(0.1).current?.gold,false);
});

test('city level: past the last level, and bad input', () => {
 assert.equal(cityLevel(40).next,null);
 assert.equal(cityLevel(40).progress,1);
 assert.equal(cityLevel(NaN).progress,0);
});

test('LED meter: full, half and empty segments', () => {
 assert.deepEqual(meterSegments(0.5,4),[1,1,0,0]);
 assert.deepEqual(meterSegments(0.6,4),[1,1,0.5,0]);
 assert.deepEqual(meterSegments(0,3),[0,0,0]);
 assert.deepEqual(meterSegments(1,3),[1,1,1]);
});
