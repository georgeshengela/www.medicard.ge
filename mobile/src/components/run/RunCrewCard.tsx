import React,{useEffect,useState} from 'react';
import {Keyboard,Pressable,Share,TextInput,View} from 'react-native';
import {Crown,LogOut,Send,UserMinus,UserPlus,Users} from 'lucide-react-native';
import {Switch} from '@/components/ui/AppSwitch';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {hubTint} from '@/theme/hub';
import {getPulseClient,usePulse} from '@/lib/medipulsi/client';
import {crewActions,normalizeCrewCode,useCrew,type Crew} from '@/lib/medipulsi/social';
import {formatKm} from '@/lib/run/geo';
import {tx} from '@/i18n/locale';
import {Action,BOLD,Card,Copy,Section,Sheet,runInk} from './PulseUi';

type Mode='create'|'join'|'manage'|null;
const km=(m:number)=>formatKm(m,1);

function Field({value,onChange,label,placeholder,max,code=false,onSubmit}:{value:string;onChange:(v:string)=>void;label:string;placeholder:string;max:number;code?:boolean;onSubmit:()=>void}){
 const c=useThemeColors();
 return <View style={{gap:8}}>
  <View style={{flexDirection:'row',alignItems:'center'}}><Copy bold size={14} style={{flex:1}}>{label}</Copy><Copy muted size={11}>{value.length}/{max}</Copy></View>
  <TextInput accessibilityLabel={label} value={value} onChangeText={v=>onChange(code?v.toUpperCase().replace(/[^A-Z0-9]/g,''):v)} maxLength={max} placeholder={placeholder} placeholderTextColor={c.text300} selectionColor={c.primary100}
   autoCorrect={false} autoCapitalize={code?'characters':'sentences'} autoFocus returnKeyType="done" submitBehavior="blurAndSubmit" onSubmitEditing={()=>{Keyboard.dismiss();onSubmit();}}
   style={{minHeight:52,paddingHorizontal:14,paddingVertical:12,borderRadius:16,borderWidth:1,borderColor:c.bg300,backgroundColor:c.surface,color:c.text100,fontFamily:BOLD,fontSize:code?22:16,letterSpacing:code?6:0,textAlign:code?'center':'left'}}/>
 </View>;
}

export function inviteMessage(crew:Pick<Crew,'name'|'code'|'link'>){
 return tx(`შემოუერთდი ჩემს MEDIRUN-ის გუნდს „${crew.name}“ — ერთად გავანათოთ ქალაქი 🌃\nკოდი: ${crew.code}\n${crew.link}`,`Join my MEDIRUN crew “${crew.name}” — let’s light up the city together 🌃\nCode: ${crew.code}\n${crew.link}`);
}

/**
 * „ჩემი გუნდი“ on the MEDIRUN hub (owner 2026-10-05): friends, a running club or an office walk together. Members
 * see nicknames and this week's distance; walking side by side shows „ერთად“ on the map and pays a few coins per
 * together-km. `joinCode` comes from a medicard.ge/crew/CODE link.
 */
export function RunCrewCard({joinCode,onJoinCodeUsed}:{joinCode?:string|null;onJoinCodeUsed?:()=>void}){
 const c=useThemeColors(),dark=useIsDark(),teal=runInk('teal',dark),query=useCrew(),crew=query.data?.crew||null,max=query.data?.max||30;
 const [mode,setMode]=useState<Mode>(null),[name,setName]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const ok=normalizeCrewCode(joinCode);if(!ok||query.isLoading)return;onJoinCodeUsed?.();if(crew?.code===ok)return;setCode(ok);setError('');setMode('join');},[joinCode,query.isLoading]);// eslint-disable-line react-hooks/exhaustive-deps
 const open=(m:Mode)=>{setError('');if(m==='create')setName('');if(m==='join'&&!normalizeCrewCode(code))setCode('');if(m==='manage')setName(crew?.name||'');setMode(m);};
 const act=async(fn:()=>Promise<unknown>,close=true)=>{
  if(busy)return;setBusy(true);setError('');
  try{await fn();if(close)setMode(null);}
  catch(e){setError((e as Error).message||tx('ვერ მოხერხდა. სცადე თავიდან.','That didn’t work. Try again.'));}
  finally{setBusy(false);}
 };
 const invite=()=>{if(crew)void Share.share({message:inviteMessage(crew)}).catch(()=>{});};
 if(query.isLoading&&!query.data)return null;
 if(query.isError&&!query.data)return null;   // older server: no crews yet — the card simply is not there
 const top=crew?.members.slice(0,5)||[];
 return <Section title={tx('ჩემი გუნდი','My crew')} link={crew?tx('მართვა','Manage'):undefined} onLink={crew?()=>open('manage'):undefined}>
  {crew?<Card style={{gap:14}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
    <View style={{width:42,height:42,borderRadius:14,backgroundColor:hubTint(teal,dark),alignItems:'center',justifyContent:'center'}}><Users size={20} color={teal}/></View>
    <View style={{flex:1,minWidth:0}}><Copy bold size={16} numberOfLines={1}>{crew.name}</Copy><Copy muted size={12}>{tx(`${crew.members.length} წევრი · კოდი ${crew.code}`,`${crew.members.length} ${crew.members.length===1?'member':'members'} · code ${crew.code}`)}</Copy></View>
   </View>
   <View style={{flexDirection:'row',borderTopWidth:1,borderColor:c.bg200,paddingTop:12}}>
    {[{v:km(crew.week.meters),l:tx('კმ ამ კვირაში','km this week')},{v:km(crew.week.togetherMeters),l:tx('კმ ერთად','km together')}].map((s,i)=><View key={s.l} style={{flex:1,alignItems:'center',borderLeftWidth:i?1:0,borderColor:c.bg200}}><Copy bold size={18} style={{fontVariant:['tabular-nums']}}>{s.v}</Copy><Copy muted size={11}>{s.l}</Copy></View>)}
   </View>
   <View style={{gap:0}}>{top.map((m,i)=><View key={m.memberId} style={{flexDirection:'row',alignItems:'center',gap:10,minHeight:40,borderTopWidth:i?1:0,borderColor:c.bg200}}>
    <Copy bold size={12} style={{width:18,color:c.text300,fontVariant:['tabular-nums']}}>{i+1}</Copy>
    <Copy bold={m.me} size={13} numberOfLines={1} style={{flex:1,color:m.me?teal:c.text100}}>{m.handle}{m.me?tx(' · შენ',' · you'):''}</Copy>
    {m.role==='owner'?<Crown size={13} color={c.text300}/>:null}
    <Copy bold size={13} style={{fontVariant:['tabular-nums']}}>{km(m.weekMeters)} {tx('კმ','km')}</Copy>
   </View>)}</View>
   {crew.members.length<max?<Action label={tx('მეგობრის მოწვევა','Invite a friend')} icon={UserPlus} onPress={invite}/>:<Copy muted size={12}>{tx(`გუნდი სავსეა (${max} წევრი).`,`The crew is full (${max} members).`)}</Copy>}
  </Card>
  :<Card style={{gap:12}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
    <View style={{width:42,height:42,borderRadius:14,backgroundColor:hubTint(teal,dark),alignItems:'center',justifyContent:'center'}}><Users size={20} color={teal}/></View>
    <Copy bold size={16} style={{flex:1}}>{tx('გაანათეთ ქალაქი ერთად','Light up the city together')}</Copy>
   </View>
   <Copy muted size={13}>{tx('შექმენი გუნდი მეგობრებთან, სარბენ კლუბთან ან ოფისთან. ერთად სიარულისას რუკაზე „ერთად“ ჩანს და ყოველ ერთად გავლილ კილომეტრზე ორივე იღებთ Medi Coins-ს.','Start a crew with friends, a running club or your office. Walk side by side and the map shows “Together” — and every kilometre together pays you both Medi Coins.')}</Copy>
   <View style={{flexDirection:'row',gap:10}}>
    <View style={{flex:1}}><Action label={tx('გუნდის შექმნა','Start a crew')} onPress={()=>open('create')}/></View>
    <View style={{flex:1}}><Action secondary label={tx('კოდით შესვლა','Join with a code')} onPress={()=>open('join')}/></View>
   </View>
   <Copy muted size={11}>{tx('გუნდის წევრები ხედავენ შენს MEDIRUN-ის სახელს და კვირის მანძილს — მდებარეობას არასდროს.','Crew members see your MEDIRUN nickname and weekly distance — never where you are.')}</Copy>
  </Card>}

  <Sheet title={tx('ახალი გუნდი','New crew')} visible={mode==='create'} onClose={()=>setMode(null)} keyboardAware
   footer={<Action busy={busy} disabled={name.trim().length<2} label={tx('გუნდის შექმნა','Start the crew')} onPress={()=>void act(()=>crewActions.create(name.trim()))}/>}>
   <Field value={name} onChange={setName} max={24} label={tx('გუნდის სახელი','Crew name')} placeholder={tx('მაგ. ვაკის მორბენლები','e.g. Vake Runners')} onSubmit={()=>{if(name.trim().length>=2)void act(()=>crewActions.create(name.trim()));}}/>
   <Copy muted size={12}>{tx(`სახელს მხოლოდ გუნდის წევრები ხედავენ. შექმნის შემდეგ მიიღებ კოდს და ბმულს — გაუზიარე, ვისაც გინდა (${max} წევრამდე).`,`Only crew members see the name. You’ll get a code and a link to share with whoever you like (up to ${max} members).`)}</Copy>
   {error?<Copy size={12} style={{color:c.danger}}>{error}</Copy>:null}
  </Sheet>

  <Sheet title={tx('გუნდში შესვლა','Join a crew')} visible={mode==='join'} onClose={()=>setMode(null)} keyboardAware
   footer={<Action busy={busy} disabled={!normalizeCrewCode(code)} label={tx('შესვლა','Join')} onPress={()=>void act(()=>crewActions.join(code))}/>}>
   <Field value={code} onChange={setCode} max={6} code label={tx('გუნდის კოდი','Crew code')} placeholder="ABC234" onSubmit={()=>{if(normalizeCrewCode(code))void act(()=>crewActions.join(code));}}/>
   <Copy muted size={12}>{tx('კოდი გუნდის წევრს ჰქონდა გაზიარებული (6 სიმბოლო). ერთდროულად ერთ გუნდში ხარ.','A crew member shares the code (6 characters). You can be in one crew at a time.')}</Copy>
   {error?<Copy size={12} style={{color:c.danger}}>{error}</Copy>:null}
  </Sheet>

  {crew?<ManageSheet visible={mode==='manage'} crew={crew} busy={busy} error={error} name={name} setName={setName} onClose={()=>setMode(null)} act={act} onInvite={invite}/>:null}
 </Section>;
}

function ManageSheet({visible,crew,busy,error,name,setName,onClose,act,onInvite}:{visible:boolean;crew:Crew;busy:boolean;error:string;name:string;setName:(v:string)=>void;onClose:()=>void;act:(fn:()=>Promise<unknown>,close?:boolean)=>Promise<void>;onInvite:()=>void}){
 const c=useThemeColors(),dark=useIsDark(),teal=runInk('teal',dark),pulse=usePulse(),owner=crew.role==='owner';
 const [confirm,setConfirm]=useState<string|null>(null);
 useEffect(()=>{if(!visible)setConfirm(null);},[visible]);
 const together=pulse.snapshot?.settings?.together!==false;
 return <Sheet title={crew.name} visible={visible} onClose={onClose} keyboardAware={owner}>
  <Card style={{gap:0,paddingVertical:4}}>{crew.members.map((m,i)=><View key={m.memberId} style={{flexDirection:'row',alignItems:'center',gap:10,minHeight:52,borderTopWidth:i?1:0,borderColor:c.bg200}}>
   <View style={{flex:1,minWidth:0}}><Copy bold size={13} numberOfLines={1} style={{color:m.me?teal:c.text100}}>{m.handle}{m.me?tx(' · შენ',' · you'):''}{m.role==='owner'?tx(' · შემქმნელი',' · creator'):''}</Copy><Copy muted size={11}>{tx(`${km(m.weekMeters)} კმ ამ კვირაში · ${km(m.togetherMeters)} კმ ერთად`,`${km(m.weekMeters)} km this week · ${km(m.togetherMeters)} km together`)}</Copy></View>
   {owner&&!m.me?<Pressable accessibilityRole="button" accessibilityLabel={confirm===m.memberId?tx(`დაადასტურე: ${m.handle} გუნდიდან ამოშლა`,`Confirm removing ${m.handle}`):tx(`${m.handle} გუნდიდან ამოშლა`,`Remove ${m.handle} from the crew`)} disabled={busy} hitSlop={6}
    onPress={()=>{if(confirm!==m.memberId){setConfirm(m.memberId);return;}setConfirm(null);void act(()=>crewActions.remove(m.memberId),false);}}
    style={{flexDirection:'row',alignItems:'center',gap:6,minHeight:36,paddingHorizontal:10,borderRadius:12,backgroundColor:confirm===m.memberId?'rgba(239,68,68,0.14)':c.bg200}}>
    <UserMinus size={14} color={confirm===m.memberId?c.danger:c.text200}/><Copy bold size={11} style={{color:confirm===m.memberId?c.danger:c.text200}}>{confirm===m.memberId?tx('დადასტურება','Confirm'):tx('ამოშლა','Remove')}</Copy>
   </Pressable>:null}
  </View>)}</Card>
  <Action secondary label={tx('ბმულის გაზიარება','Share the link')} icon={Send} onPress={onInvite}/>
  <Card style={{flexDirection:'row',alignItems:'center',gap:12}}>
   <View style={{flex:1}}><Copy bold size={14}>{tx('„ერთად“ ჩვენება','Show “Together”')}</Copy><Copy muted size={12}>{tx('როცა გუნდის წევრთან ახლოს დადიხარ, ორივე ხედავთ ერთმანეთის სახელს. გამორთვისას არავინ გხედავს და ერთად კილომეტრები არ ითვლება.','When you walk near a crew member, you both see each other’s name. Turned off, nobody sees you and together kilometres don’t count.')}</Copy></View>
   <Switch value={together} onValueChange={v=>void getPulseClient().settings({together:v}).catch(()=>{})} accessibilityLabel={tx('„ერთად“ ჩვენება','Show “Together”')}/>
  </Card>
  {owner?<View style={{gap:10}}>
   <View style={{gap:8}}><Copy bold size={14}>{tx('გუნდის სახელი','Crew name')}</Copy>
    <TextInput accessibilityLabel={tx('გუნდის სახელი','Crew name')} value={name} onChangeText={setName} maxLength={24} placeholderTextColor={c.text300} selectionColor={c.primary100} autoCorrect={false} returnKeyType="done" submitBehavior="blurAndSubmit" onSubmitEditing={()=>Keyboard.dismiss()}
     style={{minHeight:52,paddingHorizontal:14,paddingVertical:12,borderRadius:16,borderWidth:1,borderColor:c.bg300,backgroundColor:c.surface,color:c.text100,fontFamily:BOLD,fontSize:16}}/></View>
   <Action secondary busy={busy} disabled={name.trim().length<2||name.trim()===crew.name} label={tx('სახელის შენახვა','Save the name')} onPress={()=>void act(()=>crewActions.rename(name.trim()),false)}/>
  </View>:null}
  {error?<Copy size={12} style={{color:c.danger}}>{error}</Copy>:null}
  <Action secondary tone="danger" icon={LogOut} busy={busy} label={confirm==='leave'?tx('დიახ, დავტოვებ','Yes, leave'):tx('გუნდის დატოვება','Leave the crew')} onPress={()=>{if(confirm!=='leave'){setConfirm('leave');return;}void act(()=>crewActions.leave());}}/>
  {confirm==='leave'?<Copy muted size={11}>{owner&&crew.members.length>1?tx('გუნდს ყველაზე ძველი წევრი ჩაიბარებს. შენი კილომეტრები და ქოინები შენთან რჩება.','The longest-standing member takes over. Your kilometres and coins stay yours.'):tx('შენი კილომეტრები და ქოინები შენთან რჩება.','Your kilometres and coins stay yours.')}</Copy>:null}
 </Sheet>;
}
