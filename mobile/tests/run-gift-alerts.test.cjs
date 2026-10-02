// MEDIRUN gift alerts with the phone locked: at most one "near" per signal episode and one "here" per gift.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const file=path.resolve(__dirname,'../src/lib/run/giftAlerts.ts');
function load(appState='background'){const app={currentState:appState};const mocks={'react-native':{AppState:app,Platform:{OS:'ios'}},'@/i18n/locale':{tx:(ka)=>ka}};const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInThisContext('(function(require,module,exports){'+code+'\n})')((id)=>mocks[id]||require(id),module,module.exports);return {...module.exports,app};}
const near={signal:true,revealed:false,quality:true,period:1200,distance:0,gift:null};
const here={signal:true,revealed:true,quality:true,period:700,distance:6,gift:{id:'glow-1',title:'',description:'',rewardKind:'DIGITAL',position:[44.8,41.7]}};
const none={signal:false,revealed:false,quality:true,period:2200,distance:0,gift:null};
test('one near per episode, one here per gift, a new episode only after 10 quiet minutes',()=>{const {createGiftAlertState}=load();const s=createGiftAlertState();let t=1e6;
 assert.equal(s.decide(near,t),'near');assert.equal(s.decide(near,t+=20e3),null,'same episode stays quiet');
 assert.equal(s.decide(here,t+=20e3),'here');assert.equal(s.decide(here,t+=20e3),null,'once per gift');
 assert.equal(s.decide(none,t+=20e3),null);assert.equal(s.decide(near,t+=60e3),null,'back within 10 min: quiet');
 assert.equal(s.decide(none,t+=20e3),null);assert.equal(s.decide(near,t+=11*60e3),'near','a new find later is announced');
 assert.equal(s.decide({...near,quality:false},t+=20e3),null,'no alert on poor GPS');});
test('on screen nothing is sent, and locking mid-signal does not re-announce it',async()=>{const m=load('active');const sent=[];m.onGiftSignal(near,async k=>{sent.push(k);});assert.deepEqual(sent,[]);m.app.currentState='background';m.onGiftSignal(near,async k=>{sent.push(k);});assert.deepEqual(sent,[]);m.onGiftSignal(here,async k=>{sent.push(k);});assert.deepEqual(sent,['here']);});
test('a new session starts clean',()=>{const m=load();const sent=[];m.onGiftSignal(near,async k=>{sent.push(k);});m.resetGiftAlerts();m.onGiftSignal(near,async k=>{sent.push(k);});assert.deepEqual(sent,['near','near']);});
