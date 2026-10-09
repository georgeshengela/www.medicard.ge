import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
import { AssistantDirectory } from '@/components/assistant/AssistantDirectory';
import { AssistantForm } from '@/components/assistant/AssistantForm';
import { useAssistantSpeech } from '@/components/assistant/useAssistantSpeech';
import { assistantHaptic, useAssistantVoice } from '@/components/assistant/useAssistantVoice';
import { ChatFormScroll, ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { MediContextChip } from '@/components/chat/MediContextChip';
import { QuotaSheet } from '@/components/QuotaSheet';
import { aiConsentDeclinedText, aiConsentRetryLabel, isAiConsentDeclined } from '@/lib/aiConsentDecline';
import { streamAiQuery } from '@/lib/aiQueryStream';
import { CHAT_MESSAGE_LIMIT, IncompleteAnalysisError, requireAnalysisText } from '@/lib/analysisFlow';
import { api, ApiError, assistantRequest } from '@/lib/api';
import {
  assistantDisplay, assistantFieldLabels, stageAssistantLaunch,
  type AssistantAction, type AssistantChoices, type AssistantFeature, type AssistantGroup, type AssistantNative, type AssistantPlan, type AssistantReview, type AssistantTool,
} from '@/lib/assistant';
import { assistantDialogIntent, assistantFieldError, spokenAssistantReview } from '@/lib/assistantDialog';
import type { CycleMediContext } from '@/lib/cycleMediContext';
import { featureForHref, featureMessage, isFeatureOn, useFeature } from '@/lib/featureFlags';
import { refreshFeatureFlags } from '@/lib/featureFlagSync';
import { localAccountId, onLocalAccountChange } from '@/lib/localAccount';
import { clearMediDraft, holdMediDraft, takeMediCycleContext, takeMediDraft, takeMediPrefill } from '@/lib/mediHandoff';
import { legacyChatRouteToMedi } from '@/lib/mediModes';
import {
  clinicalSessions, consultFromReview, HIDDEN_ACTION_FIELDS, humanCardValue, plannerHistory, spokenAnswer, storedTurns, turnId, turnsFromSession,
  type ClinicalMode, type MediTurn, type StoredTurn,
} from '@/lib/mediThread';
import { useAuth } from '@/store/AuthContext';
import { displayFirstName } from '@/lib/displayName';
import { useThemeColors } from '@/theme/colors';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { MediComposer } from './MediComposer';
import { MediMenuSheet } from './MediMenuSheet';
import { MediTopBar } from './MediTopBar';
import { ActionCard, AnswerTurn, MediLine, ThinkingTurn, UserTurn } from './MediTurns';
import { MediWelcome } from './MediWelcome';

type Busy = null | 'plan' | 'answer' | 'deep' | 'save' | 'open' | 'check' | 'history';
type Retry = { value: string; route: 'plan' | ClinicalMode; fromVoice: boolean; petId?: string };
const HANDOFF_TOOLS = ['open', 'consult', 'pet_consult', 'pet_open', 'record_open', 'visit_open', 'medication_open'];
// The question held when she closed Medi mid-answer belongs to one account: sign-out or a switch drops it.
onLocalAccountChange(() => clearMediDraft());

export type MediChatProps = {
  owner: string;
  sessionId?: string;
  /** ?mode=deep: open with the consilium switch on. */
  startConsilium?: boolean;
  /** ?mode=doctor: the first question goes straight to the clinical model (it is already a health question). */
  directDoctor?: boolean;
  /** Fixed copy from the route (push notifications, neutral chip questions) — never health text. */
  prefill?: string;
  /** `handoff=1`: a drafted question waits in memory (mediHandoff), consume-once, for this account. */
  handoff?: boolean;
  /** The requested mode is paused from admin: say so once. */
  pausedMessage?: string;
};

/**
 * The one Medi chat (owner 2026-10-03): Medi, the doctor and the consilium in one conversation.
 * Medi's planner answers first; a health question becomes a clinical answer in the same thread.
 * See src/lib/mediThread.ts for the rules and storage.
 */
export function MediChat({ owner, sessionId, startConsilium, directDoctor, prefill, handoff, pausedMessage }: MediChatProps) {
  const C = useThemeColors();
  const router = useRouter();
  const { user, healthProfile, refreshHealthProfile, applyUsage } = useAuth();
  const doctorOn = useFeature('mediDoctor');
  const deepOn = useFeature('mediDeep');
  const voiceOn = useFeature('voice');

  const [turns, setTurns] = useState<MediTurn[]>([]);
  const [text, setText] = useState(typeof prefill === 'string' ? prefill : '');
  const [busy, setBusy] = useState<Busy>(sessionId ? 'history' : null);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [consilium, setConsilium] = useState(!!startConsilium);
  const [draft, setDraft] = useState<AssistantAction | null>(null);
  const [manual, setManual] = useState(false), [picker, setPicker] = useState(false), [menu, setMenu] = useState(false);
  const [focusFields, setFocusFields] = useState<string[] | undefined>();
  const [suggestions, setSuggestions] = useState<{ label: string; text: string; petId?: string }[]>([]);
  const [notice, setNotice] = useState<string | null>(pausedMessage ?? null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<Retry | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);
  const [cycleContext, setCycleContext] = useState<CycleMediContext | null>(null);
  const [tools, setTools] = useState<AssistantTool[]>([]);
  const [features, setFeatures] = useState<AssistantFeature[]>([]), [groups, setGroups] = useState<AssistantGroup[]>([]);
  const [choices, setChoices] = useState<AssistantChoices>({});
  const [voiceAvail, setVoiceAvail] = useState(false), [voiceOutAvail, setVoiceOutAvail] = useState(false);
  const [scrolledUp, setScrolledUp] = useState(false);

  const turnsRef = useRef<MediTurn[]>([]); turnsRef.current = turns;
  const working = useRef(false), alive = useRef(true), focused = useRef(true), generation = useRef(0);
  const conversation = useRef<string | undefined>(undefined);
  const copyOnFirstSave = useRef<StoredTurn[] | null>(null);
  const sessions = useRef<Partial<Record<ClinicalMode, string>>>({});
  const directNext = useRef<ClinicalMode | null>(directDoctor ? 'DOCTOR' : null);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const abort = useRef<AbortController | null>(null);
  /** The question on its way (planner or answer) until it settles; held as a draft if she closes Medi first. */
  const asking = useRef<string | null>(null);
  const list = useRef<FlatList<MediTurn>>(null), nearBottom = useRef(true);
  const cycleContextRef = useRef<CycleMediContext | null>(null); cycleContextRef.current = cycleContext;
  const cycleContextExcluded = useRef(false);

  const voiceIn = voiceAvail && voiceOn, voiceOut = voiceOutAvail && voiceOn;
  const consiliumOn = consilium && deepOn;
  const valid = (n = generation.current) => alive.current && focused.current && owner === localAccountId() && n === generation.current;
  // An answer or plan already on its way settles even while another screen covers Medi (menu → privacy, a
  // notification): it finishes, is saved in the thread, or fails with the question back in the composer.
  // Only a reset, a new message, closing Medi or another account cancels it. Focus gates new actions and
  // side effects (speech, haptics, navigation) — never the result itself.
  const live = (n: number) => alive.current && owner === localAccountId() && n === generation.current;
  const isHandoff = (name: string) => tools.find(t => t.name === name)?.kind === 'handoff' || HANDOFF_TOOLS.includes(name);

  // Closing Medi mid-answer is Stop (the server stores nothing); her question waits in memory as a draft.
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; abort.current?.abort(); if (asking.current && owner === localAccountId()) holdMediDraft(owner, asking.current); }; }, []);
  // Opening Medi re-checks the admin switches (≤1/min), so a paused mode hides here without leaving the app.
  useFocusEffect(useCallback(() => { focused.current = true; void refreshFeatureFlags(); return () => { focused.current = false; }; }, []));

  // A drafted question (alert, tip, lab, symptoms, cycle) arrives in memory, never in the URL.
  useEffect(() => {
    if (sessionId || pausedMessage) return;
    const drafted = handoff ? takeMediPrefill(owner) : null;
    if (drafted) { setText(drafted); directNext.current = 'DOCTOR'; }
    const staged = takeMediCycleContext(owner, drafted ?? (typeof prefill === 'string' ? prefill : null));
    if (staged) { setCycleContext(staged); directNext.current = 'DOCTOR'; }
    // Once per mount: a second read finds nothing (consume-once).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The question she was waiting on when she last closed Medi comes back in the composer, only as a draft.
  // A drafted question from another screen (prefill / handoff) wins; the held one then waits for a plain open.
  useEffect(() => {
    if (handoff || (typeof prefill === 'string' && prefill.trim())) return;
    const held = takeMediDraft(owner);
    if (held) setText(current => (current.trim() ? current : held));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHistory = useCallback(() => {
    if (!sessionId) return () => undefined;
    let current = true;
    setBusy('history'); setHistoryFailed(false);
    api.chats.get(sessionId).then(r => {
      if (!current || owner !== localAccountId()) return;
      const loaded = turnsFromSession(r.session);
      setTurns(loaded);
      sessions.current = clinicalSessions(loaded);
      if (r.session.mode === 'ASSISTANT') conversation.current = r.session.id;
      // An old consultation continues inside a new Medi thread that carries its last turns.
      else { copyOnFirstSave.current = storedTurns(loaded).slice(-30); if (r.session.mode === 'CONSILIUM') setConsilium(true); }
    }).catch(() => { if (current) setHistoryFailed(true); })
      .finally(() => { if (current) setBusy(b => (b === 'history' ? null : b)); });
    return () => { current = false; };
  }, [sessionId, owner]);
  useEffect(() => loadHistory(), [loadHistory]);

  /** Tools (with their forms), pages and the voice switches. Loaded on focus; „შესწორება“ loads it again after a failure. */
  const loadCatalog = (apply: () => boolean) =>
    assistantRequest<{ tools: AssistantTool[]; features?: AssistantFeature[]; groups?: AssistantGroup[]; choices: AssistantChoices; voiceInput: boolean; voiceOutput: boolean }>('catalog', owner, undefined, 'auto')
      .then(r => {
        if (!apply()) return null;
        setTools(r.tools); setFeatures(r.features || []); setGroups(r.groups || []); setChoices(r.choices || {}); setVoiceAvail(r.voiceInput); setVoiceOutAvail(r.voiceOutput);
        return r.tools;
      });
  useFocusEffect(useCallback(() => {
    let current = true;
    loadCatalog(() => current && valid()).catch(() => undefined);
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]));

  const persist = (stored: StoredTurn[]) => {
    const copy = copyOnFirstSave.current;
    const batch = copy ? [...copy, ...stored] : stored;
    if (!batch.length) return;
    saving.current = saving.current.then(() => api.chats.appendAssistant({ sessionId: conversation.current, turns: batch })
      .then(r => { if (owner === localAccountId()) { conversation.current = r.sessionId; copyOnFirstSave.current = null; } })).catch(() => undefined);
  };

  const scrollToEnd = useCallback((force = false) => {
    if (force) { nearBottom.current = true; setScrolledUp(false); }
    if (!nearBottom.current) return;
    requestAnimationFrame(() => { if (alive.current && nearBottom.current) list.current?.scrollToEnd({ animated: true }); });
  }, []);

  const speech = useAssistantSpeech(owner, voiceOut, setNotice);
  const capture = useAssistantVoice({ owner, blocked: !!busy || !voiceIn,
    beforeStart: () => { speech.stop(); Keyboard.dismiss(); setError(null); setNotice(null); setRetry(null); },
    onTranscript: value => { void send(value, true); },
    onError: setError, onNotice: setNotice,
  });

  const addTurns = (...next: MediTurn[]) => setTurns(t => [...t, ...next]);
  const patchTurn = (id: string, patch: Partial<MediTurn>) => setTurns(t => t.map(turn => (turn.id === id ? ({ ...turn, ...patch } as MediTurn) : turn)));
  const dropTurns = (...ids: string[]) => setTurns(t => t.filter(turn => !ids.includes(turn.id)));
  const now = () => new Date().toISOString();

  function reviewRows(current: AssistantAction) {
    return Object.entries(current.args).filter(([key]) => !HIDDEN_ACTION_FIELDS.includes(key)).map(([key, value]) => {
      const options = key === 'id' ? (current.tool.startsWith('visit_') ? choices.visitId : choices.medicationId)
        : choices[key === 'breedId' ? 'breedId:' + current.args.speciesId : key];
      const name = options?.find(option => option.value === value)?.label;
      return { key, label: (key === 'petId' ? tx('ცხოველი', 'Pet') : key === 'medicationId' ? tx('მედიკამენტი', 'Medication') : key === 'id' ? tx('ჩანაწერი', 'Entry') : key === 'dueTime' ? tx('დრო', 'Time') : key === 'destination' ? tx('გვერდი', 'Page') : assistantFieldLabels[key]) || key,
        value: name || humanCardValue(assistantDisplay(value)) };
    }).filter(row => row.value && row.value !== '—');
  }
  const errorText = (e: unknown, fallback: string) => e instanceof ApiError && e.fields?.length
    ? e.fields.map(field => { const key = field.field.split('.').pop() || ''; return assistantFieldError(key, field.message, assistantFieldLabels[key] || tx('ველი', 'Field')); }).join('\n')
    : e instanceof Error ? e.message : fallback;

  /** The clinical model answers in the thread (doctor, or the consilium when the switch is on). */
  async function answer(value: string, mode: ClinicalMode, userTurn: MediTurn, fromVoice: boolean) {
    const n = generation.current;
    const deep = mode === 'CONSILIUM';
    const slot: MediTurn = { id: turnId(), kind: 'answer', deep, text: '', at: now(), streaming: true };
    addTurns(slot); setBusy(deep ? 'deep' : 'answer'); scrollToEnd(true);
    const controller = new AbortController(); abort.current = controller;
    let buffer = '', timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => { timer = null; const extra = buffer; buffer = ''; if (extra && live(n)) setTurns(t => t.map(turn => (turn.id === slot.id && turn.kind === 'answer' ? { ...turn, text: turn.text + extra } : turn))); };
    try {
      // The cycle context rides only with the first question that goes through (consent runs first).
      const context = sessions.current[mode] ? undefined : cycleContextRef.current?.text;
      // The planner's part of this chat (what she told Medi, what was saved) — the clinical session does not hold it.
      const thread = plannerHistory(turnsRef.current.filter(t => t.id !== userTurn.id && t.id !== slot.id));
      const response = await streamAiQuery({ message: value, mode, sessionId: sessions.current[mode], cycleContextAllowed: !cycleContextExcluded.current, ...(thread.length ? { thread } : {}), ...(context ? { context } : {}) },
        { signal: controller.signal, onDelta: (chunk: string) => { if (!live(n)) return; buffer += chunk; if (!timer) timer = setTimeout(flush, 40); } });
      if (!live(n)) return;
      requireAnalysisText(response.answer);
      if (timer) clearTimeout(timer);
      if (context) setCycleContext(null);
      sessions.current[mode] = response.sessionId;
      const done: MediTurn = { ...slot, text: response.answer, streaming: false, interactionId: response.interactionId, sessionId: response.sessionId };
      setTurns(t => t.map(turn => (turn.id === slot.id ? done : turn)));
      persist(storedTurns([userTurn, done]));
      // A question asked by voice hears the start of the answer (the voice switch, mute and focus are checked in say).
      if (fromVoice) void speech.say(spokenAnswer(response.answer));
      if (response.usage) applyUsage(response.usage);
      void import('@/lib/quest/cache').then(({ requestQuestRefresh }) => requestQuestRefresh()).catch(() => undefined);
      if (focused.current) assistantHaptic('success');
    } catch (err) {
      if (timer) clearTimeout(timer);
      if (!live(n)) return;
      dropTurns(slot.id, userTurn.id);
      setText(current => (current.trim() ? current : value));
      if (isAiConsentDeclined(err)) {
        // Nothing was sent (consent runs before the request): a calm line and a retry, never an error.
        setRetry({ value, route: mode, fromVoice }); setNotice(aiConsentDeclinedText());
      } else if (err instanceof ApiError && err.isQuotaExceeded && focused.current) {
        // The limit sheet only over Medi itself; under another screen the message and „ხელახლა ცდა“ wait below.
        setQuotaBlock(err.usage?.resetsInMs);
        if (err.usage) applyUsage(err.usage);
      } else {
        setRetry({ value, route: mode, fromVoice });
        setError(err instanceof ApiError || err instanceof IncompleteAnalysisError ? err.message : ka.common.error);
        if (focused.current) assistantHaptic('error');
      }
    } finally {
      if (abort.current === controller) abort.current = null;
    }
  }

  async function plan(value: string, userTurn: MediTurn, fromVoice: boolean, petId?: string) {
    const n = generation.current;
    setBusy('plan');
    const currentDraft = draft;
    try {
      const result = await assistantRequest<AssistantPlan>('plan', owner, {
        text: value, scope: 'auto', history: plannerHistory(turnsRef.current.filter(t => t.id !== userTurn.id)), draft: currentDraft, cycleContextAllowed: !cycleContextExcluded.current, ...(petId ? { subjectId: petId } : {}),
      });
      if (!live(n)) return;
      // A health question: the clinical model answers right here, no extra tap.
      const consult = consultFromReview(result.review, value);
      if (consult) {
        setDraft(null);
        await answer(consult.message, consult.mode === 'CONSILIUM' && deepOn ? 'CONSILIUM' : 'DOCTOR', userTurn, fromVoice);
        return;
      }
      const reply: MediTurn = { id: turnId(), kind: 'medi', text: result.reply, at: now() };
      const card: MediTurn[] = result.review ? [{ id: turnId(), kind: 'action', review: result.review, state: 'pending', at: now() }] : [];
      addTurns(reply, ...card);
      persist(storedTurns([userTurn, reply]));
      setDraft(result.draft); setFocusFields(result.guidance?.fields); setSuggestions(result.suggestions || []);
      if (fromVoice) void speech.say(result.review ? spokenAssistantReview(result.review.label, reviewRows(result.review), isHandoff(result.review.tool)) : result.reply);
      scrollToEnd(true);
    } catch (e) {
      if (!live(n)) return;
      dropTurns(userTurn.id); setText(current => (current.trim() ? current : value));
      setRetry({ value, route: 'plan', fromVoice, petId });
      if (isAiConsentDeclined(e)) setNotice(aiConsentDeclinedText());
      else { setError(errorText(e, tx('კავშირი შეფერხდა.', 'Connection problem.'))); if (focused.current) assistantHaptic('error'); }
    }
  }

  async function send(message = text, fromVoice = false, petId?: string, route?: Retry['route']) {
    const value = message.trim();
    if (value.length < 2 || value.length > CHAT_MESSAGE_LIMIT || working.current || capture.isBusy() || !valid() || busy === 'history') return;
    speech.stop(); setNotice(null); setError(null); setRetry(null); setSuggestions([]);
    const pending = [...turnsRef.current].reverse().find(t => t.kind === 'action' && t.state === 'pending');
    const intent = assistantDialogIntent(value);
    if (pending?.kind === 'action' && intent === 'confirm') { setText(''); await confirm(pending.id, pending.review); return; }
    if ((pending || draft) && intent === 'cancel') { setText(''); cancelAction(pending?.id); return; }
    // A retry (or older handoff) to a mode an admin has since paused goes through the planner instead of the same 503.
    const routeOn = route === 'CONSILIUM' ? deepOn : route === 'DOCTOR' ? doctorOn : true;
    const target: Retry['route'] = route && routeOn ? route : (consiliumOn ? 'CONSILIUM' : directNext.current && doctorOn ? directNext.current : 'plan');
    directNext.current = null;
    working.current = true; generation.current++;
    asking.current = value; clearMediDraft();
    // A new message replaces a card that was never answered.
    setTurns(t => t.map(turn => (turn.kind === 'action' && turn.state === 'pending' ? { ...turn, state: 'cancelled' } : turn)));
    const userTurn: MediTurn = { id: turnId(), kind: 'user', text: value, at: now() };
    addTurns(userTurn); setText(''); Keyboard.dismiss(); scrollToEnd(true);
    try {
      if (target === 'plan') await plan(value, userTurn, fromVoice, petId);
      else await answer(value, target, userTurn, fromVoice);
    } finally { working.current = false; asking.current = null; if (alive.current) setBusy(null); }
  }

  async function afterSaved(saved: AssistantReview, n: number) {
    // Read canonical server data; no optimistic health mutation or replayed local delta.
    const { requestHealthRefresh, resetHealthPullCache } = await import('@/lib/healthDataSync');
    if (!valid(n)) return;
    resetHealthPullCache(); requestHealthRefresh();
    const tasks: Promise<unknown>[] = [refreshHealthProfile()];
    if (['weight_goal', 'steps_goal'].includes(saved.tool)) tasks.push(import('@/lib/accountSync').then(({ refreshAssistantAccountState }) => refreshAssistantAccountState(owner)));
    if (saved.tool.startsWith('medication_')) {
      tasks.push(api.medications.list().then(async response => {
        if (owner !== localAccountId()) return;
        const { syncMedicationReminders } = await import('@/lib/notifications');
        if (owner === localAccountId()) await syncMedicationReminders(response.schedule, response.medications, owner);
      }));
    }
    tasks.push(assistantRequest<{ choices: AssistantChoices }>('catalog', owner, undefined, 'auto').then(result => { if (valid(n)) setChoices(result.choices || {}); }));
    await Promise.all(tasks);
  }

  async function confirm(cardId: string, review: AssistantReview) {
    if (working.current || capture.isBusy() || !valid()) return;
    speech.stop(); setError(null); setRetry(null);
    const handoffTool = isHandoff(review.tool);
    const n = ++generation.current; working.current = true; setBusy(handoffTool ? 'open' : 'save');
    try {
      const result = await assistantRequest<{ status: string; native?: AssistantNative; operationId: string }>('execute', owner, { token: review.token, confirmed: true });
      if (!valid(n)) return;
      setDraft(null); setManual(false); setFocusFields(undefined); setSuggestions([]);
      assistantHaptic('success');
      if (result.native) {
        const route = result.native.route.startsWith('/chat/') ? legacyChatRouteToMedi(result.native.route) : result.native.route;
        const paused = featureForHref(route);
        if (paused && !isFeatureOn(paused)) { patchTurn(cardId, { state: 'cancelled' }); setNotice(featureMessage(paused)); return; }
        patchTurn(cardId, { state: 'opened' });
        if (result.native.route.startsWith('/chat/') && result.native.message) {
          // An older planner reply: answer here instead of opening another screen.
          working.current = false; setBusy(null);
          await send(result.native.message, false, undefined, result.native.mode === 'CONSILIUM' && deepOn ? 'CONSILIUM' : 'DOCTOR');
          return;
        }
        if (stageAssistantLaunch(owner, result.operationId, result.native)) router.push(result.native.route as never);
        return;
      }
      patchTurn(cardId, { state: 'saved' });
      const petName = choices.petId?.find(p => p.value === review.args.petId)?.label;
      const line = review.tool === 'medication_add' ? tx(`${String(review.args.medName)} დამატებულია.`, `${String(review.args.medName)} added.`)
        : review.tool === 'pet_care_plan' && petName ? tx(`${petName}-ის გეგმა შენახულია.`, `${petName}'s plan is saved.`) : tx('შენახულია.', 'Saved.');
      persist([{ role: 'assistant', content: line }]);
      void afterSaved(review, n).catch(() => { if (valid(n)) setNotice(tx('ჩანაწერი შენახულია. მონაცემების ან შეხსენებების განახლებისთვის შესაბამისი გვერდი გახსენი.', 'Entry saved. Open the matching page to refresh its data or reminders.')); });
    } catch (e) { if (valid(n)) setError(errorText(e, tx('მოქმედება ვერ შესრულდა.', "That action didn't go through."))); }
    finally { working.current = false; if (alive.current) setBusy(null); }
  }

  function cancelAction(cardId?: string) {
    speech.stop();
    if (cardId) patchTurn(cardId, { state: 'cancelled' });
    setDraft(null); setManual(false); setFocusFields(undefined); setSuggestions([]);
    persist([{ role: 'assistant', content: tx('კარგი, გაუქმებულია.', 'OK, cancelled.') }]);
  }

  async function editAction(cardId: string, review: AssistantReview) {
    if (working.current || !valid()) return;
    speech.stop(); setError(null);
    // The form needs the tool's fields from the catalog. If that load failed, Edit loads it again; until the
    // form can open the card stays (Edit is the retry), so the chat never ends up with no form and no composer.
    if (!tools.some(t => t.name === review.tool)) {
      const n = ++generation.current; working.current = true; setBusy('check');
      let loaded: AssistantTool[] | null = null, failed = false;
      try { loaded = await loadCatalog(() => valid(n)); } catch { failed = true; }
      finally { working.current = false; if (alive.current) setBusy(null); }
      if (!valid(n)) return;
      if (!loaded?.some(t => t.name === review.tool)) {
        setError(failed || !loaded
          ? tx('ფორმა ვერ ჩაიტვირთა. შეამოწმე კავშირი და ხელახლა სცადე.', "The form couldn't load. Check your connection and try again.")
          : tx('ამ ჩანაწერის ხელით შესწორება ახლა ვერ ხერხდება. შეინახე ან გააუქმე.', "This entry can't be edited by hand right now. Save it or cancel."));
        return;
      }
    }
    dropTurns(cardId);
    setDraft({ tool: review.tool, args: review.args }); setFocusFields(undefined); setManual(true);
  }

  async function prepare() {
    if (!draft || working.current || !valid()) return;
    const n = ++generation.current; working.current = true; setBusy('check'); setError(null);
    try {
      const result = await assistantRequest<{ review: AssistantReview }>('prepare', owner, { scope: 'auto', action: draft });
      if (!valid(n)) return;
      setManual(false); Keyboard.dismiss();
      addTurns({ id: turnId(), kind: 'action', review: result.review, state: 'pending', at: now() });
      scrollToEnd(true);
    } catch (e) { if (valid(n)) setError(errorText(e, tx('ველები გადაამოწმე.', 'Please check the fields.'))); }
    finally { working.current = false; if (alive.current) setBusy(null); }
  }

  async function openFeature(feature: AssistantFeature) {
    if (working.current || !valid()) return;
    const n = ++generation.current; working.current = true; setBusy('open'); setError(null);
    let ready: AssistantReview | null = null;
    try {
      const result = await assistantRequest<{ review: AssistantReview }>('prepare', owner, { scope: 'auto', action: { tool: 'open', args: { destination: feature.id } } });
      if (valid(n)) ready = result.review;
    } catch (e) { if (valid(n)) setError(errorText(e, tx('გვერდი ვერ გაიხსნა.', "Couldn't open the page."))); }
    finally { working.current = false; if (alive.current) setBusy(null); }
    if (ready && valid(n)) {
      setPicker(false);
      const card: MediTurn = { id: turnId(), kind: 'action', review: ready, state: 'pending', at: now() };
      addTurns(card);
      await confirm(card.id, ready);
    }
  }

  function chooseTool(tool: AssistantTool) {
    Keyboard.dismiss(); setError(null); setNotice(null);
    setDraft({ tool: tool.name, args: {} }); setFocusFields(undefined); setManual(true); setPicker(false);
  }

  function resetConversation() {
    if (working.current || capture.isBusy()) return;
    speech.stop(); abort.current?.abort(); generation.current++;
    if (sessionId) { router.replace('/assistant' as never); return; }
    conversation.current = undefined; copyOnFirstSave.current = null; sessions.current = {}; directNext.current = null;
    cycleContextExcluded.current = false;
    setTurns([]); setDraft(null); setManual(false); setPicker(false); setText(''); setError(null); setNotice(null); setRetry(null); setSuggestions([]); setCycleContext(null);
  }

  const goBack = () => {
    if (picker) setPicker(false);
    else if (manual) setManual(false);
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home' as never);
  };

  const rate = useCallback(async (id: string, interactionId: string | undefined, rating: 1 | -1) => {
    if (!interactionId) return;
    patchTurn(id, { feedbackRating: rating } as Partial<MediTurn>);
    try { await api.ai.feedback({ interactionId, rating }); }
    catch { if (alive.current && localAccountId() === owner) patchTurn(id, { feedbackRating: undefined } as Partial<MediTurn>); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);

  const activeTool = tools.find(t => t.name === draft?.tool);
  const hasAnswers = turns.some(t => t.kind === 'answer');
  const thinking = busy === 'plan' ? tx('ვფიქრობ…', 'Thinking…') : busy === 'check' ? tx('ვამოწმებ…', 'Checking…') : null;
  const subtitle = consiliumOn ? tx('კონსილიუმი ჩართულია', 'Consilium is on') : tx('შენი ჯანმრთელობის ასისტენტი', 'Your health assistant');
  // Never the server's placeholder name (phone / Apple sign-ups): no name = the welcome without one.
  const firstName = displayFirstName(user, healthProfile?.extraAnswers) || undefined;

  const renderTurn = ({ item }: { item: MediTurn }) => {
    if (item.kind === 'user') return <UserTurn text={item.text} />;
    if (item.kind === 'medi') return <MediLine text={item.text} />;
    if (item.kind === 'answer') return <AnswerTurn text={item.text} deep={item.deep} streaming={item.streaming} interactionId={item.interactionId} feedbackRating={item.feedbackRating} onRate={rating => void rate(item.id, item.interactionId, rating)} />;
    return <ActionCard title={item.review.label} tool={item.review.tool} rows={reviewRows(item.review)} handoff={isHandoff(item.review.tool)} state={item.state}
      busy={!!busy} onConfirm={() => void confirm(item.id, item.review)} onEdit={() => void editAction(item.id, item.review)} onCancel={() => cancelAction(item.id)} />;
  };

  const quiet = { color: C.text200, fontSize: 13, lineHeight: 21, fontFamily: 'NotoSansGeorgian_400Regular' } as const;
  const pill = (label: string, onPress: () => void, key?: string) => (
    <Pressable key={key ?? label} accessibilityRole="button" onPress={onPress} disabled={!!busy}
      style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.bg300, opacity: busy ? 0.6 : 1 }}>
      <Text style={{ color: C.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{label}</Text>
    </Pressable>
  );

  const footer = (
    <View style={{ gap: 14, paddingTop: turns.length ? 18 : 0 }}>
      {thinking ? <ThinkingTurn label={thinking} deep={false} /> : null}
      {suggestions.length && !busy ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 34 }}>{suggestions.map((s, i) => pill(s.label, () => void send(s.text, false, s.petId), `${i}`))}</View> : null}
      {draft && !manual && activeTool && !busy ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 34 }}>
          {pill(tx('ხელით შევსება', 'Fill in manually'), () => setManual(true))}
          {pill(tx('გაუქმება', 'Cancel'), () => cancelAction())}
        </View>
      ) : null}
      {(error || notice) && turns.length ? (
        <View accessibilityLiveRegion="polite" style={{ gap: 10, paddingLeft: 34 }}>
          <Text accessibilityRole={error ? 'alert' : undefined} style={{ ...quiet, color: error ? C.danger : C.text200 }}>{error || notice}</Text>
          {retry && !busy ? <View style={{ flexDirection: 'row' }}>{pill(error ? tx('ხელახლა ცდა', 'Try again') : aiConsentRetryLabel(), () => void send(retry.value, retry.fromVoice, retry.petId, retry.route))}</View> : null}
        </View>
      ) : null}
      {hasAnswers ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingLeft: 2 }}>
          <ShieldAlert size={14} color={C.text300} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, color: C.text300, fontSize: 12, lineHeight: 18, fontFamily: 'NotoSansGeorgian_400Regular' }}>{ka.app.disclaimer}</Text>
        </View>
      ) : null}
    </View>
  );

  const body = picker ? (
    <AssistantDirectory tools={tools} features={features} groups={groups} busy={!!busy} error={error} onClose={() => { Keyboard.dismiss(); setPicker(false); }} onTool={chooseTool} onFeature={feature => void openFeature(feature)} />
  ) : manual && draft && activeTool ? (
    <ChatFormScroll contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 18 }}>
      <Text style={{ color: C.text100, fontSize: 20, lineHeight: 30, fontFamily: 'NotoSansGeorgian_700Bold' }}>{activeTool.label}</Text>
      {error ? <Text accessibilityRole="alert" style={{ ...quiet, color: C.danger }}>{error}</Text> : null}
      <AssistantForm key={draft.tool} schema={activeTool.parameters} values={draft.args} focusFields={focusFields}
        choices={{ ...choices, id: draft.tool.startsWith('visit_') ? choices.visitId : choices.medicationId }} disabled={!!busy}
        onFieldFocus={() => speech.stop()} onChange={args => { setError(null); setDraft({ ...draft, args }); }} />
      <Pressable accessibilityRole="button" onPress={() => void prepare()} disabled={!!busy}
        style={{ minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D9488', opacity: busy ? 0.6 : 1 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: 'NotoSansGeorgian_700Bold' }}>{tx('გადამოწმება', 'Review')}</Text>
      </Pressable>
    </ChatFormScroll>
  ) : (
    <FlatList
      ref={list}
      data={turns}
      keyExtractor={item => item.id}
      renderItem={renderTurn}
      style={{ flex: 1, backgroundColor: C.bg100 }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}
      ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets={false}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={100}
      onContentSizeChange={() => scrollToEnd()}
      onScroll={event => {
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const near = contentSize.height - layoutMeasurement.height - contentOffset.y < 120;
        nearBottom.current = near; setScrolledUp(!near);
      }}
      ListEmptyComponent={busy === 'history' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}><ActivityIndicator color="#0D9488" /><Text style={quiet}>{tx('საუბარი იტვირთება…', 'Loading conversation…')}</Text></View>
      ) : historyFailed ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Text style={{ ...quiet, textAlign: 'center' }}>{tx('საუბარი ვერ ჩაიტვირთა. შეამოწმე კავშირი და სცადე ხელახლა.', "Couldn't load the conversation. Check your connection and try again.")}</Text>
          {pill(tx('ხელახლა ცდა', 'Try again'), () => { loadHistory(); })}
        </View>
      ) : (
        <MediWelcome name={firstName} consilium={consiliumOn} onStarter={value => void send(value)} notice={error || notice} />
      )}
      ListFooterComponent={turns.length ? footer : null}
    />
  );

  return (
    <>
      <ChatScreenShell style={{ backgroundColor: C.bg100 }}
        header={<MediTopBar subtitle={subtitle} onBack={goBack} onNew={turns.length ? resetConversation : undefined} onMenu={() => { Keyboard.dismiss(); setMenu(true); }} disabled={capture.phase !== 'idle'} />}
        footer={picker || (manual && draft && activeTool) ? undefined : (
          <View>
            {scrolledUp && turns.length ? (
              <Pressable accessibilityRole="button" accessibilityLabel={tx('ბოლო შეტყობინებაზე გადასვლა', 'Jump to the latest message')} onPress={() => scrollToEnd(true)}
                style={{ alignSelf: 'center', marginBottom: 6, paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.bg300 }}>
                <Text style={{ color: C.text100, fontSize: 12, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('↓ ბოლო შეტყობინება', '↓ Latest message')}</Text>
              </Pressable>
            ) : null}
            <MediComposer value={text} onChange={setText} onSend={() => void send()} busy={!!busy && busy !== 'history'} disabled={busy === 'history'}
              consilium={consiliumOn} onConsilium={deepOn ? on => { setConsilium(on); assistantHaptic('success'); } : null}
              voice={voiceIn ? { phase: capture.phase, duration: capture.duration, start: capture.start, release: capture.release, cancel: capture.cancel } : null}
              onMore={() => { Keyboard.dismiss(); setPicker(true); }}
              accessory={cycleContext ? <View style={{ marginBottom: 8 }}><MediContextChip context={cycleContext} onRemove={() => { cycleContextExcluded.current = true; setCycleContext(null); }} /></View> : null} />
          </View>
        )}>
        {body}
      </ChatScreenShell>
      <MediMenuSheet visible={menu} onClose={() => setMenu(false)} onNew={turns.length ? resetConversation : null}
        onDirectory={() => setPicker(true)} onPrivacy={() => router.push('/profile/ai-data' as never)}
        speech={voiceOut ? { muted: speech.muted, toggle: speech.toggle } : null} />
      <QuotaSheet visible={quotaBlock !== undefined} resetsInMs={quotaBlock} onClose={() => setQuotaBlock(undefined)} />
    </>
  );
}
