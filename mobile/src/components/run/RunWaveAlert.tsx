import React,{useState} from 'react';
import {ActivityIndicator,Switch,View} from 'react-native';
import {BellRing} from 'lucide-react-native';
import {useAuth} from '@/store/AuthContext';
import {useThemeColors} from '@/theme/colors';
import {tx} from '@/i18n/locale';
import {api} from '@/lib/api';
import {patchProfileExtra} from '@/lib/profileSetupFlow';
import {enablePushConnection,requestNotificationAccess} from '@/lib/appPermissions';
import {grantUserLocation} from '@/lib/userLocation';
import {Card,Copy,Tile} from './PulseUi';

/**
 * Server-side switch (HealthProfile.extraAnswers.medirunWaveAlerts — server waveAlerts.js); off unless turned on.
 * Turning it on is always a tap, so it may ask for notifications and — only when the account has no home place yet —
 * location. `set` resolves to a message to show, or '' when it worked. Used here and in Profile → შეტყობინებები.
 */
export function useWaveAlerts(){
 const {user,healthProfile,setHealthProfile}=useAuth();
 const on=(healthProfile?.extraAnswers as Record<string,unknown>|undefined)?.medirunWaveAlerts===true;
 const set=async(next:boolean):Promise<string>=>{
  if(!healthProfile||!user)return '';
  try{
   if(next){
    if(!(await requestNotificationAccess()))return tx('შეტყობინებები გამორთულია ტელეფონის პარამეტრებში — ჩართე და სცადე თავიდან.','Notifications are off in the phone settings — turn them on and try again.');
    await enablePushConnection();
    const home=await api.location.get().catch(()=>null);
    if(!home?.location?.enabled||home.location.lat==null){
     const granted=await grantUserLocation().catch(()=>null);
     if(!granted?.granted)return tx('სახლის ადგილის გარეშე ვერ გავიგებთ, რა არის შენთან ახლოს. მდებარეობის წვდომა საჭიროა.','Without your home place we can’t tell what is near you. Location access is needed.');
    }
   }
   setHealthProfile(await patchProfileExtra(healthProfile,user,{medirunWaveAlerts:next}));
   return '';
  }catch{return tx('ვერ შეინახა. შეამოწმე ინტერნეტი და სცადე თავიდან.','Couldn’t save. Check your connection and try again.');}
 };
 return {on,set,ready:Boolean(healthProfile&&user)};
}

/** MEDIRUN stage 3 (owner 2026-10-09): „შემატყობინე, როცა ახლოს დაიყრება“ under the boxes card. */
export function RunWaveAlert(){
 const c=useThemeColors(),{on,set,ready}=useWaveAlerts(),[busy,setBusy]=useState(false),[note,setNote]=useState('');
 if(!ready)return null;
 const toggle=async(next:boolean)=>{if(busy)return;setBusy(true);setNote('');try{setNote(await set(next));}finally{setBusy(false);}};
 return <Card style={{gap:8}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
   <Tile icon={BellRing} ink="amber"/>
   <View style={{flex:1,minWidth:0}}>
    <Copy bold size={14}>{tx('შემატყობინე, როცა ახლოს დაიყრება','Tell me when boxes drop nearby')}</Copy>
    <Copy muted size={11}>{tx('სახლიდან 1,5 კმ-ში · დღეში მაქსიმუმ 2-ჯერ','Within 1.5 km of home · at most twice a day')}</Copy>
   </View>
   {busy?<ActivityIndicator color={c.primary100}/>:<Switch value={on} onValueChange={v=>void toggle(v)} accessibilityLabel={tx('ყუთების შეტყობინება ახლოს','Nearby box alerts')} trackColor={{true:'#0D9488',false:c.bg300}} thumbColor="#fff"/>}
  </View>
  {note?<Copy size={11} style={{color:c.warning}}>{note}</Copy>:null}
 </Card>;
}
