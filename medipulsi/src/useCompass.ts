import {native,bridge} from './bridge';
import {useEffect,useRef,useState} from 'react';
import {orientationHeading} from './compass';
import type {CompassReading,OrientationSample} from './compass';
type PermissionOrientation=typeof DeviceOrientationEvent & {requestPermission?:(absolute?:boolean)=>Promise<'granted'|'denied'>};
export function useCompass(){
 const reading=useRef<CompassReading|null>(null),[enabled,setEnabled]=useState(false),[status,setStatus]=useState('off');
 async function enable(){
  if(native){try{await bridge('heading.start');setEnabled(true);setStatus('waiting');return true;}catch{setStatus('denied');return false;}}
  if(!window.isSecureContext){setStatus('https');return false;}
  if(!('DeviceOrientationEvent' in window)){setStatus('unsupported');return false;}
  try{const api=DeviceOrientationEvent as PermissionOrientation;if(api.requestPermission&&await api.requestPermission(true)!=='granted'){setStatus('denied');return false;}setEnabled(true);setStatus('waiting');return true;}catch{setStatus('denied');return false;}
 }
 function disable(){if(native)void bridge('heading.stop').catch(()=>{});reading.current=null;setEnabled(false);setStatus('off');}
 useEffect(()=>{if(!enabled)return;if(native){const receive=(event:Event)=>{reading.current={heading:(event as CustomEvent).detail.heading,at:Date.now()};setStatus('active');};const background=()=>{reading.current=null;setStatus('waiting');};const foreground=()=>{void bridge('heading.resume').catch(()=>setStatus('denied'));};window.addEventListener('medipulsi:heading',receive);window.addEventListener('medipulsi:background',background);window.addEventListener('medipulsi:foreground',foreground);const timer=setInterval(()=>{if(!reading.current||Date.now()-reading.current.at>5000)setStatus('waiting');},1000);return()=>{clearInterval(timer);window.removeEventListener('medipulsi:heading',receive);window.removeEventListener('medipulsi:background',background);window.removeEventListener('medipulsi:foreground',foreground);void bridge('heading.stop').catch(()=>{});};}const receive=(event:Event)=>{if(document.hidden)return;const angle=screen.orientation?.angle??(window as Window&{orientation?:number}).orientation??0;const h=orientationHeading(event as unknown as OrientationSample,angle);if(h===null)return;reading.current={heading:h,at:Date.now()};setStatus('active');};const hidden=()=>{if(document.hidden){reading.current=null;setStatus('waiting');}};window.addEventListener('deviceorientation',receive);window.addEventListener('deviceorientationabsolute',receive);document.addEventListener('visibilitychange',hidden);const timer=setInterval(()=>{if(!reading.current||Date.now()-reading.current.at>=5000)setStatus('waiting');},1000);return()=>{clearInterval(timer);window.removeEventListener('deviceorientation',receive);window.removeEventListener('deviceorientationabsolute',receive);document.removeEventListener('visibilitychange',hidden);reading.current=null;};},[enabled]);
 return {reading,enabled,status,enable,disable};
}
