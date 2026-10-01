import test from 'node:test';
import assert from 'node:assert/strict';
import {paintedCells,groupByTile,insideGeometry,geometryAreaKm2,cellCenter,CELL_KM2,PAINT_RADIUS_M} from './territoryMath.js';

const east=(lng,lat,m)=>[lng+m/(111320*Math.cos(lat*Math.PI/180)),lat];
test('a straight 1 km walk paints a ~100 m wide strip, and walking it twice adds nothing',()=>{
 const a=[44.75,41.71],line=Array.from({length:21},(_,i)=>east(...a,i*50)),back=[...line].reverse();
 const once=paintedCells({trail:[line]}).size*CELL_KM2;
 const strip=(1000*2*PAINT_RADIUS_M+Math.PI*PAINT_RADIUS_M**2)/1e6;
 assert.ok(Math.abs(once-strip)/strip<.05,`${once} vs ${strip}`);
 assert.equal(paintedCells({trail:[line,back]}).size*CELL_KM2,once);
});
test('a GPS gap never paints a straight shortcut across the city',()=>{
 const a=[44.75,41.71],far=east(...a,3000);
 const area=paintedCells({trail:[[a,far]]}).size*CELL_KM2;
 assert.ok(area<.02,`only the two ends are painted (${area})`);
});
test('cells group into tiles and polygon tests respect holes; spherical area is right',()=>{
 const cells=paintedCells({trail:[[[44.75,41.71],east(44.75,41.71,300)]]});
 assert.equal([...groupByTile(cells).values()].reduce((n,l)=>n+l.length,0),cells.size);
 const sq={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]],[[.4,.4],[.6,.4],[.6,.6],[.4,.6],[.4,.4]]]};
 assert.equal(insideGeometry([.2,.2],sq),true);assert.equal(insideGeometry([.5,.5],sq),false);assert.equal(insideGeometry([2,2],sq),false);
 const degree={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]]]};
 assert.ok(Math.abs(geometryAreaKm2(degree)-12364)<60,String(geometryAreaKm2(degree)));
 const c=cellCenter([...cells][0]);assert.ok(Math.abs(c[1]-41.71)<.01);
});
import {cityMap} from './territoryMath.js';
test('city map: dot grid inside the outline, painted squares lit, coarse enough to hide the route',()=>{
 const g={type:'Polygon',coordinates:[[[44.70,41.68],[44.80,41.68],[44.80,41.76],[44.70,41.76],[44.70,41.68]]]};
 const keys=paintedCells({trail:[Array.from({length:21},(_,i)=>east(44.75,41.72,i*50))]});
 const m=cityMap(g,keys);
 assert.ok(m.cols<=64&&m.rows<=64&&m.cellM>=120);
 assert.equal(m.grid.length,m.rows);assert.ok(m.grid.every(r=>r.length===m.cols));
 const lit=m.grid.join('').replace(/[01]/g,'').length;assert.ok(lit>=5&&lit<=20,String(lit));
 assert.ok(m.grid.join('').includes('1'));assert.equal(m.outline.length,1);
});
