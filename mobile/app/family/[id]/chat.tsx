import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { History, Phone, SquarePen } from 'lucide-react-native';
import { ModuleHeaderButton, ModuleStackHeader } from '@/components/brand/ModuleHeader';
import { ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { FamilySheet, FText, formatYmd, toneColors, useFamilyInk } from '@/components/family/FamilyUI';
import { MediComposer } from '@/components/medi/MediComposer';
import { MediOrb } from '@/components/medi/MediOrb';
import { AnswerTurn, ThinkingTurn, UserTurn } from '@/components/medi/MediTurns';
import { AiConsentDeclinedNote } from '@/components/ui/AiConsentDeclinedNote';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { isAiConsentDeclined } from '@/lib/aiConsentDecline';
import { familyApi, newFamilyRequestId, type ChatMessage, type Triage, type TriageLevel } from '@/lib/family/familyApi';
import { askChips, askText } from '@/lib/family/familyCopy';
import { streamFamilyChat } from '@/lib/family/familyChatStream';
import { FRESH } from '@/lib/queryClient';
import { tx } from '@/i18n/locale';

type Turn = { id: string; role: 'user' | 'assistant'; content: string; triage: Triage; streaming?: boolean };

/**
 * Medi for one child. Every question carries the child's saved record (server side); the rule triage
 * arrives before the first word, so an emergency card shows at once. Conversations stay with the child.
 */
export default function FamilyChatScreen() {
  const { id, ask } = useLocalSearchParams<{ id: string; ask?: string }>();
  const memberId = String(id);
  const { c } = useFamilyInk();
  const member = useAccountQuery({ key: ['family', 'member', memberId], fetch: () => familyApi.get(memberId), staleTime: FRESH.SHORT });
  const name = member.data?.member.name ?? '';
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [text, setText] = useState(() => askText(typeof ask === 'string' ? ask : null) ?? '');
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [history, setHistory] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const list = useRef<FlatList<Turn>>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const send = useCallback(async (value?: string) => {
    const message = (value ?? text).trim();
    if (message.length < 2 || busy) return;
    setBusy(true); setDeclined(null); setFailure(null); setText('');
    const answerId = `a-${Date.now()}`;
    setTurns((t) => [...t, { id: `u-${Date.now()}`, role: 'user', content: message, triage: null }, { id: answerId, role: 'assistant', content: '', triage: null, streaming: true }]);
    const controller = new AbortController();
    abort.current = controller;
    const patch = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((t) => (t.id === answerId ? fn(t) : t)));
    try {
      const done = await streamFamilyChat(memberId, { message, sessionId, clientRequestId: newFamilyRequestId() }, {
        signal: controller.signal,
        onStart: ({ sessionId: sid, triage }) => { setSessionId(sid); if (triage) patch((t) => ({ ...t, triage })); },
        onDelta: (chunk) => patch((t) => ({ ...t, content: t.content + chunk })),
      });
      setSessionId(done.sessionId);
      patch((t) => ({ ...t, content: done.content || t.content, triage: done.triage ?? t.triage, streaming: false }));
    } catch (error) {
      setTurns((all) => all.filter((t) => t.id !== answerId || t.content));
      patch((t) => ({ ...t, streaming: false }));
      if (isAiConsentDeclined(error)) { setDeclined(message); setTurns((all) => all.slice(0, -1)); }
      else setFailure((error as { message?: string })?.message || tx('Medi-მ ვერ უპასუხა — სცადე თავიდან.', 'Medi could not answer — try again.'));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }, [text, busy, memberId, sessionId]);

  const openSession = async (sid: string) => {
    setHistory(false);
    try {
      const { messages } = await familyApi.chat(memberId, sid);
      setSessionId(sid);
      setTurns(messages.filter((m) => m.content).map((m: ChatMessage) => ({ id: m.id, role: m.role, content: m.content, triage: m.triage })));
    } catch { setFailure(tx('საუბარი ვერ გაიხსნა.', 'Could not open the conversation.')); }
  };
  const fresh = () => { abort.current?.abort(); setTurns([]); setSessionId(undefined); setFailure(null); setDeclined(null); };

  return (
    <ChatScreenShell
      style={{ backgroundColor: c.bg100 }}
      header={
        <ModuleStackHeader module="family" subtitle={name ? tx(`Medi · ${name}`, `Medi · ${name}`) : 'Medi'} fallbackHref={`/family/${memberId}`}
          right={turns.length ? <ModuleHeaderButton label={tx('ახალი საუბარი', 'New conversation')} icon={SquarePen} onPress={fresh} />
            : <ModuleHeaderButton label={tx('წინა საუბრები', 'Earlier conversations')} icon={History} onPress={() => setHistory(true)} />} />
      }
      footer={
        <MediComposer value={text} onChange={setText} onSend={() => void send()} busy={busy}
          placeholder={name ? tx(`ჰკითხე ${name}ზე…`, `Ask about ${name}…`) : undefined}
          consilium={false} onConsilium={null} voice={null} onMore={() => setHistory(true)} />
      }
    >
      <FlatList
        ref={list}
        data={turns}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 18, flexGrow: 1 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Welcome name={name} stage={member.data?.age.stage} onAsk={(q) => void send(q)} />}
        renderItem={({ item }) => item.role === 'user' ? <UserTurn text={item.content} /> : (
          <View style={{ gap: 10 }}>
            {item.triage ? <TriageCard level={item.triage.level} text={item.triage.text} /> : null}
            {item.streaming && !item.content ? <ThinkingTurn label={tx(`${name || 'ბავშვის'} ჩანაწერს ვკითხულობ…`, `Reading ${name || 'the child'}’s record…`)} deep={false} /> : <AnswerTurn text={item.content} deep={false} streaming={item.streaming} onRate={() => undefined} />}
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: 10 }}>
            {declined ? <AiConsentDeclinedNote onRetry={() => void send(declined)} /> : null}
            {failure ? <FText size={13} color={toneColors('alert', false).ink}>{failure}</FText> : null}
            {turns.length ? <FText size={11} muted center>{tx('Medi ექიმი არ არის. საშიშ ნიშანზე — 112.', 'Medi is not a doctor. For danger signs — call 112.')}</FText> : null}
          </View>
        }
      />
      <HistorySheet visible={history} memberId={memberId} onClose={() => setHistory(false)} onOpen={(sid) => void openSession(sid)} />
    </ChatScreenShell>
  );
}

function Welcome({ name, stage, onAsk }: { name: string; stage?: Parameters<typeof askChips>[0]; onAsk: (q: string) => void }) {
  const { c } = useFamilyInk();
  const chips = stage ? askChips(stage, 4) : [];
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: 18, paddingVertical: 24 }}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <MediOrb size={64} breathing />
        <FText size={20} weight="bold" center>{name ? tx(`რა გაინტერესებს ${name}ზე?`, `What would you like to know about ${name}?`) : tx('რა გაინტერესებს?', 'What would you like to know?')}</FText>
        <FText size={13} muted center>{tx('Medi ხედავს ასაკს, აცრებს, ზრდას, ალერგიებს, კვებას და ბოლო ტემპერატურას — და პასუხობს მის მიხედვით.', 'Medi sees age, vaccines, growth, allergies, feeding and the latest temperature — and answers with them in mind.')}</FText>
      </View>
      <View style={{ gap: 8 }}>
        {chips.map((chip) => (
          <Pressable key={chip.key} accessibilityRole="button" accessibilityLabel={chip.text} onPress={() => onAsk(chip.text)}
            style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: c.surface }}>
            <FText size={14}>{chip.text}</FText>
          </Pressable>
        ))}
      </View>
      <FText size={12} muted center>{tx('სუნთქვის გაძნელება, კრუნჩხვა, ცნობიერების დაკარგვა, ტუჩების გალურჯება ან 3 თვემდე სიცხე — დარეკე 112-ზე, ნუ დაელოდები პასუხს.', 'Trouble breathing, a seizure, not waking, blue lips or a fever under 3 months — call 112, don’t wait for an answer.')}</FText>
    </View>
  );
}

/** The answer's urgency, above it — red with a call button for an emergency, amber for today/24 h, calm otherwise. */
function TriageCard({ level, text }: { level: TriageLevel; text: string }) {
  const { dark } = useFamilyInk();
  const tone = level === 'EMERGENCY_NOW' ? 'alert' : level === 'SEE_DOCTOR_TODAY' || level === 'SEE_DOCTOR_24H' ? 'watch' : 'info';
  const t = toneColors(tone, dark);
  return (
    <View accessibilityRole={level === 'EMERGENCY_NOW' ? 'alert' : undefined} style={{ backgroundColor: t.bg, borderRadius: 18, padding: 14, gap: 10 }}>
      <FText weight="bold" color={t.ink}>{text}</FText>
      {level === 'EMERGENCY_NOW' ? (
        <Pressable accessibilityRole="button" accessibilityLabel={tx('დარეკე 112-ზე', 'Call 112')} onPress={() => void Linking.openURL('tel:112')}
          style={{ alignSelf: 'flex-start', height: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Phone size={17} color="#FFFFFF" />
          <FText weight="semi" color="#FFFFFF">{tx('დარეკე 112', 'Call 112')}</FText>
        </Pressable>
      ) : null}
    </View>
  );
}

function HistorySheet({ visible, memberId, onClose, onOpen }: { visible: boolean; memberId: string; onClose: () => void; onOpen: (id: string) => void }) {
  const { c } = useFamilyInk();
  const query = useAccountQuery({ key: ['family', 'chats', memberId], fetch: () => familyApi.chats(memberId), staleTime: FRESH.SHORT, enabled: visible });
  const sessions = query.data?.sessions ?? [];
  return (
    <FamilySheet visible={visible} onClose={onClose} title={tx('წინა საუბრები', 'Earlier conversations')}>
      {sessions.length ? sessions.map((s) => (
        <Pressable key={s.id} accessibilityRole="button" onPress={() => onOpen(s.id)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.bg200, gap: 2 }}>
          <FText weight="semi" lines={2}>{s.title}</FText>
          <FText size={12} muted>{formatYmd(String(s.updatedAt).slice(0, 10))}</FText>
        </Pressable>
      )) : <FText muted>{tx('ჯერ საუბარი არ ყოფილა.', 'No conversations yet.')}</FText>}
    </FamilySheet>
  );
}
