import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Platform,Vibration} from 'react-native';
import {setAudioModeAsync,useAudioPlayer} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import type {GiftSignal,PulseSettings} from './types';

/** Lub-dub you can feel with the sound down: two strong taps on iOS, a short vibration pattern on Android. */
function hapticBeat(alive:{current:boolean}){
 if(Platform.OS==='android'){Vibration.vibrate([0,70,110,45]);return null;}
 void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(()=>{});
 return setTimeout(()=>{if(alive.current&&AppState.currentState==='active')void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});},150);
}

export function useHeartbeat(signal:GiftSignal,settings:PulseSettings,running:boolean){
 const player=useAudioPlayer(require('../../../assets/run/pulse.wav'));
 const [foreground,setForeground]=useState(AppState.currentState==='active');
 const second=useRef<ReturnType<typeof setTimeout>|null>(null),alive=useRef(true),audioReady=useRef(false);
 useEffect(()=>{alive.current=true;const sub=AppState.addEventListener('change',state=>{setForeground(state==='active');if(state!=='active')audioReady.current=false;});return()=>{alive.current=false;sub.remove();if(second.current)clearTimeout(second.current);};},[]);
 const beat=useCallback(async()=>{
  if(!foreground)return;
  // The vibration never waits for, or depends on, the sound: it is the signal when the phone is quiet.
  if(settings.haptic!==false){if(second.current)clearTimeout(second.current);second.current=hapticBeat(alive);}
  if(settings.sound!==false){try{
   // Configure the audio session once per heartbeat run; re-activating it on every beat can swallow the iOS haptic.
   if(!audioReady.current){await setAudioModeAsync({playsInSilentMode:true,shouldPlayInBackground:false,interruptionMode:'mixWithOthers'});audioReady.current=true;}
   if(!alive.current||AppState.currentState!=='active')return;player.volume=settings.volume??.7;await player.seekTo(0);player.play();
  }catch{/* Haptic and visual signals remain available without an audio output. */}}
 },[foreground,settings.sound,settings.haptic,settings.volume,player]);
 useEffect(()=>{if(!running||!foreground||!signal.signal||!signal.quality){player.pause();if(second.current)clearTimeout(second.current);return;}void beat();const timer=setInterval(()=>void beat(),Math.max(700,signal.period));return()=>{clearInterval(timer);if(second.current)clearTimeout(second.current);if(Platform.OS==='android')Vibration.cancel();player.pause();};},[running,foreground,signal.signal,signal.quality,signal.period,beat,player]);
 return beat;
}
