import {useSyncExternalStore} from 'react';
import type {Coordinate} from '@/lib/medipulsi/core/engine';

/**
 * „ყუთზე ნადირობა“ (owner 2026-10-08): a place tapped in „სად არის ყუთები“ becomes the walk's destination.
 * The map flies over the zone, shows the way there and comes back to the runner; the walk lights the city as
 * always and inside the zone the pulse takes over. Only the district's ~1 km grid point is known — never a box —
 * so the zone is wide on purpose. Memory only: a cold start forgets it.
 */
export type Hunt={id:string;name:string;center:Coordinate;radiusM:number;endsAt:string|null;route:Coordinate[]|null};

export const HUNT_RADIUS_M=600;

let hunt:Hunt|null=null;
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(l=>l());

export function startHunt(place:{name:string;near:Coordinate;endsAt?:string|null}){
 hunt={id:`${place.name}:${place.near.join(',')}:${Date.now()}`,name:place.name,center:place.near,radiusM:HUNT_RADIUS_M,endsAt:place.endsAt||null,route:null};
 emit();
}
export function setHuntRoute(id:string,route:Coordinate[]|null){
 if(!hunt||hunt.id!==id)return;
 hunt={...hunt,route};
 emit();
}
export function clearHunt(){
 if(!hunt)return;
 hunt=null;
 emit();
}
export const getHunt=()=>hunt;
export function useHunt(){
 return useSyncExternalStore(l=>{listeners.add(l);return()=>listeners.delete(l);},getHunt,getHunt);
}

/**
 * Where the runner is along the way to the zone: metres walked along it, metres left, how far off it they are
 * (local flat projection — fine for a few kilometres). `fraction` trims the walked part off the map line.
 */
export function routeProgress(route:Coordinate[],at:Coordinate){
 const k=Math.cos(at[1]*Math.PI/180)*111_320,M=111_320,xy=(c:Coordinate)=>[c[0]*k,c[1]*M] as const,[px,py]=xy(at);
 let total=0,best=Infinity,bestAt=0;
 for(let i=1;i<route.length;i++){
  const [ax,ay]=xy(route[i-1]),[bx,by]=xy(route[i]),dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);
  const t=len?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(len*len))):0,d=Math.hypot(ax+dx*t-px,ay+dy*t-py);
  if(d<best){best=d;bestAt=total+len*t;}
  total+=len;
 }
 return {offM:Number.isFinite(best)?best:0,doneM:bestAt,leftM:Math.max(0,total-bestAt),totalM:total,fraction:total?bestAt/total:0};
}

/** Compass bearing (0 = north, clockwise) from one point to another. */
export function bearingTo(from:Coordinate,to:Coordinate){
 const r=Math.PI/180,y=Math.sin((to[0]-from[0])*r)*Math.cos(to[1]*r),x=Math.cos(from[1]*r)*Math.sin(to[1]*r)-Math.sin(from[1]*r)*Math.cos(to[1]*r)*Math.cos((to[0]-from[0])*r);
 return (Math.atan2(y,x)/r+360)%360;
}

/**
 * The zone's radius toward a point — the same soft, irregular outline the map draws (mapHtml `blobPoints`), so
 * „ზონაში ხარ“ fires exactly when the runner crosses the wall of light.
 */
export function zoneRadiusAt(center:Coordinate,radiusM:number,at:Coordinate){
 const seed=Math.abs(Math.sin(center[0]*12.9898+center[1]*78.233)*43758.5453),p1=seed%6.283,p2=(seed*7.13)%6.283;
 const a=Math.atan2((at[1]-center[1])*111_195,(at[0]-center[0])*111_195*Math.cos(center[1]*Math.PI/180));
 return radiusM*(1+.09*Math.sin(3*a+p1)+.06*Math.sin(5*a+p2)+.03*Math.sin(8*a+p1*2));
}
