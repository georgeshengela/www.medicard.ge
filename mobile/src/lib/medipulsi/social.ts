import {useAccountQuery} from '@/hooks/useAccountQuery';
import {FRESH,invalidate,queryClient,accountKey} from '@/lib/queryClient';
import {pulseApi} from '@/lib/medipulsi/client';
import {api} from '@/lib/api';

/**
 * MEDIRUN social layer (owner 2026-10-05) — server `src/lib/medipulsi/social.js`, `cityMeter.js`, `wrapped.js`.
 * Crews: nicknames and weekly metres only. City: everyone's lit streets together. Wrapped: last week's own numbers.
 * Nothing here ever carries a location.
 */
export type CrewMember={memberId:string;handle:string;role:'owner'|'member';me:boolean;weekMeters:number;togetherMeters:number};
export type Crew={name:string;code:string;role:'owner'|'member';link:string;createdAt:string;week:{start:string;meters:number;togetherMeters:number};members:CrewMember[]};
export type CrewView={crew:Crew|null;max:number};
export type CityMilestone={percent:number;reached:boolean;reachedAt:string|null};
export type CityMeter={city:string;areaKm2:number;paintedKm2:number;percent:number;people:number;computedAt:string;milestones:{list:CityMilestone[];next:{percent:number;remaining:number}|null;last:{percent:number;reachedAt:string|null}|null}};
export type Wrapped={week:{start:string;end:string};showUntil:string;meters:number;newMeters:number;minutes:number;walks:number;boxes:number;coins:number;firsts:number;rank:{meters:number|null;boxes:number|null};prizes:{board:string;rank:number;coins:number}[]};

const CREW_KEY=['medirun','crew'] as const;
const quiet=(count:number,error:unknown)=>(error as {status?:number}|null)?.status!==404&&count<1;

export function useCrew(){
 return useAccountQuery<CrewView>({key:[...CREW_KEY],fetch:()=>pulseApi<CrewView>('/crew'),staleTime:FRESH.SHORT,retry:quiet});
}
/** Every crew write answers with the new view: put it in the cache so every card updates at once. */
async function crewWrite(path:string,method:string,body?:unknown){
 const view=await pulseApi<CrewView>(path,method,body);
 queryClient.setQueryData(accountKey(...CREW_KEY),view);
 return view;
}
export const crewActions={
 create:(name:string)=>crewWrite('/crew','POST',{name}),
 join:(code:string)=>crewWrite('/crew/join','POST',{code}),
 leave:()=>crewWrite('/crew/leave','POST'),
 rename:(name:string)=>crewWrite('/crew','PATCH',{name}),
 remove:(memberId:string)=>crewWrite(`/crew/members/${memberId}/remove`,'POST'),
 refresh:()=>invalidate(...CREW_KEY),
};
/** Codes are typed by hand: same alphabet as the server (no 0/O/1/I). */
export const CREW_CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function normalizeCrewCode(raw:unknown):string|null{
 const code=String(raw??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 return code.length===6&&[...code].every(c=>CREW_CODE_ALPHABET.includes(c))?code:null;
}

export function useCityMeter(){
 return useAccountQuery<{meter:CityMeter|null}>({key:['medirun','city'],fetch:()=>pulseApi<{meter:CityMeter|null}>('/city'),staleTime:FRESH.LONG,retry:quiet});
}
export function useWrapped(){
 return useAccountQuery<Wrapped>({key:['medirun','wrapped'],fetch:()=>pulseApi<Wrapped>('/wrapped'),staleTime:FRESH.LONG,retry:quiet});
}

/**
 * The link every MEDIRUN share carries: the person's own invite link when they have one (verified phone), so a
 * friend who installs from the clip enters the code and both get coins; otherwise the public MEDIRUN page.
 */
let cachedLink:{at:number;value:string}|null=null;
export const MEDIRUN_PUBLIC_LINK='https://medicard.ge/medirun';
export async function shareLink():Promise<string>{
 if(cachedLink&&Date.now()-cachedLink.at<10*60_000)return cachedLink.value;
 let value=MEDIRUN_PUBLIC_LINK;
 try{const me=await api.referrals.me();if(me?.code)value=me.link||`https://medicard.ge/i/${me.code}`;}catch{/* the public page is fine */}
 cachedLink={at:Date.now(),value};
 return value;
}
/** The link as it is printed on a picture: no scheme. */
export const printedLink=(link:string)=>link.replace(/^https?:\/\//,'');
