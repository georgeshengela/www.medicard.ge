// Generated from medipulsi/src by build-core.mjs.
import type {Coordinate} from './engine';
import {distance} from './engine';

export type WalkingTrail=Coordinate[][];
const rounded=(p:Coordinate):Coordinate=>[Number(p[0].toFixed(6)),Number(p[1].toFixed(6))];
const same=(a:Coordinate,b:Coordinate)=>a[0]===b[0]&&a[1]===b[1];

/** A visual record of accepted GPS movement, separate from verified road coverage. */
export function appendTrail(trail:WalkingTrail,from:Coordinate,to:Coordinate):WalkingTrail{
 const a=rounded(from),b=rounded(to);if(same(a,b))return trail;
 const last=trail.at(-1);
 // Small immutable chunks keep updates bounded without discarding older walks.
 if(last&&last.length<128&&same(last.at(-1)!,a))return [...trail.slice(0,-1),[...last,b]];
 return [...trail,[a,b]];
}

export function loadTrail(raw:unknown):WalkingTrail{
 if(!Array.isArray(raw))return [];
 return raw.filter((line):line is Coordinate[]=>Array.isArray(line)&&line.length>=2&&line.length<=128&&line.every((p,i)=>
  Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90&&
  (i===0||distance(line[i-1],p as Coordinate)<=106)));
}

export function trailFeatures(trail:WalkingTrail=[]){return {type:'FeatureCollection' as const,features:trail.map(coordinates=>({type:'Feature' as const,properties:{kind:'walked-gps'},geometry:{type:'LineString' as const,coordinates}}))};}
