import type {Fix} from './journey';
declare global {interface Window {ReactNativeWebView?:{postMessage:(message:string)=>void};__medipulsiReceive?:(message:BridgeReply)=>void;}}
type BridgeReply={id?:string;event?:string;ok?:boolean;data?:unknown;error?:string;status?:number};
const pending=new Map<string,{resolve:(value:any)=>void;reject:(reason:Error)=>void;timer:number}>();
export const native=typeof window!=='undefined'&&!!window.ReactNativeWebView;
export const embedded=typeof location!=='undefined'&&new URLSearchParams(location.search).get('embed')==='1';
if(typeof window!=='undefined')window.__medipulsiReceive=(message:BridgeReply)=>{
 if(message.event){window.dispatchEvent(new CustomEvent('medipulsi:'+message.event,{detail:message.data}));return;}
 const waiter=message.id&&pending.get(message.id);if(!waiter)return;clearTimeout(waiter.timer);pending.delete(message.id!);
 if(message.ok)waiter.resolve(message.data);else waiter.reject(Object.assign(new Error(message.error||'მოთხოვნა ვერ შესრულდა.'),{status:message.status}));
};
if(typeof window!=='undefined')window.addEventListener('message',event=>{if(embedded&&event.source===parent&&event.origin===location.origin&&event.data?.channel==='medipulsi')window.__medipulsiReceive?.(event.data);});
export function bridge<T=unknown>(action:string,payload:unknown={}):Promise<T>{return new Promise((resolve,reject)=>{
 const id=crypto.randomUUID(),message={channel:'medipulsi',id,action,payload};
 const timer=window.setTimeout(()=>{pending.delete(id);reject(new Error('კავშირი შეწყდა. სცადე თავიდან.'));},20000);pending.set(id,{resolve,reject,timer});
 if(native)window.ReactNativeWebView!.postMessage(JSON.stringify(message));else if(embedded)parent.postMessage(message,location.origin);else {clearTimeout(timer);pending.delete(id);reject(new Error('აპთან კავშირი მიუწვდომელია.'));}
});}
export function watchLocation(onFix:(fix:Fix)=>void,onError:(error:{code:number})=>void){
 if(native){const receive=(event:Event)=>onFix((event as CustomEvent).detail);window.addEventListener('medipulsi:location',receive);void bridge('location.start').catch(()=>onError({code:1}));return()=>{window.removeEventListener('medipulsi:location',receive);void bridge('location.stop').catch(()=>{});};}
 const id=navigator.geolocation.watchPosition(p=>onFix({position:[p.coords.longitude,p.coords.latitude],accuracy:p.coords.accuracy,timestamp:p.timestamp,speed:p.coords.speed}),onError,{enableHighAccuracy:true,maximumAge:0,timeout:15000});return()=>navigator.geolocation.clearWatch(id);
}
