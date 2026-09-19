import React,{forwardRef,useEffect,useImperativeHandle,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {buildRunMapHtml} from '@/lib/run/mapHtml';
import {peekMapboxToken,resolveMapboxToken} from '@/lib/run/mapbox';
import type {RunMapHandle,RunMapProps} from '@/lib/run/mapTypes';
import {useIsDark,useThemeColors} from '@/theme/colors';
export type {RunMapHandle,RunMapMessage} from '@/lib/run/mapTypes';

export const RunMap=forwardRef<RunMapHandle,RunMapProps>(function RunMap(props,ref){
 const frame=useRef<HTMLIFrameElement>(null),initial=useRef(props),channel=useRef('run-map-'+Math.random().toString(36).slice(2));
 const [token,setToken]=useState(peekMapboxToken),[ready,setReady]=useState(false),[error,setError]=useState('');
 const dark=useIsDark(),colors=useThemeColors(),callbacks=useRef(props);callbacks.current=props;
 useEffect(()=>{let alive=true;void resolveMapboxToken().then(t=>{if(alive)setToken(t);});return()=>{alive=false;};},[]);
 const html=useMemo(()=>token?buildRunMapHtml({token,center:initial.current.center,dark:initial.current.mapDark??dark,channel:channel.current}):'', [token]);
 useImperativeHandle(ref,()=>({send:message=>frame.current?.contentWindow?.postMessage({channel:channel.current,message},'*')}),[]);
 useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.source!==frame.current?.contentWindow||event.data?.channel!==channel.current)return;const data=event.data.data;if(data?.type==='ready'){setReady(true);callbacks.current.onReady?.();}if(data?.type==='follow')callbacks.current.onFollowChange?.(data.value===true);if(data?.type==='error'){setError(data.message);callbacks.current.onError?.(data.message);}};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[]);
 useEffect(()=>{if(ready)frame.current?.contentWindow?.postMessage({channel:channel.current,message:{type:'theme',dark:props.mapDark??dark}},'*');},[props.mapDark,dark,ready]);
 return <View style={[{position:'absolute',inset:0,backgroundColor:colors.bg100},props.style]}>
  {html?<iframe ref={frame} title="MEDI RUN რუკა" srcDoc={html} sandbox="allow-scripts allow-same-origin" style={{height:'100%',width:'100%',border:0}}/>:null}
  {(!ready||error)?<View pointerEvents="none" style={{position:'absolute',inset:0,alignItems:'center',justifyContent:'center',gap:12}}>{!error?<ActivityIndicator color="#14B8A6"/>:null}<Text style={{color:colors.text200}}>{error||'რუკა იტვირთება…'}</Text></View>:null}
 </View>;
});
