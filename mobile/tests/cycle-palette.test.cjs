const {test}=require('node:test'),assert=require('node:assert/strict');
const load=require('./helpers/loadTs.cjs')();
const {cycleLight,cycleDark}=load('src/theme/cyclePalette.ts');
const {pregnancyIllustrationWeek}=load('src/lib/pregnancyIllustrationStages.ts');
function rgb(hex){return hex.slice(1).match(/../g).map(v=>parseInt(v,16));}
function luminance(rgb){return rgb.map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[0.2126,0.7152,0.0722][i],0);}
function ratio(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
function contrast(a,b,min,label){const value=ratio(rgb(a),rgb(b));assert.ok(value>=min,`${label}: ${value.toFixed(2)} < ${min}`);}
for(const [name,c] of Object.entries({light:cycleLight,dark:cycleDark})){
 test(name+' cycle text retains AA contrast on every supported neutral surface',()=>{
  for(const fg of ['ink','muted','mutedSoft','brand','period','fertile'])for(const bg of ['cream','card','cardSoft'])contrast(c[fg],c[bg],4.5,`${fg}/${bg}`);
  for(const [fg,bg] of [['brand','accentSoft'],['period','periodSoft'],['fertile','fertilitySoft'],['onPeriod','period'],['onDisabled','disabledFill']])contrast(c[fg],c[bg],4.5,`${fg}/${bg}`);
 });
 test(name+' buttons, glyphs, inputs and keyboard focus meet AA in default/pressed/hover states',()=>{
  for(const bg of ['cta','ctaPressed','ctaHover','fab']){
   contrast(c.onPrimary,c[bg],4.5,`onPrimary/${bg}`);
   // Shared native pressed feedback composites the whole control at 94% opacity.
   for(const surface of ['card','cardSoft']){
    const composite=color=>rgb(color).map((v,i)=>v*.94+rgb(c[surface])[i]*.06);
    assert.ok(ratio(composite(c.onPrimary),composite(c[bg]))>=4.5,`${bg} pressed on ${surface}`);
   }
  }
  for(const fg of ['controlBorder','focus','todayRing','period','fertile','ctaBorder'])for(const bg of ['card','cardSoft','cream'])contrast(c[fg],c[bg],3,`${fg}/${bg}`);
  contrast(c.gaugeProgress,c.gaugeTrack,3,'progress/track');
 });
}
test('art stages never invent an early fetus or display an out-of-catalog/invalid week',()=>{
 for(const n of [NaN,Infinity,-1,0,1,3,4,5,41,42])assert.equal(pregnancyIllustrationWeek(n),null);
 for(let n=6;n<=40;n++){const stage=pregnancyIllustrationWeek(n);assert.ok(stage<=n);assert.ok(stage>=6);}
 for(const [week,stage] of [[6,6],[7,6],[8,8],[11,8],[12,12],[19,16],[24,24],[31,24],[32,32],[38,38],[40,38]])assert.equal(pregnancyIllustrationWeek(week),stage);
});
