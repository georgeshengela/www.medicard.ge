import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Phone, Stethoscope } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB } from '@/theme/hub';

/**
 * The last line of Home (owner 2026-10-12: the yellow „ეს არ არის დიაგნოზი“ box read as a warning about
 * nothing on a page that diagnoses nothing). One calm row instead: what MEDICARD is not, and where to
 * go when it is serious — 112 opens the phone's dialer (the OS asks before it calls).
 */
export function HomeCareNote() {
  const c = useThemeColors();
  const accent = useHomeAccent();
  return (
    <View style={[s.row, { backgroundColor: c.surface }]}>
      <View style={[s.icon, { backgroundColor: accent.tint }]}>
        <Stethoscope size={17} color={accent.ink} strokeWidth={2} />
      </View>
      <View style={s.words}>
        <Text style={[s.title, { color: c.text100 }]}>
          {tx('MEDICARD ექიმს არ ცვლის', 'MEDICARD doesn’t replace your doctor')}
        </Text>
        <Text style={[s.sub, { color: c.text200 }]}>{tx('გადაუდებელ შემთხვევაში', 'In an emergency')}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx('გადაუდებელი დახმარება 112', 'Emergency 112')}
        onPress={() => void Linking.openURL('tel:112').catch(() => {})}
        style={[s.call, { backgroundColor: accent.soft }]}
      >
        <Phone size={14} color={accent.ink} strokeWidth={2.4} />
        <Text style={[s.callText, { color: accent.ink }]}>112</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: HUB.cardRadius, paddingVertical: 12, paddingLeft: 12, paddingRight: 12 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  words: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18 },
  sub: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 16 },
  call: { minHeight: 36, borderRadius: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  callText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 18, fontVariant: ['tabular-nums'] },
});
