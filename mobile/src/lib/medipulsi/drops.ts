import {useAccountQuery} from '@/hooks/useAccountQuery';
import {pulseApi} from '@/lib/medipulsi/client';

/** `GET /api/medipulsi/drops` — server `src/lib/medipulsi/drops.js`. Aggregates only, never a location. */
export type CoinRange={min:number;max:number}|null;
export type DropWaveKind='regular'|'evening'|'saturday'|'lantern';
export type Drops={
 enabled:boolean;
 campaign:{id:string;name:string;status:'upcoming'|'live'|'ended';start:string;end:string;rulesUrl:string};
 now:{boxes:number;openingsLeft:number;endsAt:string|null;coins:CoinRange;lanternBoxes:number;districts:{name:string;boxes:number}[]};
 today:{opened:number;coins:number};
 me:{opened:number;coins:number};
 next:{startsAt:string;boxes:number;coins:CoinRange;kind:DropWaveKind}|null;
 schedule:{id:'weekday'|'weekend'|'saturday';label:string;times:string;coins:CoinRange}[];
};

/** Live box counts for the MEDIRUN hub: re-read every minute while the hub is on screen. */
export function useDrops(){
 return useAccountQuery<Drops>({key:['medirun','drops'],fetch:()=>pulseApi<Drops>('/drops'),staleTime:0,refetchInterval:60_000,retry:(count,error)=>(error as {status?:number}|null)?.status!==404&&count<1});
}

/** „1 სთ 5 წთ“ / „4 წთ 09 წმ“ / „2 დღე 3 სთ“ — a countdown that stays short. */
export function countdownParts(ms:number){
 const s=Math.max(0,Math.floor(ms/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),sec=s%60;
 return {d,h,m,s:sec};
}
