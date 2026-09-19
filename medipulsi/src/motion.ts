import {TOTAL, pointAt} from './engine.ts';
import type {Progress} from './engine.ts';

export type MotionState={current:Progress};
export const DEMO_SPEED=16;

/** Integrate elapsed frame time, never timer callback counts or background time. */
export function advanceJourney(p:Progress,elapsed:number,giftAt:number,giftEnabled:boolean,speed=DEMO_SPEED):Progress{
 const dt=Math.max(0,Math.min(.1,Number.isFinite(elapsed)?elapsed:0));
 const stop=giftEnabled&&p.meters<giftAt?giftAt-9:TOTAL;
 const meters=Math.max(p.meters,Math.min(stop,TOTAL,p.meters+dt*speed));
 return {...p,meters,seconds:p.seconds+(meters-p.meters)/speed,completedAt:meters/TOTAL>=.85?(p.completedAt||new Date().toISOString()):p.completedAt};
}
export function routeHeading(meters:number){
 const a=pointAt(Math.max(0,meters-3)),b=pointAt(Math.min(TOTAL,meters+12));
 const x=(b[0]-a[0])*Math.cos(a[1]*Math.PI/180),y=b[1]-a[1];
 return (Math.atan2(x,y)*180/Math.PI+360)%360;
}
/** Shortest arc avoids a complete camera spin at the north crossing. */
export function easeAngle(from:number,to:number,weight:number){return from+(((to-from+180)%360+360)%360-180)*Math.min(1,Math.max(0,weight));}

// Mercator distance is the metric used by Mapbox's line-trim-offset, unlike
// the geodesic metres used by gameplay. Convert once to keep the trail tip aligned.
import {ROUTE,SEGMENTS} from './engine.ts';
const mercator=(p:[number,number])=>[p[0]*Math.PI/180,Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))];
const projected=ROUTE.map(mercator);
const projectedLengths=projected.slice(1).map((p,i)=>Math.hypot(p[0]-projected[i][0],p[1]-projected[i][1]));
const projectedTotal=projectedLengths.reduce((a,b)=>a+b,0);
export function trimFraction(meters:number){let remaining=Math.max(0,Math.min(TOTAL,meters)),sum=0;for(let i=0;i<SEGMENTS.length;i++){const covered=Math.min(remaining,SEGMENTS[i]);sum+=projectedLengths[i]*covered/SEGMENTS[i];remaining-=covered;if(remaining<=0)break;}return Math.min(1,sum/projectedTotal);}
