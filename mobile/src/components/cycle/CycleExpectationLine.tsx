import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCycleColors } from '@/theme/cycle';

/**
 * One quiet line under a cycle hero (brief §8.5): „სპაზმები დღეს სავარაუდოა — ბოლო 3 ციკლიდან 2-ში ამ
 * დღეებში გქონდა“. A small dashed ring leads it — the calendar's grammar for an estimate — and the
 * text stays in the muted ink, never a badge, never a card. `cycleExpectations` writes the sentence.
 */
export function CycleExpectationLine({ text, color, align = 'center' }: { text: string; color?: string; align?: 'center' | 'left' }) {
  const c = useCycleColors();
  const ink = color ?? c.muted;
  return (
    <View style={[s.row, align === 'center' ? s.center : null]}>
      <View style={[s.ring, { borderColor: ink }]} />
      <Text style={[s.text, { color: ink, textAlign: align }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, alignSelf: 'stretch', paddingHorizontal: 6 },
  center: { justifyContent: 'center' },
  ring: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 4 },
  text: { flexShrink: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17 },
});
