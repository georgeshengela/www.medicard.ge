import {useSyncExternalStore} from 'react';
import {useAccountQuery} from '@/hooks/useAccountQuery';
import {pulseApi} from '@/lib/medipulsi/client';

/** `GET /api/medipulsi/drops` — server `src/lib/medipulsi/drops.js`. Aggregates only, never a location. */
export type CoinRange={min:number;max:number}|null;
export type DropWaveKind='regular'|'evening'|'saturday'|'lantern';
export type Drops={
 enabled:boolean;
 campaign:{id:string;name:string;status:'upcoming'|'live'|'ended';start:string;end:string;rulesUrl:string};
 /** The reader's city (servers before 2026-10-04 send none = Tbilisi). `pending` = its spots are still being found. */
 city?:{id:string;name:string;campaignCity:boolean;pending:boolean};
 now:{boxes:number;openingsLeft:number;endsAt:string|null;coins:CoinRange;lanternBoxes:number;districts:{name:string;boxes:number;near?:[number,number]|null;startsAt?:string;endsAt?:string}[]};
 today:{opened:number;coins:number};
 me:{opened:number;coins:number};
 next:{startsAt:string;boxes:number;coins:CoinRange;kind:DropWaveKind}|null;
 schedule:{id:'weekday'|'weekend'|'saturday';label:string;times:string;coins:CoinRange}[];
 /** Economy 2: percent per opening — the first finder gets decay[0] (100), later openers less. */
 economy?:{decay:number[]};
 /** People walking in the city right now and near the Saturday rain (null below three). Servers from 2026-10-05. */
 live?:{walkers:number|null;rain:number|null};
};

// Where the phone is now, on a 0.01° grid (~1 km): the server shows that city's boxes (a trip to Liège shows
// Liège even when home is Tbilisi). Sent as a header, never in the URL; null = the server decides (walk, home).
let dropsAt:string|null=null;
const atListeners=new Set<()=>void>();
export function setDropsAt(at:[number,number]|null){
 const next=at&&at.every(Number.isFinite)?`${at[0].toFixed(2)},${at[1].toFixed(2)}`:null;
 if(next===dropsAt)return;
 dropsAt=next;atListeners.forEach(l=>l());
}
const useDropsAt=()=>useSyncExternalStore(l=>{atListeners.add(l);return()=>atListeners.delete(l);},()=>dropsAt,()=>dropsAt);

/** Live box counts for the MEDIRUN hub: re-read every minute while the hub is on screen. */
export function useDrops(){
 const at=useDropsAt();
 return useAccountQuery<Drops>({key:['medirun','drops',at||'-'],fetch:()=>pulseApi<Drops>('/drops','GET',undefined,undefined,at?{'X-Medirun-At':at}:undefined),staleTime:0,refetchInterval:60_000,retry:(count,error)=>(error as {status?:number}|null)?.status!==404&&count<1});
}

/** „1 სთ 5 წთ“ / „4 წთ 09 წმ“ / „2 დღე 3 სთ“ — a countdown that stays short. */
export function countdownParts(ms:number){
 const s=Math.max(0,Math.floor(ms/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),sec=s%60;
 return {d,h,m,s:sec};
}
