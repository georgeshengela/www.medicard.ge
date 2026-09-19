import {useSyncExternalStore} from 'react';
import {API_BASE_URL} from '@/lib/api';
import {getToken,getPreference,setPreferenceStrict} from '@/lib/storage';
import {localAccountId} from '@/lib/localAccount';
import {rememberMapboxToken} from '@/lib/run/mapbox';
import {PulseSessionClient} from './sessionClient';
import {allowedApi} from '@/components/medipulsi/bridgePolicy';

let account:string|null=null,client:PulseSessionClient|null=null,timer:ReturnType<typeof setInterval>|null=null;
const uuid=()=>globalThis.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return(c==='x'?n:(n&3)|8).toString(16);});
export async function pulseApi<T>(path:string,method='GET',body?:unknown,owner=localAccountId()):Promise<T>{
 if(!owner||localAccountId()!==owner)throw new Error('შედი MEDICARD ანგარიშში.');
 if(!allowedApi(path,method))throw new Error('მოთხოვნა დაუშვებელია.');
 const token=await getToken();if(!token||localAccountId()!==owner)throw new Error('ანგარიში შეიცვალა.');
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),15000);
 try{
  const response=await fetch(API_BASE_URL+'/api/medipulsi'+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:abort.signal});
  const data=await response.json();if(localAccountId()!==owner)throw new Error('ანგარიში შეიცვალა.');
  if(!response.ok)throw Object.assign(new Error(response.status===404?'MEDI RUN-ის თამაშის სერვისი ამ სერვერზე ჯერ არ განახლებულა.':data.error||'კავშირი ვერ მოხერხდა.'),{status:response.status,code:data.code});
  if(data.mapboxToken)rememberMapboxToken(data.mapboxToken);return data;
 }finally{clearTimeout(timeout);}
}
export function resetPulseClient(){client?.dispose();client=null;account=null;if(timer)clearInterval(timer);timer=null;}
export function getPulseClient(){
 const owner=localAccountId();if(client&&account===owner)return client;
 resetPulseClient();account=owner;
 const key=`medicard.medipulsi.native.${owner||'signed-out'}`;
 client=new PulseSessionClient({id:uuid,request:<T>(path:string,method?:string,body?:unknown)=>pulseApi<T>(path,method,body,owner),read:()=>getPreference(key),write:value=>setPreferenceStrict(key,value),archive:value=>setPreferenceStrict(key+'.conflict.'+Date.now(),value)});
 const activeClient=client;
 timer=setInterval(()=>{if(localAccountId()===owner&&(activeClient.getSnapshot().running||activeClient.getSnapshot().pending))void activeClient.tick();},5000);
 return client;
}
export function usePulse(){const current=getPulseClient();return useSyncExternalStore(current.subscribe,current.getSnapshot,current.getSnapshot);}
