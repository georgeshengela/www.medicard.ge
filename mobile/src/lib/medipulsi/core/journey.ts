// Generated from medipulsi/src by build-core.mjs.
import data from './data/vake-network.json';
import {distance} from './engine';
import type {Coordinate} from './engine';
import {appendTrail,loadTrail} from './trail';
import type {WalkingTrail} from './trail';
export type Source='demo'|'gps';
export type Interval=[number,number];
export type Edge={id:string;a:string;b:string;way:string;kind:string;park:boolean;playable:boolean;name:string;length:number};
export const NODES:Record<string,Coordinate>=Object.fromEntries(Object.entries(data.nodes).map(([id,p])=>[id,[p[0],p[1]] as Coordinate]));
export const EDGES:Edge[]=data.edges.map(e=>({...e,length:distance(NODES[e.a],NODES[e.b])}));
export const EDGE=new Map(EDGES.map(e=>[e.id,e]));
export const PLAYABLE=EDGES.filter(e=>e.playable);
export const PARK=data.park as Coordinate[],DISTRICT=data.district as Coordinate[];
export const NETWORK_VERSION=data.version;
export const PARK_METERS=PLAYABLE.reduce((s,e)=>s+e.length,0);
export function polygonArea(ring:Coordinate[]){const scaleX=111195*Math.cos(41.71*Math.PI/180),scaleY=111195;let area=0;for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];area+=(a[0]-44.75)*scaleX*(b[1]-41.71)*scaleY-(b[0]-44.75)*scaleX*(a[1]-41.71)*scaleY;}return Math.abs(area/2);}
export const PARK_AREA=polygonArea(PARK),DISTRICT_AREA=polygonArea(DISTRICT),PARK_SHARE=PARK_AREA/DISTRICT_AREA*100;
export function inside(p:Coordinate,ring:Coordinate[]){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
export function interpolate(a:Coordinate,b:Coordinate,t:number):Coordinate{return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
export function heading(a:Coordinate,b:Coordinate){return (Math.atan2((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1])*180/Math.PI+360)%360;}
export function nearestNode(p:Coordinate){let best=PLAYABLE[0].a,d=Infinity;for(const e of PLAYABLE){for(const id of [e.a,e.b]){const n=distance(p,NODES[id]);if(n<d){best=id;d=n;}}}return best;}
export const START=nearestNode([44.7529,41.71135]);
export const GIFT_NODE=nearestNode([44.7511,41.7103]);
export const SPAWNS=[{id:START,name:'მთავარი შესასვლელი'},{id:nearestNode([44.7506,41.7093]),name:'ცენტრალური ბილიკი'},{id:nearestNode([44.7482,41.7101]),name:'დასავლეთის ბილიკი'}];
export const GIFTS=[GIFT_NODE,nearestNode([44.7497,41.7104]),nearestNode([44.7521,41.7108])];
const adjacency=new Map<string,Edge[]>();for(const e of EDGES){for(const n of [e.a,e.b]){if(!adjacency.has(n))adjacency.set(n,[]);adjacency.get(n)!.push(e);}}
const other=(e:Edge,n:string)=>e.a===n?e.b:e.a;
export function shortestPath(start:string,end:string,parkOnly=true,max=Infinity):{edges:string[];length:number}|null{
 if(start===end)return {edges:[],length:0};const costs=new Map([[start,0]]),previous=new Map<string,{node:string;edge:string}>(),open=new Set([start]);
 while(open.size){let current='',best=Infinity;for(const n of open){const c=costs.get(n)!;if(c<best){best=c;current=n;}}if(best>max||!current)return null;open.delete(current);if(current===end){const path:string[]=[];let n=end;while(n!==start){const p=previous.get(n)!;path.unshift(p.edge);n=p.node;}return {edges:path,length:best};}
  for(const e of adjacency.get(current)||[]){if(parkOnly&&!e.playable)continue;const n=other(e,current),next=best+e.length;if(next<(costs.get(n)??Infinity)){costs.set(n,next);previous.set(n,{node:current,edge:e.id});open.add(n);}}
 }return null;
}
export function mergeIntervals(intervals:Interval[],range:Interval):Interval[]{const sorted=[...intervals,[Math.min(...range),Math.max(...range)] as Interval].sort((a,b)=>a[0]-b[0]),out:Interval[]=[];for(const r of sorted){const last=out.at(-1);if(last&&r[0]<=last[1]+.000001)last[1]=Math.max(last[1],r[1]);else out.push([...r]);}return out;}
export function coveredLength(covered:Record<string,Interval[]>,parkOnly=true){let total=0;for(const [id,ranges] of Object.entries(covered)){const e=EDGE.get(id);if(e&&(!parkOnly||e.playable))total+=ranges.reduce((s,r)=>s+(r[1]-r[0])*e.length,0);}return total;}
export function parkProgress(s:Journey){const unique=coveredLength(s.covered);return {unique,percent:Math.min(100,unique/PARK_METERS*100),complete:unique/PARK_METERS>=.85};}
export type Cursor={edge:string;from:string;offset:number};
export type Journey={version:3;network:string;source:Source;position:Coordinate;heading:number;meters:number;seconds:number;movingSeconds:number;steps:number;speed:number;maxSpeed:number;sessionStartCoverage:number;covered:Record<string,Interval[]>;trail?:WalkingTrail;claimed:boolean;cursor:Cursor|null;queue:string[];seed:number;accuracy:number;lastFix:number|null;lastRaw:Coordinate|null;match:{edge:string;t:number}|null;rejected:number;status:string;startedAt:string;completedAt:string|null;pauseReason?:'manual'|'background'|'reload'|'gps'|null;pausedAt?:string|null};
export function createJourney(source:Source='demo',spawn=START):Journey{return {version:3,network:NETWORK_VERSION,source,position:[...NODES[spawn]],heading:200,meters:0,seconds:0,movingSeconds:0,steps:0,speed:0,maxSpeed:0,sessionStartCoverage:0,covered:{},trail:[],claimed:false,cursor:null,queue:[],seed:7,accuracy:source==='demo'?6:999,lastFix:null,lastRaw:null,match:null,rejected:0,status:source==='demo'?'ready':'waiting',startedAt:new Date().toISOString(),completedAt:null};}
export type DemoConfig={pace:'walk'|'run';speed:number;rate:number;scenario:'explore'|'gift'|'return'|'still';accuracy:number;pulseRadius:number;revealRadius:number;giftIndex:number;autoPause:boolean;stride:number};
export const DEFAULT_CONFIG:DemoConfig={pace:'walk',speed:5,rate:10,scenario:'explore',accuracy:6,pulseRadius:120,revealRadius:18,giftIndex:0,autoPause:true,stride:.72};
export function validConfig(x:Partial<DemoConfig>|null):DemoConfig{const c={...DEFAULT_CONFIG,...x};return {...c,pace:c.pace==='run'?'run':'walk',scenario:['explore','gift','return','still'].includes(c.scenario)?c.scenario:'explore',speed:Math.max(2,Math.min(14,Number(c.speed)||5)),rate:[1,5,10,25].includes(c.rate)?c.rate:10,accuracy:[6,15,40].includes(c.accuracy)?c.accuracy:6,pulseRadius:Math.max(60,Math.min(180,Number(c.pulseRadius)||120)),revealRadius:Math.max(10,Math.min(25,Number(c.revealRadius)||18)),giftIndex:Math.min(GIFTS.length-1,Math.max(0,Math.floor(Number(c.giftIndex)||0))),stride:Math.max(.4,Math.min(1.5,Number(c.stride)||.72)),autoPause:c.autoPause!==false};}
function mark(s:Journey,e:Edge,from:number,to:number){if(Math.abs(to-from)<1e-9)return;s.covered[e.id]=mergeIntervals(s.covered[e.id]||[],[Math.max(0,Math.min(1,from)),Math.max(0,Math.min(1,to))]);}
export function proximity(s:Journey,c:DemoConfig,now=Date.now()){
 const distanceM=distance(s.position,NODES[GIFTS[c.giftIndex]]),quality=s.accuracy<=25&&(s.source==='demo'||(s.lastFix!==null&&now-s.lastFix<15000&&s.status!=='vehicle'));
 const revealed=!s.claimed&&quality&&distanceM+(s.source==='gps'?s.accuracy:0)<=c.revealRadius;
 return {distance:distanceM,signal:!s.claimed&&quality&&distanceM<=c.pulseRadius,revealed,quality,period:Math.round(2200-1500*Math.max(0,1-distanceM/c.pulseRadius))};
}
export function planTo(s:Journey,target:string):Journey{const edge=s.cursor?EDGE.get(s.cursor.edge):null;const start=edge?other(edge,s.cursor!.from):nearestNode(s.position);const plan=shortestPath(start,target);return {...s,queue:plan?.edges||[]};}
function choose(s:Journey,node:string,previous:string|undefined,c:DemoConfig):Edge{
 let selected=s.queue.shift();let e=selected?EDGE.get(selected):undefined;if(e&&(e.a===node||e.b===node)&&e.playable)return e;
 if(c.scenario==='gift'||c.scenario==='return'){const target=c.scenario==='gift'?GIFTS[c.giftIndex]:START;const p=shortestPath(node,target);if(p?.edges.length){s.queue=p.edges.slice(1);return EDGE.get(p.edges[0])!;}}
 const choices=(adjacency.get(node)||[]).filter(e=>e.playable);s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;
 const ranked=choices.map(e=>({e,score:(s.covered[e.id]||[]).reduce((n,r)=>n+r[1]-r[0],0)*10+(e.id===previous?20:0)+((s.seed+Number(e.a.slice(-4)))%97)/97})).sort((a,b)=>a.score-b.score);return ranked[0].e;
}
/** Follow OSM edge geometry; accelerated time affects distance, steps and time equally. */
export function advanceDemo(input:Journey,elapsed:number,c:DemoConfig):Journey{
 const dt=Math.max(0,Math.min(.1,Number.isFinite(elapsed)?elapsed:0))*c.rate;
 const s={...input,covered:{...input.covered},queue:[...input.queue],accuracy:c.accuracy,seconds:input.seconds+dt,status:c.accuracy>25?'inaccurate':'tracking'};
 if(c.scenario==='still'){s.speed=0;s.status=c.accuracy>25?'inaccurate':'stationary';return s;}
 let budget=c.speed/3.6*dt,travelled=0,guard=0;
 while(budget>1e-7&&guard++<30){
  if(!s.cursor){const node=nearestNode(s.position),e=choose(s,node,undefined,c);s.cursor={edge:e.id,from:node,offset:0};}
  const cursor={...s.cursor},e=EDGE.get(cursor.edge)!;const amount=Math.min(budget,e.length-cursor.offset),next=cursor.offset+amount;const forward=cursor.from===e.a;
  if(c.accuracy<=25)mark(s,e,forward?cursor.offset/e.length:1-cursor.offset/e.length,forward?next/e.length:1-next/e.length);
  s.position=interpolate(NODES[cursor.from],NODES[other(e,cursor.from)],next/e.length);s.heading=heading(NODES[cursor.from],NODES[other(e,cursor.from)]);travelled+=amount;budget-=amount;
  if(next>=e.length-1e-7){const node=other(e,cursor.from),n=choose(s,node,e.id,c);s.cursor={edge:n.id,from:node,offset:0};}else s.cursor={...cursor,offset:next};
 }
 s.speed=c.accuracy<=25?c.speed:0;if(c.accuracy<=25){s.meters+=travelled;s.movingSeconds+=dt;s.steps+=travelled/c.stride;s.maxSpeed=Math.max(s.maxSpeed,c.speed);}
 if(!s.completedAt&&parkProgress(s).complete)s.completedAt=new Date().toISOString();return s;
}
export function nearestEdge(p:Coordinate){let best:{edge:Edge;t:number;point:Coordinate;distance:number}|null=null;const sx=Math.cos(p[1]*Math.PI/180);for(const e of EDGES){const a=NODES[e.a],b=NODES[e.b],dx=(b[0]-a[0])*sx,dy=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*sx*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));const point=interpolate(a,b,t),d=distance(p,point);if(!best||d<best.distance)best={edge:e,t,point,distance:d};}return best!;}
export type Fix={position:Coordinate;accuracy:number;timestamp:number;speed:number|null};
/** Only quality, fresh, plausible fixes count. A gap never paints a shortcut. */
export function acceptFix(input:Journey,fix:Fix,stride=.72,now=Date.now()):Journey{
 if(!fix.position.every(Number.isFinite)||Math.abs(fix.position[0])>180||Math.abs(fix.position[1])>90||!Number.isFinite(fix.accuracy)||fix.accuracy<0||!Number.isFinite(fix.timestamp)||fix.timestamp>now+5000||fix.timestamp<now-15000||(input.lastFix!==null&&fix.timestamp<=input.lastFix))return {...input,speed:0,rejected:input.rejected+1,status:'invalid'};
 if(fix.accuracy>25)return {...input,accuracy:fix.accuracy,speed:0,rejected:input.rejected+1,status:'inaccurate'};
 const match=nearestEdge(fix.position),onPath=match.distance<=Math.min(18,Math.max(8,fix.accuracy));
 const base={...input,covered:{...input.covered},accuracy:fix.accuracy,status:onPath?'tracking':'off-path'};
 if(!input.lastRaw||input.lastFix===null||fix.timestamp-input.lastFix>15000){return {...base,position:onPath?match.point:fix.position,lastRaw:fix.position,lastFix:fix.timestamp,match:onPath?{edge:match.edge.id,t:match.t}:null,speed:0};}
 const seconds=(fix.timestamp-input.lastFix)/1000,rawDistance=distance(input.lastRaw,fix.position),speed=rawDistance/seconds;
 if(speed>7||(fix.speed!==null&&fix.speed>7))return {...base,lastFix:fix.timestamp,lastRaw:fix.position,match:null,speed:0,rejected:input.rejected+1,status:'vehicle'};
 if(rawDistance<Math.max(2,Math.min(6,fix.accuracy*.25)))return {...base,speed:0,status:'stationary'};
 let meters=rawDistance;const s={...base,position:onPath?match.point:fix.position,heading:heading(input.position,onPath?match.point:fix.position),lastFix:fix.timestamp,lastRaw:fix.position,match:onPath?{edge:match.edge.id,t:match.t}:null};
 if(onPath&&input.match){const old=EDGE.get(input.match.edge)!;
  if(old.id===match.edge.id){meters=Math.abs(input.match.t-match.t)*old.length;mark(s,old,input.match.t,match.t);}
  else{let best:{length:number;path:string[];from:string;to:string}|null=null;for(const from of [old.a,old.b])for(const to of [match.edge.a,match.edge.b]){const partA=(from===old.a?input.match.t:1-input.match.t)*old.length,partB=(to===match.edge.a?match.t:1-match.t)*match.edge.length;const path=shortestPath(from,to,false,seconds*7+25);if(path){const length=path.length+partA+partB;if(!best||length<best.length)best={length,path:path.edges,from,to};}}
   if(best&&best.length<=seconds*7&&best.length<=rawDistance*2+15){meters=best.length;mark(s,old,input.match.t,best.from===old.a?0:1);for(const id of best.path)mark(s,EDGE.get(id)!,0,1);mark(s,match.edge,best.to===match.edge.a?0:1,match.t);}
  }
 }
 // Outside the imported network, retain the accepted GPS trace without awarding road coverage.
 if(!onPath&&!input.match&&input.accuracy<=25&&['tracking','off-path','stationary'].includes(input.status)&&input.lastRaw)s.trail=appendTrail(input.trail||[],input.lastRaw,fix.position);
 s.meters+=meters;s.steps+=meters/stride;s.movingSeconds+=seconds;s.speed=meters/seconds*3.6;s.maxSpeed=Math.max(s.maxSpeed,s.speed);if(!s.completedAt&&parkProgress(s).complete)s.completedAt=new Date().toISOString();return s;
}
export function loadJourney(raw:string|null,source:Source):Journey{
 const fresh=createJourney(source);try{const d=JSON.parse(raw||'null');if(d?.version!==3||d.network!==NETWORK_VERSION||d.source!==source)return fresh;
 const validPoint=Array.isArray(d.position)&&d.position.length===2&&d.position.every(Number.isFinite)&&Math.abs(d.position[0])<=180&&Math.abs(d.position[1])<=90;
 if(!validPoint)return fresh;const covered:Journey['covered']={};for(const [id,list] of Object.entries(d.covered||{})){if(!EDGE.has(id)||!Array.isArray(list))continue;let out:Interval[]=[];for(const r of list){if(Array.isArray(r)&&r.length===2&&r.every(Number.isFinite)&&r[0]>=0&&r[1]<=1&&r[1]>=r[0])out=mergeIntervals(out,r as Interval);}if(out.length)covered[id]=out;}
 const nonnegative=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,v):0;
 const edge=EDGE.get(d.cursor?.edge),cursor=edge&&[edge.a,edge.b].includes(d.cursor.from)&&Number.isFinite(d.cursor.offset)&&d.cursor.offset>=0&&d.cursor.offset<=edge.length?d.cursor:null;
 return {...fresh,position:d.position,heading:nonnegative(d.heading)%360,meters:nonnegative(d.meters),seconds:nonnegative(d.seconds),movingSeconds:Math.min(nonnegative(d.movingSeconds),nonnegative(d.seconds)),steps:nonnegative(d.steps),maxSpeed:nonnegative(d.maxSpeed),sessionStartCoverage:Math.min(nonnegative(d.sessionStartCoverage),coveredLength(covered)),covered,trail:source==='gps'?loadTrail(d.trail):[],claimed:d.claimed===true,cursor,seed:nonnegative(d.seed)||7,completedAt:typeof d.completedAt==='string'?d.completedAt:null,startedAt:typeof d.startedAt==='string'?d.startedAt:fresh.startedAt};
 }catch{return fresh;}
}
export function coverageFeatures(s:Journey){const features=[];for(const [id,ranges] of Object.entries(s.covered)){const e=EDGE.get(id);if(!e)continue;for(const [a,b] of ranges){features.push({type:'Feature' as const,properties:{},geometry:{type:'LineString' as const,coordinates:[interpolate(NODES[e.a],NODES[e.b],a),interpolate(NODES[e.a],NODES[e.b],b)]}});}}return {type:'FeatureCollection' as const,features};}
