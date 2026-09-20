const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=require('./helpers/loadTs.cjs')();
const {withAuthConnectionRetry}=load('src/lib/authConnection.ts');
const {stackMotion}=load('src/theme/stackMotion.ts');
const immediate=async()=>{};

test('one dropped native connection recovers with exactly one replay',async()=>{
 let count=0;
 const value=await withAuthConnectionRetry(async()=>{if(++count===1)throw new TypeError('Network request failed');return 'signed-in';},new AbortController().signal,immediate);
 assert.equal(value,'signed-in');assert.equal(count,2);
});
test('repeated failure stops after two attempts',async()=>{
 let count=0;
 await assert.rejects(()=>withAuthConnectionRetry(async()=>{count++;throw new TypeError('Network request failed');},new AbortController().signal,immediate));
 assert.equal(count,2);
});
for(const status of [400,401,403,409,422,429,500])test('does not replay HTTP '+status,async()=>{
 let count=0;const error=Object.assign(new Error('Synthetic failure'),{status});
 await assert.rejects(()=>withAuthConnectionRetry(async()=>{count++;throw error;},new AbortController().signal,immediate),e=>e===error);
 assert.equal(count,1);
});
for(const status of [502,503,504])test('gateway '+status+' can recover once',async()=>{
 let count=0;
 assert.equal(await withAuthConnectionRetry(async()=>{if(++count===1)throw Object.assign(new Error('Gateway unavailable'),{status});return 'ok';},new AbortController().signal,immediate),'ok');
 assert.equal(count,2);
});
test('deadline abort during reconnect never starts another request',async()=>{
 let count=0;const controller=new AbortController();
 await assert.rejects(()=>withAuthConnectionRetry(async()=>{count++;throw new TypeError('Dropped');},controller.signal,async()=>controller.abort()),e=>e.name==='AbortError');
 assert.equal(count,1);
});
test('default reconnect wait is abortable with the React Native AbortController shim',async()=>{
 const {AbortController: NativeAbortController}=require('abort-controller');
 const controller=new NativeAbortController();let count=0;
 const pending=withAuthConnectionRetry(async()=>{count++;throw new TypeError('Dropped');},controller.signal);
 setTimeout(()=>controller.abort(),10);
 await assert.rejects(()=>pending,e=>e.name==='AbortError');assert.equal(count,1);
});
test('normal detail navigation keeps platform motion and gesture defaults',()=>{
 assert.equal(stackMotion('detail',false).animation,'default');
 assert.equal(stackMotion('detail',false).gestureEnabled,undefined);
 assert.equal(stackMotion('detail',false).animationDuration,undefined);
});
test('peers and completed tasks have no implied horizontal direction',()=>{
 for(const intent of ['peer','completion'])assert.equal(stackMotion(intent,false).animation,'fade');
});
test('Reduce Motion removes transitions for every intent',()=>{
 for(const intent of ['detail','peer','completion'])assert.equal(stackMotion(intent,true).animation,'none');
});
test('all native navigators use the OS-aware policy, including pet nested stacks',()=>{
 const root=path.resolve(__dirname,'../app');let count=0;
 function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(entry.name==='_layout.tsx'){const text=fs.readFileSync(file,'utf8');assert.match(text,/useStackMotion|usePetStackOptions/,file);assert.doesNotMatch(text,/slide_from_right|STACK_PUSH/,file);count++;}}}
 visit(root);assert.ok(count>=30);
});
