import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CycleFlowGlyph } from './CycleFlowGlyph';
import { Check } from 'lucide-react-native';
import { FLOW_OPTIONS } from '@/constants/cycle';
import { CycleCard } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

const FLOW_LEVEL: Record<string, number> = {
  none: 0,
  spotting: 1,
  light: 2,
  medium: 3,
  heavy: 4,
};

type Props = {
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  options?: { id: string; label: string }[];
  hint?: string;
};

export function CycleFlowPicker({ value, onChange, disabled, options, hint }: Props) {
  const c = useCycleColors();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale >= 1.25;
  const items = options || FLOW_OPTIONS;
  return (
    <CycleCard padded={false} style={{ padding: 8, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: compact ? 8 : 6 }}>
        {items.map((opt) => {
          const selected = value === opt.id;
          const level = FLOW_LEVEL[opt.id] ?? 0;
          return (
            <View
              key={opt.id}
              style={{
                flex: compact ? undefined : 1,
                width: compact ? '30%' : undefined,
                alignItems: 'center',
              }}
            >
              <Pressable
                disabled={disabled}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  onChange(opt.id);
                }}
                accessibilityRole="radio"
                accessibilityLabel={opt.label}
                accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
                style={{
                  width: '100%',
                  borderRadius: 14,
                  paddingVertical: 8,
                  paddingHorizontal: 4,
                  alignItems: 'center',
                  backgroundColor: selected ? c.accentSoft : c.cardSoft,
                  borderWidth: 1,
                  borderColor: selected ? c.brand : c.controlBorder,
                  minHeight: 60,
                  justifyContent: 'center',
                }}
              >
                {selected ? (
                  <View style={{ position: 'absolute', top: 6, right: 6 }}>
                    <Check size={12} color={c.brand} strokeWidth={3} />
                  </View>
                ) : null}
                <CycleFlowGlyph level={level} selected={selected}/>
              </Pressable>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  fontFamily: selected ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium',
                  color: selected ? c.brand : c.muted,
                  textAlign: 'center',
                  lineHeight: 16,
                }}
                numberOfLines={2}
              >
                {opt.label}
              </Text>
            </View>
          );
        })}
      </View>
      <Text
        style={{
          color: c.mutedSoft,
          fontSize: 11,
          marginTop: 10,
          textAlign: 'center',
          fontFamily: 'NotoSansGeorgian_400Regular',
        }}
      >
        {hint ?? ka.cycle.flowPickerHint}
      </Text>
    </CycleCard>
  );
}
