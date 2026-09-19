import test from 'node:test';
import assert from 'node:assert/strict';
import {PulseEngine} from '../src/pulse.ts';

test('audio stays silent before a gesture; unlock, mute and cancellation respect user control',async()=>{
 const starts:number[]=[],stops:number[]=[],vibrations:unknown[]=[];
 const parameter={setValueAtTime(){},exponentialRampToValueAtTime(){}};
 class Context {
  state='suspended';currentTime=5;destination={};
  async resume(){this.state='running';}async close(){this.state='closed';}
  createOscillator(){return {frequency:parameter,type:'sine',onended:null,connect(){},disconnect(){},start(t:number){starts.push(t);},stop(t:number){stops.push(t);}};}
  createGain(){return {gain:parameter,connect(){},disconnect(){}};}
 }
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 try{
  Object.defineProperty(globalThis,'window',{configurable:true,value:{AudioContext:Context}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{vibrate:(value:unknown)=>{vibrations.push(value);return true;}}});
  const pulse=new PulseEngine();
  assert.equal(pulse.beat(true,false).audio,false);
  assert.equal(starts.length,0);
  assert.equal(await pulse.unlock(),true);
  assert.deepEqual(pulse.beat(true,true),{audio:true,vibration:'requested'});
  assert.equal(new Set(starts).size,2,'each signal has two distinct beats');
  assert.ok(Math.abs(starts[3]-starts[0]-.19)<.001);
  assert.deepEqual(vibrations[0],[85,105,65]);
  const before=starts.length;
  assert.deepEqual(pulse.beat(false,false),{audio:false,vibration:'off'});
  assert.equal(starts.length,before,'muting must not create oscillators');
  pulse.stop();assert.equal(vibrations.at(-1),0);assert.ok(stops.length>starts.length,'stop cancels active tones');
  pulse.dispose();assert.equal(pulse.beat(true,false).audio,false);
 }finally{
  if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');
  if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else Reflect.deleteProperty(globalThis,'navigator');
 }
});

test('unsupported or denied vibration reports its actual capability without crashing',()=>{
 const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 try{
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
  const unsupported=new PulseEngine();assert.equal(unsupported.beat(false,true).vibration,'unsupported');unsupported.stop();
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{vibrate:()=>false}});
  assert.equal(new PulseEngine().beat(false,true).vibration,'blocked');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{vibrate:()=>{throw Error('denied');}}});
  const blocked=new PulseEngine();assert.equal(blocked.beat(false,true).vibration,'blocked');assert.doesNotThrow(()=>blocked.stop());
 }finally{if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else Reflect.deleteProperty(globalThis,'navigator');}
});
