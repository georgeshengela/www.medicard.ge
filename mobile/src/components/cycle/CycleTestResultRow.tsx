import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CYCLE_TEST_OPTIONS } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  value: string | null;
  onChange: (next: string | null) => void;
  accent?: string;
};

export function CycleTestResultRow({ value, onChange, accent }: Props) {
  const c = useCycleColors();
  const color = accent ?? c.brand;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {CYCLE_TEST_OPTIONS.map((opt) => {
        const on = value === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              onChange(on ? null : opt.id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${opt.label}${on ? `, ${ka.cycle.logSelected}` : ''}`}
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 14,
              justifyContent: 'center',
              backgroundColor: on ? color : c.cardSoft,
              borderWidth: on ? 0 : 1,
              borderColor: c.border,
            }}
          >
            <Text
              style={{
                color: on ? c.white : c.ink,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 13,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
