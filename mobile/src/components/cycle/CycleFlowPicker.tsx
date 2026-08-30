import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
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
};

export function CycleFlowPicker({ value, onChange, disabled }: Props) {
  const c = useCycleColors();
  return (
    <CycleCard padded={false} style={{ padding: 12, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row' }}>
        {FLOW_OPTIONS.map((opt, index) => {
          const selected = value === opt.id;
          const level = FLOW_LEVEL[opt.id] ?? 0;
          return (
            <View
              key={opt.id}
              style={{
                flex: 1,
                marginLeft: index === 0 ? 0 : 6,
                alignItems: 'center',
              }}
            >
              <Pressable
                disabled={disabled}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  onChange(opt.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                accessibilityState={{ selected, disabled: Boolean(disabled) }}
                style={{
                  width: '100%',
                  borderRadius: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 4,
                  alignItems: 'center',
                  backgroundColor: selected ? c.period : c.cardSoft,
                  borderWidth: selected ? 2 : 1.5,
                  borderColor: selected ? c.ink : c.border,
                  minHeight: 88,
                  justifyContent: 'center',
                }}
              >
                {selected ? (
                  <View style={{ position: 'absolute', top: 6, right: 6 }}>
                    <Check size={12} color={c.white} strokeWidth={3} />
                  </View>
                ) : null}
                <View style={{ height: 36, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {level === 0 ? (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        borderWidth: 2,
                        borderColor: selected ? c.white : c.mutedSoft,
                      }}
                    />
                  ) : (
                    Array.from({ length: level }).map((_, i) => (
                      <View
                        key={i}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: selected ? c.white : c.period,
                          opacity: selected ? 1 : 0.35 + i * 0.15,
                          marginBottom: 3,
                        }}
                      />
                    ))
                  )}
                </View>
              </Pressable>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  fontFamily: selected ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium',
                  color: selected ? c.period : c.muted,
                  textAlign: 'center',
                  lineHeight: 13,
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
        {ka.cycle.flowPickerHint}
      </Text>
    </CycleCard>
  );
}
