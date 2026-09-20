const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');

// Run the actual provider callbacks with deterministic React state/native boundaries.
// These tests cover ordering and network recovery; they do not emulate native rendering.
function harness(initialToken=null) {
 const slots=[],effects=[];let cursor=0,token=initialToken,postLoginCount=0,loginCount=0,meCount=0,profileCount=0;
 const user={id:'synthetic-user',email:'qa@medicard.test'},profile={completedAt:'2026-09-20T00:00:00Z'};
 const full={user,usage:{remaining:10},stats:{records:5},healthProfile:profile};
 let me=async()=>full,readProfile=async()=>({profile:{...profile}});
 class ApiError extends Error {constructor(message,status,payload={}){super(message);this.status=status;Object.assign(this,payload);}get isUnauthorized(){return this.status===401;}}
 const noop=()=>{},asyncNoop=async()=>{};
 const React={createContext:()=>({Provider:'Provider'}),createElement:(type,props,...children)=>({type,props:{...props,children}}),
  useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
  useRef:init=>{const i=cursor++;if(!(i in slots))slots[i]={current:init};return slots[i];},useEffect:fn=>{effects.push(fn);},useCallback:(fn,deps)=>{const i=cursor++,prev=slots[i];if(!prev||deps.some((d,j)=>!Object.is(d,prev.deps[j]))){slots[i]={fn,deps};}return slots[i].fn;},useMemo:fn=>fn(),useContext:noop};
 const modules={
  react:React,'react-native':{AppState:{addEventListener:()=>({remove:noop})}},
  '@/lib/run/store':{resetRunMemory:noop},'@/i18n/ka':{ka:{auth:{registerNotConfirmed:'Unconfirmed'}}},
  '@/lib/api':{ApiError,api:{auth:{login:async()=>{loginCount++;return {token:'confirmed-token',user,usage:full.usage};},me:async()=>{meCount++;return me();}},healthProfile:{get:async()=>{profileCount++;return readProfile();}}}},
  '@/lib/localAccount':{setLocalAccountId:noop,wipeLegacyUnscopedHealthCaches:asyncNoop},
  '@/lib/onboarding':{needsHealthAssessment:noop,needsProfileSetup:noop,assessmentPhaseComplete:noop},
  '@/lib/sessionSnapshot':{clearSessionSnapshot:asyncNoop,saveSessionSnapshot:asyncNoop,loadSessionSnapshot:async()=>null},
  '@/lib/storage':{getToken:async()=>token,setToken:async value=>{token=value;},clearToken:async()=>{token=null;}},
  '@/lib/safeStartup':{runPostLoginSideEffects:()=>{postLoginCount++;}},'@/lib/authErrorMessage':{authErrorMessage:error=>error.message},
  '@/lib/quest/devFixture':{isQuestDevEnabled:()=>false,isQuestVisualSession:()=>false,setQuestVisualSession:noop},
  '@/lib/healthDataSync':{resetHealthPullCache:noop},'@/lib/quest/socket':{disconnectQuestSocket:noop},'@/lib/accountSync':{resetAccountSync:noop},
  '@/lib/notifications':{unregisterPushFromServer:asyncNoop,cancelAllReminders:asyncNoop},'@/lib/petCareReminders':{onPetCareLogout:asyncNoop},
 };
 const file=path.resolve(__dirname,'../src/store/AuthContext.tsx');
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 const exports={};vm.runInNewContext(source,{exports,require:name=>{if(!(name in modules))throw Error('Unmocked: '+name);return modules[name];},console,setTimeout,clearTimeout},{filename:file});
 const render=()=>{cursor=0;return exports.AuthProvider({children:null}).props.value;};
 render();const startup=effects[0];
 return {render,startup,full,ApiError,setMe:fn=>{me=fn;},setProfile:fn=>{readProfile=fn;},token:()=>token,counters:()=>({postLoginCount,loginCount,meCount,profileCount})};
}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const tick=()=>new Promise(r=>setImmediate(r));

test('does not expose an empty profile or trigger onboarding during successful login',async()=>{
 const h=harness(),pending=deferred();h.setMe(()=>pending.promise);
 const login=h.render().signIn('qa@medicard.test','synthetic');await tick();
 assert.equal(h.render().user,null);assert.equal(h.counters().postLoginCount,0);
 pending.resolve(h.full);await login;
 assert.equal(h.render().user.id,h.full.user.id);assert.equal(h.render().healthProfile,h.full.healthProfile);
 assert.equal(h.counters().postLoginCount,1);
});
test('login profile connection failure retains the token and retry needs no new password',async()=>{
 const h=harness();h.setMe(async()=>{throw new h.ApiError('Network unavailable',0);});
 await h.render().signIn('qa@medicard.test','synthetic');
 assert.equal(h.render().user,null);assert.equal(h.render().sessionRestoreError,'Network unavailable');assert.equal(h.token(),'confirmed-token');
 h.setMe(async()=>h.full);await h.render().refresh();
 assert.equal(h.render().user.id,h.full.user.id);assert.equal(h.render().sessionRestoreError,null);assert.equal(h.counters().loginCount,1);
});
test('cold-start outage keeps the session for retry instead of showing logged-out state',async()=>{
 const h=harness('saved-token');h.setMe(async()=>{throw new h.ApiError('Gateway unavailable',503);});
 h.startup();await tick();await tick();
 assert.equal(h.render().ready,true);assert.equal(h.token(),'saved-token');assert.equal(h.render().sessionRestoreError,'Gateway unavailable');
});
test('expired tokens are cleared and cannot recover without signing in',async()=>{
 const h=harness('expired-token');h.setMe(async()=>{throw new h.ApiError('Expired',401);});await h.render().refresh();
 assert.equal(h.token(),null);assert.equal(h.render().user,null);assert.equal(h.render().sessionRestoreError,null);
});
test('blocked account is not treated as a temporary connection failure',async()=>{
 const h=harness('blocked-token');h.setMe(async()=>{throw new h.ApiError('Blocked',403,{code:'ACCOUNT_BLOCKED'});});await h.render().refresh();
 assert.equal(h.token(),null);assert.equal(h.render().sessionRestoreError,null);
});
test('rapid retry cannot start concurrent session restoration requests',async()=>{
 const h=harness('saved-token'),pending=deferred();h.setMe(()=>pending.promise);
 const a=h.render().refresh(),b=h.render().refresh();assert.equal(a,b);await tick();assert.equal(h.counters().meCount,1);
 pending.resolve(h.full);await Promise.all([a,b]);assert.equal(h.render().restoringSession,false);
});
test('a late successful response cannot log the user back in after signing out',async()=>{
 const h=harness('saved-token'),pending=deferred();h.setMe(()=>pending.promise);
 const restore=h.render().refresh();await tick();await h.render().signOut();pending.resolve(h.full);await restore;
 assert.equal(h.token(),null);assert.equal(h.render().user,null);assert.equal(h.counters().postLoginCount,0);
});

test('assessment effect does not refetch on every profile response',async()=>{
 const h=harness('saved-token');let previous;
 // Assessment depends on this callback. Re-render after each fresh API object.
 for(let commit=0;commit<6;commit++){
  const refresh=h.render().refreshHealthProfile;
  if(refresh!==previous){previous=refresh;await refresh();}
 }
 assert.equal(h.counters().profileCount,1,'profile updates must not restart the assessment loading effect');
 assert.ok(h.render().healthProfile.completedAt);
 await h.render().refreshHealthProfile();
 assert.equal(h.counters().profileCount,2,'an explicit later refresh still fetches current data');
});

test('a late health profile cannot repopulate state after logout',async()=>{
 const h=harness('saved-token'),pending=deferred();h.setProfile(()=>pending.promise);
 const read=h.render().refreshHealthProfile();await tick();await h.render().signOut();
 pending.resolve({profile:h.full.healthProfile});await read;
 assert.equal(h.render().healthProfile,null);
});
