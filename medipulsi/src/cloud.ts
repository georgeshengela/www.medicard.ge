import type {Journey,Fix} from './journey';
import type {Mission,MissionBook} from './missions';
import {MISSIONS} from './missions';
import {bridge,native,embedded} from './bridge';
export type Claim={id:string;giftId:string;status:string;code:string;reward:{title:string;description:string;kind:string};createdAt:string};
export type Snapshot={userId:string;state:{journey:Journey;book:MissionBook};settings:Record<string,any>;handle:string;leaderboardOptIn:boolean;revision:number;session:null|{id:string;phase:string;seq:number};history:Array<{id:string;startedAt:string;meters:number;seconds:number;steps:number;newMeters:number}>;claims:Claim[];missions:Mission[];config:{enabled:boolean;giftsEnabled:boolean;leaderboardEnabled:boolean;message:string};mapboxToken?:string};
type Operation={path:string;method:string;body?:unknown};
export type Signal={signal:boolean;revealed:boolean;quality:boolean;period:number;distance:number;gift:null|{id:string;title:string;description:string;rewardKind:string;position:[number,number]}};
export const EMPTY_SIGNAL:Signal={signal:false,revealed:false,quality:false,period:2200,distance:0,gift:null};
let token=sessionStorage.getItem('medipulsi.web.token')||'',account='',queue:Operation[]=[],pendingFixes:Fix[]=[],sessionId:string|null=null,seq=0,chain:Promise<void>|null=null;
export let currentSnapshot:Snapshot;
export let currentSignal=EMPTY_SIGNAL;
let syncText='ანგარიშთან დაკავშირებულია';
let recoveryNotice='';
const emit=()=>window.dispatchEvent(new CustomEvent('medipulsi:sync',{detail:{text:syncText,pending:queue.length,signal:currentSignal}}));
export function storageKey(key:string){return `medipulsi:${account}:${key}`;}
function persistQueue(){try{localStorage.setItem(storageKey('outbox'),JSON.stringify({queue,pendingFixes,sessionId,seq}));}catch{syncText='მოწყობილობის საცავი სავსეა · აღადგინე ინტერნეტი შესანახად';emit();}}
export function setToken(next:string){token=next;sessionStorage.setItem('medipulsi.web.token',next);}
export function logout(){sessionStorage.removeItem('medipulsi.web.token');location.reload();}
export async function api<T=any>(path:string,method='GET',body?:unknown):Promise<T>{
 if(!/^\/(bootstrap|settings|mission|sessions(?:\/[a-zA-Z0-9_-]+(?:\/batches|\/pause|\/resume|\/finish)?)?|nearby|gifts\/[a-zA-Z0-9_-]+\/claim|leaderboard(?:\?period=(?:week|season))?)$/.test(path))throw new Error('მოთხოვნის მისამართი არასწორია.');
 if(native||embedded)return bridge<T>('api',{path,method,body});
 const res=await fetch('/api/medipulsi'+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error||'სერვერთან კავშირი ვერ მოხერხდა.'),{status:res.status,code:data.code});return data;
}
export async function init():Promise<Snapshot>{
 const s=await api<Snapshot>('/bootstrap');account=s.userId;currentSnapshot=s;MISSIONS.splice(0,MISSIONS.length,...s.missions);
 try{const saved=JSON.parse(localStorage.getItem(storageKey('outbox'))||'null');if(saved&&Array.isArray(saved.queue)){queue=saved.queue;pendingFixes=saved.pendingFixes||[];sessionId=saved.sessionId;seq=saved.seq||0;}}catch{/* Fresh cache; server remains authoritative. */}
 if(!queue.length&&!pendingFixes.length){sessionId=s.session?.id||null;seq=s.session?.seq||0;}
 // Flush a previous foreground walk before reconciling. Never join its last fix to a new walk.
 seal();await flush();if(sessionId){await api(`/sessions/${sessionId}/pause`,'POST');}
 currentSnapshot=await api<Snapshot>('/bootstrap');sessionId=currentSnapshot.session?.id||null;seq=currentSnapshot.session?.seq||0;
 try{localStorage.setItem(storageKey('pulse-journey-v3-gps'),JSON.stringify(currentSnapshot.state.journey));}catch{syncText='მოწყობილობის საცავი სავსეა · სერვერის პროგრესი შენარჩუნებულია';}
 persistQueue();return currentSnapshot;
}
async function recoverConflict(error:Error){
 // Keep the rejected samples locally for diagnosis; never silently replay them
 // into a different walk or award distance from competing device sequences.
 const archivedAt=Date.now();
 localStorage.setItem(storageKey(`sync-conflict-${archivedAt}`),JSON.stringify({archivedAt,reason:error.message,queue,pendingFixes,sessionId,seq}));
 queue=[];pendingFixes=[];sessionId=null;seq=0;persistQueue();
 recoveryNotice='სესია სხვა მოწყობილობაზე შეიცვალა. შეუთანხმებელი ჩანაწერი ამ მოწყობილობაზე დარჩა; გააგრძელე ერთი მოწყობილობიდან.';
 syncText=recoveryNotice;currentSignal=EMPTY_SIGNAL;emit();
 window.dispatchEvent(new CustomEvent('medipulsi:conflict',{detail:recoveryNotice}));
 currentSnapshot=await api<Snapshot>('/bootstrap');
}
function seal(){if(!pendingFixes.length||!sessionId)return;for(let i=0;i<pendingFixes.length;i+=60)queue.push({path:`/sessions/${sessionId}/batches`,method:'POST',body:{id:crypto.randomUUID(),seq:++seq,fixes:pendingFixes.slice(i,i+60)}});pendingFixes=[];persistQueue();}
export function flush(){
 if(chain)return chain;
 chain=(async()=>{while(queue.length){const op=queue[0];try{const result=await api(op.path,op.method,op.body);if(result?.userId===account&&result.state)currentSnapshot=result;queue.shift();persistQueue();}catch(error){const status=(error as {status?:number}).status;if(status===409||status===404){await recoverConflict(error as Error);break;}syncText=(error as Error).message+' · ჩანაწერი მოწყობილობაზე შენახულია';emit();throw error;}}syncText=recoveryNotice||'ანგარიშში შენახულია';emit();})().finally(()=>{chain=null;});return chain;
}
export async function begin(){
 seal();await flush();recoveryNotice='';const latest=await api<Snapshot>('/bootstrap');
 if(latest.session){sessionId=latest.session.id;seq=latest.session.seq;currentSnapshot=await api(`/sessions/${sessionId}/resume`,'POST');}
 else{const proposed=crypto.randomUUID();currentSnapshot=await api('/sessions','POST',{id:proposed});sessionId=currentSnapshot.session!.id;seq=0;}
 persistQueue();return currentSnapshot;
}
export function recordFix(fix:Fix){if(!sessionId)return;pendingFixes.push(fix);persistQueue();syncText='ინახება…';if(pendingFixes.length>=5){seal();void flush().catch(()=>{});}emit();}
export function stop(action:'pause'|'finish'='pause'){
 seal();if(sessionId){queue.push({path:`/sessions/${sessionId}/${action}`,method:'POST'});if(action==='finish')sessionId=null;persistQueue();}currentSignal=EMPTY_SIGNAL;emit();void flush().catch(()=>{});
}
export async function refreshSignal(){if(!sessionId){currentSignal=EMPTY_SIGNAL;return currentSignal;}try{currentSignal=await api('/nearby');}catch{currentSignal=EMPTY_SIGNAL;}emit();return currentSignal;}
export async function chooseMission(id:string|null){seal();await flush();currentSnapshot=await api('/mission','PUT',{id});}
export async function saveSettings(settings:Record<string,unknown>){currentSnapshot=await api('/settings','PATCH',settings);return currentSnapshot;}
export async function claimGift(id:string){seal();await flush();const claim=await api<Claim>(`/gifts/${id}/claim`,'POST');currentSnapshot={...currentSnapshot,claims:[claim,...currentSnapshot.claims.filter(c=>c.id!==claim.id)]};currentSignal=EMPTY_SIGNAL;emit();return claim;}
window.addEventListener('online',()=>{seal();void flush().catch(()=>{});});
window.setInterval(()=>{if(pendingFixes.length)seal();if(queue.length)void flush().catch(()=>{});},5000);
