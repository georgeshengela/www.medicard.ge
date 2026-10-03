import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { HomeMediOrb } from '@/components/home/HomeMediOrb';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { useHomeAccent } from '@/theme/homeAccent';
import { useFeature } from '@/lib/featureFlags';

/**
 * One line to Medi. Reads as an input, behaves as a door: tapping anywhere
 * opens the conversation canvas, where voice and typing both live.
 */
export function HomeAskMedi({ onPress }: { onPress: () => void }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const voice = useFeature('voice');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tx('Medi — ჰკითხე, ჩაწერე ან დაგეგმე', 'Medi — ask, log or plan')}
      onPress={onPress}
      style={[s.bar, { backgroundColor: c.surface, borderColor: c.bg300 }]}
    >
      <Sparkles size={18} color={accent.ink} strokeWidth={2} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[s.placeholder, { color: c.text100 }]}>
          {tx('ჰკითხე Medi-ს', 'Ask Medi')}
        </Text>
        <Text numberOfLines={1} style={[s.hint, { color: c.text300 }]}>
          {voice ? tx('ხმით ან ტექსტით', 'By voice or text') : tx('ტექსტით', 'By text')}
        </Text>
      </View>
      <HomeMediOrb size={46} background={accent.soft} ringColor={accent.ring} iconColor={accent.ink} voice={voice} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 30,
    borderWidth: 1,
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 7,
    minHeight: 60,
  },
  placeholder: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 15,
    lineHeight: 21,
  },
  hint: {
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 11,
    lineHeight: 15,
  },
});
