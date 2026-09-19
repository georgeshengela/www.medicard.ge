import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {setAudioModeAsync,useAudioPlayer} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import type {GiftSignal,PulseSettings} from './types';

export function useHeartbeat(signal:GiftSignal,settings:PulseSettings,running:boolean){
 const player=useAudioPlayer(require('../../../assets/run/pulse.wav'));
 const [foreground,setForeground]=useState(AppState.currentState==='active');
 const second=useRef<ReturnType<typeof setTimeout>|null>(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;const sub=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>{alive.current=false;sub.remove();if(second.current)clearTimeout(second.current);};},[]);
 const beat=useCallback(async()=>{
  if(!foreground)return;
  if(settings.haptic!==false){void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});if(second.current)clearTimeout(second.current);second.current=setTimeout(()=>{if(alive.current&&AppState.currentState==='active')void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});},180);}
  if(settings.sound!==false){try{await setAudioModeAsync({playsInSilentMode:true,shouldPlayInBackground:false,interruptionMode:'mixWithOthers'});if(!alive.current||AppState.currentState!=='active')return;player.volume=settings.volume??.7;await player.seekTo(0);player.play();}catch{/* Haptic and visual signals remain available without an audio output. */}}
 },[foreground,settings.sound,settings.haptic,settings.volume,player]);
 useEffect(()=>{if(!running||!foreground||!signal.signal||!signal.quality){player.pause();if(second.current)clearTimeout(second.current);return;}void beat();const timer=setInterval(()=>void beat(),Math.max(700,signal.period));return()=>{clearInterval(timer);if(second.current)clearTimeout(second.current);player.pause();};},[running,foreground,signal.signal,signal.quality,signal.period,beat,player]);
 return beat;
}
