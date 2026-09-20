import React, { useEffect, useSyncExternalStore } from 'react';
let current='/cycle', options:any={},revision=0;const listeners=new Set<()=>void>(),stack:string[]=[];
function emit(){revision++;for(const fn of listeners)fn();}
function target(v:any){if(typeof v==='string')return v;return v.pathname+(v.params?'?'+new URLSearchParams(v.params).toString():'');}
export const router={push:(v:any)=>{stack.push(current);current=target(v);options={};emit();},replace:(v:any)=>{current=target(v);options={};emit();},back:()=>{current=stack.pop()||'/cycle';options={};emit();},canGoBack:()=>stack.length>0};
export function usePreviewRoute(){useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>revision,()=>revision);return {path:current.split('?')[0],options};}
export const useRouter=()=>router;
const navigation={setOptions:(v:any)=>{const next={...options,...v};if(JSON.stringify(next)!==JSON.stringify(options)){options=next;emit();}},addListener:()=>()=>{}};
export const useNavigation=()=>navigation;
export const usePathname=()=>current.split('?')[0];
export const useLocalSearchParams=():any=>({...Object.fromEntries(new URLSearchParams(current.split('?')[1]||'')),week:current.match(/week\/(\d+)/)?.[1]});
export const useFocusEffect=(callback:()=>void|(()=>void))=>useEffect(callback,[callback]);
export const Stack={Screen:(_:any)=>null};
export const Link=({children}:any)=><>{children}</>;
export const Redirect=({href}:any)=>{useEffect(()=>router.replace(href),[href]);return null;};
