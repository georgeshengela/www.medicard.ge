import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { learningBadgeExplain, learningBadgeText, statsLearningChip } from '@/lib/cycleForecastCopy';
import { useCycleColors } from '@/theme/cycle';

/**
 * The quiet badge that stands where fertile days would be until 3 cycles are counted (brief §8.2 item 9,
 * §9 item 13): „ვსწავლობთ შენს რიტმს · 2/3 ციკლი“ with three small progress dots. Calm ink, never a
 * warning; the dots fill in the fertile turquoise as cycles are completed.
 */
export function CycleLearningBadge({
  done,
  required = 3,
  align = 'center',
  surface,
  compact = false,
}: {
  done: number;
  required?: number;
  align?: 'center' | 'flex-start';
  /** Pill fill; defaults to the cycle `cardSoft` (pass the page canvas when the badge sits on it). */
  surface?: string;
  /** Short text („ვსწავლობთ · 2/3“) for narrow rows such as the stats card footer. */
  compact?: boolean;
}) {
  const c = useCycleColors();
  const text = compact ? statsLearningChip(done, required) : learningBadgeText(done, required);
  return (
    <View
      accessible
      accessibilityLabel={`${text}. ${learningBadgeExplain(required)}`}
      style={[s.pill, { backgroundColor: surface ?? c.cardSoft, alignSelf: align }]}
    >
      <View style={s.dots} importantForAccessibility="no" accessibilityElementsHidden>
        {Array.from({ length: required }, (_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i < done ? { backgroundColor: c.fertile } : { borderWidth: 1.2, borderColor: c.mutedSoft, borderStyle: 'dashed' },
            ]}
          />
        ))}
      </View>
      <Text numberOfLines={2} style={[s.text, { color: c.muted }]}>
        {text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, maxWidth: '100%' },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { flexShrink: 1, fontSize: 12.5, lineHeight: 17, fontFamily: 'NotoSansGeorgian_600SemiBold' },
});
