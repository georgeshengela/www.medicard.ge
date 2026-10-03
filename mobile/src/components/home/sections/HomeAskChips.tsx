import React, { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { HeartHandshake } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { prepareCycleAskMedi } from '@/lib/cycleAskMediLaunch';
import { peekCycleView } from '@/lib/cycleViewCache';
import { useFeature } from '@/lib/featureFlags';
import { tx } from '@/i18n/locale';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB } from '@/theme/hub';

/**
 * Questions women ask most, one tap from the „ჰკითხე Medi-ს“ bar (women's Home). A chip only puts
 * its question into the consultation's input — nothing is sent until she presses send, so the AI
 * consent flow of that screen stays the only way anything reaches the model. The questions are the
 * same for everyone: nothing in them is derived from her cycle or her logs.
 *
 * W2-8: the tap also puts today's cycle context aside in memory (`prepareCycleAskMedi` — day, phase
 * estimate, what's ahead, today's pain and moods; never intimate fields, nothing while the cycle lock,
 * privacy mode or discreet notifications are on). The consultation shows it as a removable chip and
 * sends it only with her first question, after AI consent. The question waits in memory too; the
 * route carries only the `handoff=1` marker (W2-8b).
 */
const QUESTIONS: string[] = [
  tx('რა მეხმარება მენსტრუაციის ტკივილისას?', 'What helps with period pain?'),
  tx('რა არის PMS და როგორ შევიმსუბუქო?', 'What is PMS and how can I ease it?'),
  tx('რატომ შეიძლება დაგვიანდეს მენსტრუაცია?', 'Why might my period be late?'),
  tx('რა ვჭამო ციკლის სხვადასხვა ფაზაში?', 'What should I eat in each cycle phase?'),
];

/**
 * `community`: the women's space entry is allowed — the row then starts with „ჰკითხე სხვა ქალებს“,
 * which opens the space's composer (empty: no question or health text travels between screens).
 */
export function HomeAskChips({ community = false }: { community?: boolean } = {}) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const router = useRouter();
  const { user } = useAuth();
  const cycleOn = useFeature('cycle');
  const opening = useRef(false);
  const ask = async (question: string) => {
    if (opening.current) return;
    opening.current = true;
    try {
      // Read once at the tap (Home keeps one subscriber per query key); the Home only caches the
      // view while the cycle lock is off.
      const bundle = cycleOn ? (peekCycleView()?.display ?? null) : null;
      router.push((await prepareCycleAskMedi(user?.id, bundle, question)) as never);
    } finally {
      opening.current = false;
    }
  };
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      style={s.scroller}
      contentContainerStyle={s.content}
    >
      {community ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('ჰკითხე სხვა ქალებს — ქალების სივრცე', 'Ask other women — Women’s space')}
          hitSlop={{ top: 4, bottom: 4 }}
          onPress={() => router.push('/community?compose=1' as never)}
          style={[s.chip, s.communityChip, { backgroundColor: accent.soft, borderColor: accent.soft }]}
        >
          <HeartHandshake size={15} color={accent.ink} strokeWidth={2} />
          <Text numberOfLines={1} style={[s.text, { color: accent.ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>
            {tx('ჰკითხე სხვა ქალებს', 'Ask other women')}
          </Text>
        </Pressable>
      ) : null}
      {QUESTIONS.map((question) => (
        <Pressable
          key={question}
          accessibilityRole="button"
          accessibilityLabel={tx(`ჰკითხე Medi-ს: ${question}`, `Ask Medi: ${question}`)}
          hitSlop={{ top: 4, bottom: 4 }}
          onPress={() => void ask(question)}
          style={[s.chip, { backgroundColor: c.surface, borderColor: c.bg300 }]}
        >
          <Text numberOfLines={1} style={[s.text, { color: c.text100 }]}>
            {question}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroller: { marginHorizontal: -HUB.gutter, marginTop: 10 },
  content: { paddingHorizontal: HUB.gutter, gap: 8 },
  chip: { minHeight: 40, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  communityChip: { flexDirection: 'row', gap: 6 },
  text: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18 },
});
