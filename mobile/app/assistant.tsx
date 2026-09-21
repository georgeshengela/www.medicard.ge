import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AssistantDirectory } from '@/components/assistant/AssistantDirectory';
import { AssistantTalkDock } from '@/components/assistant/AssistantTalkDock';
import { AssistantVoiceStage } from '@/components/assistant/AssistantVoiceStage';
import { useAssistantVoice, assistantHaptic } from '@/components/assistant/useAssistantVoice';
import { useAssistantSpeech } from '@/components/assistant/useAssistantSpeech';
import { assistantDialogIntent, spokenAssistantReview, assistantFieldError } from '@/lib/assistantDialog';
import { ChevronLeft, ChevronDown, Ellipsis, PawPrint, Check } from 'lucide-react-native';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';
import { ChatFormScroll, ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AssistantForm } from '@/components/assistant/AssistantForm';
import { api, assistantRequest, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { assistantDisplay, assistantFieldLabels, stageAssistantLaunch, type AssistantAction, type AssistantChoices, type AssistantNative, type AssistantPlan, type AssistantReview, type AssistantTool, type AssistantFeature, type AssistantGroup } from '@/lib/assistant';

type Turn = { role: 'user' | 'assistant'; content: string };
export default function AssistantScreen() {
  const { user } = useAuth();
  return user ? <AssistantSession key={user.id} owner={user.id} /> : null;
}
function AssistantSession({ owner }: { owner: string }) {
  const C = useThemeColors(), router = useRouter();
  const { refreshHealthProfile } = useAuth();
  const scope = 'auto' as const;
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false), [tapMode, setTapMode] = useState(false), [detailsOpen, setDetailsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<{label:string; text:string; petId?:string}[]>([]);
  const [tools, setTools] = useState<AssistantTool[]>([]);
  const [features, setFeatures] = useState<AssistantFeature[]>([]), [groups, setGroups] = useState<AssistantGroup[]>([]);
  const [choices, setChoices] = useState<AssistantChoices>({});
  const [voice, setVoice] = useState(false), [voiceOutput, setVoiceOutput] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(true);
  const [text, setText] = useState('');
  const [history, setHistory] = useState<Turn[]>([]);
  const [review, setReview] = useState<AssistantReview | null>(null);
  const [draft, setDraft] = useState<AssistantAction | null>(null);
  const [manual, setManual] = useState(false), [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const [focusFields, setFocusFields] = useState<string[] | undefined>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [formEditing, setFormEditing] = useState(false);
  const [receipt, setReceipt] = useState<AssistantReview | null>(null);
  const alive = useRef(true), working = useRef(false), generation = useRef(0), scroll = useRef<ScrollView>(null);
  const focused = useRef(true);
  const retryPlan = useRef<{ value: string; fromVoice: boolean; petId?: string } | null>(null);
  const valid = (n = generation.current) => alive.current && focused.current && owner === localAccountId() && n === generation.current;
  const speech = useAssistantSpeech(owner, voiceOutput, setNotice);
  const capture = useAssistantVoice({ owner, blocked: !!busy,
    beforeStart: () => { retryPlan.current = null; speech.stop(); Keyboard.dismiss(); setError(null); setNotice(null); setVoiceMode(true); setManual(false); },
    onTranscript: value => { void send(value, true); },
    onError: setError, onNotice: setNotice,
  });
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; generation.current++; }; }, []));
  function reviewRows(current: AssistantAction) {
    return Object.entries(current.args).map(([key, value]) => {
      const list = key === 'id' ? (current.tool.startsWith('visit_') ? choices.visitId : choices.medicationId)
        : choices[key === 'breedId' ? 'breedId:' + current.args.speciesId : key];
      const name = list?.find(option => option.value === value)?.label;
      return { key, label: (key === 'petId' ? 'ცხოველი' : key === 'medicationId' ? 'მედიკამენტი' : key === 'id' ? 'ჩანაწერი' : key === 'dueTime' ? 'დრო' : assistantFieldLabels[key]) || key,
        value: name || assistantDisplay(value) };
    });
  }
  const reviewSpeech = (current: AssistantReview) => {
    const a = current.args;
    const name = choices.petId?.find(p => p.value === a.petId)?.label || 'ცხოველი';
    if (current.tool === 'pet_care_plan') {
      const recurrence = a.recurrenceKind !== 'ONCE' ? assistantDisplay(a.recurrenceKind) + (a.intervalCount ? ': ' + String(a.intervalCount) : '') + '. ' + assistantDisplay(a.recurrenceBasis) + '. ' : '';
      return name + ' · ' + String(a.title) + '. ' + String(a.startOn) + (a.dueTime ? ', ' + String(a.dueTime) + ' საათზე' : '') + '. ' + recurrence + (a.courseEndsOn ? 'ბოლო დღე: ' + String(a.courseEndsOn) + '. ' : '') + (a.dose ? 'დოზა: ' + String(a.dose) + ' ' + String(a.doseUnit || '') + '. ' : '') + (a.kind === 'VACCINATION' ? 'პირადი გეგმაა, კლინიკის ჯავშანი არ კეთდება. ' : '') + 'შევინახო?';
    }
    if (current.tool === 'hydration_add') return String(a.date) + ' · ' + String(a.amountMl) + ' მლ წყალი. ჩავწერო?';
    if (current.tool === 'open') return (choices.destination?.find(p => p.value === a.destination)?.label || current.label) + ' — გავხსნა?';
    return spokenAssistantReview(current.label, reviewRows(current), isHandoff(current.tool));
  };
  const errorText = (e: unknown, fallback: string) => e instanceof ApiError && e.fields?.length
    ? e.fields.map(field => { const key = field.field.split('.').pop() || ''; return assistantFieldError(key, field.message, assistantFieldLabels[key] || 'ველი'); }).join('\n')
    : e instanceof Error ? e.message : fallback;
  const isHandoff = (name: string) => tools.find(t => t.name === name)?.kind === 'handoff' || ['open', 'consult', 'pet_consult', 'pet_open', 'record_open', 'visit_open', 'medication_open'].includes(name);
  function cancelReview() {
    speech.stop(); setReview(null); setDraft(null); setManual(false); setReceipt(null); setFocusFields(undefined); setSuggestions([]);
    const reply = 'კარგი, გაუქმებულია.';
    setHistory(h => [...h, { role: 'assistant', content: reply }].slice(-12) as Turn[]); void speech.say(reply);
  }
  useFocusEffect(useCallback(() => {
    let current = true;
    assistantRequest<{ tools: AssistantTool[]; features?: AssistantFeature[]; groups?: AssistantGroup[]; choices: AssistantChoices; voiceInput: boolean; voiceOutput: boolean }>('catalog', owner, undefined, scope)
      .then(r => { if (current && valid()) { setTools(r.tools); setFeatures(r.features || []); setGroups(r.groups || []); setChoices(r.choices || {}); setVoice(r.voiceInput); setVoiceOutput(r.voiceOutput); } })
      .catch(e => { if (current && valid()) setError(e.message); });
    return () => { current = false; };
  }, [scope, owner]));
  async function afterSaved(saved: AssistantReview, startedGeneration: number) {
    // Read canonical server data; no optimistic health mutation or replayed local delta.
    const { requestHealthRefresh, resetHealthPullCache } = await import('@/lib/healthDataSync');
    if (!valid()) return;
    resetHealthPullCache(); requestHealthRefresh();
    const tasks: Promise<unknown>[] = [refreshHealthProfile()];
    if (['weight_goal', 'steps_goal'].includes(saved.tool)) {
      tasks.push(import('@/lib/accountSync').then(({ refreshAssistantAccountState }) => refreshAssistantAccountState(owner)));
    }
    if (saved.tool.startsWith('medication_')) {
      tasks.push(api.medications.list().then(async response => {
        if (owner !== localAccountId()) return;
        const { syncMedicationReminders } = await import('@/lib/notifications');
        if (owner === localAccountId()) await syncMedicationReminders(response.schedule, response.medications, owner);
      }));
    }
    tasks.push(assistantRequest<{ choices: AssistantChoices }>('catalog', owner, undefined, scope).then(result => {
      if (valid(startedGeneration)) setChoices(result.choices || {});
    }));
    await Promise.all(tasks);
  }
  async function confirm(current = review) {
    if (!current || working.current || capture.isBusy() || !valid()) return;
    retryPlan.current = null;
    speech.stop();
    const n = ++generation.current; working.current = true; setBusy(isHandoff(current.tool) ? 'ვხსნი…' : 'ვინახავ…'); setError(null);
    try {
      const result = await assistantRequest<{ status: string; native?: AssistantNative; operationId: string }>('execute', owner, { token: current.token, confirmed: true });
      if (!valid(n)) return;
      setReview(null); setDraft(null); setManual(false); setFocusFields(undefined); setReceipt(result.native ? null : current);
      setSuggestions([]);
      assistantHaptic('success');
      if (result.native) {
        // Open immediately; waiting for TTS playback made native handoffs feel stalled.
        if (stageAssistantLaunch(owner, result.operationId, result.native)) router.push(result.native.route as never);
      } else {
        const petName = choices.petId?.find(p => p.value === current.args.petId)?.label;
        const reply = current.tool === 'medication_add' ? `${String(current.args.medName)} დამატებულია.` : current.tool === 'pet_care_plan' && petName ? `${petName}ს გეგმა შენახულია — ${String(current.args.startOn)}${current.args.dueTime ? ', ' + String(current.args.dueTime) : ''}.` : 'შენახულია.';
        setHistory(h => [...h, { role: 'assistant', content: reply }].slice(-12) as Turn[]); void speech.say(reply);
        void afterSaved(current, n).catch(() => { if (valid(n)) setNotice('ჩანაწერი შენახულია. მონაცემების ან შეხსენებების განახლებისთვის შესაბამისი გვერდი გახსენი.'); });
      }
    } catch (e) { if (valid(n)) setError(e instanceof Error ? e.message : 'მოქმედება ვერ შესრულდა.'); }
    finally { working.current = false; if (alive.current) setBusy(null); }
  }
  async function send(message = text, fromVoice = false, petId?: string) {
    const value = message.trim();
    if (!value || working.current || capture.isBusy() || !valid()) return;
    retryPlan.current = null;
    speech.stop(); setNotice(null); setSuggestions([]); setDetailsOpen(false);
    const intent = assistantDialogIntent(value);
    if (review && intent === 'confirm') { setText(''); await confirm(); return; }
    if ((review || draft) && intent === 'cancel') { setText(''); cancelReview(); return; }
    if (!fromVoice) setVoiceMode(false);
    const n = ++generation.current; working.current = true; setBusy('ვამზადებ…'); setReceipt(null); setHistoryOpen(false); setError(null);
    // Editing language invalidates the previous preview before the next request.
    const currentDraft = review ? { tool: review.tool, args: review.args } : draft;
    setReview(null); setText(''); Keyboard.dismiss();
    setHistory(h => h.at(-1)?.role === 'user' && h.at(-1)?.content === value ? h : [...h, { role: 'user', content: value }].slice(-12) as Turn[]);
    try {
      const result = await assistantRequest<AssistantPlan>('plan', owner, { text: value, scope, history: history.slice(-10), draft: currentDraft, ...(petId ? { subjectId: petId } : {}) });
      if (!valid(n)) return;
      setHistory(h => [...h, { role: 'assistant', content: result.reply }].slice(-12) as Turn[]);
      void speech.say(result.review ? reviewSpeech(result.review) : result.reply);
      setText(''); setReview(result.review); setDraft(result.draft); setFocusFields(result.guidance?.fields); setManual(false); setSuggestions(result.suggestions || []);
      if (fromVoice) setVoiceMode(true);
    } catch (e) { if (valid(n)) { retryPlan.current = { value, fromVoice, petId }; setDraft(currentDraft); if (!fromVoice) setText(value); setError(errorText(e, 'კავშირი შეფერხდა.')); assistantHaptic('error'); } }
    finally { working.current = false; if (alive.current) setBusy(null); }
  }
  async function openFeature(feature: AssistantFeature) {
    if (working.current || capture.isBusy() || !valid()) return;
    speech.stop(); Keyboard.dismiss();
    const n = ++generation.current; working.current = true; setBusy('ვხსნი…'); setError(null);
    let ready: AssistantReview | null = null;
    try {
      const result = await assistantRequest<{review: AssistantReview}>('prepare', owner, { scope, action: { tool: 'open', args: { destination: feature.id } } });
      if (valid(n)) ready = result.review;
    } catch (e) { if (valid(n)) setError(errorText(e, 'გვერდი ვერ გაიხსნა.')); }
    finally { working.current = false; if (alive.current) setBusy(null); }
    if (ready && valid(n)) { setPicker(false); await confirm(ready); }
  }
  function chooseTool(tool: AssistantTool) {
    speech.stop(); Keyboard.dismiss(); setError(null); setNotice(null); setReceipt(null); setReview(null); setVoiceMode(false);
 setDraft({tool:tool.name,args:{}}); setFocusFields(undefined); setManual(true); setPicker(false); setFormEditing(false);
  }
  const showDirectory = () => { speech.stop(); Keyboard.dismiss(); setError(null); setPicker(true); };
  async function prepare(save = false) {
    if (!draft || working.current || capture.isBusy() || !valid()) return;
    retryPlan.current = null;
    speech.stop();
    let ready: AssistantReview | null = null;
    const n = ++generation.current; working.current = true; setBusy('ვამოწმებ…'); setError(null);
    try {
      const result = await assistantRequest<{ review: AssistantReview }>('prepare', owner, { scope, action: draft });
      if (valid(n)) { ready = result.review; setReview(ready); setManual(false); Keyboard.dismiss(); if (!save) void speech.say(reviewSpeech(ready)); }
    } catch (e) { if (valid(n)) setError(errorText(e, 'ველები გადაამოწმე.')); }
    finally { working.current = false; if (alive.current) setBusy(null); }
    if (save && ready && valid(n)) await confirm(ready);
  }
  const activeTool = tools.find(t => t.name === draft?.tool);
  const lastReply = [...history].reverse().find(turn => turn.role === 'assistant')?.content;
  const lastUser = [...history].reverse().find(turn => turn.role === 'user')?.content;
  const task = review || draft || receipt;
  const summaryRows = task ? reviewRows(task) : [];
  const visibleRows = summaryRows.filter(row => !['recurrenceBasis', 'source', 'timeMode', 'timezone'].includes(row.key));
  const quiet = { color: C.text200, fontSize: 12, lineHeight: 20, fontFamily: 'NotoSansGeorgian_400Regular' } as const;
  const button = (label: string, onPress: () => void, primary = false) => <Pressable accessibilityRole="button" disabled={!!busy || capture.phase !== 'idle'} onPress={onPress}
    style={{ minHeight: 46, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: primary ? '#0F766E' : C.bg200, opacity: busy ? .6 : 1 }}>
    <Text style={{ color: primary ? '#FFFFFF' : C.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_700Bold' }}>{label}</Text>
  </Pressable>;
  const resetConversation = () => { if (working.current || capture.isBusy()) return; speech.stop(); generation.current++; setHistory([]); setReview(null); setDraft(null); setReceipt(null); setText(''); setManual(false); setMenu(false); setError(null); setNotice(null); setHistoryOpen(false); setVoiceMode(true); };
  const header = <View style={{ paddingTop: insets.top, backgroundColor: C.bg100 }}><View style={{ height: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="უკან დაბრუნება" onPress={() => { if (picker) setPicker(false); else if (manual) setManual(false); else if (menu || historyOpen) { setMenu(false); setHistoryOpen(false); } else if (router.canGoBack()) router.back(); else router.replace('/(tabs)/home' as never); }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }}><ChevronLeft size={24} color={C.text100} /></Pressable>
    <View style={{ flex: 1, gap: 2 }}><Text style={{ color: C.text100, fontSize: 20, fontFamily: 'NotoSansGeorgian_700Bold' }}>Medi<Text style={{ color: C.primary200 }}>.</Text></Text><Text style={{ ...quiet, fontSize: 11 }}>შენი ასისტენტი</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="საუბრის პარამეტრები" accessibilityState={{ expanded: menu }} disabled={!!busy || capture.phase !== 'idle'} onPress={() => { speech.stop(); Keyboard.dismiss(); setMenu(!menu); }} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: menu ? C.bg200 : 'transparent' }}><Ellipsis size={23} color={C.text200} /></Pressable>
  </View></View>;
  return <ChatScreenShell style={{ backgroundColor: C.bg100 }} header={header}
    footer={picker || menu || historyOpen ? undefined : <AssistantTalkDock voice={voice} voiceOutput={voiceOutput} phase={capture.phase} duration={capture.duration} metering={capture.metering}
      speechPhase={speech.phase} muted={speech.muted} busy={busy} reviewing={!!review} text={text} onText={setText} onSend={() => void send()} tapMode={tapMode}
      voiceStage={voiceMode && !manual} formActive={!!draft && manual} formEditing={formEditing} onTextFocus={() => setFormEditing(false)} onSave={() => void prepare(true)} onMode={typing => { setVoiceMode(!typing); if (!typing) setManual(false); }}
      start={capture.start} release={capture.release} cancel={capture.cancel} stopSpeech={speech.stop} toggleSpeech={speech.toggle} />}>
    {menu ? <ChatFormScroll contentContainerStyle={{ padding: 24, gap: 14 }}>
      <Text style={{ color: C.text100, fontSize: 22, fontFamily: 'NotoSansGeorgian_700Bold', marginBottom: 8 }}>შენი საუბარი</Text>
      {button('საუბრის გაგრძელება', () => setMenu(false), true)}
      {history.length ? button('საუბრის ისტორია', () => { setMenu(false); setHistoryOpen(true); }) : null}
      {button('რას აკეთებს Medi', () => { setMenu(false); showDirectory(); })}
      {button(tapMode ? 'ჩაწერა: ერთი შეხებით' : 'ჩაწერა: დაჭერით და აშვებით', () => setTapMode(!tapMode))}
      <Text style={quiet}>{tapMode ? 'შეხება იწყებს ჩაწერას. მეორე შეხება აგზავნის.' : 'გეჭიროს საუბრისას. აშვებისას შენი ნათქვამი იგზავნება.'} Medi გისმენს მხოლოდ ჩაწერისას. ჩანაწერის შენახვამდე გეკითხება.</Text>
      {history.length || draft || review ? button('ახალი საუბარი', resetConversation) : null}
    </ChatFormScroll> : historyOpen ? <ChatFormScroll contentContainerStyle={{ padding: 20, gap: 16 }}>
      {history.map((turn, i) => <View key={i} style={{ alignSelf: turn.role === 'user' ? 'flex-end' : 'stretch', maxWidth: '95%', padding: 16, borderRadius: 20, backgroundColor: turn.role === 'user' ? C.bg200 : C.surface }}><Text selectable style={{ color: C.text100, fontSize: 14, lineHeight: 24, fontFamily: 'NotoSansGeorgian_400Regular' }}>{turn.content}</Text></View>)}
      {button('საუბრის გაგრძელება', () => setHistoryOpen(false))}
    </ChatFormScroll> : picker ? <AssistantDirectory tools={tools} features={features} groups={groups} busy={!!busy} error={error} onClose={() => { Keyboard.dismiss(); setPicker(false); }} onTool={chooseTool} onFeature={feature => void openFeature(feature)} /> : manual && draft && activeTool ? <ChatFormScroll ref={scroll} contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 18 }}>
      <Text style={{ color: C.text100, fontSize: 20, lineHeight: 30, fontFamily: 'NotoSansGeorgian_700Bold' }}>{activeTool.label}</Text>
      {error ? <Text accessibilityRole="alert" style={{ ...quiet, color: C.danger }}>{error}</Text> : null}
      <AssistantForm onFieldFocus={() => { speech.stop(); setFormEditing(true); }} key={draft.tool} schema={activeTool.parameters} values={draft.args} focusFields={focusFields} choices={{ ...choices, id: draft.tool.startsWith('visit_') ? choices.visitId : choices.medicationId }} disabled={!!busy || capture.phase !== 'idle'} onChange={args => { speech.stop(); setError(null); setDraft({ ...draft, args }); }} />
      {button('გადამოწმება', () => void prepare(), true)}
      {button('ხმით გაგრძელება', () => { Keyboard.dismiss(); setManual(false); setVoiceMode(true); })}
    </ChatFormScroll> : <AssistantVoiceStage phase={capture.phase} metering={capture.metering} processing={!!busy || capture.phase === 'transcribing'} speaking={speech.phase === 'speaking'}
      reply={review ? reviewSpeech(review) : lastReply} userText={lastUser} error={error} notice={notice} hasTask={!!task}>
      {error && !review && retryPlan.current ? <View style={{ width: '100%', gap: 8 }}>{button('ხელახლა ცდა', () => { const pending = retryPlan.current; if (pending) void send(pending.value, pending.fromVoice, pending.petId); }, true)}</View> : null}
      {suggestions.length ? <View style={{ width: '100%', gap: 10, flexDirection: suggestions.length <= 2 ? 'row' : 'column' }}>{suggestions.map((option, i) => <View key={i} style={suggestions.length <= 2 ? { flex: 1 } : undefined}>{button(option.label, () => void send(option.text, voiceMode, option.petId))}</View>)}</View> : null}
      {review ? <View style={{ width: '100%', borderRadius: 22, padding: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.bg300, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>{review.tool.startsWith('pet_') ? <PawPrint size={16} color={C.primary100} /> : <Check size={16} color={C.primary100} />}<Text style={quiet}>{isHandoff(review.tool) ? 'მზადაა გასახსნელად' : 'გადაამოწმე შენახვამდე'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen(!detailsOpen)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={quiet}>ჩანაწერის დეტალები</Text><ChevronDown size={17} color={C.text200} /></Pressable>
        {detailsOpen ? visibleRows.map(row => <View key={row.key} style={{ gap: 2 }}><Text style={{ ...quiet, fontSize: 11 }}>{row.label}</Text><Text selectable style={{ color: C.text100, fontSize: 14, lineHeight: 22, fontFamily: 'NotoSansGeorgian_400Regular' }}>{row.value}</Text></View>) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}>{button('გაუქმება', cancelReview)}</View><View style={{ flex: 1 }}>{button(isHandoff(review.tool) ? 'გახსნა' : 'შენახვა', () => void confirm(), true)}</View></View>
        {button('შესწორება', () => { speech.stop(); setDraft({ tool: review.tool, args: review.args }); setFocusFields(undefined); setReview(null); setManual(true); })}
      </View> : draft ? <View style={{ width: '100%', flexDirection: 'row', gap: 8 }}>
        <Pressable accessibilityRole="button" disabled={!!busy || capture.phase !== 'idle'} onPress={() => { speech.stop(); setManual(true); }} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={quiet}>ხელით შევსება</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!!busy} onPress={cancelReview} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={quiet}>გაუქმება</Text></Pressable>
      </View> : null}
    </AssistantVoiceStage>}
  </ChatScreenShell>;
}
