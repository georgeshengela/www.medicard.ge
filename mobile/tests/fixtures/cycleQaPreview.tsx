// Real cycle routes and real API/database; only navigation/auth host is a QA wrapper.
import '@expo/metro-runtime';
import '@/lib/aiSharingConsent';
import '@/lib/quest/cache';
import '@/lib/accountSync';
import '@/lib/mediNotificationBrain';
import React, { useState } from 'react';
import { registerRootComponent } from 'expo';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansGeorgian_400Regular, NotoSansGeorgian_500Medium, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_700Bold } from '@expo-google-fonts/noto-sans-georgian';
import { ThemeProvider, useTheme } from '@/store/ThemeContext';
import { useCycleColors } from '@/theme/cycle';
import { api } from '@/lib/api';
import { setToken } from '@/lib/storage';
import { setLocalAccountId } from '@/lib/localAccount';
import { CycleQaAuth } from './cycleQaAuth';
import { usePreviewRoute, router } from './cycleQaRouter';
import Home from '../../app/cycle';
import Settings from '../../app/cycle/settings';
import Log from '../../app/cycle/log';
import Journal from '../../app/cycle/journal';
import Trends from '../../app/cycle/trends';
import Summary from '../../app/cycle/summary';
import Timeline from '../../app/cycle/pregnancy/timeline';
import Care from '../../app/cycle/pregnancy/care-plan';
import Week from '../../app/cycle/week/[week]';
import '../../global.css';

function Qa(){
 const [fonts]=useFonts({NotoSansGeorgian_400Regular,NotoSansGeorgian_500Medium,NotoSansGeorgian_600SemiBold,NotoSansGeorgian_700Bold});
 const [user,setUser]=useState<any>(null),[email,setEmail]=useState('female.cycle.20260920@medicard.test'),[password,setPassword]=useState(''),[error,setError]=useState('');
 const theme=useTheme(),c=useCycleColors(),{path,options}=usePreviewRoute();
 if(!fonts)return null;
 if(!user)return <View style={{flex:1,justifyContent:'center',padding:28,backgroundColor:'#FFF7F8',gap:16}}>
  <Text style={{fontFamily:'NotoSansGeorgian_700Bold',fontSize:23}}>ციკლის სატესტო სივრცე</Text><Text>მხოლოდ ადგილობრივი სინთეზური ანგარიშები · API :4340</Text>
  <TextInput accessibilityLabel="ელფოსტა" value={email} onChangeText={setEmail} style={{padding:16,borderWidth:1,borderRadius:14}}/>
  <TextInput accessibilityLabel="პაროლი" value={password} onChangeText={setPassword} secureTextEntry style={{padding:16,borderWidth:1,borderRadius:14}}/>
  <Pressable accessibilityRole="button" onPress={async()=>{try{const data=await api.auth.login({email,password});await setToken(data.token);setLocalAccountId(data.user.id);setUser(data.user);}catch(e:any){setError(e.message);}}} style={{padding:18,borderRadius:16,backgroundColor:'#BE123C'}}><Text style={{color:'#fff'}}>სატესტო შესვლა</Text></Pressable>
  <Text accessibilityRole="alert">{error}</Text></View>;
 const Screen=path==='/cycle'?Home:path==='/cycle/settings'?Settings:path==='/cycle/log'?Log:path==='/cycle/journal'?Journal:path==='/cycle/trends'?Trends:path==='/cycle/summary'?Summary:path==='/cycle/pregnancy/timeline'?Timeline:path==='/cycle/pregnancy/care-plan'?Care:path.startsWith('/cycle/week/')?Week:Home;
 return <CycleQaAuth.Provider value={{user,ready:true}}>
  <View style={{flex:1,minHeight:0}}>
   <View style={{backgroundColor:c.cardSoft,paddingHorizontal:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center',minHeight:30}}>
    <Text style={{color:c.mutedSoft,fontSize:9}}>SYNTHETIC QA · REAL API :4340</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="თემის შეცვლა" onPress={()=>theme.setPreference(theme.scheme==='dark'?'light':'dark')} style={{padding:8}}><Text style={{color:c.ink,fontSize:11}}>◐ თემა</Text></Pressable>
   </View>
   {path!=='/cycle'?<View style={{backgroundColor:c.cream,padding:12,flexDirection:'row',alignItems:'center',gap:12}}>
    <Pressable accessibilityRole="button" accessibilityLabel="უკან" onPress={router.back} style={{padding:8}}><Text style={{color:c.brand}}>← უკან</Text></Pressable>
    <Text style={{color:c.ink,fontFamily:'NotoSansGeorgian_600SemiBold',flex:1}}>{options.title||'ციკლი'}</Text>
   </View>:null}
   <Screen key={path}/>
  </View>
 </CycleQaAuth.Provider>;
}
registerRootComponent(()=> <SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:393,height:852},insets:{top:0,bottom:0,left:0,right:0}}}><ThemeProvider><Qa/></ThemeProvider></SafeAreaProvider>);
