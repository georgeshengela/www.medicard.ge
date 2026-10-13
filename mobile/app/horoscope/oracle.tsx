import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ArrowUp, SquarePen } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModuleHeaderButton, ModuleStackHeader } from '@/components/brand/ModuleHeader';
import { ChatScreenShell, useChatKeyboardOpen } from '@/components/chat/ChatScreenShell';
import { AstroGlyph } from '@/components/horoscope/AstroGlyph';
import { GLASS, GLASS_LINE, HORO_INK, HText } from '@/components/horoscope/HoroUI';
import { OracleMascot } from '@/components/horoscope/OracleMascot';
import { StarrySky } from '@/components/horoscope/StarrySky';
import { TarotCard } from '@/components/horoscope/TarotCard';
import { AiConsentDeclinedNote } from '@/components/ui/AiConsentDeclinedNote';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { isAiConsentDeclined } from '@/lib/aiConsentDecline';
import { horoscopeApi, newOracleRequestId, type OracleCard, type OracleThread } from '@/lib/horoscope/horoscopeApi';
import { streamOracle } from '@/lib/horoscope/oracleStream';
import { FRESH } from '@/lib/queryClient';
import { useThemeColors } from '@/theme/colors';

type Turn = { id: string; role: 'user' | 'assistant'; content: string; cards: OracleCard[] | null; streaming?: boolean };

const ASKS = () => [
  tx('რა მელის დღეს?', 'What does today hold for me?'),
  tx('ამომიღე ტაროს კარტი', 'Draw me a tarot card'),
  tx('გამიშალე სამი კარტი: წარსული, აწმყო, მომავალი', 'Lay out three cards: past, present, future'),
  tx('სიყვარულში რა მელის ამ კვირაში?', 'What’s ahead in love this week?'),
  tx('ამიხსენი ჩემი რუკა მარტივად', 'Explain my chart simply'),
  tx('ვნახე სიზმარი და მინდა ამიხსნა', 'I had a dream — explain it'),
];

/**
 * The Oracle: MEDIHOROSCOPE's own assistant — Medi in a witch hat, a mysterious but clear fortune-teller who
 * reads the person's real chart and today's sky, turns tarot cards and explains dreams. Health questions go to
 * Medi. Everything goes through the AI-consent path; a declined consent is a calm note.
 */
export default function OracleScreen() {
  const { ask, go } = useLocalSearchParams<{ ask?: string; go?: string }>();
  const c = useThemeColors();
  const thread = useAccountQuery<OracleThread>({ key: ['horoscope', 'oracle'], fetch: () => horoscopeApi.oracle(), staleTime: FRESH.SHORT });
  const name = thread.data?.name || tx('ორაკული', 'Oracle');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [text, setText] = useState(() => (typeof ask === 'string' ? ask : ''));
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const loaded = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const list = useRef<FlatList<Turn>>(null);
  useEffect(() => () => abort.current?.abort(), []);

  // The last conversation comes back when the screen opens (unless the person arrived with a question).
  useEffect(() => {
    if (loaded.current || !thread.data) return;
    loaded.current = true;
    if (typeof ask === 'string' && ask) return;
    if (thread.data.sessionId && thread.data.messages.length) {
      setSessionId(thread.data.sessionId);
      setTurns(thread.data.messages.filter((m) => m.content).map((m) => ({ id: m.id, role: m.role, content: m.content, cards: m.cards })));
    }
  }, [thread.data, ask]);

  const send = useCallback(async (value?: string) => {
    const message = (value ?? text).trim();
    if (message.length < 2 || busy) return;
    setBusy(true); setDeclined(null); setFailure(null); setText('');
    const answerId = `a-${Date.now()}`;
    setTurns((t) => [...t, { id: `u-${Date.now()}`, role: 'user', content: message, cards: null }, { id: answerId, role: 'assistant', content: '', cards: null, streaming: true }]);
    const controller = new AbortController();
    abort.current = controller;
    const patch = (fn: (t: Turn) => Turn) => setTurns((all) => all.map((t) => (t.id === answerId ? fn(t) : t)));
    try {
      const done = await streamOracle({ message, sessionId, clientRequestId: newOracleRequestId() }, {
        signal: controller.signal,
        onStart: ({ sessionId: sid, cards }) => { setSessionId(sid); if (cards?.length) patch((t) => ({ ...t, cards })); },
        onDelta: (chunk) => patch((t) => ({ ...t, content: t.content + chunk })),
      });
      setSessionId(done.sessionId);
      patch((t) => ({ ...t, content: done.content || t.content, cards: done.cards ?? t.cards, streaming: false }));
    } catch (error) {
      setTurns((all) => all.filter((t) => t.id !== answerId || t.content));
      patch((t) => ({ ...t, streaming: false }));
      if (isAiConsentDeclined(error)) { setDeclined(message); setTurns((all) => all.slice(0, -1)); }
      else setFailure((error as { message?: string })?.message || tx('ორაკულმა ვერ გიპასუხა — სცადე თავიდან.', 'The Oracle could not answer — try again.'));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }, [text, busy, sessionId]);

  // A chip from the hub or the tarot page asks at once (`go=1`); a started sentence („ვნახე სიზმარი: “) waits for the rest.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || go !== '1' || typeof ask !== 'string' || !ask || !thread.data) return;
    asked.current = true;
    void send(ask);
  }, [go, ask, thread.data, send]);

  const fresh = () => { abort.current?.abort(); setTurns([]); setSessionId(undefined); setFailure(null); setDeclined(null); };
  const last = turns[turns.length - 1];
  const mood = busy ? (last?.content ? 'talk' : 'think') : 'idle';

  return (
    <ChatScreenShell
      style={{ backgroundColor: c.bg100 }}
      header={
        <ModuleStackHeader module="horo" subtitle={name} fallbackHref="/horoscope"
          right={turns.length ? <ModuleHeaderButton label={tx('ახალი საუბარი', 'New conversation')} icon={SquarePen} onPress={fresh} /> : undefined} />
      }
      footer={<OracleComposer value={text} onChange={setText} onSend={() => void send()} busy={busy} name={name} />}
    >
      <View style={{ flex: 1 }}>
        <StarrySky density={0.7} />
        <FlatList
          ref={list}
          data={turns}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 18, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={turns.length ? (
            <View style={{ alignItems: 'center', paddingBottom: 4 }}>
              <OracleMascot size={92} mood={mood} glow={busy} />
            </View>
          ) : null}
          ListEmptyComponent={<Welcome name={name} onAsk={(q) => void send(q)} busy={busy} />}
          renderItem={({ item }) => (item.role === 'user' ? <UserTurn text={item.content} /> : <OracleTurn turn={item} />)}
          ListFooterComponent={
            <View style={{ gap: 10 }}>
              {declined ? <AiConsentDeclinedNote onRetry={() => void send(declined)} background={GLASS} /> : null}
              {failure ? <HText size={13} color="#F0A3B0">{failure}</HText> : null}
              {turns.length ? <HText size={11} muted center>{tx('ორაკული გასართობია და ჯანმრთელობაზე რჩევას არ იძლევა — ამისთვის Medi გყავს.', 'The Oracle is for fun and gives no health advice — Medi is there for that.')}</HText> : null}
            </View>
          }
        />
      </View>
    </ChatScreenShell>
  );
}

function Welcome({ name, onAsk, busy }: { name: string; onAsk: (q: string) => void; busy: boolean }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: 18, paddingVertical: 12 }}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <OracleMascot size={170} mood={busy ? 'think' : 'hello'} glow={busy} />
        <HText size={22} weight="serif" center color="#FBF3E0">{tx('ვარსკვლავები გისმენენ', 'The stars are listening')}</HText>
        <HText size={14} muted center>{tx(`მე ვარ ${name}. შენს რუკას, დღევანდელ ცას, ტაროს და სიზმრებს ერთად წავიკითხავთ.`, `I am the ${name}. Together we’ll read your chart, today’s sky, the tarot and your dreams.`)}</HText>
      </View>
      <View style={{ gap: 8 }}>
        {ASKS().map((q, i) => (
          <Animated.View key={q} entering={FadeInDown.delay(120 + i * 70).duration(380)}>
            <Pressable accessibilityRole="button" accessibilityLabel={q} onPress={() => onAsk(q)}
              style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: GLASS, borderWidth: 1, borderColor: 'rgba(185,166,255,0.22)' }}>
              <HText size={14} color="#E6E0FF">{q}</HText>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function UserTurn({ text }: { text: string }) {
  return (
    <View style={{ alignSelf: 'flex-end', maxWidth: '86%', borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(185,166,255,0.16)', borderWidth: 1, borderColor: 'rgba(185,166,255,0.24)' }}>
      <HText size={15} color="#F1EDFF">{text}</HText>
    </View>
  );
}

function OracleTurn({ turn }: { turn: Turn }) {
  return (
    <Animated.View entering={FadeIn.duration(500)} style={{ gap: 12 }}>
      {turn.cards?.length ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
          {turn.cards.map((card, i) => (
            <TarotCard key={`${card.id}-${i}`} card={{ roman: card.roman, name: tx(card.ka, card.en), glyph: card.glyph }} width={turn.cards!.length > 1 ? 96 : 132} delay={300 + i * 450} />
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(233,199,126,0.14)', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
          <AstroGlyph name="moon" size={15} color={HORO_INK} />
        </View>
        <View style={{ flex: 1 }}>
          {turn.content ? <HText size={15.5} lineHeight={25} color="#EEF0FA">{turn.content.replace(/\*\*(.+?)\*\*/g, '$1')}</HText>
            : <HText size={14} muted>{tx('ვარსკვლავებს ვეკითხები…', 'Asking the stars…')}</HText>}
        </View>
      </View>
    </Animated.View>
  );
}

function OracleComposer({ value, onChange, onSend, busy, name }: { value: string; onChange: (v: string) => void; onSend: () => void; busy: boolean; name: string }) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const open = useChatKeyboardOpen();
  const can = value.trim().length >= 2 && !busy;
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: open ? 8 : Math.max(insets.bottom, 10), backgroundColor: c.bg100 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderRadius: 26, backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_LINE, padding: 6 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={tx('ჰკითხე ვარსკვლავებს…', 'Ask the stars…')}
          placeholderTextColor={c.text300}
          multiline
          maxLength={2000}
          style={{ flex: 1, minHeight: 40, maxHeight: 140, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, color: c.text100, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15 }}
          accessibilityLabel={tx('შეკითხვა ორაკულს', 'Question for the Oracle')}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={tx('გაგზავნა', 'Send')} accessibilityState={{ disabled: !can }} disabled={!can} onPress={onSend}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: can ? HORO_INK : 'rgba(233,199,126,0.25)' }}>
          <ArrowUp size={20} color="#141B3F" />
        </Pressable>
      </View>
    </View>
  );
}
