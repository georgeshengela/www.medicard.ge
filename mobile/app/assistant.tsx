import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AssistantTalkDock } from '@/components/assistant/AssistantTalkDock';
import { AssistantVoiceStage } from '@/components/assistant/AssistantVoiceStage';
import { useAssistantVoice, assistantHaptic } from '@/components/assistant/useAssistantVoice';
import { useAssistantSpeech } from '@/components/assistant/useAssistantSpeech';
import { assistantDialogIntent, spokenAssistantReview } from '@/lib/assistantDialog';
import { ChevronRight, Plus, Sparkles, UserRound, PawPrint, Volume2, Check, Pencil, X } from 'lucide-react-native';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors, useIsDark } from '@/theme/colors';
import { ChatFormScroll, ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { ChatTopNav } from '@/components/chat/ChatTopNav';
import { AssistantForm } from '@/components/assistant/AssistantForm';
import { assistantRequest, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { assistantDisplay, assistantFieldLabels, stageAssistantLaunch, type AssistantAction, type AssistantChoices, type AssistantNative, type AssistantPlan, type AssistantReview, type AssistantScope, type AssistantTool } from '@/lib/assistant';

type Turn = { role: 'user' | 'assistant'; content: string };
export default function AssistantScreen() {
  const { user } = useAuth();
  return user ? <AssistantSession key={user.id} owner={user.id} /> : null;
}
function AssistantSession({ owner }: { owner: string }) {
  const C = useThemeColors(), dark = useIsDark(), router = useRouter();
  const { refreshHealthProfile } = useAuth();
  const [scope, setScope] = useState<AssistantScope>('human');
  const [tools, setTools] = useState<AssistantTool[]>([]);
  const [choices, setChoices] = useState<AssistantChoices>({});
  const [voice, setVoice] = useState(false), [voiceOutput, setVoiceOutput] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(true), [transcript, setTranscript] = useState('');
  const [text, setText] = useState('');
  const [history, setHistory] = useState<Turn[]>([]);
  const [review, setReview] = useState<AssistantReview | null>(null);
  const [draft, setDraft] = useState<AssistantAction | null>(null);
  const [manual, setManual] = useState(false), [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<string[]>([]);
  const alive = useRef(true), working = useRef(false), generation = useRef(0), scroll = useRef<ScrollView>(null);
  const focused = useRef(true);
  const valid = (n = generation.current) => alive.current && focused.current && owner === localAccountId() && n === generation.current;
  const speech = useAssistantSpeech(owner, voiceOutput, setNotice);
  const capture = useAssistantVoice({ owner, blocked: !!busy,
    beforeStart: () => { speech.stop(); Keyboard.dismiss(); setError(null); setNotice(null); setVoiceMode(true); setTranscript(''); },
    onTranscript: value => { setTranscript(value); void send(value, true); },
    onError: setError, onNotice: setNotice,
  });
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; generation.current++; }; }, []));
  function reviewRows(current: AssistantReview) {
    return Object.entries(current.args).map(([key, value]) => {
      const list = key === 'id' ? (current.tool.startsWith('visit_') ? choices.visitId : choices.medicationId)
        : choices[key === 'breedId' ? 'breedId:' + current.args.speciesId : key];
      const name = list?.find(option => option.value === value)?.label;
      return { key, label: (key === 'petId' ? 'ცხოველი' : key === 'medicationId' ? 'მედიკამენტი' : key === 'id' ? 'ჩანაწერი' : assistantFieldLabels[key]) || key,
        value: name || assistantDisplay(value) };
    });
  }
  const reviewSpeech = (current: AssistantReview) => spokenAssistantReview(current.label, reviewRows(current), ['open', 'consult', 'pet_consult'].includes(current.tool));
  const errorText = (e: unknown, fallback: string) => e instanceof ApiError && e.fields?.length
    ? e.fields.map(field => (assistantFieldLabels[field.field.split('.').pop() || ''] || 'ველი') + ': ' + field.message).join('\n')
    : e instanceof Error ? e.message : fallback;
  function cancelReview() {
    speech.stop(); setReview(null); setDraft(null); setManual(false);
    const reply = 'კარგი, ეს მოქმედება გავაუქმე. სხვა რით დაგეხმარო?';
    setHistory(h => [...h, { role: 'assistant', content: reply }].slice(-12) as Turn[]); void speech.say(reply);
  }
  useEffect(() => {
    let current = true;
    assistantRequest<{ tools: AssistantTool[]; choices: AssistantChoices; voiceInput: boolean; voiceOutput: boolean }>('catalog', owner, undefined, scope)
      .then(r => { if (current && valid()) { setTools(r.tools); setChoices(r.choices || {}); setVoice(r.voiceInput); setVoiceOutput(r.voiceOutput); } })
      .catch(e => { if (current && valid()) setError(e.message); });
    return () => { current = false; };
  }, [scope, owner]);
  const changeScope = (next: AssistantScope) => {
    if (next === scope || working.current || capture.isBusy()) return;
    speech.stop(); setNotice(null); setTranscript('');
    generation.current++; setScope(next); setHistory([]); setReview(null); setDraft(null); setManual(false); setText(''); setContext([]); setError(null); setTools([]);
  };
  async function afterSaved() {
    // Read canonical server data; no optimistic health mutation or replayed local delta.
    const { requestHealthRefresh, resetHealthPullCache } = await import('@/lib/healthDataSync');
    if (!valid()) return;
    resetHealthPullCache(); requestHealthRefresh();
    await refreshHealthProfile();
    if (!valid()) return;
    const { refreshAssistantAccountState } = await import('@/lib/accountSync');
    await refreshAssistantAccountState(owner);
  }
  async function confirm(current = review) {
    if (!current || working.current || capture.isBusy() || !valid()) return;
    speech.stop();
    const n = generation.current; working.current = true; setBusy('მოქმედება სრულდება…'); setError(null);
    try {
      const result = await assistantRequest<{ status: string; native?: AssistantNative; operationId: string }>('execute', owner, { token: current.token, confirmed: true });
      if (!valid(n)) return;
      setReview(null); setDraft(null); setManual(false);
      setVoiceMode(false);
      assistantHaptic('success');
      if (result.native) {
        await speech.say(current.tool === 'consult' && current.args.mode === 'CONSILIUM' ? 'კონსილიუმს ვხსნი.' : 'კარგი, შესაბამის გვერდს ვხსნი.');
        if (!valid(n)) return;
        if (stageAssistantLaunch(owner, result.operationId, result.native)) router.push(result.native.route as never);
      } else {
        const reply = `შენახულია — ${current.label}. სხვა რით დაგეხმარო?`;
        setHistory(h => [...h, { role: 'assistant', content: reply }].slice(-12) as Turn[]); void speech.say(reply);
        try { await afterSaved(); } catch { if (valid(n)) setError('ჩანაწერი შეინახა. ეკრანზე განახლება შეფერხდა — შესაბამისი გვერდი ხელახლა გახსენი.'); }
      }
    } catch (e) { if (valid(n)) setError(e instanceof Error ? e.message : 'მოქმედება ვერ შესრულდა.'); }
    finally { working.current = false; if (alive.current) setBusy(null); }
  }
  async function send(message = text, fromVoice = false) {
    const value = message.trim();
    if (!value || working.current || capture.isBusy() || !valid()) return;
    speech.stop(); setNotice(null);
    const intent = assistantDialogIntent(value);
    if (review && intent === 'confirm') { setText(''); await confirm(); return; }
    if ((review || draft) && intent === 'cancel') { setText(''); setVoiceMode(false); cancelReview(); return; }
    if (!fromVoice) setVoiceMode(false);
    const n = generation.current; working.current = true; setBusy('Medi ამზადებს…'); setError(null);
    // Editing language invalidates the previous preview before the next request.
    const currentDraft = review ? { tool: review.tool, args: review.args } : draft;
    setReview(null); setText(''); Keyboard.dismiss();
    setHistory(h => [...h, { role: 'user', content: value }].slice(-12) as Turn[]);
    try {
      const result = await assistantRequest<AssistantPlan>('plan', owner, { text: value, scope, history: history.slice(-10), draft: currentDraft });
      if (!valid(n)) return;
      setHistory(h => [...h, { role: 'assistant', content: result.reply }].slice(-12) as Turn[]);
      void speech.say(result.review ? reviewSpeech(result.review) : result.reply);
      setText(''); setReview(result.review); setDraft(result.draft); setContext(result.contextDomains); setManual(false);
      setVoiceMode(false);
    } catch (e) { if (valid(n)) { setDraft(currentDraft); setText(value); setError(errorText(e, 'კავშირი შეფერხდა.')); assistantHaptic('error'); } }
    finally { working.current = false; if (alive.current) setBusy(null); }
  }
  async function prepare() {
    if (!draft || working.current || capture.isBusy() || !valid()) return;
    const n = generation.current; working.current = true; setBusy('ვამოწმებ ველებს…'); setError(null);
    try {
      const result = await assistantRequest<{ review: AssistantReview }>('prepare', owner, { scope, action: draft });
      if (valid(n)) { setReview(result.review); setManual(false); Keyboard.dismiss(); void speech.say(reviewSpeech(result.review)); }
    } catch (e) { if (valid(n)) setError(errorText(e, 'ველები გადაამოწმე.')); }
    finally { working.current = false; if (alive.current) setBusy(null); }
  }
  const activeTool = tools.find(t => t.name === draft?.tool);
  const button = (label: string, onPress: () => void, primary = false) => <Pressable accessibilityRole="button" disabled={!!busy || capture.phase !== 'idle'} onPress={onPress}
    style={{ minHeight: 46, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: primary ? '#0F766E' : C.bg200, opacity: busy ? .6 : 1 }}>
    <Text style={{ color: primary ? '#FFFFFF' : C.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_700Bold' }}>{label}</Text>
  </Pressable>;
  const scopes = <View style={{ flexDirection: 'row', gap: 8 }}>{(['human', 'pet'] as const).map(s => <Pressable key={s} accessibilityRole="tab" accessibilityState={{ selected: scope === s }} disabled={!!busy || capture.phase !== 'idle'} onPress={() => changeScope(s)}
    style={{ flex: 1, minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: scope === s ? C.primary100 : C.bg300, backgroundColor: scope === s ? C.accent100 : C.surface }}>
    {s === 'human' ? <UserRound size={17} color={C.primary100} /> : <PawPrint size={17} color={C.primary100} />}
    <Text style={{ color: C.text100, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13 }}>{s === 'human' ? 'ჩემთვის' : 'ჩემი ცხოველისთვის'}</Text>
  </Pressable>)}</View>;
  return <ChatScreenShell style={voiceMode ? { backgroundColor: dark ? C.bg100 : '#FFFFFF' } : undefined} header={<ChatTopNav title={scope === 'pet' ? 'Medi Vet' : 'Medi'} subtitle="შენი ყოველდღიური ასისტენტი" icon={Sparkles} onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/home' as never)} />}
    footer={<AssistantTalkDock voice={voice} voiceOutput={voiceOutput} phase={capture.phase} duration={capture.duration} metering={capture.metering}
      speechPhase={speech.phase} muted={speech.muted} busy={busy} reviewing={!!review} text={text} onText={setText} onSend={() => void send()}
      voiceStage={voiceMode} onMode={typing => { setVoiceMode(!typing); setTranscript(''); }}
      start={capture.start} release={capture.release} cancel={capture.cancel} stopSpeech={speech.stop} toggleSpeech={speech.toggle} />}>
    {voiceMode ? <View style={{ flex: 1, minHeight: 0 }}><View style={{ paddingHorizontal: 16, paddingTop: 12 }}>{scopes}</View>
      <AssistantVoiceStage phase={capture.phase} metering={capture.metering} transcript={transcript} notice={notice} error={error} pet={scope === 'pet'} processing={!!busy || capture.phase === 'transcribing'} />
    </View> : <ChatFormScroll ref={scroll} contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 16 }} onContentSizeChange={() => { if (!manual) scroll.current?.scrollToEnd({ animated: true }); }}>
      {scopes}
      {!history.length ? <View style={{ padding: 18, borderRadius: 22, backgroundColor: C.surface, gap: 12, borderWidth: 1, borderColor: C.bg300 }}>
        <Text style={{ color: C.text100, fontSize: 22, lineHeight: 32, fontFamily: 'NotoSansGeorgian_700Bold' }}>მოუყევი Medi-ს</Text>
        <Text style={{ color: C.text200, fontSize: 13, lineHeight: 22, fontFamily: 'NotoSansGeorgian_400Regular' }}>ჩანაწერი, მიზანი თუ კონსულტაცია — დაიწყე შენი სიტყვებით. შენახვამდე ერთად გადავამოწმებთ დეტალებს.</Text>
        {(scope === 'human' ? ['დღეს დავლიე 250 მლ წყალი', 'მიზნად მინდა 100 კილოგრამი', 'თავი მტკივა, შეკარი კონსილიუმი'] : ['მინდა დავამატო ძაღლი რექსი', 'მინდა ცხოველის წონა ჩავწერო']).map(example => <Pressable accessibilityRole="button" key={example} disabled={!!busy} onPress={() => setText(example)} style={{ minHeight: 44, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1, color: C.primary100, fontSize: 13, lineHeight: 21, fontFamily: 'NotoSansGeorgian_400Regular' }}>{example}</Text><ChevronRight size={16} color={C.primary100} />
        </Pressable>)}
      </View> : history.map((turn, i) => <View key={i} style={{ alignSelf: turn.role === 'user' ? 'flex-end' : 'stretch', maxWidth: '96%', padding: 14, borderRadius: 18, gap: 6, backgroundColor: turn.role === 'user' ? C.accent100 : C.surface }}>
        <Text style={{ color: C.primary100, fontSize: 11, fontFamily: 'NotoSansGeorgian_700Bold' }}>{turn.role === 'user' ? 'შენ' : 'Medi'}</Text>
        <Text selectable style={{ color: C.text100, fontSize: 14, lineHeight: 23, fontFamily: 'NotoSansGeorgian_400Regular' }}>{turn.content}</Text>
      </View>)}
      {context.length ? <Text style={{ color: C.text200, fontSize: 11, lineHeight: 17, fontFamily: 'NotoSansGeorgian_400Regular' }}>გამოყენებულია ანგარიშის შესაბამისი, ბოლო ჩანაწერები. {scope === 'pet' ? 'ადამიანის ჯანმრთელობის მონაცემები გამიჯნულია.' : 'დაცული ციკლის მონაცემები არ იხსნება.'}</Text> : null}
      {review && !manual ? <View style={{ padding: 16, borderRadius: 20, borderWidth: 1, borderColor: C.primary100, backgroundColor: C.surface, gap: 13 }}>
        <Text style={{ color: C.text100, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>{review.label}</Text>
        {reviewRows(review).map(({ key, label, value }) => <View key={key} style={{ gap: 3 }}><Text style={{ color: C.text200, fontSize: 11, fontFamily: 'NotoSansGeorgian_400Regular' }}>{label}</Text><Text selectable style={{ color: C.text100, fontSize: 14, lineHeight: 22, fontFamily: 'NotoSansGeorgian_400Regular' }}>{value}</Text></View>)}
        <Text style={{ color: C.text200, fontSize: 12, lineHeight: 19, fontFamily: 'NotoSansGeorgian_400Regular' }}>ჯერ არ შესრულებულა. გადაამოწმე და დაადასტურე.</Text>
        {button(['open', 'consult', 'pet_consult'].includes(review.tool) ? 'დადასტურება და გახსნა' : 'დადასტურება და შენახვა', () => void confirm(), true)}
        <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}>{button('შესწორება', () => { speech.stop(); setDraft({ tool: review.tool, args: review.args }); setReview(null); setManual(true); })}</View><View style={{ flex: 1 }}>{button('გაუქმება', cancelReview)}</View></View>
      </View> : null}
      {draft && !review ? <View style={{ padding: 16, gap: 14, backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.bg300 }}>
        <Text style={{ color: C.text100, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>{activeTool?.label || 'მონახაზი'}</Text>
        {manual && activeTool ? <><AssistantForm schema={activeTool.parameters} values={draft.args} choices={{ ...choices, id: draft.tool.startsWith('visit_') ? choices.visitId : choices.medicationId }} disabled={!!busy} onChange={args => setDraft({ ...draft, args })} />{button('ინფორმაციის გადამოწმება', () => void prepare(), true)}</> : <Text style={{ color: C.text200, fontSize: 13, lineHeight: 21, fontFamily: 'NotoSansGeorgian_400Regular' }}>{assistantDisplay(draft.args) || 'შეავსე საჭირო ინფორმაცია.'}</Text>}
        {button(manual ? 'მოყოლით გავაგრძელებ' : 'ხელით შევავსებ', () => setManual(!manual))}
      </View> : null}
      {notice ? <View style={{ padding: 12, borderRadius: 14, backgroundColor: C.bg200 }}><Text accessibilityLiveRegion="polite" style={{ color: C.text200, fontSize: 12, lineHeight: 20, fontFamily: 'NotoSansGeorgian_400Regular' }}>{notice}</Text></View> : null}
      {busy ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><ActivityIndicator color={C.primary100} /><Text style={{ color: C.text200, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13 }}>{busy}</Text></View> : null}
      {error ? <View accessibilityRole="alert" style={{ padding: 14, gap: 8, borderRadius: 16, backgroundColor: C.dangerBg }}><Text style={{ color: C.danger, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 22 }}>{error}</Text>{button('დახურვა', () => setError(null))}</View> : null}
      {!review && !draft ? <>{button(picker ? 'სიის დახურვა' : 'ხელით არჩევა', () => setPicker(!picker))}{picker ? tools.map(tool => <Pressable key={tool.name} accessibilityRole="button" disabled={!!busy} onPress={() => { setDraft({ tool: tool.name, args: {} }); setManual(true); setPicker(false); }} style={{ minHeight: 46, flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8 }}><Plus size={17} color={C.primary100} /><Text style={{ flex: 1, color: C.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_400Regular' }}>{tool.label}</Text></Pressable>) : null}</> : null}
    </ChatFormScroll>}
  </ChatScreenShell>;
}
