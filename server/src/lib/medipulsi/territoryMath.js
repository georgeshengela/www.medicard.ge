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
