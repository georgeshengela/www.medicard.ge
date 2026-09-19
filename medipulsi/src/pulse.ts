import {native,bridge} from './bridge.ts';
export type PulseResult={audio:boolean;vibration:'requested'|'unsupported'|'blocked'|'off'};
export class PulseEngine {
 private context:AudioContext|null=null;
 private nodes=new Set<OscillatorNode>();
 supported=native||typeof navigator!=='undefined'&&typeof navigator.vibrate==='function';
 async unlock(){
  try{const C=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!C)return false;this.context??=new C();if(this.context.state!=='running')await this.context.resume();return this.context.state==='running';}catch{return false;}
 }
 beat(sound:boolean,haptic:boolean,volume=.65):PulseResult{
  const ctx=this.context;const audible=!!(sound&&ctx?.state==='running');
  if(audible&&ctx){
   // The harmonics remain audible on small phone speakers; the bass provides weight.
   [0,.19].forEach((delay,beat)=>{
    [{frequency:112,end:67,gain:.45},{frequency:228,end:150,gain:.23},{frequency:390,end:260,gain:.06}].forEach(tone=>{
     const osc=ctx.createOscillator(),gain=ctx.createGain();const start=ctx.currentTime+delay;
     osc.type='sine';osc.frequency.setValueAtTime(tone.frequency,start);osc.frequency.exponentialRampToValueAtTime(tone.end,start+.16);
     const level=tone.gain*volume*(beat?.72:1);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(level,start+.014);gain.gain.exponentialRampToValueAtTime(.0001,start+.23);
     osc.connect(gain);gain.connect(ctx.destination);this.nodes.add(osc);osc.onended=()=>{osc.disconnect();gain.disconnect();this.nodes.delete(osc);};osc.start(start);osc.stop(start+.25);
    });
   });
  }
  let vibration:PulseResult['vibration']='off';
  if(haptic&&native){void bridge('haptic').catch(()=>{});vibration='requested';}
  else if(haptic){try{vibration=this.supported?(navigator.vibrate([85,105,65])?'requested':'blocked'):'unsupported';}catch{vibration='blocked';}}
  return {audio:audible,vibration};
 }
 stop(){this.nodes.forEach(n=>{try{n.stop();}catch{/* Already ended. */}});this.nodes.clear();try{if(this.supported)navigator.vibrate(0);}catch{/* Some embedded browsers deny haptic requests. */}}
 dispose(){this.stop();void this.context?.close();this.context=null;}
}
