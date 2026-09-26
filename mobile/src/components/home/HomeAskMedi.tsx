import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { HomeMediOrb } from '@/components/home/HomeMediOrb';
import { useThemeColors } from '@/theme/colors';

/**
 * One line to Medi. Reads as an input, behaves as a door: tapping anywhere
 * opens the conversation canvas, where voice and typing both live.
 */
export function HomeAskMedi({ onPress }: { onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="მედი — ჰკითხე, ჩაწერე ან დაგეგმე"
      onPress={onPress}
      style={[s.bar, { backgroundColor: c.surface, borderColor: c.bg300 }]}
    >
      <Sparkles size={18} color={c.primary100} strokeWidth={2} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[s.placeholder, { color: c.text100 }]}>
          ჰკითხე მედის
        </Text>
        <Text numberOfLines={1} style={[s.hint, { color: c.text300 }]}>
          ხმით ან ტექსტით
        </Text>
      </View>
      <HomeMediOrb size={46} background={c.accent100} ringColor={c.primary200} iconColor={c.primary100} />
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
