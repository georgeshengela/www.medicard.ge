// MEDIRUN "painted territory": the strip of city a person has lit up by walking.
// The map lights buildings within ~55 m of the walked path; the share card counts the same strip,
// measured on a 20 m grid so overlapping walks are never counted twice.
import {EDGE,NODES,interpolate} from './core/journey.js';

export const CELL_M=20,PAINT_RADIUS_M=50,TILE_DEG=0.02;
export const CELL_KM2=CELL_M*CELL_M/1e6;
/** Land area of the Earth (km²), for the playful "of the world" figure. */
export const WORLD_LAND_KM2=148_940_000;
const M_PER_DEG=111_320,RAD=Math.PI/180,SAMPLE_M=10;

const rowLat=iy=>(iy+.5)*CELL_M/M_PER_DEG;
const colScale=iy=>M_PER_DEG*Math.cos(rowLat(iy)*RAD);
export function cellCenter(key){const [iy,ix]=key.split(':').map(Number);return [(ix+.5)*CELL_M/colScale(iy),rowLat(iy)];}
export function tileOf([lng,lat]){return `${Math.floor(lat/TILE_DEG)}:${Math.floor(lng/TILE_DEG)}`;}
export function tileCenter(tile){const [y,x]=tile.split(':').map(Number);return [(x+.5)*TILE_DEG,(y+.5)*TILE_DEG];}

/** Marks every grid cell whose centre lies within the paint radius of the point. */
function stamp(cells,[lng,lat]){
 const iy0=Math.floor(lat*M_PER_DEG/CELL_M),span=Math.ceil(PAINT_RADIUS_M/CELL_M)+1;
 for(let iy=iy0-span;iy<=iy0+span;iy++){
  const cy=rowLat(iy),dy=(cy-lat)*M_PER_DEG;if(Math.abs(dy)>PAINT_RADIUS_M)continue;
  const scale=colScale(iy),ix0=Math.floor(lng*scale/CELL_M);
  for(let ix=ix0-span;ix<=ix0+span;ix++){const dx=((ix+.5)*CELL_M/scale-lng)*scale;if(dx*dx+dy*dy<=PAINT_RADIUS_M*PAINT_RADIUS_M)cells.add(`${iy}:${ix}`);}
 }
}
function metersBetween(a,b){const dx=(b[0]-a[0])*M_PER_DEG*Math.cos((a[1]+b[1])/2*RAD),dy=(b[1]-a[1])*M_PER_DEG;return Math.hypot(dx,dy);}
function paintLine(cells,line){
 for(let i=0;i<line.length;i++){
  const p=line[i];if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1]))continue;
  stamp(cells,p);if(i===0)continue;
  const a=line[i-1],d=metersBetween(a,p);if(!(d>SAMPLE_M)||d>500)continue; // a gap never paints a shortcut
  const n=Math.ceil(d/SAMPLE_M);for(let k=1;k<n;k++)stamp(cells,interpolate(a,p,k/n));
 }
}

/** Every painted cell of a journey: the GPS trail anywhere in the world plus verified park coverage. */
export function paintedCells(journey){
 const cells=new Set();
 for(const line of Array.isArray(journey?.trail)?journey.trail:[])if(Array.isArray(line))paintLine(cells,line);
 for(const [id,ranges] of Object.entries(journey?.covered||{})){const e=EDGE.get(id);if(!e||!Array.isArray(ranges))continue;for(const [from,to] of ranges)paintLine(cells,[interpolate(NODES[e.a],NODES[e.b],from),interpolate(NODES[e.a],NODES[e.b],to)]);}
 return cells;
}

export function groupByTile(cells){const tiles=new Map();for(const key of cells){const tile=tileOf(cellCenter(key));let list=tiles.get(tile);if(!list)tiles.set(tile,list=[]);list.push(key);}return tiles;}

/** GeoJSON Polygon / MultiPolygon → list of polygons (each a list of rings). */
export function polygonsOf(geometry){if(geometry?.type==='Polygon')return [geometry.coordinates];if(geometry?.type==='MultiPolygon')return geometry.coordinates;return [];}
function inRing([x,y],ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;}
export function insideGeometry(p,geometry){return polygonsOf(geometry).some(rings=>rings.length&&inRing(p,rings[0])&&!rings.slice(1).some(h=>inRing(p,h)));}
export function geometryBbox(geometry){let b=[Infinity,Infinity,-Infinity,-Infinity];for(const rings of polygonsOf(geometry))for(const [x,y] of rings[0]||[])b=[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)];return b;}
/** Spherical area of a GeoJSON polygon geometry, km². */
export function geometryAreaKm2(geometry){
 const R=6371.0088;const ring=pts=>{let s=0;for(let i=0;i<pts.length;i++){const [x1,y1]=pts[i],[x2,y2]=pts[(i+1)%pts.length];s+=(x2-x1)*RAD*(2+Math.sin(y1*RAD)+Math.sin(y2*RAD));}return Math.abs(s*R*R/2);};
 return polygonsOf(geometry).reduce((sum,rings)=>sum+(rings.length?ring(rings[0])-rings.slice(1).reduce((h,r)=>h+ring(r),0):0),0);
}

function simplify(points,tolerance){
 if(points.length<=3)return points;
 const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
 const stack=[[0,points.length-1]];
 while(stack.length){
  const [a,b]=stack.pop();let best=-1,index=-1;const [x1,y1]=points[a],[x2,y2]=points[b],dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1;
  for(let i=a+1;i<b;i++){const d=Math.abs(dy*points[i][0]-dx*points[i][1]+x2*y1-y2*x1)/len;if(d>best){best=d;index=i;}}
  if(best>tolerance){keep[index]=1;stack.push([a,index],[index,b]);}
 }
 return points.filter((_,i)=>keep[i]);
}

/** Minimal city map for the share card: a dot grid inside the outline, painted squares lit by how much of each is painted.
 * Squares are ≥120 m, so the card shows neighbourhoods, never the exact route. */
export function cityMap(geometry,keys,{maxCells=64,minCellM=120}={}){
 const [minX,minY,maxX,maxY]=geometryBbox(geometry);if(!Number.isFinite(minX))return null;
 const kx=Math.cos((minY+maxY)/2*RAD)*M_PER_DEG,widthM=(maxX-minX)*kx,heightM=(maxY-minY)*M_PER_DEG;
 const cell=Math.max(minCellM,Math.max(widthM,heightM)/maxCells),cols=Math.max(1,Math.ceil(widthM/cell)),rows=Math.max(1,Math.ceil(heightM/cell));
 const counts=new Map();
 for(const key of keys){const [x,y]=cellCenter(key),gx=Math.floor((x-minX)*kx/cell),gy=Math.floor((maxY-y)*M_PER_DEG/cell);if(gx<0||gy<0||gx>=cols||gy>=rows)continue;const k=gy*cols+gx;counts.set(k,(counts.get(k)||0)+1);}
 const grid=[];
 for(let gy=0;gy<rows;gy++){let line='';for(let gx=0;gx<cols;gx++){
  const n=counts.get(gy*cols+gx)||0;
  if(n){const share=n*CELL_M*CELL_M/(cell*cell);line+=String(2+Math.min(7,Math.floor(share*14)));continue;}
  line+=insideGeometry([minX+(gx+.5)*cell/kx,maxY-(gy+.5)*cell/M_PER_DEG],geometry)?'1':'0';
 }grid.push(line);}
 const toGrid=([x,y])=>[Math.round((x-minX)*kx/cell*10)/10,Math.round((maxY-y)*M_PER_DEG/cell*10)/10];
 // A closed ring starts and ends on one point: split it at the farthest point so both halves simplify.
 const ring=pts=>{if(pts.length<4)return pts;let far=1,d=-1;for(let i=1;i<pts.length;i++){const e=Math.hypot(pts[i][0]-pts[0][0],pts[i][1]-pts[0][1]);if(e>d){d=e;far=i;}}return [...simplify(pts.slice(0,far+1),.15),...simplify(pts.slice(far),.15).slice(1)];};
 const outline=polygonsOf(geometry).map(r=>r[0]?ring(r[0].map(toGrid)):[]).filter(r=>r.length>=4);
 return {cols,rows,cellM:Math.round(cell),grid,outline};
}
