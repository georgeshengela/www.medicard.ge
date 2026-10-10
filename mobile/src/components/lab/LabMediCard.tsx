import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, ChevronUp, ListChecks, MessageCircle, Sparkles, Stethoscope, TriangleAlert } from 'lucide-react-native';
import { MediOrb } from '@/components/medi/MediOrb';
import { AiConsentDeclinedNote } from '@/components/ui/AiConsentDeclinedNote';
import { Markdown } from '@/components/ui/Markdown';
import { tx } from '@/i18n/locale';
import { HUB, hubText } from '@/theme/hub';
import { MedilabButton, useMedilab } from './MedilabUI';

const FOLDED = 236;

/**
 * „Medi-ს განმარტება“ (owner 2026-10-10: refine it). Medi's sphere and name head the card like a
 * signed note; a long explanation folds to its first lines with a soft fade and „სრულად წაკითხვა“.
 * Before there is one, the card says what Medi will write (meaning, what to watch, what to ask the
 * doctor) above the one button. Under the text: continue in the chat, and the calm reminder that
 * Medi explains — the doctor diagnoses.
 */
export function LabMediCard({
  analysis,
  dateLabel,
  busy,
  declined,
  error,
  onExplain,
  onAsk,
}: {
  analysis: string;
  dateLabel: string;
  busy: boolean;
  declined: boolean;
  error: string | null;
  onExplain: () => void;
  onAsk?: () => void;
}) {
  const M = useMedilab();
  const [height, setHeight] = useState(0);
  const [open, setOpen] = useState(false);
  const long = height > FOLDED + 40;
  const folded = long && !open;

  return (
    <View style={[s.card, { backgroundColor: M.c.surface }]}>
      <View style={s.head}>
        <MediOrb size={36} breathing={busy} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[hubText.cardTitle, { color: M.c.text100 }]}>Medi</Text>
          <Text numberOfLines={1} style={[hubText.caption, { color: M.c.text300 }]}>
            {analysis ? tx(`${dateLabel} · ანალიზის განმარტება`, `${dateLabel} · explanation`) : tx('აგიხსნის ამ ანალიზს', 'Will explain this test')}
          </Text>
        </View>
      </View>

      {analysis ? (
        <>
          <View style={[s.body, folded && { maxHeight: FOLDED, overflow: 'hidden' }]}>
            <View onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
              <Markdown content={analysis} />
            </View>
            {folded ? (
              <LinearGradient
                pointerEvents="none"
                colors={[`${M.c.surface}00`, M.c.surface]}
                style={s.fade}
              />
            ) : null}
          </View>
          {long ? (
            <Pressable accessibilityRole="button" onPress={() => setOpen((v) => !v)} style={s.toggle}>
              <Text style={[hubText.link, { color: M.ink }]}>{open ? tx('დაკეცვა', 'Show less') : tx('სრულად წაკითხვა', 'Read it all')}</Text>
              {open ? <ChevronUp size={16} color={M.ink} /> : <ChevronDown size={16} color={M.ink} />}
            </Pressable>
          ) : null}
          <View style={[s.foot, { borderTopColor: M.c.bg300 }]}>
            {onAsk ? (
              <Pressable accessibilityRole="button" onPress={onAsk} style={[s.ask, { backgroundColor: M.inkSoft }]}>
                <MessageCircle size={17} color={M.ink} strokeWidth={2.2} />
                <Text style={[hubText.link, { color: M.ink }]}>{tx('დაუსვი Medi-ს შეკითხვა', 'Ask Medi a question')}</Text>
              </Pressable>
            ) : null}
            <Text style={[hubText.caption, { color: M.c.text300 }]}>
              {tx('Medi ხსნის, დიაგნოზს არ სვამს. შედეგი ექიმს აჩვენე.', 'Medi explains; it does not diagnose. Show the result to your doctor.')}
            </Text>
          </View>
        </>
      ) : declined ? (
        <View style={s.body}>
          <AiConsentDeclinedNote background={M.c.bg100} onRetry={onExplain} />
        </View>
      ) : (
        <View style={[s.body, { gap: 14 }]}>
          <View style={{ gap: 10 }}>
            <Promise icon={Sparkles} text={tx('რას ნიშნავს თითოეული მაჩვენებელი — უბრალო ენით', 'What each value means, in plain words')} />
            <Promise icon={ListChecks} text={tx('რას მიაქციო ყურადღება და რატომ', 'What to keep an eye on, and why')} />
            <Promise icon={Stethoscope} text={tx('რა ჰკითხო ექიმს შემდეგ ვიზიტზე', 'What to ask your doctor next time')} />
          </View>
          <MedilabButton
            label={busy ? tx('Medi კითხულობს…', 'Medi is reading…') : tx('აგიხსნას Medi-მ', 'Let Medi explain')}
            icon={busy ? undefined : Sparkles}
            busy={busy}
            onPress={onExplain}
          />
        </View>
      )}

      {error ? (
        <View style={[s.error, { backgroundColor: M.attentionSoft }]}>
          <TriangleAlert size={15} color={M.attention} />
          <Text style={[hubText.caption, { color: M.attention, flex: 1 }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Promise({ icon: Icon, text }: { icon: typeof Sparkles; text: string }) {
  const M = useMedilab();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={[s.promiseIcon, { backgroundColor: M.inkSoft }]}>
        <Icon size={15} color={M.ink} strokeWidth={2.2} />
      </View>
      <Text style={[hubText.body, { color: M.c.text100, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, overflow: 'hidden', paddingVertical: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  body: { paddingHorizontal: 16, marginTop: 12 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 72 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: 16, marginTop: 2 },
  foot: { marginTop: 12, paddingTop: 12, paddingHorizontal: 16, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  ask: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 14 },
  promiseIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, padding: 10, borderRadius: 12 },
});
