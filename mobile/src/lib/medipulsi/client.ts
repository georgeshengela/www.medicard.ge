import {useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {API_BASE_URL,guardRequest} from '@/lib/api';
import {getToken,getPreference,setPreferenceStrict} from '@/lib/storage';
import {localAccountId} from '@/lib/localAccount';
import {rememberMapboxToken} from '@/lib/run/mapbox';
import {PulseSessionClient} from './sessionClient';
import {allowedApi} from '@/components/medipulsi/bridgePolicy';
import {appLang,tx} from '../../i18n/locale.js';

let account:string|null=null,client:PulseSessionClient|null=null,timer:ReturnType<typeof setInterval>|null=null;
const uuid=()=>globalThis.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return(c==='x'?n:(n&3)|8).toString(16);});
export async function pulseApi<T>(path:string,method='GET',body?:unknown,owner=localAccountId()):Promise<T>{
 if(!owner||localAccountId()!==owner)throw new Error(tx('შედი MEDICARD ანგარიშში.','Sign in to your MEDICARD account.'));
 if(!allowedApi(path,method))throw new Error(tx('მოთხოვნა დაუშვებელია.','This request isn’t allowed.'));
 guardRequest(method,'/api/medipulsi'+path);
 const token=await getToken();if(!token||localAccountId()!==owner)throw new Error(tx('ანგარიში შეიცვალა.','The account changed.'));
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),15000);
 try{
  const response=await fetch(API_BASE_URL+'/api/medipulsi'+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Medicard-Lang':appLang()},body:body===undefined?undefined:JSON.stringify(body),signal:abort.signal});
  const data=await response.json();if(localAccountId()!==owner)throw new Error(tx('ანგარიში შეიცვალა.','The account changed.'));
  if(!response.ok)throw Object.assign(new Error(response.status===404?tx('MEDIRUN-ის თამაშის სერვისი ამ სერვერზე ჯერ არ განახლებულა.','The MEDIRUN game service isn’t updated on this server yet.'):data.error||tx('კავშირი ვერ მოხერხდა.','Couldn’t connect.')),{status:response.status,code:data.code});
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
 timer=setInterval(()=>{if(localAccountId()===owner&&(activeClient.getSnapshot().running||activeClient.getSnapshot().pending))void activeClient.tick(AppState.currentState==='active');},5000);
 return client;
}
export function usePulse(){const current=getPulseClient();return useSyncExternalStore(current.subscribe,current.getSnapshot,current.getSnapshot);}
