import {useEffect,useState} from 'react';
import {useAccountQuery} from '@/hooks/useAccountQuery';
import {FRESH} from '@/lib/queryClient';
import {pulseApi} from '@/lib/medipulsi/client';
import {getMediCoinBalanceHint,subscribeMediCoinBalance} from '@/lib/quest/cache';

/** `GET /api/medipulsi/wallet` — server `src/lib/medipulsi/economy.js` walletView. Parks and dates, never a coordinate. */
export type WalletRow={
 id:string;amount:number;createdAt:string;
 kind:'box'|'prize'|'grand'|'together';
 /** Box openings: the place in the first-finder ladder (1 = first) and what the first finder got. */
 rank:number|null;base:number|null;
 place:string|null;district:string|null;city:string|null;
 /** Weekly prizes: which board and which Tbilisi week (Monday). */
 board:'boxes'|'meters'|string|null;week:string|null;
 giftKind:string|null;
};
export type RunWalletData={
 balance:number;
 season:{earned:number;boxes:number;firsts:number;start:string;end:string};
 rows:WalletRow[];
 now:string;
};

export const RUN_WALLET_KEY=['medirun','wallet'] as const;

/**
 * Balance + MEDIRUN history for the hub. LIVE: re-read on every focus (the person comes back from a walk with a
 * box just opened) and the moment any screen publishes a new coin balance; the published balance is also returned
 * so the number on screen moves before the server answers.
 */
export function useRunWallet(){
 const query=useAccountQuery<RunWalletData>({key:[...RUN_WALLET_KEY],fetch:()=>pulseApi<RunWalletData>('/wallet'),staleTime:FRESH.LIVE,retry:(count,error)=>(error as {status?:number}|null)?.status!==404&&count<1});
 const {refetch}=query;
 const [liveBalance,setLiveBalance]=useState<number|null>(()=>getMediCoinBalanceHint());
 useEffect(()=>subscribeMediCoinBalance(value=>{setLiveBalance(value);void refetch();}),[refetch]);
 return {...query,liveBalance};
}
