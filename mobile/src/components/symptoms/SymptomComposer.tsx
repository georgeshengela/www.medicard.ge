import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowRight, PersonStanding } from 'lucide-react-native';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';

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
 * The typed path's footer (owner 2026-10-04: compact): the body map one tap away, then
 * „გაგრძელება · N“. With nothing picked yet the button puts the cursor in the search field.
 */
export function SymptomComposer({ count, onFocusInput, onContinue, onAnatomy, disabled }: Props) {
  const T = useFigmaSymptoms();
  const label = count ? `${ka.common.continue} · ${count}` : tx('ჩაწერე ან აირჩიე სიმპტომი', 'Type or pick a symptom');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: T.canvas }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ka.symptoms.browseAnatomy}
        onPress={onAnatomy}
        style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: T.white, alignItems: 'center', justifyContent: 'center' }}
      >
        <PersonStanding size={22} color={T.brand} strokeWidth={1.9} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={disabled ? onFocusInput : onContinue}
        style={{
          flex: 1,
          minHeight: 48,
          borderRadius: 24,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: disabled ? T.white : T.brandDark,
        }}
      >
        <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: disabled ? T.textSecondary : '#FFFFFF', flexShrink: 1 }}>
          {label}
        </Text>
        {disabled ? null : <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.2} />}
      </Pressable>
    </View>
  );
}
