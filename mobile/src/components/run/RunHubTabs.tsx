import React,{useEffect,useRef,useState} from 'react';
import {StyleSheet,Text,TouchableOpacity,View,type LayoutChangeEvent} from 'react-native';
import Animated,{Easing,useAnimatedStyle,useSharedValue,withTiming} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {ChartColumn,Footprints,Gift,UsersRound,type LucideIcon} from 'lucide-react-native';
import {TAB_BAR_HEIGHT,TAB_BAR_SIDE} from '@/components/navigation/FloatingTabBar';
import {usePrefersReducedMotion} from '@/hooks/usePrefersReducedMotion';
import {useThemeColors} from '@/theme/colors';
import {tx} from '@/i18n/locale';

/**
 * MEDIRUN hub sections (owner 2026-10-05: „გვერდი ძალიან დაგრძელდა — ქვემოთ მენიუ, ლოგიკური დანაყოფებით“):
 * start = go out now (boxes, passport, my walks), rewards = coins → goal → grand prize → collection, together =
 * crew → week race → the city, progress = last week (Mon–Wed) → this week → records → cities → help (owner 2026-10-09).
 */
export type RunHubTab='start'|'rewards'|'together'|'progress';
export const RUN_HUB_TABS:ReadonlyArray<{id:RunHubTab;label:string;Icon:LucideIcon}>=[
 {id:'start',label:tx('დაწყება','Start'),Icon:Footprints},
 {id:'rewards',label:tx('ჯილდოები','Rewards'),Icon:Gift},
 {id:'together',label:tx('ერთად','Together'),Icon:UsersRound},
 {id:'progress',label:tx('პროგრესი','Progress'),Icon:ChartColumn},
];
/** Space the page leaves under its content for the menu. */
export function useRunHubTabsInset(){const insets=useSafeAreaInsets();return TAB_BAR_HEIGHT+Math.max(insets.bottom,12)+28;}

const PAD=5;
/** The same floating pill as the app's tab bar and MEDICOACH's: raised surface, sliding indicator, small labels. */
export function RunHubTabBar({value,onChange}:{value:RunHubTab;onChange:(tab:RunHubTab)=>void}){
 const c=useThemeColors(),insets=useSafeAreaInsets(),reduceMotion=usePrefersReducedMotion();
 const index=Math.max(0,RUN_HUB_TABS.findIndex(t=>t.id===value));
 const [trackWidth,setTrackWidth]=useState(0);
 const tabWidth=trackWidth>0?(trackWidth-PAD*2)/RUN_HUB_TABS.length:0;
 const x=useSharedValue(0),placed=useRef(false);
 useEffect(()=>{
  if(!tabWidth)return;
  const to=PAD+index*tabWidth;
  if(!placed.current||reduceMotion){placed.current=true;x.value=to;return;}
  x.value=withTiming(to,{duration:180,easing:Easing.out(Easing.cubic)});
 },[index,tabWidth,reduceMotion,x]);
 const indicator=useAnimatedStyle(()=>({transform:[{translateX:x.value}]}));
 return <View pointerEvents="box-none" style={[st.wrap,{paddingBottom:Math.max(insets.bottom,12)}]}>
  <View onLayout={(e:LayoutChangeEvent)=>setTrackWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist" style={[st.bar,{backgroundColor:c.surfaceRaised,borderColor:c.bg300}]}>
   {tabWidth>0?<Animated.View pointerEvents="none" style={[st.indicator,{width:tabWidth,backgroundColor:c.accent100},indicator]}/>:null}
   {RUN_HUB_TABS.map(({id,label,Icon})=>{
    const active=id===value,color=active?c.primary100:c.text200;
    return <TouchableOpacity key={id} accessibilityRole="tab" accessibilityState={{selected:active}} accessibilityLabel={label} activeOpacity={0.65} style={st.tab}
     onPress={()=>{void Haptics.selectionAsync().catch(()=>undefined);onChange(id);}}>
     <Icon size={20} color={color} strokeWidth={active?2.3:1.8}/>
     <Text numberOfLines={1} style={{color,fontFamily:'NotoSansGeorgian_500Medium',fontSize:9,marginTop:4}}>{label}</Text>
    </TouchableOpacity>;
   })}
  </View>
 </View>;
}

const st=StyleSheet.create({
 wrap:{position:'absolute',left:0,right:0,bottom:0,paddingHorizontal:TAB_BAR_SIDE,paddingTop:18},
 bar:{height:TAB_BAR_HEIGHT,borderRadius:TAB_BAR_HEIGHT/2,borderWidth:1,flexDirection:'row',alignItems:'center',paddingHorizontal:PAD,elevation:8,shadowColor:'#000',shadowOffset:{width:0,height:8},shadowOpacity:0.18,shadowRadius:16},
 indicator:{position:'absolute',left:0,top:PAD,height:TAB_BAR_HEIGHT-PAD*2,borderRadius:(TAB_BAR_HEIGHT-PAD*2)/2},
 tab:{flex:1,height:'100%',alignItems:'center',justifyContent:'center',zIndex:1},
});
