import test from 'node:test';
import assert from 'node:assert/strict';
import {trimEnds,joinSegments,cityLines,boundsOf,thin,lineLength,metersBetween,buildShareStudioHtml,splitJumps,longestLine,type LngLat} from './shareStudio.ts';

const T:LngLat=[44.7930,41.6970];
const east=(p:LngLat,m:number):LngLat=>[p[0]+m/(111320*Math.cos(p[1]*Math.PI/180)),p[1]];
const line=(from:LngLat,meters:number,step=25)=>Array.from({length:Math.floor(meters/step)+1},(_,i)=>east(from,i*step));

test('privacy zone: 200 m cut at both ends of every line, short walks vanish', () => {
 const [cut]=trimEnds([line(T,1000)],200);
 assert.ok(Math.abs(lineLength(cut)-600)<2,String(lineLength(cut)));
 assert.ok(Math.abs(metersBetween(cut[0],T)-200)<2);
 assert.ok(Math.abs(metersBetween(cut[cut.length-1],east(T,1000))-200)<2);
 assert.deepEqual(trimEnds([line(T,350)],200),[]);
 assert.deepEqual(trimEnds([[T,[NaN,1] as LngLat]],200),[]);
});

test('one walk = one line; the city clip keeps one city', () => {
 assert.equal(joinSegments([line(T,100),line(east(T,300),100)]).length,10);
 const liege:LngLat=[5.5797,50.6326];
 const kept=cityLines([line(T,500),line(east(T,800),500),line(liege,500)]);
 assert.equal(kept.length,2);
 const b=boundsOf(kept)!;
 assert.ok(b[0]>=44.79&&b[2]<44.82);
 assert.equal(boundsOf([]),null);
});

test('thin keeps both ends and the cap', () => {
 const long=line(T,20000,5);
 const t=thin(long,100);
 assert.equal(t.length,100);
 assert.deepEqual(t[0],long[0]);
 assert.deepEqual(t[99],long[long.length-1]);
});

test('the page carries the scene as data only and escapes markup', () => {
 const html=buildShareStudioHtml({token:'pk.test',scene:{kind:'box',coins:40,badge:'</script><b>',place:'📍 ვაკე',kicker:'',title:'',big:'',unit:'',stats:[],link:'medicard.ge/i/ABC234',cta:'x',attribution:'© Mapbox'}});
 assert.ok(!html.includes('</script><b>'));
 assert.ok(html.includes('medicard.ge/i/ABC234'));
 assert.ok(!html.includes('mapbox-gl.js'),'the box clip loads no map');
 const city=buildShareStudioHtml({token:'pk.test',scene:{kind:'walk',line:line(T,600),hero:'f',kicker:'',title:'',big:'2',unit:'km',stats:[],link:'medicard.ge/medirun',cta:'x',attribution:'© Mapbox'}});
 assert.ok(city.includes('mapbox-gl.js')&&city.includes('engine.js'));
 assert.ok(!/[\u2028\u2029]/.test(city));
});

test('GPS jumps split a route; the walk clip keeps the longest unbroken stretch', () => {
 const walk=line(T,600,10),leap=line(east(T,3000),300,10);
 const pieces=splitJumps([[...walk,...leap]]);
 assert.equal(pieces.length,2);
 assert.ok(Math.abs(lineLength(longestLine(pieces))-600)<2);
 // a long downsampled walk (40 m steps) is not mistaken for jumps
 assert.equal(splitJumps([line(T,8000,40)]).length,1);
 // a lone leap between two fixes leaves nothing to draw
 assert.deepEqual(trimEnds([[T,east(T,2500)]],200),[]);
});
