import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { mediRoute } from '@/lib/mediModes';
import { tx } from '@/i18n/locale';
import { useThemeColors } from '@/theme/colors';
import { HUB } from '@/theme/hub';

/**
 * Questions women ask most, one tap from the „ჰკითხე Medi-ს“ bar (women's Home). A chip only puts
 * its question into the consultation's input — nothing is sent until she presses send, so the AI
 * consent flow of that screen stays the only way anything reaches the model. The questions are the
 * same for everyone: nothing here is derived from her cycle or her logs.
 */
const QUESTIONS: string[] = [
  tx('რა მეხმარება მენსტრუაციის ტკივილისას?', 'What helps with period pain?'),
  tx('რა არის PMS და როგორ შევიმსუბუქო?', 'What is PMS and how can I ease it?'),
  tx('რატომ შეიძლება დაგვიანდეს მენსტრუაცია?', 'Why might my period be late?'),
  tx('რა ვჭამო ციკლის სხვადასხვა ფაზაში?', 'What should I eat in each cycle phase?'),
];

export function HomeAskChips() {
  const c = useThemeColors();
  const router = useRouter();
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      style={s.scroller}
      contentContainerStyle={s.content}
    >
      {QUESTIONS.map((question) => (
        <Pressable
          key={question}
          accessibilityRole="button"
          accessibilityLabel={tx(`ჰკითხე Medi-ს: ${question}`, `Ask Medi: ${question}`)}
          hitSlop={{ top: 4, bottom: 4 }}
          onPress={() => router.push(mediRoute({ mode: 'doctor', prefill: question }) as never)}
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
  text: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18 },
});
