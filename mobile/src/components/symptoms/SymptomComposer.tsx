import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ArrowRight } from 'lucide-react-native';
import { BODY_PART_ICON_SVG } from '@/constants/bodyPartIconSvg';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { useThemeColors } from '@/theme/colors';
import { useToneAccent } from '@/theme/homeAccent';

type Props = {
  /** How many symptoms are picked (shown on the button). */
  count: number;
  onFocusInput: () => void;
  /** Moves on to the details (duration, pain …) before the analysis. */
  onContinue: () => void;
  onAnatomy: () => void;
  disabled?: boolean;
};

/**
 * The typed path's footer (owner 2026-10-04: compact; 2026-10-12: in the app's look): the body map one
 * tap away as a square module button, then „გაგრძელება · N“ in the accent. With nothing picked yet the
 * button puts the cursor in the search field.
 */
export function SymptomComposer({ count, onFocusInput, onContinue, onAnatomy, disabled }: Props) {
  const c = useThemeColors();
  const accent = useToneAccent();
  const label = count ? `${ka.common.continue} · ${count}` : tx('ჩაწერე ან აირჩიე სიმპტომი', 'Type or pick a symptom');
  return (
    <View style={[s.bar, { backgroundColor: c.bg100 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ka.symptoms.browseAnatomy}
        onPress={onAnatomy}
        style={[s.body, { backgroundColor: c.surface }]}
      >
        <SvgXml xml={BODY_PART_ICON_SVG.body} width={24} height={24} color={accent.ink} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={disabled ? onFocusInput : onContinue}
        style={[s.cta, { backgroundColor: disabled ? c.surface : accent.cta }]}
      >
        <Text numberOfLines={1} style={[s.ctaText, { color: disabled ? c.text200 : accent.onCta }]}>
          {label}
        </Text>
        {disabled ? null : <ArrowRight size={18} color={accent.onCta} strokeWidth={2.2} />}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  body: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cta: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 20, flexShrink: 1 },
});
