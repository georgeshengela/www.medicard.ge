import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import { MEDI_MODES, type MediMode } from '@/lib/mediModes';
import { useThemeColors } from '@/theme/colors';

/** The three ways to talk to Medi, on one screen. Segmented, 44pt targets, no extra screens. */
export function MediModeSwitch({ value, onChange }: { value: MediMode; onChange: (mode: MediMode) => void }) {
  const c = useThemeColors();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, marginHorizontal: 16, marginBottom: 10, padding: 4, borderRadius: 16, backgroundColor: c.bg200 }}>
      {MEDI_MODES.map((mode) => {
        const active = mode === value;
        return (
          <Pressable
            key={mode}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={ka.chat.mediModes[mode]}
            onPress={() => { if (!active) onChange(mode); }}
            style={{ flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: active ? c.surface : 'transparent' }}
          >
            <Text numberOfLines={1} style={{ fontFamily: active ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_400Regular', fontSize: 13, color: active ? c.text100 : c.text200 }}>
              {ka.chat.mediModes[mode]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
