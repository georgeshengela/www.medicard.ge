import {acceptFix,createJourney,loadJourney} from './core/journey';
import {advanceMission,emptyBook} from './core/missions';
import {pauseJourney,resetSession} from './core/session';
import {EMPTY_SIGNAL} from './types';
import {normalizePulseFix,repairRejectedBatch} from './fixNormalization';
import type {Snapshot,PulseFix,GiftSignal,PulseSettings,Claim} from './types';

type Operation={path:string;body?:unknown};
export type SessionAdapter={request:<T>(path:string,method?:string,body?:unknown)=>Promise<T>;read:()=>Promise<string|null>;write:(value:string)=>Promise<void>;archive:(value:string)=>Promise<void>;id:()=>string};
export type PulseView={snapshot:Snapshot|null;journey:ReturnType<typeof createJourney>;book:ReturnType<typeof emptyBook>;signal:GiftSignal;loading:boolean;running:boolean;pending:number;message:string;conflict:boolean};

/** One account, one ordered outbox. No browser, location sensor or React dependency. */
export class PulseSessionClient {
 private queue:Operation[]=[];
 private fixes:PulseFix[]=[];
 private sessionId:string|null=null;
 private seq=0;
 private task:Promise<void>|null=null;
 private opening:Promise<void>|null=null;
 private writes:Promise<void>=Promise.resolve();
 private disposed=false;
 private loaded=false;
 private listeners=new Set<()=>void>();
 private view:PulseView={snapshot:null,journey:createJourney('gps'),book:emptyBook(),signal:EMPTY_SIGNAL,loading:false,running:false,pending:0,message:'შენი გზა ყველგან გრძელდება',conflict:false};
 constructor(private adapter:SessionAdapter){}
 getSnapshot=()=>this.view;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private set(patch:Partial<PulseView>){if(this.disposed)return;this.view={...this.view,...patch,pending:this.queue.length+Number(this.fixes.length>0)};this.listeners.forEach(fn=>fn());}
 private persist(){
  const value=JSON.stringify({v:1,queue:this.queue,fixes:this.fixes,sessionId:this.sessionId,seq:this.seq,snapshot:this.view.snapshot,journey:this.view.journey,book:this.view.book});
  this.writes=this.writes.catch(()=>{}).then(()=>this.adapter.write(value));
  void this.writes.catch(()=>this.set({message:'მოწყობილობაზე შენახვა ვერ მოხერხდა. აღადგინე კავშირი.'}));
  return this.writes;
 }
 private apply(snapshot:Snapshot,replaceJourney=false){this.set({snapshot,...(replaceJourney?{journey:pauseJourney(snapshot.state.journey,'reload'),book:snapshot.state.book}:{}),loading:false});}
 async init(){
  if(this.loaded)return;if(this.opening)return this.opening;
  this.opening=(async()=>{
   this.set({loading:true});
   try{
    const raw=await this.adapter.read();if(this.disposed)return;
    if(raw){const saved=JSON.parse(raw);if(saved.v===1&&Array.isArray(saved.queue)&&saved.queue.every((op:Operation)=>/^\/sessions\/[a-zA-Z0-9_-]+\/(batches|pause|finish)$/.test(op.path))){this.queue=saved.queue;this.fixes=saved.fixes||[];this.sessionId=saved.sessionId;this.seq=saved.seq||0;if(saved.snapshot)this.apply(saved.snapshot,true);if(saved.journey)this.set({journey:loadJourney(JSON.stringify(saved.journey),'gps'),book:saved.book||this.view.book});}}
   }catch{/* A damaged cache cannot prevent authoritative recovery. */}
   try{
    this.seal();await this.flush();
    // Only reconcile a session this device had open; browsing another device
    // must not silently pause its active recording.
    if(this.sessionId){try{await this.adapter.request(`/sessions/${this.sessionId}/pause`,'POST');}catch(error){if(![404,409].includes((error as {status?:number}).status||0))throw error;this.sessionId=null;this.seq=0;}}
    const snapshot=await this.adapter.request<Snapshot>('/bootstrap');if(this.disposed)return;
    this.apply(snapshot,true);this.sessionId=snapshot.session?.id||null;this.seq=snapshot.session?.seq||0;this.loaded=true;await this.persist();
   }catch(e){
    if(this.disposed)return;
    // A rejected upload must not hide already-saved walks, gifts or map coverage.
    // Keep the outbox and its sequence intact; reading never pauses its server session.
    if(this.queue.length||this.fixes.length){
     try{
      const snapshot=await this.adapter.request<Snapshot>('/bootstrap');if(this.disposed)return;
      const local=this.view.journey,seen=new Set((snapshot.state.journey.trail||[]).map(line=>JSON.stringify(line)));
      const trail=[...(snapshot.state.journey.trail||[]),...(local.trail||[]).filter(line=>!seen.has(JSON.stringify(line)))];
      this.apply(snapshot,false);this.set({journey:{...pauseJourney(local,'reload'),trail},loading:false,message:'შენახული პროგრესი ჩაიტვირთა. ტელეფონში დარჩენილი ჩანაწერები გაგზავნას ელოდება.'});
      this.loaded=true;await this.persist();return;
     }catch{/* Preserve the original upload error if the server cannot be read either. */}
    }
    this.set({loading:false,message:(e as Error).message});throw e;
   }
  })().finally(()=>{this.opening=null;});return this.opening;
 }
 private seal(){if(!this.sessionId||!this.fixes.length)return;for(let i=0;i<this.fixes.length;i+=60)this.queue.push({path:`/sessions/${this.sessionId}/batches`,body:{id:this.adapter.id(),seq:++this.seq,fixes:this.fixes.slice(i,i+60)}});this.fixes=[];void this.persist();}
 flush():Promise<void>{
  if(this.task)return this.task;
  this.task=(async()=>{
   while(this.queue.length&&!this.disposed){
    const op=this.queue[0];
    try{const result=await this.adapter.request<Snapshot|{seq:number}>(op.path,'POST',op.body);if(this.disposed)return;if('userId' in result)this.apply(result);this.queue.shift();await this.persist();}
    catch(error){const status=(error as {status?:number}).status;
     if(this.disposed)return;
     if(status===400&&op.path.endsWith('/batches')){
      const repaired=repairRejectedBatch(op.body);
      if(repaired){
       await this.adapter.archive(JSON.stringify({operation:op,reason:'native-gps-format-repair',at:Date.now()}));
       op.body=repaired;await this.persist();continue;
      }
     }
     if(status===409||status===404){
      await this.adapter.archive(JSON.stringify({queue:this.queue,fixes:this.fixes,sessionId:this.sessionId,at:Date.now()}));
      this.queue=[];this.fixes=[];this.sessionId=null;this.seq=0;
      this.set({running:false,signal:EMPTY_SIGNAL,conflict:true,journey:pauseJourney(this.view.journey),message:'სესია სხვა მოწყობილობაზე შეიცვალა. ჩანაწერი ადგილობრივად დარჩა. გააგრძელე ერთი მოწყობილობიდან.'});await this.persist();return;
     }
     this.set({message:status===400?'GPS ჩანაწერის გაგზავნა ვერ მოხერხდა · ასლი ტელეფონში შენარჩუნებულია':'კავშირი შეწყდა · ჩანაწერი გაგზავნას ელოდება'});await this.persist();throw error;
    }
   }
   if(!this.view.conflict)this.set({message:'ანგარიშში შენახულია'});
  })().finally(()=>{this.task=null;});return this.task;
 }
 async begin(){
  await this.init();this.seal();await this.flush();
  const latest=await this.adapter.request<Snapshot>('/bootstrap');
  if(!latest.config.enabled)throw new Error(latest.config.message||'თამაში დროებით შეჩერებულია.');
  const snapshot=latest.session?await this.adapter.request<Snapshot>(`/sessions/${latest.session.id}/resume`,'POST'):await this.adapter.request<Snapshot>('/sessions','POST',{id:this.adapter.id()});
  if(this.disposed)throw new Error('ანგარიში შეიცვალა.');
  this.sessionId=snapshot.session!.id;this.seq=snapshot.session!.seq;this.apply(snapshot,true);this.set({running:true,conflict:false,message:'GPS მზადაა · იარე შენი მიმართულებით'});await this.persist();return this.view.journey;
 }
 ingest(fix:PulseFix){
  if(!this.view.running||!this.sessionId||this.disposed)return this.view.journey;
  const normalized=normalizePulseFix(fix);
  if(!normalized){this.set({journey:{...this.view.journey,rejected:this.view.journey.rejected+1,status:'invalid',speed:0},message:'ზუსტ GPS ჩანაწერს ველოდებით'});return this.view.journey;}
  fix=normalized;
  this.fixes.push(fix);
  const before=this.view.journey;
  const journey=fix.mocked?{...before,rejected:before.rejected+1,status:'invalid',speed:0}:acceptFix(before,fix,.72,fix.timestamp);
  const mission=this.view.snapshot?.missions.find(m=>m.id===this.view.book.selected)||null;
  const book=advanceMission(this.view.book,before,journey,fix.timestamp,mission);
  this.set({journey,book,message:'გზა ინახება…'});void this.persist();
  if(this.fixes.length>=5){this.seal();void this.flush().catch(()=>{});}return journey;
 }
 stop(finish=false){
  this.seal();if(this.sessionId)this.queue.push({path:`/sessions/${this.sessionId}/${finish?'finish':'pause'}`});
  if(finish)this.sessionId=null;
  this.set({running:false,signal:EMPTY_SIGNAL,journey:finish?resetSession(this.view.journey):pauseJourney(this.view.journey),message:'გასეირნება შენახულია · სინქრონიზდება'});
  void this.persist();void this.flush().catch(()=>{});
 }
 async tick(){this.seal();try{await this.flush();if(this.view.running){const signal=await this.adapter.request<GiftSignal>('/nearby');this.set({signal});}}catch{this.set({signal:EMPTY_SIGNAL});}}
 async refresh(){await this.init();if(!this.view.running&&(this.queue.length||this.fixes.length)){this.seal();try{await this.flush();}catch{/* Reading saved progress remains available while an upload waits. */}}const snapshot=await this.adapter.request<Snapshot>('/bootstrap');this.apply(snapshot,!this.view.running&&!this.queue.length&&!this.fixes.length);await this.persist();return snapshot;}
 async selectMission(id:string|null){this.seal();await this.flush();const snapshot=await this.adapter.request<Snapshot>('/mission','PUT',{id});this.apply(snapshot);this.set({book:snapshot.state.book});await this.persist();}
 async settings(value:PulseSettings|{handle:string;leaderboardOptIn:boolean}){const snapshot=await this.adapter.request<Snapshot>('/settings','PATCH',value);this.apply(snapshot);await this.persist();}
 async claim(id:string){this.seal();await this.flush();const claim=await this.adapter.request<Claim>(`/gifts/${id}/claim`,'POST');if(this.view.snapshot)this.apply({...this.view.snapshot,claims:[claim,...this.view.snapshot.claims.filter(c=>c.id!==claim.id)]});this.set({signal:EMPTY_SIGNAL});await this.persist();return claim;}
 dispose(){this.disposed=true;this.listeners.clear();}
}

